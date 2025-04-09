uniform samplerCube sceneTexture;
uniform float refractionIndex;
uniform float focalLength;
uniform vec3 cameraPos;
uniform vec3 lensPos;
uniform float isConcave;

varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() 
{
    float f = focalLength * mix(1.0, -1.0, isConcave);
    vec3 d = lensPos - cameraPos;
    float di = (d.x*f)/(abs(d.x)-f);

    vec3 refractedRay = vec3(0., cameraPos.yz);
    refractedRay += mix(sign(abs(d.x)-f), -1.0, isConcave) * vec3(
        di, 
        (d.y/d.x)*(di+d.x) - vWorldPosition.y,
        (d.z/d.x)*(di+d.x) - vWorldPosition.z
    );

    vec3 refractionColor = textureCube(sceneTexture, normalize(refractedRay)).rgb;
    gl_FragColor = vec4(pow(refractionColor, vec3(0.52)), 1.0); //gamma correction
}