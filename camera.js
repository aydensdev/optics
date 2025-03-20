// This file handles camera data and interaction
// It also data adds listeners for modification

import { GUI } from "./modules/dat.gui.module.js";

export const cam = 
{
    fieldOfView: 70,
    planeDist:    3,
    res:          1,

    position:   [0.0, 0.2, -3.0],
    right:      [0.0, 0.0, 0.0],
    up:         [0.0, 0.0, 0.0],
    forward:    [0.0, 0.0, 0.0],

    yaw:    0,
    pitch:  7,
    orbit:  330,

    uv_to_plane: [0.0, 0.0, 0.0],
    frame: 3.0,

    Init: () =>
    {
        const gui = new GUI()
        gui.domElement.id = 'gui';
        
        gui.add(cam, 'fieldOfView', 1, 100, 0.1).onChange(cam.Modify);
        gui.add(cam, 'planeDist', 1, 15, 0.01).onChange(cam.Modify);
        gui.add(cam, 'res', 1, 12, 1).onChange(cam.Modify);
        gui.add(cam, 'frame', 0, 18, 0.01).onChange(cam.Modify);
        gui.add(cam, 'yaw', -180, 180, 0.01).onChange(cam.Modify);
        gui.add(cam, 'pitch', -180, 180, 0.01).onChange(cam.Modify);
        gui.add(cam, 'orbit', 0, 359, 0.01).onChange(cam.Modify);

        window.onresize = cam.Modify;
    },

    Modify: () => {},

    Refresh: () => 
    {
        // Camera 3D rotation handling

        const DEG_TO_RAD = Math.PI / 180;
        const canvas = document.querySelector('canvas');

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

        let mag = Math.sqrt(cam.position[0]**2 + cam.position[2]**2);
        let orbit = (cam.orbit + 270) % 360; // offset for ease
        cam.position[0] = cosd(orbit) * mag;
        cam.position[2] = sind(orbit) * mag;

        let yaw = 270-orbit+cam.yaw;
        if (yaw < 0) { yaw += 360 }

        let pitch = cam.pitch;
        if (pitch < 0){ pitch += 360 };


        cam.forward = [
            sind(yaw) * sind((pitch+90) % 360),
            cosd((pitch+90) % 360),
            cosd(yaw) * sind((pitch+90) % 360),
        ]

        cam.right = [
            sind((yaw+90) % 360),
            cam.right[1], //no change
            cosd((yaw+90) % 360),
        ]

        cam.up = [
            sind(yaw) * sind(pitch),
            cosd(pitch),
            cosd(yaw) * sind(pitch),
        ]

        // Resizing or resolution handling

        if (cam.res > 1) { canvas.style.imageRendering = "pixelated" }
        else { canvas.style.imageRendering = "" };
        let w = Math.floor(document.body.clientWidth * (1 / cam.res));
        let h = Math.floor(document.body.clientHeight * (1 / cam.res))
        canvas.width = w; canvas.height = h;

        // Calculate the new projection plane from camera settings

        cam.uv_to_plane[0] = cam.planeDist * Math.tan(cam.fieldOfView * 0.5 * DEG_TO_RAD) * 2;
        cam.uv_to_plane[1] = cam.uv_to_plane[0] * h / w;
        cam.uv_to_plane[2] = cam.planeDist;
    }
};
