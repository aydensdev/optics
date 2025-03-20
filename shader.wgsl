// This file holds the fragment shader and raymarching
// algorithm. It also contains scene data and SDFs.

struct VertexOut
{
    @builtin(position) pos : vec4<f32>,
    @location(0) uv: vec2<f32>
}

struct Camera
{
    position: vec3<f32>,
    right: vec3<f32>,
    up: vec3<f32>,
    forward: vec3<f32>,
    uv_to_plane: vec3<f32>,
    frame: vec3<f32>
}

@binding(0) @group(0) var<uniform> cam : Camera;

@vertex

fn vertMain(@builtin(vertex_index) VertexIndex: u32) -> VertexOut
{
    // Streched triangle covers screen

    var pos = array<vec2<f32>, 3>
    (
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 3.0, -1.0),
        vec2<f32>(-1.0,  3.0)
    );

    // UV coordinates for each vertex (maps from 0-1 on screen)

    var uvs = array<vec2<f32>, 3>
    (
        vec2<f32>(0.0, 0.0),
        vec2<f32>(2.0, 0.0),
        vec2<f32>(0.0, 2.0)
    );

    var output: VertexOut;
    output.pos = vec4<f32>(pos[VertexIndex], 0.0, 1.0);
    output.uv = uvs[VertexIndex];
    return output;
}

fn Sphere(p: vec3<f32>, o: vec3<f32>, r: f32) -> f32
{
    return length(p-o)-r;
}

fn Box(p: vec3<f32>, b: vec3<f32>, o: vec3<f32>, r: f32) -> f32
{
    var q = abs(p-o) - b + r;
    return length(max(q,vec3(0.0))) + min(max(q.x,max(q.y,q.z)),0.0) - r;
}

fn Torus(p: vec3<f32>, o: vec3<f32>, tx: f32, ty: f32) -> f32
{
  var q = vec2(length(p.xy)-tx,p.z);
  return length(q)-ty;
}

fn SmoothUnion( d1: f32, d2: f32, k: f32 ) -> f32
{
    var h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h);
}

fn SceneSDF(p: vec3<f32>) -> f32
{
    // var s1 = Sphere(p, vec3(0.93, 0.0, 0.0), 1.0);
    // var s2 = Sphere(p, vec3(-0.93, 0.0, 0.0), 1.0);
    // var balls = SmoothUnion(s1, s2, 0.6);

    var b1 = Box(p, vec3(0.6), vec3(0.0, -1.0, 0.0), 0.1);
    var t1 = Torus(p, vec3(0.0, 2.1, 0.0), 0.4, 0.2);

    return SmoothUnion(b1, t1, 0.3);
}

fn CalcNormal(p: vec3<f32>) -> vec3<f32>
{
    let ep = 0.0001;

    var v1 = vec3
    (
        SceneSDF(p + vec3(ep, 0.0, 0.0)),
        SceneSDF(p + vec3(0.0, ep, 0.0)),
        SceneSDF(p + vec3(0.0, 0.0, ep))
    );

    var v2 = vec3
    (
        SceneSDF(p - vec3(ep, 0.0, 0.0)),
        SceneSDF(p - vec3(0.0, ep, 0.0)),
        SceneSDF(p - vec3(0.0, 0.0, ep))
    );

    return normalize(v1-v2);
}

@fragment

fn fragMain(FragCoord: VertexOut) -> @location(0) vec4<f32> 
{
    // find the corresponding point on the screen
    // transform the screen such that it is in world space

    var vp = vec3(FragCoord.uv-vec2(0.5), 1.0) * cam.uv_to_plane;
    vp = cam.position + cam.right * vp.x + cam.up * vp.y + cam.forward * vp.z;
    var dir = normalize(vp - cam.position);

    // Raymarch

    var i = 0;
    var max_iter = 200; 
 
    var p = cam.position;
    var dst: f32;
    var c = vec3(0.106, 0.137, 0.275);

    while (true)
    {
        dst = SceneSDF(p);

        // ray hit scene

        if (dst <= 0.001) 
        { 
            var norm = CalcNormal(p);

            var lightDir = normalize(vec3(1.0, 1.0, 0.0));
            var baseColor = vec3(0.19, 0.09, 0.25);
            var d = clamp(dot(norm, lightDir), 0.0, 1.0);

            c = baseColor + d * vec3(0.3, 0.0, 0.3);
            c += vec3(pow(f32(i)/50.0, 2.0));
            break;
        }

        // ray escaped

        if (i == max_iter || length(p) > 30.0)
        {
            c += vec3(pow(f32(i)/50.0, 2.0));
            break;
        }

        p += dir * dst;
        i++;
    }

    // Narkowicz 2015, "ACES Filmic Tone Mapping Curve"

    var mapped = (c*(2.51*c + 0.03)) / (c*(2.43*c + 0.59 ) + 0.14);
    return vec4<f32>(clamp(mapped, vec3(0.0), vec3(1.0)), 1.0);
}