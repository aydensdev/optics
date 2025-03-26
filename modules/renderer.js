// This file will handle 3D rendering of the scene. 
// It is dependant on main.js for simulation information.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GUI } from './dat.gui.module.js'

const DEG_TO_RAD = Math.PI/180;
const pw = 0.6;
const camY = 0;

var config = 
{
	camHeight: 0,
	camDistance: 5,
	camAngleX: 0.5,
	rotateSpeed: 0,
	planeRadius: 0.1,
	ambStrength: 0, 
	dirStrength: 0,
	lightColor: '#ffffff',
	objColor: 0x3966a8,
    lensRadius: 1.7,
    lensDiameter: 2,
    refractionIndex: 1.5,
    bunnyDist: 1.0,
}

// Create scene and camera

const canvas = document.querySelector("canvas");
const scene = new THREE.Scene();

const perspectiveCamera = new THREE.PerspectiveCamera( 60, 0, 0.1, 1000 );
const orthoCamera = new THREE.OrthographicCamera();
let camera = perspectiveCamera;

function setCamOrtho()
{  
    let aspect = window.innerWidth*pw / window.innerHeight;
    let size = 2.7;
    orthoCamera.left = -size * aspect;
    orthoCamera.right = size * aspect;
    orthoCamera.top = size;
    orthoCamera.bottom = -size;
    orthoCamera.updateProjectionMatrix();

    camera = orthoCamera;
    camera.position.set(0, camY, config.camDistance);
}

const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas });
const orbiter = new OrbitControls( camera, renderer.domElement );

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;

