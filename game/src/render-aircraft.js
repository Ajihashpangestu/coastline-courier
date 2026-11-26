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
  const scale = clamp(anchor.scale * 1.05, 2.4, plane.onGround ? 5.1 : 4.7);
  const bankRad = degToRad(plane.bankDeg);
  const pitchScale = clamp(1 - plane.pitchDeg * 0.008, 0.88, 1.1);
  ctx.save();
  ctx.translate(anchor.x, anchor.y + 54 + (plane.onGround ? 66 : 0));
  ctx.rotate(bankRad * 0.9);
  ctx.scale(scale, scale * 0.54 * pitchScale);
  ctx.transform(1, 0, clamp(-0.07 - bankRad * 0.08, -0.13, -0.01), 1, 0, 0);
  drawPlaneShapes(ctx, state, plane);
  ctx.restore();
}

function drawWing(ctx, side) {
  const shade = ctx.createLinearGradient(side * 6, 0, side * 68, 0);
  shade.addColorStop(0, side < 0 ? '#f0643c' : '#d94e2c');
  shade.addColorStop(0.55, PALETTE.planeBody);
  shade.addColorStop(1, side < 0 ? '#c2432b' : '#a83a24');
  const underside = ctx.createLinearGradient(0, 0, 0, 18);
  underside.addColorStop(0, 'rgba(90,30,18,0.45)');
  underside.addColorStop(1, 'rgba(40,14,8,0.75)');
  ctx.fillStyle = underside;
  ctx.beginPath();
  ctx.moveTo(side * 7, 7);
  ctx.quadraticCurveTo(side * 38, 0, side * 65, -3);
  ctx.quadraticCurveTo(side * 69, 1, side * 64, 7);
  ctx.quadraticCurveTo(side * 36, 13, side * 8, 18);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = side < 0 ? 'rgba(255,210,150,0.9)' : 'rgba(255,190,120,0.55)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(side * 6, -4);
  ctx.quadraticCurveTo(side * 38, -10, side * 66, -8);
  ctx.stroke();
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.moveTo(side * 6, 3);
  ctx.quadraticCurveTo(side * 36, -4, side * 64, -7);
  ctx.quadraticCurveTo(side * 69, -3, side * 64, 3);
  ctx.quadraticCurveTo(side * 35, 9, side * 7, 14);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,243,214,0.55)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(side * 9, 4);
  ctx.quadraticCurveTo(side * 36, -2, side * 61, -5);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(90,30,18,0.5)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(side * 24, 1);
  ctx.quadraticCurveTo(side * 25, 6, side * 24, 11);
  ctx.moveTo(side * 42, -2);
  ctx.quadraticCurveTo(side * 43, 3, side * 42, 8);
  ctx.moveTo(side * 14, 11);
  ctx.quadraticCurveTo(side * 34, 7, side * 58, 3);
  ctx.stroke();
  ctx.fillStyle = 'rgba(247,243,232,0.88)';
  ctx.beginPath();
  ctx.ellipse(side * 54, -1, 5.2, 1.8, side * -0.08, 0, Math.PI * 2);
  ctx.fill();
}

function drawNavLight(ctx, x, y, color) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 7);
  glow.addColorStop(0, color);
  glow.addColorStop(0.35, color);
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 2.1, 0, Math.PI * 2);
  ctx.fill();
}

