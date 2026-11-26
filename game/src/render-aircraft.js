// Aircraft rendering: the chase-view aeroplane drawn as layered vector
// shapes with a spinning prop blur and blinking nav lights, and the cockpit
// view with a lit six-gauge panel, yoke and windshield frame.

import { DISPLAY, PALETTE, clamp, degToRad } from './config.js';
import { projectPoint } from './render-world.js';
import { terrainHeightAt } from './terrain.js';

export function drawChaseAircraft(ctx, camera, state) {
  if (state.screen === 'menu' || state.cameraMode === 'cockpit') return;
  const plane = state.plane;
  const anchor = projectPoint(camera, plane.x, plane.y, plane.z);
  if (!anchor) return;
  drawAircraft3D(ctx, state, plane, anchor);
}

// Low-poly 3D aircraft: the chase aeroplane is a real vertex/face model
// (tapered octagonal fuselage, faceted canopy, thick dihedral wings, fin,
// stabilizers, spinner and prop disc) rendered in software with a
// perspective projection, painter's-algorithm sorting and per-face flat
// shading from the golden-hour sun. Model space: x right, y up, z toward
// the nose. The camera sits behind and slightly to the right of the plane,
// giving the rear-quarter chase view.

const SUN_DIR = (() => {
  const v = [-0.55, 0.6, 0.6];
  const len = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
})();

const MAT_BODY = [232, 84, 44];
const MAT_CREAM = [247, 243, 232];
const MAT_GLASS = [104, 186, 214];
const MAT_DARK = [39, 49, 61];
const MAT_METAL = [130, 140, 150];

function vSub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function vCross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function vDot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function vNorm(a) {
  const len = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / len, a[1] / len, a[2] / len];
}

function ringPoints(z, radius, cy, count = 8) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.PI / count;
    pts.push([Math.cos(a) * radius, cy + Math.sin(a) * radius, z]);
  }
  return pts;
}

