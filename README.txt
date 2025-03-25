The user-inputed turning force will determine the center point that the tire friction vectors to align on

The user-inputed speed is used in determining the opposing centrifugal force (F = mass * vel * vel / r)

The user-inputed braking during the turn will cause a weight shift and determine the traction of the rear tires 

The rear tires will "give out" after x force and start to swing around the front wheels 

By aligning with them with the centrifugal force, countersteer prevents the front wheels from joining this spin

The user-inputed throttle during the drift can keep the rear friction low, determining the swing amount

As the rear swing is about the pass the countersteer angle, high throttle can end the drift with the car still moving

If no throttle is inputted at the sweet spot, the rear swing will eventually slow down, regain traction and stop


function vecDiff(vecA, vecB)
{
	let a = new Vector2().copy(vecA);
	let b = new Vector2().copy(vecB);
	a.normalize(); b.normalize();

	return Math.sign(a.x*b.x + a.y*b.y);
}

