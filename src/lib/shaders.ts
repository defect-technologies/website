export const MAX_LAMPS = 5;
export const MAX_SLABS = 8;
const SHADOW_SAMPLES = 10;

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
uniform float uTime;
uniform float uLightZ;
uniform float uRadius;
uniform float uExposure;
uniform int uSlabCount;
uniform vec4 uSlab[MAX_SLABS];
uniform float uSlabZ[MAX_SLABS];
uniform vec4 uLampSpan[MAX_LAMPS];
uniform vec4 uLampTint[MAX_LAMPS];

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float valueNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  vec2 blend = f * f * (3.0 - 2.0 * f);
  float a = hash(cell);
  float b = hash(cell + vec2(1.0, 0.0));
  float c = hash(cell + vec2(0.0, 1.0));
  float d = hash(cell + vec2(1.0, 1.0));
  return mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y);
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
  for (int l = 0; l < MAX_LAMPS; l++) {
    vec4 span = uLampSpan[l];
    if (span.w <= 0.002) continue;
    vec4 tint = uLampTint[l];
    vec3 sum = vec3(0.0);
    for (int s = 0; s < SAMPLES; s++) {
      float along = (float(s) + hash(px + vec2(float(s) * 7.3, uTime))) / float(SAMPLES);
      float rise = (hash(px * 1.71 + vec2(float(s), uTime * 0.7)) - 0.5) * 2.0 * tint.w;
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

  float concrete = valueNoise(px * 0.42) * 0.55 + valueNoise(px * 1.9) * 0.45;
  float albedo = (surfaceIndex < 0 ? 0.58 : 0.42) * (0.76 + 0.34 * concrete);

  vec3 lit = gather(px, depth, surfaceIndex) * uExposure * albedo;
  lit += vec3(0.008, 0.009, 0.012) * albedo;

  lit = lit / (lit + vec3(0.92));
  lit = pow(lit, vec3(0.86));

  vec2 uv = px / uRes;
  float edge = smoothstep(1.3, 0.32, length((uv - 0.5) * vec2(1.12, 1.0)) * 1.62);
  lit *= mix(0.68, 1.0, edge);

  lit += (hash(px * 1.31 + vec2(uTime * 41.0)) - 0.5) * 0.02;

  gl_FragColor = vec4(max(lit, vec3(0.0)), 1.0);
}
`;