function buildAircraftFaces(plane) {
  const faces = [];
  const add = (pts, mat, opts = {}) => faces.push({ pts, mat, ...opts });

  const stations = [
    [3.2, 0.3, 0.05],
    [2.6, 0.56, 0.05],
    [1.2, 0.63, 0.08],
    [-0.5, 0.56, 0.08],
    [-2.2, 0.31, 0.14],
    [-3.2, 0.17, 0.2],
  ];
  const rings = stations.map(([z, r, cy]) => ringPoints(z, r, cy));
  for (let s = 0; s < rings.length - 1; s++) {
    const a = rings[s];
    const b = rings[s + 1];
    for (let i = 0; i < a.length; i++) {
      const j = (i + 1) % a.length;
      add([a[i], a[j], b[j], b[i]], MAT_BODY);
    }
  }
  const tailCap = [0, 0.2, -3.35];
  const lastRing = rings[rings.length - 1];
  for (let i = 0; i < lastRing.length; i++) {
    const j = (i + 1) % lastRing.length;
    add([lastRing[i], lastRing[j], tailCap], MAT_BODY);
  }

  const noseTip = [0, 0.05, 3.85];
  const noseRing = rings[0];
  for (let i = 0; i < noseRing.length; i++) {
    const j = (i + 1) % noseRing.length;
    add([noseRing[j], noseRing[i], noseTip], MAT_DARK);
  }

  const canopyStations = [
    [2.05, 0.16, 0.38],
    [1.55, 0.42, 0.36],
    [0.85, 0.46, 0.36],
    [0.25, 0.3, 0.38],
  ];
  const canopyRings = canopyStations.map(([z, r, cy]) => {
    const pts = [];
    for (let i = 0; i <= 4; i++) {
      const a = (i / 4) * Math.PI;
      pts.push([Math.cos(a) * r, cy + Math.sin(a) * r, z]);
    }
    return pts;
  });
  for (let s = 0; s < canopyRings.length - 1; s++) {
    const a = canopyRings[s];
    const b = canopyRings[s + 1];
    for (let i = 0; i < a.length - 1; i++) {
      add([a[i], a[i + 1], b[i + 1], b[i]], MAT_GLASS, { glass: true });
    }
  }
  for (const [ring, z] of [[canopyRings[0], 2.2], [canopyRings[canopyRings.length - 1], 0.1]]) {
    const center = [0, 0.42, z];
    for (let i = 0; i < ring.length - 1; i++) {
      add([ring[i], ring[i + 1], center], MAT_GLASS, { glass: true });
    }
  }

  for (const side of [-1, 1]) {
    const rootLE = [side * 0.4, 0.02, 0.8];
    const rootTE = [side * 0.4, -0.02, -0.55];
    const tipLE = [side * 4.6, 0.4, 0.28];
    const tipTE = [side * 4.6, 0.36, -0.42];
    const t = 0.075;
    const up = (p) => [p[0], p[1] + t, p[2]];
    const down = (p) => [p[0], p[1] - t, p[2]];
    const midLE = [side * 3.35, 0.31, 0.4];
    const midTE = [side * 3.35, 0.27, -0.46];
    add([up(rootLE), up(midLE), up(midTE), up(rootTE)], MAT_BODY);
    add([up(midLE), up(tipLE), up(tipTE), up(midTE)], MAT_CREAM);
    add([down(rootTE), down(midTE), down(midLE), down(rootLE)], MAT_BODY);
    add([down(midTE), down(tipTE), down(tipLE), down(midLE)], MAT_BODY);
    add([up(rootLE), up(tipLE), down(tipLE), down(rootLE)], MAT_BODY);
    add([up(tipTE), up(rootTE), down(rootTE), down(tipTE)], MAT_BODY);
    add([up(tipLE), up(tipTE), down(tipTE), down(tipLE)], MAT_BODY);
  }

  for (const side of [-1, 1]) {
    const rootLE = [side * 0.12, 0.2, -2.55];
    const rootTE = [side * 0.12, 0.2, -3.15];
    const tipLE = [side * 1.7, 0.3, -2.7];
    const tipTE = [side * 1.7, 0.3, -3.15];
    const t = 0.04;
    const up = (p) => [p[0], p[1] + t, p[2]];
    const down = (p) => [p[0], p[1] - t, p[2]];
    add([up(rootLE), up(tipLE), up(tipTE), up(rootTE)], MAT_BODY);
    add([down(rootTE), down(tipTE), down(tipLE), down(rootLE)], MAT_BODY);
    add([up(rootLE), up(tipLE), down(tipLE), down(rootLE)], MAT_BODY);
    add([up(tipLE), up(tipTE), down(tipTE), down(tipLE)], MAT_BODY);
  }

  const finProfile = [
    [0.16, -2.05],
    [0.98, -2.5],
    [1.08, -3.05],
    [0.22, -3.28],
  ];
  for (const side of [-1, 1]) {
    const x = side * 0.05;
    const pts = finProfile.map(([y, z]) => [x, y, z]);
    add(side < 0 ? [...pts].reverse() : pts, MAT_BODY);
  }
  for (let i = 0; i < finProfile.length; i++) {
    const [y1, z1] = finProfile[i];
    const [y2, z2] = finProfile[(i + 1) % finProfile.length];
    add([[-0.05, y1, z1], [0.05, y1, z1], [0.05, y2, z2], [-0.05, y2, z2]], MAT_BODY);
  }
  const rudder = [
    [0.22, -3.28],
    [1.08, -3.05],
    [1.0, -2.9],
    [0.3, -3.05],
  ];
  for (const side of [-1, 1]) {
    const x = side * 0.056;
    const pts = rudder.map(([y, z]) => [x, y, z]);
    add(side < 0 ? [...pts].reverse() : pts, MAT_CREAM);
  }

  if (plane.onGround) {
    for (const side of [-1, 1]) {
      add([
        [side * 0.55, -0.35, 0.35],
        [side * 0.68, -0.35, 0.35],
        [side * 0.8, -1.12, 0.35],
        [side * 0.66, -1.12, 0.35],
      ], MAT_METAL);
      add([
        [side * 0.62, -1.0, 0.12],
        [side * 0.84, -1.0, 0.12],
        [side * 0.84, -1.28, 0.12],
        [side * 0.62, -1.28, 0.12],
      ], MAT_DARK);
      add([
        [side * 0.62, -1.0, 0.58],
        [side * 0.62, -1.28, 0.58],
        [side * 0.84, -1.28, 0.58],
        [side * 0.84, -1.0, 0.58],
      ], MAT_DARK);
    }
    add([
      [-0.06, -0.35, 2.25],
      [0.06, -0.35, 2.25],
      [0.06, -1.05, 2.25],
      [-0.06, -1.05, 2.25],
    ], MAT_METAL);
    add([
      [-0.09, -0.95, 2.08],
      [0.09, -0.95, 2.08],
      [0.09, -1.2, 2.08],
      [-0.09, -1.2, 2.08],
    ], MAT_DARK);
  }

  return faces;
}

