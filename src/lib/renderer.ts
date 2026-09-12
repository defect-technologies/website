import {
  EXPOSURE,
  LIGHT_RADIUS,
  LIGHT_Z,
  ROOM,
  type Slab,
} from "./scene";
import {
  FRAGMENT_SOURCE,
  MAX_LAMPS,
  MAX_SLABS,
  VERTEX_SOURCE,
} from "./shaders";

export type LampUniform = {
  left: number;
  right: number;
  centre: number;
  halfHeight: number;
  rgb: [number, number, number];
  power: number;
};

type Uniforms = {
  res: WebGLUniformLocation | null;
  time: WebGLUniformLocation | null;
  lightZ: WebGLUniformLocation | null;
  radius: WebGLUniformLocation | null;
  exposure: WebGLUniformLocation | null;
  slabCount: WebGLUniformLocation | null;
  slab: WebGLUniformLocation | null;
  slabZ: WebGLUniformLocation | null;
  lampSpan: WebGLUniformLocation | null;
  lampTint: WebGLUniformLocation | null;
};

const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

function compile(gl: WebGLRenderingContext, kind: number, source: string) {
  const shader = gl.createShader(kind);
  if (!shader) throw new Error("could not create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "shader compile failed");
  }
  return shader;
}

function link(gl: WebGLRenderingContext) {
  const program = gl.createProgram();
  if (!program) throw new Error("could not create program");
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SOURCE));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "program link failed");
  }
  return program;
}

function locate(gl: WebGLRenderingContext, program: WebGLProgram): Uniforms {
  const at = (name: string) => gl.getUniformLocation(program, name);
  return {
    res: at("uRes"),
    time: at("uTime"),
    lightZ: at("uLightZ"),
    radius: at("uRadius"),
    exposure: at("uExposure"),
    slabCount: at("uSlabCount"),
    slab: at("uSlab[0]"),
    slabZ: at("uSlabZ[0]"),
    lampSpan: at("uLampSpan[0]"),
    lampTint: at("uLampTint[0]"),
  };
}

function packRoom(slabs: Slab[], width: number, height: number) {
  const rects = new Float32Array(MAX_SLABS * 4);
  const depths = new Float32Array(MAX_SLABS);
  slabs.slice(0, MAX_SLABS).forEach((slab, i) => {
    rects[i * 4] = slab.x * width;
    rects[i * 4 + 1] = slab.y * height;
    rects[i * 4 + 2] = slab.w * width;
    rects[i * 4 + 3] = slab.h * height;
    depths[i] = slab.z * height;
  });
  return { rects, depths, count: Math.min(slabs.length, MAX_SLABS) };
}

function packLamps(lamps: LampUniform[]) {
  const spans = new Float32Array(MAX_LAMPS * 4);
  const tints = new Float32Array(MAX_LAMPS * 4);
  lamps.slice(0, MAX_LAMPS).forEach((lamp, i) => {
    spans[i * 4] = lamp.left;
    spans[i * 4 + 1] = lamp.right;
    spans[i * 4 + 2] = lamp.centre;
    spans[i * 4 + 3] = lamp.power;
    tints[i * 4] = lamp.rgb[0] / 255;
    tints[i * 4 + 1] = lamp.rgb[1] / 255;
    tints[i * 4 + 2] = lamp.rgb[2] / 255;
    tints[i * 4 + 3] = lamp.halfHeight;
  });
  return { spans, tints };
}

export class RoomRenderer {
  private gl: WebGLRenderingContext;
  private uniforms: Uniforms;
  private width = 0;
  private height = 0;

  private constructor(gl: WebGLRenderingContext, program: WebGLProgram) {
    this.gl = gl;
    this.uniforms = locate(gl, program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1f(this.uniforms.exposure, EXPOSURE);
  }

  static create(canvas: HTMLCanvasElement): RoomRenderer | null {
    const gl = (canvas.getContext("webgl", {
      antialias: false,
      alpha: false,
      powerPreference: "low-power",
    }) ?? canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return null;
    try {
      return new RoomRenderer(gl, link(gl));
    } catch {
      return null;
    }
  }

  resize(pixelWidth: number, pixelHeight: number) {
    this.width = pixelWidth;
    this.height = pixelHeight;
    this.gl.viewport(0, 0, pixelWidth, pixelHeight);
    const room = packRoom(ROOM, pixelWidth, pixelHeight);
    this.gl.uniform2f(this.uniforms.res, pixelWidth, pixelHeight);
    this.gl.uniform1i(this.uniforms.slabCount, room.count);
    this.gl.uniform4fv(this.uniforms.slab, room.rects);
    this.gl.uniform1fv(this.uniforms.slabZ, room.depths);
    this.gl.uniform1f(this.uniforms.lightZ, LIGHT_Z * pixelHeight);
    this.gl.uniform1f(this.uniforms.radius, LIGHT_RADIUS * pixelHeight);
  }

  draw(lamps: LampUniform[], seconds: number) {
    if (this.width === 0 || this.height === 0) return;
    const { spans, tints } = packLamps(lamps);
    this.gl.uniform1f(this.uniforms.time, seconds);
    this.gl.uniform4fv(this.uniforms.lampSpan, spans);
    this.gl.uniform4fv(this.uniforms.lampTint, tints);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }
}