const refractionShader = {
    uniforms: {
        sceneTexture: { value: null }, // This is the scene texture
        refractionIndex: { value: 1.6 }, // Refraction index (for glass, typically 1.5)
        focalLength: { value: 1.0 }, // Focal length
        cameraPos: { value: new THREE.Vector3() }, // Camera position
        distortionStrength: { value: 1.0 }, // Distortion strength
        projectionMatrix: { value: new THREE.Matrix4() }, // Add projection matrix
        viewMat: { value: new THREE.Matrix4() },       // Add view matrix
    },
    vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        void main() {
            vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
            vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D sceneTexture;
        uniform float refractionIndex;
        uniform vec3 cameraPos;
        uniform mat4 projectionMatrix;
        uniform mat4 viewMat;

        varying vec3 vWorldPosition;
        varying vec3 vNormal;

        void main() {

            // Compute view direction
            vec3 viewDir = normalize(vWorldPosition - cameraPos);

            // Compute refracted direction
            vec3 refractedRay = refract(viewDir, normalize(vNormal), 1.0 / refractionIndex);

            // Approximate exit refraction
            // next is sphere intersection
            // or figure out how phet does it with thin lens
            //vec3 oppositeNormal = vec3(vNormal.x, -vNormal.y, -vNormal.z);
            //refractedRay = refract(refractedRay, normalize(oppositeNormal), refractionIndex);
            //refractedRay = refract(viewDir, normalize(vNormal), 1.0 / refractionIndex);

            // Convert refracted direction to screen space
            vec4 projected = projectionMatrix * viewMat * vec4(vWorldPosition + refractedRay, 1.0);
            vec2 uv = projected.xy / projected.w * 0.5 + 0.5; // Correct UV mapping

            // Ensure UV coordinates stay in valid range
            uv = clamp(uv, 0.0, 1.0);

            // Sample texture
            vec3 refractionColor = texture(sceneTexture, uv).rgb;
            gl_FragColor = vec4(pow(refractionColor, vec3(1.0 / 2.15)), 1.0);
        }
    `
};

const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth*pw, window.innerHeight, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBFormat,
});

renderTarget.texture.colorSpace = THREE.SRGBColorSpace;
renderer.outputColorSpace = THREE.SRGBColorSpace;

console.log(renderer);

// Lens mesh and material

let lensMesh = null;
const lensX = -1.0;

const lensMaterial = new THREE.ShaderMaterial(refractionShader);

function createLensGeometry(radius, diameter) 
{
    const theta = Math.asin(diameter / (2 * radius));
    const offset = Math.sqrt(radius**2 - (diameter / 2)**2);

    const frontGeo = new THREE.SphereGeometry(radius, 64, 32, 0, 2 * Math.PI, 0, theta);
    const backGeo = new THREE.SphereGeometry(radius, 64, 32, 0, 2 * Math.PI, 0, theta);

    frontGeo.translate(0, -offset, 0);
    backGeo.translate(0, -offset, 0);

    frontGeo.rotateZ(-90 * DEG_TO_RAD);
    backGeo.rotateZ(90 * DEG_TO_RAD);

    frontGeo.translate(lensX, 0, 0);
    backGeo.translate(lensX, 0, 0);

    return mergeGeometries([frontGeo, backGeo]);
}

function createLensMesh() 
{   
    if (config.lensDiameter >= config.lensRadius*2) return;
    const geometry = createLensGeometry(config.lensRadius, config.lensDiameter);
    if (lensMesh) {
        lensMesh.geometry.dispose(); // Dispose of the old geometry
        lensMesh.geometry = geometry; // Reassign the new geometry
    } else {
        lensMesh = new THREE.Mesh(geometry, lensMaterial);
        lensMesh.position.set(2, 0, 0);
        scene.add(lensMesh);
    }
}

createLensMesh();

// Bunny
var bunny;
new GLTFLoader().load("./assets/scene.gltf", object =>
{
    bunny = object.scene;
    bunny.scale.multiplyScalar(8.0)
    bunny.position.set(-2.0, -1.0, -10);
    bunny.rotateY(45*DEG_TO_RAD);
    scene.add(bunny);
    refreshProperties();
})

// Skybox setup

const skyboxGeo = new THREE.SphereGeometry(20, 32, 32); 
const skyboxMat = new THREE.MeshBasicMaterial({
    map: null, // To be assigned when HDR loads
    side: THREE.BackSide
});
const skyboxMesh = new THREE.Mesh(skyboxGeo, skyboxMat);
skyboxMesh.rotateY(160*DEG_TO_RAD)
scene.add(skyboxMesh);

new RGBELoader().load('./assets/lab4k.hdr', (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;
    skyboxMat.map = texture;
    skyboxMat.needsUpdate = true;
});

// Render function from main.js

function render(frame, carInfo)
{   
    orbiter.update();

    // Update uniforms
    lensMaterial.uniforms.cameraPos.value.copy(camera.position);
    lensMaterial.uniforms.projectionMatrix.value.copy(camera.projectionMatrix);
    lensMaterial.uniforms.viewMat.value.copy(camera.matrixWorldInverse);

    // Hide lens mesh while rendering the scene to the texture
    lensMesh.visible = false; 

    // Render the scene to the texture
    renderer.setRenderTarget(renderTarget);
    renderer.clear();  // Clear color and depth to avoid artifacts
    renderer.render(scene, camera);

    // Set the scene texture in the shader
    lensMaterial.uniforms.sceneTexture.value = renderTarget.texture;
    lensMaterial.needsUpdate = true;

    // Show the lens mesh again for the final render
    lensMesh.visible = true;

    // Render final scene
    renderer.setRenderTarget(null);
    renderer.clear(); 
    renderer.render(scene, camera);
}

// Update object properties

function refreshProperties()
{
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.setClearColor( 0xffffff, 0);

    
    
	Object.assign(orbiter, {
		enablePan: false, enableZoom: false,
		minPolarAngle: Math.PI*0.4,
		maxPolarAngle: Math.PI*0.6,
        minDistance: config.camDistance,
        maxDistance: config.camDistance,
		autoRotate: true, 
        autoRotateSpeed: config.rotateSpeed,
	});
    //camera.updateProjectionMatrix();

    createLensMesh();
    lensMaterial.uniforms.refractionIndex.value =  config.refractionIndex;
    // lensmakers equation or sum
    lensMaterial.uniforms.focalLength.value = config.lensRadius/(2.0*(config.refractionIndex - 1.0));
    console.log(config.lensRadius/(2.0*(config.refractionIndex - 1.0)))
    bunny.position.set(-config.bunnyDist, -1.0, 0);
}

// dat.gui setup

const gui = new GUI()
gui.domElement.id = 'gui';

gui.add(config, 'lensRadius', 0.1, 5).onChange(refreshProperties);
gui.add(config, 'lensDiameter', 0.1, 2*config.lensRadius).onChange(refreshProperties);
gui.add(config, 'refractionIndex', 1.0, 2.417).onChange(refreshProperties);
gui.add(config, 'bunnyDist', 0.0, 35.0).onChange(refreshProperties);
gui.add(config, 'camDistance', 5.0, 30.0).onChange(refreshProperties);
gui.add({ add:setCamOrtho }, 'add').name('Standard View');

orbiter.addEventListener('start', () =>
{   
    if (!camera.isPerspectiveCamera)
    {
        camera = perspectiveCamera;
        
        camera.position.set(0, camY, config.camDistance);

        onWindowResize();
        
        // animateFOV(50, camera.getFocalLength(), 30)

        // function animateFOV(start, target, steps)
        // {   
        //     function ease(x)
        //     {
        //         //return -(Math.cos(Math.PI * x) - 1) / 2;
        //         return 0.5*Math.log(x)+1;
        //     };

        //     let step = 0;
        //     let interval = setInterval(() => 
        //     {
        //         camera.setFocalLength(THREE.MathUtils.lerp(start, target, ease(step/steps)));
        //         console.log(1 - Math.pow(1 - step/steps, 3))
        //         if (step == steps)
        //         {
        //             clearInterval(interval);
        //             camera.setFocalLength(target);
        //         }
        //         step++;
        //     }, 8); // Update every 16ms (approximately 60fps)
        // }
    }
});

// Handle resizing

function onWindowResize() 
{
	let width = window.innerWidth*pw;
	let height = window.innerHeight;

	camera.aspect = width / height;
	camera.updateProjectionMatrix();

    if (!camera.isPerspectiveCamera) setCamOrtho();
        
	renderer.setSize(width, height);
}

window.addEventListener('resize', onWindowResize);

// Exporting

onWindowResize();
setCamOrtho();
export { render };