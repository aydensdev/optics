import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GUI } from './dat.gui.module.js'
import Stats from "./stats.module.js";

const DEG_TO_RAD = (deg) => deg*Math.PI/180;

var config = 
{
    percentWidth: 0.7,
    camX: -1,
    camHeight: -0.2,
	camDistance: 5,
	camAngleX: 0.5,
	rotateSpeed: 0,

    lensX: 0.0,
    lensRadius: 1.7,
    lensDiameter: 2,
    focalLength: 0,
    refractionIndex: 1.5,
    bunnyDist: 1.8,
    objectID: 0,
}

var stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);
stats.dom.id = "stats";

const canvas = document.getElementById("canvas");
const scene = new THREE.Scene();

const perspectiveCamera = new THREE.PerspectiveCamera( 60, 0, 0.1, 1000 );
let camera = perspectiveCamera;

const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: canvas });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const orbiter = new OrbitControls( camera, renderer.domElement );

// Secondary camera for equation view

let orthoSize = 2.7;
const orthoCamera = new THREE.OrthographicCamera();
function setCamOrtho()
{  
    let aspect = window.innerWidth*config.percentWidth / window.innerHeight;
    orthoCamera.left = -orthoSize * aspect;
    orthoCamera.right = orthoSize * aspect;
    orthoCamera.top = orthoSize;
    orthoCamera.bottom = -orthoSize;
    orthoCamera.updateProjectionMatrix();

    camera = orthoCamera;
    camera.position.set(config.camX, config.camHeight, config.camDistance);
}

const overlay = document.getElementById('overlay');
const ctx = overlay.getContext('2d');

function worldToScreen(position) {
    const vector = position.clone()
        .project(camera);
  
    const x = (vector.x * 0.5 + 0.5) * overlay.width;
    const y = (1 - (vector.y * 0.5 + 0.5)) * overlay.height;
  
    return [x, y];
}

function drawOverlay()
{
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.beginPath();
    ctx.moveTo(...worldToScreen(new THREE.Vector3(0, 0, 0)));
    ctx.lineTo(...worldToScreen(new THREE.Vector3(-config.bunnyDist/2.7, 0.5, 0)));
    ctx.strokeStyle = "red";
    ctx.lineWidth = 5;
    ctx.stroke();
}

// A Cube Camera for reflection and refraction simulation

const renderTarget = new THREE.WebGLCubeRenderTarget(1024, {
    format: THREE.RGBAFormat,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
});
const cubeCamera = new THREE.CubeCamera(0.01, 100, renderTarget);

// Set up scene objects

const skyboxMesh = new THREE.Mesh(
    new THREE.SphereGeometry(20, 32, 32), 
    new THREE.MeshBasicMaterial({
        map: null, // To be assigned when HDR loads
        side: THREE.BackSide
    }),
);
skyboxMesh.rotateY(DEG_TO_RAD(160))
scene.add(skyboxMesh);

new RGBELoader().load('./assets/lab4k.hdr', (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;
    skyboxMesh.material.map = texture;
    skyboxMesh.material.needsUpdate = true;
});

const shaderCode = await (await fetch("./modules/refraction.frag")).text();
const lensMaterial = new THREE.ShaderMaterial({
    uniforms: {
        sceneTexture: { value: null }, // This is the scene texture
        focalLength: { value: 1.0 }, // Focal length
        cameraPos: { value: new THREE.Vector3() }, // Camera position
        lensPos: { value: new THREE.Vector3(config.lensX, 0, 0) }, // Lens position
        isConcave: { value: false }, // Is the lens concave?
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
    fragmentShader: shaderCode,
    side: THREE.DoubleSide,
});

let lensMesh = null;
function createLensMesh(isConcave) 
{   
    if (config.lensDiameter >= config.lensRadius*2) return;
 
    let radius = config.lensRadius;
    let diameter = config.lensDiameter;
    let isMirror = config.objectID == 2 || config.objectID == 3;

    const theta = Math.asin(diameter / (2 * radius));
    const offset = Math.sqrt(radius**2 - (diameter / 2)**2);
    const offset2 = radius - offset;

    var frontGeo = new THREE.SphereGeometry(radius, 64, 32, 0, 2 * Math.PI, 0, theta);
    const backGeo = new THREE.SphereGeometry(radius, 64, 32, 0, 2 * Math.PI, 0, theta);

    frontGeo.translate(0, -offset, 0);
    backGeo.translate(0, -offset, 0);

    if (isConcave)
    {
        frontGeo.translate(0, -offset2, 0);
        backGeo.translate(0, -offset2, 0);

        frontGeo = mergeGeometries([
            frontGeo, 
            new THREE.CylinderGeometry(
                diameter/2, diameter/2, 2*offset2, 64, 1, true
            )
        ]);
    }

    frontGeo.rotateZ(DEG_TO_RAD(-90));
    backGeo.rotateZ(DEG_TO_RAD(90));

    frontGeo.translate(config.lensX, 0, 0);
    backGeo.translate(config.lensX, 0, 0);

    const geometry = mergeGeometries([frontGeo, backGeo]);

    let mat = lensMaterial;
    if (isMirror)
    {
        mat = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color('white'),
            roughness: 0.0,
            metalness: 1.0,
            side: THREE.DoubleSide,
            envMap: renderTarget.texture,
        })
    }

    // Create mesh or just refresh it

    if (!lensMesh) 
    {
        lensMesh = new THREE.Mesh(geometry, mat);
        lensMesh.position.set(config.lensX, 0, 0);
        lensMesh.add(cubeCamera)
        scene.add(lensMesh);
    }

    lensMesh.geometry.dispose();
    lensMesh.geometry = geometry;
    lensMesh.material = mat;
    lensMesh.material.needsUpdate = true;
}

