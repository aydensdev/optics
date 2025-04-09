uniform sampler2D sceneTexture;
uniform float refractionIndex;
uniform float focalLength;
uniform vec3 cameraPos;
uniform mat4 projectionMatrix;
uniform mat4 viewMat;

varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() 
{
    vec3 incidentRay = vWorldPosition - cameraPos;

    // TODO: Compute refracted direction
    vec3 refractedRay = normalize(incidentRay);

    // Convert refracted direction to screen space
    vec4 projected = projectionMatrix * viewMat * vec4(vWorldPosition + refractedRay, 1.0);
    vec2 uv = projected.xy / projected.w * 0.5 + 0.5; // Correct UV mapping

    // Ensure UV coordinates stay in valid range
    uv = clamp(uv, 0.0, 1.0);

    // Sample texture
    vec3 refractionColor = texture(sceneTexture, uv).rgb;
    gl_FragColor = vec4(pow(refractionColor, vec3(1.0 / 2.15)), 1.0);
}