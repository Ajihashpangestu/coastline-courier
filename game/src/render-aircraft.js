// Aircraft rendering: the chase-view aeroplane drawn as layered vector
// shapes with a spinning prop blur and blinking nav lights, and the cockpit
// view with a lit six-gauge panel, yoke and windshield frame.

import { DISPLAY, PALETTE, clamp, degToRad } from './config.js';
import { projectPoint } from './render-world.js';

export function drawChaseAircraft(ctx, camera, state) {
  if (state.screen === 'menu' || state.cameraMode === 'cockpit') return;
  const plane = state.plane;
  const anchor = projectPoint(camera, plane.x, plane.y, plane.z);
  if (!anchor) return;
  const scale = clamp(anchor.scale * 1.1, 2.2, 4.7);
  const bankRad = degToRad(plane.bankDeg);
  ctx.save();
  ctx.translate(anchor.x, anchor.y + 46);
  ctx.rotate(bankRad * 0.85);
  ctx.scale(scale, scale);
  drawPlaneShapes(ctx, state, plane);
  ctx.restore();
}

function drawPlaneShapes(ctx, state, plane) {
  const propSpin = state.time * 40;
  ctx.fillStyle = 'rgba(39,49,61,0.1)';
  ctx.beginPath();
  ctx.ellipse(0, -34, 21, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(39,49,61,0.28)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(Math.cos(propSpin) * 19, -34 + Math.sin(propSpin) * 2.4);
  ctx.lineTo(-Math.cos(propSpin) * 19, -34 - Math.sin(propSpin) * 2.4);
  ctx.stroke();
  ctx.fillStyle = PALETTE.planeDark;
  ctx.beginPath();
  ctx.moveTo(-58, 2);
  ctx.lineTo(58, 2);
  ctx.lineTo(50, 12);
  ctx.lineTo(-50, 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.planeBody;
  ctx.beginPath();
  ctx.moveTo(-56, 3);
  ctx.lineTo(56, 3);
  ctx.lineTo(49, 10);
  ctx.lineTo(-49, 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.planeTrim;
  ctx.fillRect(-56, 5.5, 112, 2);
  ctx.fillStyle = PALETTE.planeBody;
  ctx.beginPath();
  ctx.moveTo(-7, -36);
  ctx.lineTo(7, -36);
  ctx.lineTo(10, 26);
  ctx.lineTo(4, 34);
  ctx.lineTo(-4, 34);
  ctx.lineTo(-10, 26);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.planeTrim;
  ctx.beginPath();
  ctx.moveTo(-4.5, -20);
  ctx.lineTo(4.5, -20);
  ctx.lineTo(6, 4);
  ctx.lineTo(-6, 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#9fd4e8';
  ctx.beginPath();
  ctx.ellipse(0, -8, 5.4, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.planeBody;
  ctx.beginPath();
  ctx.moveTo(-3, 24);
  ctx.lineTo(3, 24);
  ctx.lineTo(3, 38);
  ctx.lineTo(-3, 38);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-20, 34);
  ctx.lineTo(20, 34);
  ctx.lineTo(16, 40);
  ctx.lineTo(-16, 40);
  ctx.closePath();
  ctx.fill();
  const blink = Math.sin(state.time * 6) > 0.4;
  ctx.fillStyle = '#ff4b3e';
  ctx.beginPath();
  ctx.arc(-57, 6, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3ee06f';
  ctx.beginPath();
  ctx.arc(57, 6, 2.2, 0, Math.PI * 2);
  ctx.fill();
  if (blink) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 39, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (plane.hull < 55) {
    ctx.fillStyle = 'rgba(70,70,70,0.35)';
    ctx.beginPath();
    ctx.ellipse(4, -26, 7, 12, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGauge(ctx, x, y, radius, label, needleAngle, ticks) {
  ctx.fillStyle = PALETTE.gaugeFace;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.gaugeLit;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,217,138,0.75)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < ticks; i++) {
    const angle = Math.PI * 0.75 + (i / (ticks - 1)) * Math.PI * 1.5;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * radius * 0.78, y + Math.sin(angle) * radius * 0.78);
    ctx.lineTo(x + Math.cos(angle) * radius * 0.92, y + Math.sin(angle) * radius * 0.92);
    ctx.stroke();
  }
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
  ctx.font = `600 ${Math.max(9, radius * 0.3)}px system-ui, sans-serif`;
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
  ctx.fillStyle = '#222b36';
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
  const yokeX = width * 0.5;
  const yokeY = height * 0.93;
  ctx.strokeStyle = '#39424e';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(yokeX, yokeY, width * 0.045, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(yokeX, yokeY + 6);
  ctx.lineTo(yokeX, height);
  ctx.stroke();
  const warning = plane.stalled ? 'STALL' : plane.fuel < 18 ? 'LOW FUEL' : plane.hull < 45 ? 'HULL' : '';
  if (warning) {
    ctx.fillStyle = '#ff5a4e';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(warning, width * 0.5, panelTop + 22);
  }
}
