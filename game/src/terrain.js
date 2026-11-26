// Procedural island terrain: an analytic height field with a coastline,
// patchwork fields, forested hills, a rocky ridge and a flattened runway
// shelf, plus the biome colours and landmarks the renderers draw.

import { PALETTE, RUNWAY, WORLD, clamp, lerp, smoothstep } from './config.js';

function hashLattice(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function valueNoise(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hashLattice(ix, iz);
  const b = hashLattice(ix + 1, iz);
  const c = hashLattice(ix, iz + 1);
  const d = hashLattice(ix + 1, iz + 1);
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sz);
}

function fractalNoise(x, z) {
  let total = 0;
  let amplitude = 0.55;
  let frequency = 1;
  for (let octave = 0; octave < 4; octave++) {
    total += valueNoise(x * frequency, z * frequency) * amplitude;
    frequency *= 2.13;
    amplitude *= 0.5;
  }
  return total;
}

function islandDome(x, z) {
  const dx = x / WORLD.islandRadiusX;
  const dz = z / WORLD.islandRadiusZ;
  const d = Math.sqrt(dx * dx + dz * dz);
  return smoothstep(1.05, 0.55, d);
}

function ridgeHeight(x, z, dome) {
  const ridgeLine = z + 950 + 0.32 * x;
  const ridge = Math.exp(-(ridgeLine * ridgeLine) / (2 * 620 * 620));
  return ridge * 225 * dome;
}

function rawIslandHeight(x, z) {
  const dome = islandDome(x, z);
  const rolling = fractalNoise(x * 0.00045 + 7.3, z * 0.00045 - 2.1);
  const hills = Math.pow(rolling, 1.7) * 330;
  const shore = dome * 26;
  const seaFloor = -14 * (1 - dome);
  return dome * hills + ridgeHeight(x, z, dome) + shore + seaFloor;
}

function runwayBlend(x, z) {
  const dx = Math.abs(x - RUNWAY.centerX);
  const dz = Math.abs(z - RUNWAY.centerZ);
  const across = smoothstep(RUNWAY.width * 2.6, RUNWAY.width * 0.75, dx);
  const along = smoothstep(RUNWAY.length * 0.72, RUNWAY.length * 0.52, dz);
  return Math.min(across, along);
}

export function terrainHeightAt(x, z) {
  const base = rawIslandHeight(x, z);
  const blend = runwayBlend(x, z);
  return lerp(base, RUNWAY.elevation, blend);
}

export function isOnRunway(x, z) {
  return (
    Math.abs(x - RUNWAY.centerX) <= RUNWAY.width / 2 &&
    Math.abs(z - RUNWAY.centerZ) <= RUNWAY.length / 2
  );
}

export function isOverWater(x, z) {
  return terrainHeightAt(x, z) < 0.4 && !isOnRunway(x, z);
}

function fieldPatch(x, z) {
  const cell = 420;
  const ix = Math.floor(x / cell);
  const iz = Math.floor(z / cell);
  return hashLattice(ix * 3 + 11, iz * 5 - 4);
}

export function terrainColorAt(x, z, height, slope) {
  if (height < -2.5) return PALETTE.deepWater;
  if (height < 0.6) return PALETTE.shallowWater;
  if (height < 4) return PALETTE.sand;
  if (height > 365) return PALETTE.snow;
  if (slope > 0.5 && height > 80) return PALETTE.rock;
  if (height > 240) return PALETTE.rock;
  if (height < 55) {
    const patch = fieldPatch(x, z);
    if (patch > 0.66) return PALETTE.fieldGold;
    if (patch > 0.34) return PALETTE.fieldGreen;
    return PALETTE.grass;
  }
  const woods = fractalNoise(x * 0.0016 - 4.2, z * 0.0016 + 9.7);
  return woods > 0.42 ? PALETTE.forest : PALETTE.grass;
}

export function shadeColor(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(Math.round(((n >> 16) & 255) * factor), 0, 255);
  const g = clamp(Math.round(((n >> 8) & 255) * factor), 0, 255);
  const b = clamp(Math.round((n & 255) * factor), 0, 255);
  return `rgb(${r},${g},${b})`;
}

export const LANDMARKS = [
  { name: 'lighthouse', x: -3350, z: 1150 },
  { name: 'harbour', x: -2650, z: 2050 },
  { name: 'windmill', x: 1750, z: -350 },
  { name: 'village', x: 350, z: 1250 },
  { name: 'summit mast', x: -350, z: -1150 },
];

export function buildCloudField() {
  const clouds = [];
  for (let i = 0; i < 46; i++) {
    const rx = hashLattice(i * 17 + 3, 91);
    const rz = hashLattice(47, i * 23 + 5);
    const ra = hashLattice(i * 7 + 1, i * 3 + 8);
    clouds.push({
      x: (rx - 0.5) * 13000,
      z: (rz - 0.5) * 11000,
      y: 620 + ra * 380,
      radius: 130 + hashLattice(i, 77) * 170,
      puffs: 3 + Math.floor(hashLattice(5, i) * 3),
    });
  }
  return clouds;
}
