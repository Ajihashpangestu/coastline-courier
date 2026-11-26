// Shared constants for Coastline Courier: world scale, aircraft limits,
// display conversions and the single warm coastal palette every renderer uses.

export const WORLD = {
  islandRadiusX: 5400,
  islandRadiusZ: 4400,
  seaLevel: 0,
  viewDistance: 6800,
  terrainCell: 165,
  terrainGridHalf: 30,
};

export const RUNWAY = {
  centerX: 900,
  centerZ: 1900,
  headingDeg: 0,
  length: 980,
  width: 64,
  elevation: 14,
};

export const AIRCRAFT = {
  maxSpeed: 78,
  stallSpeed: 23,
  maxPitchDeg: 30,
  maxBankDeg: 58,
  pitchRate: 1.5,
  bankRate: 2.4,
  gearHeight: 1.6,
  maxHull: 100,
};

export const DISPLAY = {
  metersToFeet: 3.28084,
  msToKnots: 1.94384,
  fieldOfViewDeg: 64,
};

export const PALETTE = {
  skyTop: '#2b3a67',
  skyMid: '#a86a7a',
  skyHorizon: '#ff9e57',
  sunGlow: '#ffe9b8',
  deepWater: '#1d4e63',
  shallowWater: '#2f7f8f',
  sand: '#ecd9a0',
  grass: '#6fae4e',
  fieldGold: '#d9b45b',
  fieldGreen: '#84bc5e',
  forest: '#3f7d45',
  rock: '#8d8073',
  snow: '#f2f5f7',
  asphalt: '#3c4148',
  runwayPaint: '#f5f2e8',
  ringNext: '#ffc53d',
  ringWaiting: '#39c2c9',
  ringPassed: '#58d977',
  targetRed: '#e4572e',
  hudInk: '#10202f',
  hudPaper: 'rgba(246, 248, 244, 0.88)',
  hudAccent: '#ff9f2e',
  gaugeFace: '#1c2733',
  gaugeLit: '#ffd98a',
  planeBody: '#e8552f',
  planeTrim: '#f7f3e8',
  planeDark: '#27313d',
};

export function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

export function wrapDegrees(deg) {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

export function headingVector(headingDeg) {
  const rad = degToRad(headingDeg);
  return { x: Math.sin(rad), z: -Math.cos(rad) };
}
