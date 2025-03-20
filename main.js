// This file handles WebGPU by loading shaders,
// sending camera data, and rendering

import { cam } from './camera.js';

// Setup WebGPU

const canvas = document.querySelector('canvas');
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();
const context = canvas.getContext('webgpu');
const format = navigator.gpu.getPreferredCanvasFormat();

context.configure({
    device,
    format: format,
    alphaMode: 'premultiplied',
});

// Deprecated, fix later
// const adapterInfo = await adapter.requestAdapterInfo();
// console.log(adapterInfo);

// Fetch the shader code & setup pipeline

const shaderCode = await (await fetch("./shader.wgsl")).text();
const shader = device.createShaderModule({ code: shaderCode });

const pipeline = device.createRenderPipeline(
{
    layout: device.createPipelineLayout(
    {
        bindGroupLayouts: [ device.createBindGroupLayout(
        {
            entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: { type: "uniform" },
            }],
        })],
    }),
    vertex: 
    {
        module: shader,
        entryPoint: 'vertMain',
    },
    fragment: 
    {
        module: shader,
        entryPoint: 'fragMain',
        targets: [{ format: format }]
    },
    primitive: { topology: 'triangle-list' }
});

// Create a buffer to hold camera data

const uniformBuffer = device.createBuffer({
    size: 6*16, // https://sotrh.github.io/learn-wgpu/showcase/alignment/
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});

// Initalize camera and allow it to make changes to GPU buffer

(cam.Modify = () =>
{
    cam.Refresh();

    device.queue.writeBuffer(uniformBuffer,      0, new Float32Array(cam.position));
    device.queue.writeBuffer(uniformBuffer, 16 * 1, new Float32Array(cam.right));
    device.queue.writeBuffer(uniformBuffer, 16 * 2, new Float32Array(cam.up));
    device.queue.writeBuffer(uniformBuffer, 16 * 3, new Float32Array(cam.forward));
    device.queue.writeBuffer(uniformBuffer, 16 * 4, new Float32Array(cam.uv_to_plane));
    device.queue.writeBuffer(uniformBuffer, 16 * 5, new Float32Array([cam.frame, 0.0, 0.0]));
})();

cam.Init();

// Create a bind group so the shader can use the buffer

const bindGroup = device.createBindGroup(
{
    layout: pipeline.getBindGroupLayout(0),
    entries: 
    [{
        binding: 0,
        resource: { buffer: uniformBuffer },
    }],
});

// Rendering

var frame = 0;

function Render()
{
    cam.frame = 1 + frame/600;
    cam.Modify();

    const commandEncoder = device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass(
    {
        colorAttachments: 
        [{
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store',
        }],
    });

    renderPass.setPipeline(pipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(3, 1, 0, 0);
    renderPass.end();
    
    device.queue.submit([commandEncoder.finish()]);

    requestAnimationFrame(Render);
    frame++;
}

Render();