createLensMesh();

var bunny;

new GLTFLoader().load("./assets/scene.gltf", object =>
{
    bunny = object.scene;
    bunny.scale.multiplyScalar(8.0)
    bunny.rotateY(DEG_TO_RAD(45));
    scene.add(bunny);
    refresh();
})

// Render function

const display = document.getElementById("LOST");
function updateDisplay()
{
	let dO = config.bunnyDist;
	var dI = (dO*config.focalLength)/(Math.abs(dO)-config.focalLength);
	var hI = -0.6*dI/dO; //bunny height approx 0.6?
	var orientation = (hI>0 ? "Upright" : "Inverted");
	var type = (Math.sign(dO)==Math.sign(dI)? "Virtual" : "Real");
	display.innerHTML = 
	`<br>
        <b>Location</b>: ${Math.round(100*dI)/100} <b>Orientation</b>: ${orientation}
	<br><b>Size</b>: ${Math.round(100*hI)/100} <b>Type</b>: ${type} <b>F</b>: ${config.focalLength}`;
}

function render(timestamp)
{   
    stats.begin();
    orbiter.update();

    // Hide lens mesh while rendering the scene to the texture
    lensMesh.visible = false; 
    cubeCamera.position.copy(lensMesh.position);
    cubeCamera.update(renderer, scene);
    lensMesh.visible = true;

    // Update uniforms
    lensMaterial.uniforms.cameraPos.value.copy(camera.position);
    lensMaterial.uniforms.lensPos.value.copy(lensMesh.position);
    lensMaterial.uniforms.sceneTexture.value = renderTarget.texture;
	
    // Render final scene
    renderer.clear(); 
    renderer.render(scene, camera);

    updateDisplay();
    //drawOverlay();

    stats.end();
    requestAnimationFrame(render);
}

// User interaction handling

function refresh()
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

    let isConcave = config.objectID == 1 || config.objectID == 3;
    config.focalLength = (isConcave?-1:1)*config.lensRadius/(2.0*(config.refractionIndex - 1.0));
    lensMaterial.uniforms.focalLength.value = config.focalLength;
	lensMaterial.uniforms.isConcave.value = isConcave;
    createLensMesh(isConcave);
    
    // Update shader uniforms
    bunny.position.set(-config.bunnyDist, -1.0, 0);
}

const gui = new GUI()
gui.domElement.id = 'gui';

gui.add(config, 'lensRadius', 0.1, 5).onChange(refresh).name('Lens Radius');
gui.add(config, 'lensDiameter', 0.1, 10).onChange(refresh).name('Lens Diameter');
gui.add(config, 'refractionIndex', 1.0, 2.417).onChange(refresh).name('Lens Strength');
gui.add(config, 'bunnyDist', 0.0, 35.0).onChange(refresh).name('Object Distance');
gui.add(config, 'camDistance', 0.0, 30.0).onChange(refresh).name('Camera Distance');

gui.add(config, 'objectID', {
    "Convex Lens": 0, 
    "Concave Lens": 1,
    "Convex Mirror": 2,
    "Concave Mirror": 3,
}).onChange(refresh).name('Simulation Type');

gui.add({ add:setCamOrtho }, 'add').name('Standard View');

orbiter.addEventListener('start', () =>
{   
    if (!camera.isPerspectiveCamera)
    {
        camera = perspectiveCamera;
        camera.position.set(0, config.camHeight, config.camDistance);
        onWindowResize();
    }
});

function onWindowResize() 
{
	let width = window.innerWidth*config.percentWidth;
	let height = window.innerHeight;

    overlay.width = window.innerWidth;
    overlay.height = height;

	camera.aspect = width / height;
	camera.updateProjectionMatrix();

    if (!camera.isPerspectiveCamera) setCamOrtho();
        
	renderer.setSize(width, height);
}

window.addEventListener('resize', onWindowResize);

onWindowResize();
setCamOrtho();
render();