function drawLandingGear(ctx) {
  ctx.strokeStyle = '#27313d';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-13, 14);
  ctx.lineTo(-17, 27);
  ctx.moveTo(13, 14);
  ctx.lineTo(17, 27);
  ctx.moveTo(0, 30);
  ctx.lineTo(0, 39);
  ctx.stroke();
  ctx.fillStyle = '#1c242e';
  for (const x of [-17, 17]) {
    ctx.beginPath();
    ctx.ellipse(x, 29, 4.6, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8b96a5';
    ctx.beginPath();
    ctx.arc(x, 29, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c242e';
  }
  ctx.beginPath();
  ctx.ellipse(0, 41, 3.2, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlaneShapes(ctx, state, plane) {
  const propSpin = state.time * 40;
  const propBlur = ctx.createLinearGradient(-19, 0, 19, 0);
  propBlur.addColorStop(0, 'rgba(39,49,61,0)');
  propBlur.addColorStop(0.5, 'rgba(39,49,61,0.13)');
  propBlur.addColorStop(1, 'rgba(39,49,61,0)');
  ctx.fillStyle = propBlur;
  ctx.beginPath();
  ctx.ellipse(0, -45, 19, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(39,49,61,0.22)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(Math.cos(propSpin) * 17, -45 + Math.sin(propSpin) * 2);
  ctx.lineTo(-Math.cos(propSpin) * 17, -45 - Math.sin(propSpin) * 2);
  ctx.stroke();
  ctx.fillStyle = '#27313d';
  ctx.beginPath();
  ctx.ellipse(0, -43, 4.4, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(0, -2.5);
  ctx.scale(0.94, 0.94);
  drawWing(ctx, -1);
  ctx.restore();
  ctx.save();
  ctx.translate(0, 2.5);
  ctx.scale(1.06, 1.06);
  drawWing(ctx, 1);
  ctx.restore();
  const fuselageShade = ctx.createLinearGradient(-12, 0, 12, 0);
  fuselageShade.addColorStop(0, '#f0643c');
  fuselageShade.addColorStop(0.38, PALETTE.planeBody);
  fuselageShade.addColorStop(0.72, '#c2432b');
  fuselageShade.addColorStop(1, '#8f3120');
  ctx.fillStyle = fuselageShade;
  ctx.beginPath();
  ctx.moveTo(0, -44);
  ctx.quadraticCurveTo(6.5, -42, 7.5, -34);
  ctx.quadraticCurveTo(10.5, -18, 10.5, -2);
  ctx.quadraticCurveTo(10, 14, 7, 28);
  ctx.quadraticCurveTo(5, 38, 2.5, 43);
  ctx.lineTo(-2.5, 43);
  ctx.quadraticCurveTo(-5, 38, -7, 28);
  ctx.quadraticCurveTo(-10, 14, -10.5, -2);
  ctx.quadraticCurveTo(-10.5, -18, -7.5, -34);
  ctx.quadraticCurveTo(-6.5, -42, 0, -44);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,243,214,0.28)';
  ctx.beginPath();
  ctx.ellipse(-4.5, -6, 2.2, 24, 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-5.5, -34);
  ctx.quadraticCurveTo(-7.5, -6, -5, 22);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,220,170,0.35)';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(-3, -38);
  ctx.quadraticCurveTo(-4.5, -10, -3, 18);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,205,140,0.85)';
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(-2.5, -44);
  ctx.quadraticCurveTo(-8.5, -30, -9.5, -4);
  ctx.quadraticCurveTo(-9, 16, -4.5, 30);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,190,120,0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(2, -44);
  ctx.quadraticCurveTo(8, -28, 9, -2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(90,30,18,0.22)';
  ctx.beginPath();
  ctx.ellipse(6.5, 8, 2.4, 22, -0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(247,243,232,0.72)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-7, -30);
  ctx.quadraticCurveTo(-9, -4, -6, 24);
  ctx.moveTo(7, -30);
  ctx.quadraticCurveTo(9, -4, 6, 24);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(90,30,18,0.45)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-7, -32);
  ctx.quadraticCurveTo(0, -29, 7, -32);
  ctx.moveTo(-9, 16);
  ctx.quadraticCurveTo(0, 19, 9, 16);
  ctx.stroke();
  const canopyShade = ctx.createLinearGradient(-7, -24, 7, 4);
  canopyShade.addColorStop(0, '#dff6ff');
  canopyShade.addColorStop(0.35, '#7fc7de');
  canopyShade.addColorStop(0.75, '#2f6f8f');
  canopyShade.addColorStop(1, '#1d4b63');
  ctx.fillStyle = canopyShade;
  ctx.beginPath();
  ctx.moveTo(0, -25);
  ctx.quadraticCurveTo(6.8, -22, 7, -10);
  ctx.quadraticCurveTo(6.5, 1, 3, 5);
  ctx.lineTo(-3, 5);
  ctx.quadraticCurveTo(-6.5, 1, -7, -10);
  ctx.quadraticCurveTo(-6.8, -22, 0, -25);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,243,214,0.85)';
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(29,75,99,0.65)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.quadraticCurveTo(1, -10, 0, 4);
  ctx.moveTo(-6.5, -11);
  ctx.quadraticCurveTo(0, -8, 6.5, -11);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.ellipse(-2.4, -16, 1.5, 5.2, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,214,160,0.4)';
  ctx.beginPath();
  ctx.ellipse(2.6, -6, 1.3, 6.5, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-4.5, -20);
  ctx.quadraticCurveTo(0, -14, 4.5, -19);
  ctx.stroke();
  ctx.fillStyle = 'rgba(90,30,18,0.35)';
  for (const y of [-28, 8, 22]) {
    ctx.beginPath();
    ctx.arc(-8.2, y, 0.7, 0, Math.PI * 2);
    ctx.arc(8.2, y, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  if (plane.speed > 42) {
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 1.3;
    for (const offset of [-52, -34, 34, 52]) {
      const streak = 14 + (plane.speed - 42) * 0.5;
      ctx.beginPath();
      ctx.moveTo(offset, 16);
      ctx.lineTo(offset * 1.04, 16 + streak);
      ctx.stroke();
    }
  }
  const tailShade = ctx.createLinearGradient(-28, 0, 28, 0);
  tailShade.addColorStop(0, '#d94e2c');
  tailShade.addColorStop(0.5, PALETTE.planeBody);
  tailShade.addColorStop(1, '#a83a24');
  ctx.fillStyle = tailShade;
  ctx.beginPath();
  ctx.moveTo(-5, 29);
  ctx.quadraticCurveTo(-18, 25, -29, 26);
  ctx.quadraticCurveTo(-30, 30, -26, 32);
  ctx.quadraticCurveTo(-15, 34, -4, 35);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(5, 29);
  ctx.quadraticCurveTo(18, 25, 29, 26);
  ctx.quadraticCurveTo(30, 30, 26, 32);
  ctx.quadraticCurveTo(15, 34, 4, 35);
  ctx.closePath();
  ctx.fill();
  const finShade = ctx.createLinearGradient(-5, 0, 6, 0);
  finShade.addColorStop(0, '#f0643c');
  finShade.addColorStop(0.55, PALETTE.planeBody);
  finShade.addColorStop(1, '#8f3120');
  ctx.fillStyle = finShade;
  ctx.beginPath();
  ctx.moveTo(-4, 42);
  ctx.quadraticCurveTo(-4.5, 27, -2, 13);
  ctx.quadraticCurveTo(0, 7, 2.4, 13);
  ctx.quadraticCurveTo(4.5, 27, 4, 42);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,30,18,0.55)';
  ctx.lineWidth = 0.9;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(247,243,232,0.8)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(2, 15);
  ctx.quadraticCurveTo(2.8, 28, 2.4, 41);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(90,30,18,0.5)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-18, 29);
  ctx.quadraticCurveTo(-16, 31, -15, 33);
  ctx.moveTo(18, 29);
  ctx.quadraticCurveTo(16, 31, 15, 33);
  ctx.stroke();
  if (plane.onGround) drawLandingGear(ctx);
  const blink = Math.sin(state.time * 6) > 0.4;
  drawNavLight(ctx, -62, -4, '#ff4b3e');
  drawNavLight(ctx, 70, 0, '#3ee06f');
  if (blink) drawNavLight(ctx, 0, 43, '#ffffff');
  if (plane.hull < 55) {
    ctx.fillStyle = 'rgba(70,70,70,0.35)';
    ctx.beginPath();
    ctx.ellipse(4, -26, 7, 12, 0.2, 0, Math.PI * 2);
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