function shadeFace(mat, normal, glass) {
  const d = Math.max(0, vDot(normal, SUN_DIR));
  const ambient = glass ? 0.6 : 0.46;
  const s = ambient + 0.78 * d;
  const warm = d * d;
  const r = clamp(mat[0] * s + warm * 42, 0, 255);
  const g = clamp(mat[1] * s + warm * 20, 0, 255);
  const b = clamp(mat[2] * s - warm * 4, 0, 255);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function drawNavLight(ctx, x, y, color, radius) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 3.2);
  glow.addColorStop(0, color);
  glow.addColorStop(0.35, color);
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawAircraft3D(ctx, state, plane, anchor) {
  const bankRad = degToRad(plane.bankDeg);
  const pitchRad = degToRad(plane.pitchDeg);
  const roll = -bankRad * 0.95;
  const pitch = -pitchRad * 0.9;

  const rotate = (p) => {
    const y1 = p[1] * Math.cos(pitch) - p[2] * Math.sin(pitch);
    const z1 = p[1] * Math.sin(pitch) + p[2] * Math.cos(pitch);
    const x2 = p[0] * Math.cos(roll) - y1 * Math.sin(roll);
    const y2 = p[0] * Math.sin(roll) + y1 * Math.cos(roll);
    return [x2, y2, z1];
  };

  const cam = [1.7, 1.15, -9.2];
  const target = [0, 0.1, 0.3];
  const forward = vNorm(vSub(target, cam));
  const right = vNorm(vCross([0, 1, 0], forward));
  const up = vCross(forward, right);

  const scale = clamp(anchor.scale * 1.05, 2.4, plane.onGround ? 5.1 : 5.0);
  const focal = scale * 150;
  const cx = anchor.x;
  const cy = anchor.y + 46 + (plane.onGround ? 66 : 0);

  const project = (p) => {
    const rel = vSub(rotate(p), cam);
    const vx = vDot(rel, right);
    const vy = vDot(rel, up);
    const vz = vDot(rel, forward);
    return [cx + (vx / vz) * focal, cy - (vy / vz) * focal, vz];
  };

  const discPts = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    discPts.push(project([Math.cos(a) * 1.55, 0.05 + Math.sin(a) * 1.55, 3.5]));
  }
  ctx.fillStyle = 'rgba(30,40,50,0.1)';
  ctx.beginPath();
  discPts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,40,50,0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();
  const bladeAngle = state.time * 40;
  const hub = project([0, 0.05, 3.55]);
  ctx.strokeStyle = 'rgba(30,40,50,0.4)';
  ctx.lineWidth = 2.4;
  for (const phase of [0, Math.PI]) {
    const a = bladeAngle + phase;
    const tip = project([Math.cos(a) * 1.45, 0.05 + Math.sin(a) * 1.45, 3.55]);
    ctx.beginPath();
    ctx.moveTo(hub[0], hub[1]);
    ctx.lineTo(tip[0], tip[1]);
    ctx.stroke();
  }

  const faces = buildAircraftFaces(plane);
  const rendered = [];
  for (const face of faces) {
    const world = face.pts.map(rotate);
    const normal = vNorm(vCross(vSub(world[1], world[0]), vSub(world[2], world[0])));
    if (vDot(normal, forward) > 0.04) continue;
    const screen = face.pts.map(project);
    const depth = screen.reduce((sum, p) => sum + p[2], 0) / screen.length;
    rendered.push({ face, normal, screen, depth });
  }
  rendered.sort((a, b) => b.depth - a.depth);

  for (const { face, normal, screen } of rendered) {
    ctx.fillStyle = shadeFace(face.mat, normal, face.glass);
    ctx.beginPath();
    screen.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = face.glass ? 'rgba(18,38,52,0.55)' : 'rgba(46,18,10,0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const leftTip = project([-4.6, 0.38, -0.05]);
  const rightTip = project([4.6, 0.38, -0.05]);
  const tailLight = project([0, 0.2, -3.35]);
  drawNavLight(ctx, leftTip[0], leftTip[1], '#ff4b3e', Math.max(1.6, focal / leftTip[2] * 0.03));
  drawNavLight(ctx, rightTip[0], rightTip[1], '#3ee06f', Math.max(1.6, focal / rightTip[2] * 0.03));
  if (Math.sin(state.time * 6) > 0.4) {
    drawNavLight(ctx, tailLight[0], tailLight[1], '#ffffff', Math.max(1.4, focal / tailLight[2] * 0.026));
  }

  if (plane.hull < 55) {
    const smoke = project([0.4, 0.5, 2.4]);
    ctx.fillStyle = 'rgba(70,70,70,0.35)';
    ctx.beginPath();
    ctx.ellipse(smoke[0], smoke[1], 16, 9, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGauge(ctx, x, y, radius, label, needleAngle, ticks) {
  const bezel = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.35, radius * 0.2, x, y, radius * 1.12);
  bezel.addColorStop(0, '#4b5766');
  bezel.addColorStop(0.7, '#232c38');
  bezel.addColorStop(1, '#11161e');
  ctx.fillStyle = bezel;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.gaugeFace;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.gaugeLit;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,217,138,0.8)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < ticks; i++) {
    const angle = Math.PI * 0.75 + (i / (ticks - 1)) * Math.PI * 1.5;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * radius * 0.78, y + Math.sin(angle) * radius * 0.78);
    ctx.lineTo(x + Math.cos(angle) * radius * 0.92, y + Math.sin(angle) * radius * 0.92);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(x + 1.6, y + 2);
  ctx.lineTo(x + Math.cos(needleAngle) * radius * 0.8 + 1.6, y + Math.sin(needleAngle) * radius * 0.8 + 2);
  ctx.stroke();
  ctx.strokeStyle = '#ff9f2e';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(needleAngle) * radius * 0.8, y + Math.sin(needleAngle) * radius * 0.8);
  ctx.stroke();
  ctx.fillStyle = PALETTE.gaugeLit;
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  ctx.beginPath();
  ctx.ellipse(x - radius * 0.32, y - radius * 0.42, radius * 0.42, radius * 0.2, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.gaugeLit;
  ctx.font = `700 ${Math.max(9, radius * 0.3)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + radius * 0.62);
}

function drawAttitudeGauge(ctx, x, y, radius, pitchDeg, bankDeg) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(degToRad(bankDeg));
  const shift = clamp(pitchDeg * 1.4, -radius, radius);
  ctx.fillStyle = '#4a90c4';
  ctx.fillRect(-radius, -radius + shift, radius * 2, radius);
  ctx.fillStyle = '#8a6b45';
  ctx.fillRect(-radius, shift, radius * 2, radius);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-radius, shift);
  ctx.lineTo(radius, shift);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = PALETTE.gaugeLit;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#ffd23d';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - radius * 0.55, y);
  ctx.lineTo(x - radius * 0.15, y);
  ctx.moveTo(x + radius * 0.15, y);
  ctx.lineTo(x + radius * 0.55, y);
  ctx.stroke();
  ctx.fillStyle = PALETTE.gaugeLit;
  ctx.font = `600 ${Math.max(9, radius * 0.3)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('ATT', x, y + radius * 0.62);
}

export function drawCockpit(ctx, state, width, height) {
  if (state.cameraMode !== 'cockpit' || state.screen === 'menu') return;
  const plane = state.plane;
  const panelTop = height * 0.68;
  const panelShade = ctx.createLinearGradient(0, panelTop, 0, height);
  panelShade.addColorStop(0, '#2c3644');
  panelShade.addColorStop(0.4, '#222b36');
  panelShade.addColorStop(1, '#161d27');
  ctx.fillStyle = panelShade;
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, panelTop + 40);
  ctx.quadraticCurveTo(width / 2, panelTop - 26, width, panelTop + 40);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#39424e';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#39424e';
  for (const sx of [0.06, 0.5, 0.94]) {
    ctx.beginPath();
    ctx.arc(width * sx, panelTop + 26, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#1a222c';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(width * 0.055, 0);
  ctx.lineTo(width * 0.13, panelTop + 30);
  ctx.lineTo(0, height * 0.34);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(width, 0);
  ctx.lineTo(width * 0.945, 0);
  ctx.lineTo(width * 0.87, panelTop + 30);
  ctx.lineTo(width, height * 0.34);
  ctx.closePath();
  ctx.fill();
  const gaugeY = panelTop + (height - panelTop) * 0.42;
  const radius = Math.min(width, height) * 0.062;
  const startX = width * 0.24;
  const step = width * 0.104;
  const speedKt = plane.speed * DISPLAY.msToKnots;
  const altFt = plane.y * DISPLAY.metersToFeet;
  const speedAngle = Math.PI * 0.75 + clamp(speedKt / 180, 0, 1) * Math.PI * 1.5;
  const altAngle = Math.PI * 0.75 + ((altFt % 1000) / 1000) * Math.PI * 1.5;
  const headingAngle = Math.PI * 0.75 + (plane.headingDeg / 360) * Math.PI * 1.5;
  const vsiAngle = Math.PI * 0.75 + clamp((plane.verticalSpeed * 196.85 + 2000) / 4000, 0, 1) * Math.PI * 1.5;
  const fuelAngle = Math.PI * 0.75 + clamp(plane.fuel / 100, 0, 1) * Math.PI * 1.5;
  drawGauge(ctx, startX, gaugeY, radius, 'KTS', speedAngle, 10);
  drawAttitudeGauge(ctx, startX + step, gaugeY, radius, plane.pitchDeg, plane.bankDeg);
  drawGauge(ctx, startX + step * 2, gaugeY, radius, 'ALT', altAngle, 10);
  drawGauge(ctx, startX + step * 3, gaugeY, radius, 'HDG', headingAngle, 12);
  drawGauge(ctx, startX + step * 4, gaugeY, radius, 'VSI', vsiAngle, 9);
  drawGauge(ctx, startX + step * 5, gaugeY, radius, 'FUEL', fuelAngle, 6);
  const rpmAngle = Math.PI * 0.75 + clamp(plane.throttle, 0, 1) * Math.PI * 1.5;
  const aglFt = Math.max(0, (plane.y - Math.max(terrainHeightAt(plane.x, plane.z), 0)) * DISPLAY.metersToFeet);
  const radaltAngle = Math.PI * 0.75 + clamp(aglFt / 1000, 0, 1) * Math.PI * 1.5;
  drawGauge(ctx, width * 0.115, gaugeY, radius * 0.62, 'RPM', rpmAngle, 8);
  drawGauge(ctx, width * 0.885, gaugeY, radius * 0.62, 'RADALT', radaltAngle, 8);
  ctx.font = '700 13px ui-monospace, monospace';
  ctx.textAlign = 'center';
  const readouts = [
    { x: startX, text: `${Math.round(speedKt)} KT` },
    { x: startX + step * 2, text: `${Math.round(altFt)} FT` },
    { x: startX + step * 3, text: `${String(Math.round(plane.headingDeg)).padStart(3, '0')}°` },
    { x: startX + step * 5, text: `${Math.round(plane.fuel)}%` },
  ];
  for (const r of readouts) {
    ctx.fillStyle = '#0d141d';
    ctx.beginPath();
    ctx.roundRect(r.x - 34, gaugeY + radius + 8, 68, 20, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,217,138,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#ffd98a';
    ctx.fillText(r.text, r.x, gaugeY + radius + 23);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, panelTop + 2, width, 10);
  ctx.fillStyle = '#39424e';
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.arc(width * (0.06 + i * 0.08), height - 12, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const yokeX = width * 0.5;
  const yokeY = height * 0.975;
  ctx.strokeStyle = '#39424e';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(yokeX, yokeY, width * 0.04, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(yokeX, yokeY + 6);
  ctx.lineTo(yokeX, height);
  ctx.stroke();
  const lamps = [
    { label: 'STALL', lit: plane.stalled, color: '#ff5a4e' },
    { label: 'FUEL', lit: plane.fuel < 18, color: '#ffb03a' },
    { label: 'HULL', lit: plane.hull < 45, color: '#ff5a4e' },
    { label: 'GEAR', lit: plane.onGround, color: '#3ee06f' },
  ];
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  lamps.forEach((lamp, i) => {
    const lx = width * 0.5 + (i - 1.5) * 74;
    ctx.fillStyle = lamp.lit ? lamp.color : '#39424e';
    ctx.beginPath();
    ctx.roundRect(lx - 32, panelTop + 8, 64, 20, 5);
    ctx.fill();
    ctx.fillStyle = lamp.lit ? '#10161f' : '#8b96a5';
    ctx.fillText(lamp.label, lx, panelTop + 22);
  });
}
