export const MAX_LAMPS = 5;
export const MAX_SLABS = 8;
const SHADOW_SAMPLES = 8;

export const VERTEX_SOURCE = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const FRAGMENT_SOURCE = `
precision highp float;

#define MAX_LAMPS ${MAX_LAMPS}
#define MAX_SLABS ${MAX_SLABS}
#define SAMPLES ${SHADOW_SAMPLES}

uniform vec2 uRes;
uniform float uLightZ;
uniform float uRadius;
uniform float uExposure;
uniform int uSlabCount;
uniform vec4 uSlab[MAX_SLABS];
uniform float uSlabZ[MAX_SLABS];
uniform vec4 uLampSpan[MAX_LAMPS];
uniform vec4 uLampTint[MAX_LAMPS];

/**
 * Dave Hoskins' sine-free hash. The usual fract(sin(dot(p, ...))) hash loses
 * precision at large coordinates and lays down an axis-aligned lattice, which
 * is what streaked this wall before.
 */
float hash12(vec2 p) {
  p = fract(p * vec2(0.16632, 0.17369));
  p += dot(p.xy, p.yx + 19.19);
  return fract(p.x * p.y);
}

/**
 * Jimenez's interleaved gradient noise. Spatially far more even than white
 * noise, so shadow samples spread out instead of clumping into fizz.
 */
float gradientNoise(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

float valueNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  vec2 blend = f * f * (3.0 - 2.0 * f);
  float a = hash12(cell);
  float b = hash12(cell + vec2(1.0, 0.0));
  float c = hash12(cell + vec2(0.0, 1.0));
  float d = hash12(cell + vec2(1.0, 1.0));
  return mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y);
}

/**
 * Triangular-PDF dither. Two decorrelated uniform samples summed, so the grain
 * reads the same everywhere along a gradient; a single uniform sample leaves
 * visible ripples where the signal sits near a quantisation step.
 */
float triangularDither(vec2 p) {
  return hash12(p) + hash12(p + 17.0) - 1.0;
}

bool inside(vec2 p, vec4 slab) {
  return p.x > slab.x && p.x < slab.x + slab.z && p.y > slab.y && p.y < slab.y + slab.w;
}

void frontmostSurface(vec2 px, out float depth, out int index) {
  depth = 0.0;
  index = -1;
  for (int i = 0; i < MAX_SLABS; i++) {
    if (i >= uSlabCount) break;
    if (inside(px, uSlab[i]) && uSlabZ[i] > depth) {
      depth = uSlabZ[i];
      index = i;
    }
  }
}

float visibility(vec3 surface, vec3 lamp, int surfaceIndex) {
  for (int i = 0; i < MAX_SLABS; i++) {
    if (i >= uSlabCount) break;
    if (i == surfaceIndex) continue;
    float z = uSlabZ[i];
    if (z <= surface.z || z >= lamp.z) continue;
    float k = (z - surface.z) / (lamp.z - surface.z);
    if (inside(surface.xy + (lamp.xy - surface.xy) * k, uSlab[i])) return 0.0;
  }
  return 1.0;
}

vec3 gather(vec2 px, float depth, int surfaceIndex) {
  vec3 surface = vec3(px, depth);
  vec3 total = vec3(0.0);

  // One low-discrepancy offset per pixel, then evenly stratified samples along
  // the lit line. Stratifying is what keeps the penumbra smooth without
  // resorting to per-sample noise.
  float offset = gradientNoise(px);
  float riseSeed = gradientNoise(px + 41.0);

  for (int l = 0; l < MAX_LAMPS; l++) {
    vec4 span = uLampSpan[l];
    if (span.w <= 0.002) continue;
    vec4 tint = uLampTint[l];
    vec3 sum = vec3(0.0);
    for (int s = 0; s < SAMPLES; s++) {
      float along = (float(s) + offset) / float(SAMPLES);
      float rise = (fract(along * 3.7 + riseSeed) - 0.5) * 2.0 * tint.w;
      vec3 lamp = vec3(mix(span.x, span.y, along), span.z + rise, uLightZ);
      vec3 delta = lamp - surface;
      float dist = max(length(delta), 1.0);
      float lambert = max(delta.z, 0.0) / dist;
      float falloff = 1.0 / (1.0 + (dist * dist) / (uRadius * uRadius));
      sum += lambert * falloff * visibility(surface, lamp, surfaceIndex);
    }
    total += tint.rgb * span.w * sum / float(SAMPLES);
  }
  return total;
}

void main() {
  vec2 px = gl_FragCoord.xy;

  float depth;
  int surfaceIndex;
  frontmostSurface(px, depth, surfaceIndex);

  // Very low frequency, very low amplitude: the wall should look unevenly
  // cast rather than textured. Anything finer reads as noise.
  float unevenness = valueNoise(px * 0.0045);
  float albedo = (surfaceIndex < 0 ? 0.58 : 0.42) * (0.95 + 0.1 * unevenness);

  vec3 lit = gather(px, depth, surfaceIndex) * uExposure * albedo;
  lit += vec3(0.008, 0.009, 0.012) * albedo;

  lit = lit / (lit + vec3(0.92));
  // Barely any lift. Anything stronger drags the unlit wall up off black once
  // several lamps are burning at once.
  lit = pow(lit, vec3(0.95));

  vec2 uv = px / uRes;
  float edge = smoothstep(1.3, 0.32, length((uv - 0.5) * vec2(1.12, 1.0)) * 1.62);
  lit *= mix(0.5, 1.0, edge);

  // Last thing before the 8-bit write, in the space being quantised.
  lit += triangularDither(px) / 255.0;

  gl_FragColor = vec4(max(lit, vec3(0.0)), 1.0);
}
`;
