// World renderer: a small perspective projector over the analytic island.
// drawWorld paints sky, sun, terrain quads far-to-near, the runway, mission
// rings and checkpoints, landmarks, clouds and cargo, in one flat-shaded
// late-afternoon style. The chase and cockpit cameras share this projector.

import { DISPLAY, PALETTE, RUNWAY, WORLD, clamp, degToRad, headingVector } from './config.js';
import { LANDMARKS, shadeColor, terrainColorAt, terrainHeightAt } from './terrain.js';
import { activeRing } from './missions.js';

export function makeCamera(state, width, height) {
  const plane = state.plane;
  const axis = headingVector(plane.headingDeg);
  const pitchRad = degToRad(plane.pitchDeg * 0.55);
  let camX;
  let camY;
  let camZ;
  let lookX;
  let lookY;
  let lookZ;
  if (state.screen === 'menu') {
    const orbit = state.menuOrbit;
    camX = RUNWAY.centerX + Math.sin(orbit) * 900;
    camZ = RUNWAY.centerZ + Math.cos(orbit) * 900;
    camY = 260;
    lookX = RUNWAY.centerX;
    lookY = 60;
    lookZ = RUNWAY.centerZ - 500;
  } else if (state.cameraMode === 'cockpit') {
    camX = plane.x + axis.x * 1.5;
    camY = plane.y + 1.6;
    camZ = plane.z + axis.z * 1.5;
    lookX = plane.x + axis.x * 300;
    lookY = plane.y + Math.sin(pitchRad) * 300;
    lookZ = plane.z + axis.z * 300;
  } else {
    const rightAxis = { x: -axis.z, z: axis.x };
    camX = plane.x - axis.x * 34 + rightAxis.x * 3;
    camY = plane.y + 3.4 - Math.sin(pitchRad) * 6;
    camZ = plane.z - axis.z * 34 + rightAxis.z * 3;
    lookX = plane.x + axis.x * 260 + rightAxis.x * 1;
    lookY = plane.y + Math.sin(pitchRad) * 130 - 1.5;
    lookZ = plane.z + axis.z * 260 + rightAxis.z * 1;
  }
  const forward = normalize({ x: lookX - camX, y: lookY - camY, z: lookZ - camZ });
  const flatRight = normalize(cross(forward, { x: 0, y: 1, z: 0 }));
  const flatUp = cross(flatRight, forward);
  const rollRad = state.screen === 'menu' ? 0 : degToRad(plane.bankDeg * 0.38);
  const cosRoll = Math.cos(rollRad);
  const sinRoll = Math.sin(rollRad);
  const right = {
    x: flatRight.x * cosRoll + flatUp.x * sinRoll,
    y: flatRight.y * cosRoll + flatUp.y * sinRoll,
    z: flatRight.z * cosRoll + flatUp.z * sinRoll,
  };
  const up = {
    x: flatUp.x * cosRoll - flatRight.x * sinRoll,
    y: flatUp.y * cosRoll - flatRight.y * sinRoll,
    z: flatUp.z * cosRoll - flatRight.z * sinRoll,
  };
  const focal = height / 2 / Math.tan(degToRad(DISPLAY.fieldOfViewDeg) / 2);
  const buffetShake = plane.buffet * 3;
  return {
    x: camX,
    y: camY,
    z: camZ,
    forward,
    right,
    up,
    focal,
    centerX: width / 2 + (Math.random() - 0.5) * buffetShake,
    centerY: height / 2 + (Math.random() - 0.5) * buffetShake,
    width,
    height,
  };
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function normalize(v) {
  const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

export function projectPoint(camera, x, y, z) {
  const dx = x - camera.x;
  const dy = y - camera.y;
  const dz = z - camera.z;
  const depth = dx * camera.forward.x + dy * camera.forward.y + dz * camera.forward.z;
  if (depth < 2) return null;
  const side = dx * camera.right.x + dy * camera.right.y + dz * camera.right.z;
  const rise = dx * camera.up.x + dy * camera.up.y + dz * camera.up.z;
  return {
    x: camera.centerX + (side / depth) * camera.focal,
    y: camera.centerY - (rise / depth) * camera.focal,
    depth,
    scale: camera.focal / depth,
  };
}

function drawMountainSilhouettes(ctx, camera, horizonY) {
  const headingDeg = Math.atan2(camera.forward.x, -camera.forward.z) * 57.2958;
  const layers = [
    { base: 26, amp: 74, color: 'rgba(107,90,128,0.5)', snow: 'rgba(255,235,220,0.5)', seed: 3.1 },
    { base: 10, amp: 52, color: 'rgba(62,66,88,0.68)', snow: 'rgba(255,240,225,0.75)', seed: 7.7 },
  ];
  for (const layer of layers) {
    const peaks = [];
    ctx.fillStyle = layer.color;
    ctx.beginPath();
    ctx.moveTo(-20, horizonY + 14);
    for (let x = -20; x <= camera.width + 20; x += 46) {
      const t = (x + headingDeg * 9) * 0.011 + layer.seed;
      const peak = layer.base + Math.abs(Math.sin(t * 2.3)) * layer.amp + Math.abs(Math.sin(t * 5.7)) * layer.amp * 0.35;
      const y = horizonY - peak;
      peaks.push({ x, y, peak });
      ctx.lineTo(x, y);
    }
    ctx.lineTo(camera.width + 20, horizonY + 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = layer.snow;
    for (const p of peaks) {
      if (p.peak < layer.base + layer.amp * 0.72) continue;
      ctx.beginPath();
      ctx.moveTo(p.x - 9, p.y + 8);
      ctx.lineTo(p.x, p.y);
      ctx.lineTo(p.x + 9, p.y + 8);
      ctx.lineTo(p.x + 3, p.y + 5);
      ctx.lineTo(p.x, p.y + 9);
      ctx.lineTo(p.x - 3, p.y + 5);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawSky(ctx, camera) {
  const gradient = ctx.createLinearGradient(0, 0, 0, camera.height);
  gradient.addColorStop(0, PALETTE.skyTop);
  gradient.addColorStop(0.42, '#6d6a9e');
  gradient.addColorStop(0.62, PALETTE.skyMid);
  gradient.addColorStop(0.8, PALETTE.skyHorizon);
  gradient.addColorStop(1, '#ff8f4d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, camera.width, camera.height);
  const horizonForRange = projectPoint(camera, camera.x + camera.forward.x * 9000, 0, camera.z + camera.forward.z * 9000);
  if (horizonForRange) drawMountainSilhouettes(ctx, camera, horizonForRange.y);
  const sun = projectPoint(camera, -9000, 2600, -11000);
  if (sun) {
    const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 360);
    glow.addColorStop(0, 'rgba(255,246,205,0.98)');
    glow.addColorStop(0.14, 'rgba(255,222,150,0.6)');
    glow.addColorStop(0.45, 'rgba(255,190,110,0.28)');
    glow.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, 360, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6cf';
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,160,0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sun.x - 160, sun.y);
    ctx.lineTo(sun.x + 160, sun.y);
    ctx.stroke();
  }
  const horizon = projectPoint(camera, camera.x + camera.forward.x * 9000, 0, camera.z + camera.forward.z * 9000);
  if (horizon) {
    const haze = ctx.createLinearGradient(0, horizon.y - 220, 0, horizon.y + 60);
    haze.addColorStop(0, 'rgba(255,190,120,0)');
    haze.addColorStop(0.65, 'rgba(255,190,120,0.22)');
    haze.addColorStop(1, 'rgba(255,170,100,0.4)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizon.y - 220, camera.width, 280);
  }
}

function terrainVertex(x, z) {
  const height = terrainHeightAt(x, z);
  return { x, y: Math.max(height, 0), z, height };
}

function drawSeaHorizon(ctx, camera) {
  const reach = 24000;
  const left = projectPoint(
    camera,
    camera.x + camera.forward.x * reach - camera.right.x * reach,
    0,
    camera.z + camera.forward.z * reach - camera.right.z * reach,
  );
  const right = projectPoint(
    camera,
    camera.x + camera.forward.x * reach + camera.right.x * reach,
    0,
    camera.z + camera.forward.z * reach + camera.right.z * reach,
  );
  if (!left || !right) return;
  const topY = Math.min(left.y, right.y);
  const seaGradient = ctx.createLinearGradient(0, topY, 0, camera.height);
  seaGradient.addColorStop(0, '#7a6a72');
  seaGradient.addColorStop(0.18, PALETTE.shallowWater);
  seaGradient.addColorStop(0.55, PALETTE.deepWater);
  seaGradient.addColorStop(1, '#16394d');
  ctx.fillStyle = seaGradient;
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.lineTo(camera.width, camera.height);
  ctx.lineTo(0, camera.height);
  ctx.closePath();
  ctx.fill();
  const sun = projectPoint(camera, -9000, 2600, -11000);
  if (sun && sun.x > -200 && sun.x < camera.width + 200) {
    const refl = ctx.createLinearGradient(0, topY, 0, camera.height);
    refl.addColorStop(0, 'rgba(255,196,110,0.55)');
    refl.addColorStop(0.5, 'rgba(255,170,90,0.25)');
    refl.addColorStop(1, 'rgba(255,150,80,0.05)');
    ctx.fillStyle = refl;
    ctx.beginPath();
    ctx.moveTo(sun.x - 46, topY);
    ctx.lineTo(sun.x + 46, topY);
    ctx.lineTo(sun.x + 150, camera.height);
    ctx.lineTo(sun.x - 150, camera.height);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,160,0.5)';
    ctx.lineWidth = 2;
    for (let row = 0; row < 16; row++) {
      const y = topY + 8 + row * ((camera.height - topY) / 16);
      const spread = 40 + row * 7;
      const off = (hash01(row * 3, 9) - 0.5) * spread;
      const len = 14 + hash01(row, 4) * 30;
      ctx.beginPath();
      ctx.moveTo(sun.x + off - len / 2, y);
      ctx.lineTo(sun.x + off + len / 2, y);
      ctx.stroke();
    }
  }
}

function parseColor(value) {
  if (value.startsWith('#')) return [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
  return value.match(/\d+/g).slice(0, 3).map(Number);
}

function mixColor(colorA, colorB, amount) {
  const a = parseColor(colorA);
  const b = parseColor(colorB);
  const mixed = a.map((v, i) => Math.round(v + (b[i] - v) * clamp(amount, 0, 1)));
  return `rgb(${mixed[0]},${mixed[1]},${mixed[2]})`;
}

function drawTerrain(ctx, camera, state) {
  const cell = WORLD.terrainCell;
  const half = WORLD.terrainGridHalf;
  const centerX = Math.round(state.plane.x / cell) * cell;
  const centerZ = Math.round(state.plane.z / cell) * cell;
  const quads = [];
  for (let iz = -half; iz < half; iz++) {
    for (let ix = -half; ix < half; ix++) {
      const x0 = centerX + ix * cell;
      const z0 = centerZ + iz * cell;
      const corners = [
        terrainVertex(x0, z0),
        terrainVertex(x0 + cell, z0),
        terrainVertex(x0 + cell, z0 + cell),
        terrainVertex(x0, z0 + cell),
      ];
      const avgHeight = (corners[0].height + corners[1].height + corners[2].height + corners[3].height) / 4;
      const slope = Math.max(
        Math.abs(corners[1].height - corners[0].height),
        Math.abs(corners[3].height - corners[0].height),
      ) / cell;
      const projected = corners.map((c) => projectPoint(camera, c.x, c.y, c.z));
      if (projected.some((p) => !p)) continue;
      const depth = (projected[0].depth + projected[2].depth) / 2;
      if (depth > WORLD.viewDistance) continue;
      const base = terrainColorAt(x0 + cell / 2, z0 + cell / 2, avgHeight, slope);
      const grain = ((Math.sin(x0 * 12.9898 + z0 * 78.233) * 43758.5453) % 1 + 1) % 1;
      const patch = ((Math.sin(Math.floor(x0 / 420) * 39.7 + Math.floor(z0 / 420) * 17.3) * 24634.63) % 1 + 1) % 1;
      const sunSlope = ((corners[0].height + corners[3].height) - (corners[1].height + corners[2].height)) / (2 * cell);
      const gradX = ((corners[1].height + corners[2].height) - (corners[0].height + corners[3].height)) / (2 * cell);
      const gradZ = ((corners[3].height + corners[2].height) - (corners[0].height + corners[1].height)) / (2 * cell);
      const sunFacing = -(gradX * -0.63 + gradZ * -0.77);
      let light = clamp(0.78 + slope * 0.34 + sunSlope * 0.55 + sunFacing * 0.5 + (avgHeight > 0 ? 0.08 : 0) + grain * 0.16, 0.46, 1.3);
      if (avgHeight >= 0.6 && avgHeight < 80) light = clamp(light + (patch - 0.5) * 0.14, 0.52, 1.24);
      if (avgHeight < 0) {
        const wave = Math.sin(x0 * 0.021 + z0 * 0.013 + state.time * 1.4) * 0.05;
        light = clamp(light + wave, 0.52, 1.24);
      }
      let color = shadeColor(base, light);
      if (avgHeight > 0) {
        if (sunFacing > 0.02) color = mixColor(color, '#ffc98a', clamp(sunFacing * 0.55, 0, 0.34));
        else if (sunFacing < -0.02) color = mixColor(color, '#2c4638', clamp(-sunFacing * 0.5, 0, 0.3));
      }
      if (avgHeight >= 0.6 && avgHeight < 80) {
        color = mixColor(color, patch > 0.62 ? '#d9b45b' : grain > 0.5 ? '#86c45c' : '#4e8f3a', 0.16 + patch * 0.14);
        if (patch > 0.47 && patch < 0.53) color = mixColor(color, '#3d6b2f', 0.35);
      }
      if (avgHeight < 0 && grain > 0.84) {
        const sparkle = clamp((grain - 0.84) * 2.4, 0, 0.34) * (0.55 + 0.45 * Math.sin(state.time * 2 + x0 * 0.04 + z0 * 0.03));
        color = mixColor(color, '#dff7ff', sparkle);
      }
      if (avgHeight < 1.5 && avgHeight > -9) {
        const foam = clamp((1.5 - Math.abs(avgHeight)) / 4, 0, 1) * (0.35 + grain * 0.4);
        color = mixColor(color, '#f4fbff', foam);
      }
      if (avgHeight > 0) color = mixColor(color, '#e8a06a', 0.1);
      else color = mixColor(color, '#c97b5a', 0.07);
      const hazeMix = clamp((depth - 1400) / 5200, 0, 0.55);
      if (hazeMix > 0) color = mixColor(color, PALETTE.skyHorizon, hazeMix);
      quads.push({ projected, depth, color });
    }
  }
  quads.sort((a, b) => b.depth - a.depth);
  for (const quad of quads) {
    ctx.fillStyle = quad.color;
    ctx.strokeStyle = quad.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(quad.projected[0].x, quad.projected[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(quad.projected[i].x, quad.projected[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawGroundQuad(ctx, camera, points, color) {
  const projected = points.map((p) => projectPoint(camera, p.x, p.y, p.z));
  if (projected.some((p) => !p)) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(projected[0].x, projected[0].y);
  for (let i = 1; i < projected.length; i++) ctx.lineTo(projected[i].x, projected[i].y);
  ctx.closePath();
  ctx.fill();
}

function drawRunway(ctx, camera) {
  const y = RUNWAY.elevation + 0.4;
  const halfW = RUNWAY.width / 2;
  const halfL = RUNWAY.length / 2;
  const cx = RUNWAY.centerX;
  const cz = RUNWAY.centerZ;
  drawGroundQuad(ctx, camera, [
    { x: cx - halfW, y, z: cz - halfL },
    { x: cx + halfW, y, z: cz - halfL },
    { x: cx + halfW, y, z: cz + halfL },
    { x: cx - halfW, y, z: cz + halfL },
  ], PALETTE.asphalt);
  for (const side of [-1, 1]) {
    drawGroundQuad(ctx, camera, [
      { x: cx + side * (halfW - 3), y: y + 0.1, z: cz - halfL },
      { x: cx + side * halfW, y: y + 0.1, z: cz - halfL },
      { x: cx + side * halfW, y: y + 0.1, z: cz + halfL },
      { x: cx + side * (halfW - 3), y: y + 0.1, z: cz + halfL },
    ], PALETTE.runwayPaint);
  }
  for (let i = 0; i < 10; i++) {
    const z = cz - halfL + 70 + i * 92;
    drawGroundQuad(ctx, camera, [
      { x: cx - 2.2, y: y + 0.1, z },
      { x: cx + 2.2, y: y + 0.1, z },
      { x: cx + 2.2, y: y + 0.1, z: z + 42 },
      { x: cx - 2.2, y: y + 0.1, z: z + 42 },
    ], PALETTE.runwayPaint);
  }
  for (const end of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const x = cx - halfW + 7 + i * 10;
      const z = cz + end * (halfL - 26);
      drawGroundQuad(ctx, camera, [
        { x, y: y + 0.1, z },
        { x: x + 5, y: y + 0.1, z },
        { x: x + 5, y: y + 0.1, z: z - end * 20 },
        { x, y: y + 0.1, z: z - end * 20 },
      ], PALETTE.runwayPaint);
    }
  }
  for (let i = 0; i < 4; i++) {
    const light = projectPoint(camera, cx - halfW - 14, y + 1.5, cz - halfL + 120 + i * 16);
    if (!light) continue;
    ctx.fillStyle = i < 2 ? '#ff5a4e' : '#f5f2e8';
    ctx.beginPath();
    ctx.arc(light.x, light.y, Math.max(1.5, light.scale * 1.4), 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i <= 12; i++) {
    const z = cz - halfL + (i / 12) * RUNWAY.length;
    for (const side of [-1, 1]) {
      const light = projectPoint(camera, cx + side * (halfW + 3), y + 1.2, z);
      if (!light) continue;
      ctx.fillStyle = 'rgba(255,214,120,0.35)';
      ctx.beginPath();
      ctx.arc(light.x, light.y, Math.max(3, light.scale * 3), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(light.x, light.y, Math.max(1.4, light.scale * 1.3), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let i = 1; i <= 5; i++) {
    const light = projectPoint(camera, cx, y + 1.2, cz + halfL + i * 60);
    if (!light) continue;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(light.x, light.y, Math.max(1.6, light.scale * 1.6), 0, Math.PI * 2);
    ctx.fill();
  }
  drawGroundQuad(ctx, camera, [
    { x: cx - 14, y: y + 0.12, z: cz - halfL + 150 },
    { x: cx - 6, y: y + 0.12, z: cz - halfL + 150 },
    { x: cx - 6, y: y + 0.12, z: cz - halfL + 190 },
    { x: cx - 14, y: y + 0.12, z: cz - halfL + 190 },
  ], PALETTE.runwayPaint);
  drawGroundQuad(ctx, camera, [
    { x: cx + 6, y: y + 0.12, z: cz - halfL + 150 },
    { x: cx + 14, y: y + 0.12, z: cz - halfL + 150 },
    { x: cx + 14, y: y + 0.12, z: cz - halfL + 190 },
    { x: cx + 6, y: y + 0.12, z: cz - halfL + 190 },
  ], PALETTE.runwayPaint);
}

function drawRing(ctx, camera, ring, color, pulse) {
  const axis = headingVector(ring.headingDeg);
  const side = { x: axis.z, z: -axis.x };
  const segments = 28;
  const outer = [];
  const inner = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const ox = ring.x + side.x * cos * (ring.radius + 3.4);
    const oz = ring.z + side.z * cos * (ring.radius + 3.4);
    const oy = ring.y + sin * (ring.radius + 3.4);
    const ix = ring.x + side.x * cos * (ring.radius - 3.4);
    const iz = ring.z + side.z * cos * (ring.radius - 3.4);
    const iy = ring.y + sin * (ring.radius - 3.4);
    const po = projectPoint(camera, ox, oy, oz);
    const pi = projectPoint(camera, ix, iy, iz);
    if (!po || !pi) return;
    outer.push(po);
    inner.push(pi);
  }
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.22 + pulse * 0.25;
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(outer[0].x, outer[0].y);
  for (const p of outer) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.moveTo(outer[0].x, outer[0].y);
  for (const p of outer) ctx.lineTo(p.x, p.y);
  for (let i = inner.length - 1; i >= 0; i--) ctx.lineTo(inner[i].x, inner[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.55 + pulse * 0.35;
  ctx.strokeStyle = '#fff7d6';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(outer[0].x, outer[0].y);
  for (const p of outer) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawObjectiveMarkers(ctx, camera, state) {
  if (!state.mission) return;
  const def = state.mission.definition;
  const pulse = (Math.sin(state.time * 3.2) + 1) / 2;
  if (def.kind === 'rings') {
    const next = activeRing(state);
    for (const ring of def.rings) {
      if (ring.passed) drawRing(ctx, camera, ring, PALETTE.ringPassed, 0);
      else if (ring === next) drawRing(ctx, camera, ring, PALETTE.ringNext, pulse);
      else drawRing(ctx, camera, ring, PALETTE.ringWaiting, 0);
    }
  }
  if (def.kind === 'cargo') {
    const zone = def.dropZone;
    const groundY = Math.max(terrainHeightAt(zone.x, zone.z), 0) + 1;
    const center = projectPoint(camera, zone.x, groundY, zone.z);
    const edgeEast = projectPoint(camera, zone.x + zone.radius, groundY, zone.z);
    const edgeNorth = projectPoint(camera, zone.x, groundY, zone.z - zone.radius);
    if (center && edgeEast && edgeNorth) {
      const rx = Math.max(5, Math.abs(edgeEast.x - center.x));
      const ry = Math.max(3, Math.abs(edgeNorth.y - center.y));
      ctx.strokeStyle = PALETTE.targetRed;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(center.x, center.y, rx * 0.45, ry * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = PALETTE.targetRed;
      ctx.beginPath();
      ctx.arc(center.x, center.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 5; i++) {
      const puff = projectPoint(camera, zone.x + Math.sin(state.time + i) * 8, groundY + 14 + i * 16, zone.z);
      if (!puff) continue;
      ctx.fillStyle = 'rgba(240,240,235,0.5)';
      ctx.beginPath();
      ctx.arc(puff.x, puff.y, Math.max(3, puff.scale * 9), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (def.kind === 'checkpoints') {
    for (const point of def.checkpoints) {
      const base = projectPoint(camera, point.x, point.y + 2, point.z);
      const top = projectPoint(camera, point.x, point.y + point.ceiling, point.z);
      if (!base || !top) continue;
      ctx.strokeStyle = point.hit ? PALETTE.ringPassed : PALETTE.ringNext;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
      ctx.fillStyle = point.hit ? PALETTE.ringPassed : PALETTE.ringNext;
      ctx.beginPath();
      ctx.arc(top.x, top.y, Math.max(3, top.scale * 5), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawLandmarks(ctx, camera) {
  for (const mark of LANDMARKS) {
    const ground = Math.max(terrainHeightAt(mark.x, mark.z), 0);
    const base = projectPoint(camera, mark.x, ground, mark.z);
    if (!base || base.depth > 5200) continue;
    const s = base.scale;
    if (mark.name === 'lighthouse') {
      const top = projectPoint(camera, mark.x, ground + 42, mark.z);
      if (!top) continue;
      ctx.fillStyle = '#f5f2e8';
      ctx.fillRect(base.x - 3 * s, top.y, 6 * s, base.y - top.y);
      ctx.fillStyle = PALETTE.targetRed;
      ctx.fillRect(base.x - 3 * s, top.y + (base.y - top.y) * 0.35, 6 * s, (base.y - top.y) * 0.18);
      ctx.fillStyle = '#ffd98a';
      ctx.beginPath();
      ctx.arc(top.x, top.y, Math.max(2, 3 * s), 0, Math.PI * 2);
      ctx.fill();
    } else if (mark.name === 'windmill') {
      const top = projectPoint(camera, mark.x, ground + 30, mark.z);
      if (!top) continue;
      ctx.strokeStyle = '#f5f2e8';
      ctx.lineWidth = Math.max(1, 1.6 * s);
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const angle = i * (Math.PI / 2) + 0.6;
        ctx.beginPath();
        ctx.moveTo(top.x, top.y);
        ctx.lineTo(top.x + Math.cos(angle) * 11 * s, top.y + Math.sin(angle) * 11 * s);
        ctx.stroke();
      }
    } else if (mark.name === 'summit mast') {
      const top = projectPoint(camera, mark.x, ground + 55, mark.z);
      if (!top) continue;
      ctx.strokeStyle = '#39424e';
      ctx.lineWidth = Math.max(1, 1.4 * s);
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
      ctx.fillStyle = '#ff5a4e';
      ctx.beginPath();
      ctx.arc(top.x, top.y, Math.max(1.5, 2 * s), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#e8ddc8';
      const w = Math.max(2, 16 * s);
      const h = Math.max(2, 9 * s);
      ctx.fillRect(base.x - w / 2, base.y - h, w, h);
      ctx.fillStyle = '#b5563c';
      ctx.beginPath();
      ctx.moveTo(base.x - w / 2 - 2, base.y - h);
      ctx.lineTo(base.x, base.y - h - h * 0.7);
      ctx.lineTo(base.x + w / 2 + 2, base.y - h);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawClouds(ctx, camera, state) {
  const drawn = [];
  for (const cloud of state.clouds) {
    const p = projectPoint(camera, cloud.x, cloud.y, cloud.z);
    if (!p || p.depth > 9000 || p.depth < 700) continue;
    drawn.push({ cloud, p });
  }
  drawn.sort((a, b) => b.p.depth - a.p.depth);
  for (const { cloud, p } of drawn) {
    ctx.fillStyle = 'rgba(196,150,130,0.38)';
    for (let i = 0; i < cloud.puffs; i++) {
      const offset = (i - (cloud.puffs - 1) / 2) * cloud.radius * 0.34 * p.scale;
      ctx.beginPath();
      ctx.ellipse(p.x + offset, p.y + (7 + (i % 2) * 5) * p.scale, cloud.radius * 0.4 * p.scale, cloud.radius * 0.19 * p.scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,238,222,0.78)';
    for (let i = 0; i < cloud.puffs; i++) {
      const offset = (i - (cloud.puffs - 1) / 2) * cloud.radius * 0.34 * p.scale;
      ctx.beginPath();
      ctx.ellipse(p.x + offset, p.y + (i % 2) * 5 * p.scale, cloud.radius * 0.4 * p.scale, cloud.radius * 0.2 * p.scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,205,150,0.55)';
    for (let i = 0; i < cloud.puffs; i++) {
      const offset = (i - (cloud.puffs - 1) / 2) * cloud.radius * 0.3 * p.scale;
      ctx.beginPath();
      ctx.ellipse(p.x + offset, p.y - 5 * p.scale, cloud.radius * 0.24 * p.scale, cloud.radius * 0.1 * p.scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawCargoCrates(ctx, camera, state) {
  for (const crate of state.cargo) {
    const p = projectPoint(camera, crate.x, crate.y, crate.z);
    if (!p) continue;
    const size = clamp(4.5 * p.scale, 2, 26);
    ctx.fillStyle = '#a4713b';
    ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    ctx.strokeStyle = '#6e4a22';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(p.x - size / 2, p.y - size / 2, size, size);
    if (!crate.landed) {
      ctx.strokeStyle = 'rgba(245,242,232,0.9)';
      ctx.beginPath();
      ctx.moveTo(p.x - size, p.y - size * 1.6);
      ctx.lineTo(p.x + size, p.y - size * 1.6);
      ctx.lineTo(p.x, p.y - size / 2);
      ctx.closePath();
      ctx.stroke();
    }
  }
}

function hash01(a, b) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function drawTree(ctx, p, size, shade) {
  ctx.strokeStyle = '#5d4326';
  ctx.lineWidth = Math.max(1, size * 0.12);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x, p.y - size * 0.35);
  ctx.stroke();
  ctx.fillStyle = shade > 0.5 ? '#2f6b35' : '#3f7d45';
  ctx.beginPath();
  ctx.moveTo(p.x - size * 0.42, p.y - size * 0.25);
  ctx.lineTo(p.x + size * 0.42, p.y - size * 0.25);
  ctx.lineTo(p.x, p.y - size * 1.05);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade > 0.5 ? '#3f7d45' : '#57a047';
  ctx.beginPath();
  ctx.moveTo(p.x - size * 0.3, p.y - size * 0.62);
  ctx.lineTo(p.x + size * 0.3, p.y - size * 0.62);
  ctx.lineTo(p.x, p.y - size * 1.3);
  ctx.closePath();
  ctx.fill();
}

function drawHouse(ctx, p, size, roof) {
  const w = size;
  const h = size * 0.62;
  ctx.fillStyle = '#f5efe0';
  ctx.fillRect(p.x - w / 2, p.y - h, w, h);
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(p.x - w * 0.62, p.y - h);
  ctx.lineTo(p.x + w * 0.62, p.y - h);
  ctx.lineTo(p.x, p.y - h - size * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5d4326';
  ctx.fillRect(p.x - w * 0.09, p.y - h * 0.55, w * 0.18, h * 0.55);
  ctx.fillStyle = '#ffd98a';
  ctx.fillRect(p.x - w * 0.34, p.y - h * 0.72, w * 0.16, h * 0.2);
  ctx.fillRect(p.x + w * 0.18, p.y - h * 0.72, w * 0.16, h * 0.2);
}

function drawScenery(ctx, camera, state) {
  const features = [];
  const cell = WORLD.terrainCell;
  const half = WORLD.terrainGridHalf;
  const centerX = Math.round(state.plane.x / cell) * cell;
  const centerZ = Math.round(state.plane.z / cell) * cell;
  for (let iz = -half; iz < half; iz++) {
    for (let ix = -half; ix < half; ix++) {
      const x0 = centerX + ix * cell;
      const z0 = centerZ + iz * cell;
      const h = hash01(ix + centerX / cell, iz + centerZ / cell);
      if (h > 0.22) continue;
      const wx = x0 + hash01(ix * 3, iz) * cell;
      const wz = z0 + hash01(ix, iz * 7) * cell;
      const ground = terrainHeightAt(wx, wz);
      if (ground < 4 || ground > 210) continue;
      const p = projectPoint(camera, wx, ground, wz);
      if (!p || p.depth > 4300) continue;
      features.push({ depth: p.depth, kind: 'tree', p, size: clamp(15 * p.scale, 3, 44), shade: h });
      if (h < 0.1) {
        const p2 = projectPoint(camera, wx + 26, terrainHeightAt(wx + 26, wz + 18), wz + 18);
        if (p2 && p2.depth <= 4300) features.push({ depth: p2.depth, kind: 'tree', p: p2, size: clamp(12 * p2.scale, 3, 36), shade: 1 - h });
      }
    }
  }
  const hamlets = [
    { x: 350, z: 1250, r: 260, n: 11 },
    { x: -2650, z: 2050, r: 220, n: 9 },
    { x: -750, z: -950, r: 240, n: 10 },
    { x: 100, z: -520, r: 200, n: 8 },
    { x: 1750, z: -350, r: 180, n: 7 },
    { x: 650, z: 1500, r: 200, n: 8 },
  ];
  const roofs = ['#b5502f', '#8a5a33', '#7a4a3a', '#a03d2a'];
  for (const hamlet of hamlets) {
    for (let i = 0; i < hamlet.n; i++) {
      const wx = hamlet.x + (hash01(hamlet.x + i * 13, hamlet.z) - 0.5) * hamlet.r * 2;
      const wz = hamlet.z + (hash01(hamlet.x, hamlet.z + i * 17) - 0.5) * hamlet.r * 2;
      const ground = terrainHeightAt(wx, wz);
      if (ground < 2) continue;
      const p = projectPoint(camera, wx, ground, wz);
      if (!p || p.depth > 5200) continue;
      features.push({ depth: p.depth, kind: 'house', p, size: clamp(13 * p.scale, 3, 34), roof: roofs[i % roofs.length] });
    }
  }
  features.sort((a, b) => b.depth - a.depth);
  for (const f of features) {
    if (f.kind === 'tree') drawTree(ctx, f.p, f.size, f.shade);
    else drawHouse(ctx, f.p, f.size, f.roof);
  }
  const roads = [
    [[350, 1250], [900, 1900]],
    [[-2650, 2050], [350, 1250]],
    [[1750, -350], [350, 1250]],
    [[350, 1250], [-350, -1150]],
    [[-750, -950], [100, -520]],
  ];
  ctx.strokeStyle = 'rgba(232,217,174,0.95)';
  ctx.lineCap = 'round';
  for (const [[ax, az], [bx, bz]] of roads) {
    const steps = 26;
    let prev = null;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const wx = ax + (bx - ax) * t;
      const wz = az + (bz - az) * t;
      const p = projectPoint(camera, wx, Math.max(terrainHeightAt(wx, wz), 0) + 0.8, wz);
      if (p && prev && p.depth < 5600) {
        ctx.lineWidth = clamp(2.4 * p.scale, 1, 7);
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      prev = p;
    }
  }
}

function drawPlaneShadow(ctx, camera, state) {
  if (state.cameraMode === 'cockpit' || state.screen === 'menu') return;
  const plane = state.plane;
  const groundY = Math.max(terrainHeightAt(plane.x, plane.z), 0) + 0.5;
  const p = projectPoint(camera, plane.x, groundY, plane.z);
  if (!p) return;
  const heightAbove = clamp(plane.y - groundY, 0, 600);
  const size = clamp(16 * p.scale * (1 - heightAbove / 1400), 3, 60);
  ctx.fillStyle = `rgba(16,32,47,${clamp(0.36 - heightAbove / 2200, 0.05, 0.36)})`;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(degToRad(plane.bankDeg) * 0.35);
  ctx.beginPath();
  ctx.ellipse(size * 0.06, 0, size * 1.3, size * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.08, size * 0.18, size * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-size * 0.04, size * 0.34, size * 0.56, size * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (state.landingSmoke) {
    for (let i = 0; i < 6; i++) {
      const puff = projectPoint(camera, plane.x - 4 + i * 1.6, groundY + 1 + i * 0.7, plane.z + 6 + i * 2.2);
      if (!puff) continue;
      ctx.fillStyle = `rgba(235,238,240,${0.5 - i * 0.06})`;
      ctx.beginPath();
      ctx.arc(puff.x, puff.y, Math.max(3, puff.scale * (4 + i * 1.6)), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawWorld(ctx, state, width, height) {
  const camera = makeCamera(state, width, height);
  drawSky(ctx, camera);
  drawSeaHorizon(ctx, camera);
  drawTerrain(ctx, camera, state);
  drawRunway(ctx, camera);
  drawObjectiveMarkers(ctx, camera, state);
  drawLandmarks(ctx, camera);
  drawScenery(ctx, camera, state);
  drawCargoCrates(ctx, camera, state);
  drawPlaneShadow(ctx, camera, state);
  drawClouds(ctx, camera, state);
  return camera;
}
