// This file holds the structure of the simulation
// It does not handle rendering or graphing

import { render } from "./renderer.js";
import Stats from "./stats.module.js";
import { ACESFilmicToneMapping, Vector2 } from 'three';

// util functions

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

function sind( deg )
{
	if ( deg == 180 || deg == 360 ) { return 0 };
	return Math.sin( deg * DEG_TO_RAD );
}	

function cosd( deg )
{
	if ( deg == 90 || deg == 270 ) { return 0 };
	return Math.cos( deg * DEG_TO_RAD );
}

function toVec(dir, mag)
{
	return new Vector2(sind(dir)*mag, cosd(dir)*mag);
}

function getDir(vec)
{
	let direction = Math.asin(vec.x/vec.length()) * RAD_TO_DEG;
	if (Math.abs(vec.y) != vec.y) direction = 180 - direction;
	if (direction < 0) { direction = 360+direction };
	return direction;
}

function lerpVec(vec1, vec2, t)
{
	//a + (b — a) * t
	let a = new Vector2().copy(vec1);
	let b = new Vector2().copy(vec2);

	b.sub(a); b.multiplyScalar(t);
	return a.add(b);
}

function angularDiff(dirA, dirB)
{
	let dist = Math.abs(dirA-dirB);

	if (dist > 180) 
    {
		dist = 360-dist;
		if (dirA > dirB) { dist *= -1 };
	} 
    else 
    {
		if (dirB > dirA) { dist *= -1 };
	}

	return dist;
}

// input handling 

var keysPressed = 
{
    "KeyW": false,
    "KeyA": false,
    "KeyS": false,
    "KeyD": false
}

function inputHandle(e)
{
	if (keysPressed[e.code] == undefined || e.repeat){ return };
	keysPressed[e.code] = (e.type == "keydown");
}

// initialize project

var stats = new Stats();
stats.showPanel(0);
document.body.appendChild( stats.dom );

var carPos = new Vector2();
var carVel = new Vector2();
var rotVel = 0, frontDir = 0, rearDir = 0;
document.addEventListener('keydown', inputHandle);
document.addEventListener('keyup', inputHandle);

var previous, frame = 1;
requestAnimationFrame(tick);

function tick(timestamp)
{
	let dT = timestamp - previous; 
	previous = timestamp;
	stats.begin();

	let forwardIn = (keysPressed["KeyS"] - keysPressed["KeyW"]);
	let sideIn = (keysPressed["KeyD"] - keysPressed["KeyA"]);

	if (Math.abs(carVel.x) < 0.1) { carVel.x = 0 };
	if (Math.abs(carVel.y) < 0.1) { carVel.y = 0 };

	let maxSpeed = 80;
	let acceleration = 0.5;
	let friction = 0.97;
	let steerLimit = 60;
	let steerSpeed = 1.5;
	let rearFollow = 10/1000;
	let frontFollow = 10/1000;
	let baseTireFric = 0.9;

	// apply input

	frontDir += sideIn * -steerSpeed;
	frontDir = Math.max(Math.min(frontDir, steerLimit), -steerLimit);
	carVel.x += sind(rearDir) * forwardIn * acceleration;
	carVel.y += cosd(rearDir) * forwardIn * acceleration;

	// swing car rear

	let fDirVec = toVec((rearDir+frontDir)%360, 1);
	let rDirVec = toVec(rearDir, 1);
    let speedPercent = Math.min(Math.abs(carVel.length()), maxSpeed) / maxSpeed;
	let factor = speedPercent * rearFollow;

	if (forwardIn == 1) {
		fDirVec.multiplyScalar(-1);
		frontDir *= 1-factor;
	}

	frontDir *= 1-factor;

	let targetDir = getDir(lerpVec(rDirVec, fDirVec, factor)) % 360;
	if ( targetDir < 0 ){ targetDir = 360+targetDir };

	rotVel += angularDiff(targetDir, rearDir) * 0.05;
	if ( rearDir < 0){ rearDir = 360+rearDir };
	rearDir = rearDir % 360;
	rearDir += rotVel;
	

	// max speed

	if(Math.abs(carVel.length()) > maxSpeed) {
		carVel.normalize();
		carVel.multiplyScalar(maxSpeed);
	}

	// apply friction and velocity 

	if (forwardIn == 0) { carVel.multiplyScalar(friction) };
	rotVel *= baseTireFric + (0.04 * speedPercent);

	let factored = new Vector2().copy(carVel);
	carPos.add(factored.multiplyScalar(0.001));
	rearDir += rotVel;
	
	// render the scene
	
	let carInfo = {
		x: carPos.x,
		y: carPos.y,
		frontDir: frontDir,
		rearDir: rearDir,
	}
	render(frame, carInfo);
	
	frame++;
	stats.end();
	requestAnimationFrame(tick);
}