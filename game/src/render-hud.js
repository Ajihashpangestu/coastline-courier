// Heads-up display: altitude, speed and heading readouts, a compass ribbon,
// mission card, throttle/fuel/hull bars, a navigation arrow to the active
// objective, a small island minimap and transient message banners.

import { DISPLAY, PALETTE, RUNWAY, clamp, headingVector, wrapDegrees } from './config.js';
import { activeRing, objectiveText } from './missions.js';
import { altitudeAboveGround } from './aircraft.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(16,32,47,0.28)';
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 4, w, h, 10);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudPaper;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(16,32,47,0.38)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 10, y + 1.5);
  ctx.lineTo(x + w - 10, y + 1.5);
  ctx.stroke();
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function drawMiniAttitude(ctx, x, y, radius, pitchDeg, bankDeg) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate((bankDeg * Math.PI) / 180);
  const shift = clamp(pitchDeg * 0.9, -radius * 0.7, radius * 0.7);
  ctx.fillStyle = '#4a90c4';
  ctx.fillRect(-radius, -radius + shift, radius * 2, radius);
  ctx.fillStyle = '#8a6b45';
  ctx.fillRect(-radius, shift, radius * 2, radius);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-radius, shift);
  ctx.lineTo(radius, shift);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#39424e';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#ffd23d';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(x - radius * 0.55, y);
  ctx.lineTo(x - radius * 0.15, y);
  ctx.moveTo(x + radius * 0.15, y);
  ctx.lineTo(x + radius * 0.55, y);
  ctx.stroke();
}

function drawMiniGauge(ctx, x, y, radius, label, fraction, valueText) {
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
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,217,138,0.85)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i <= 8; i++) {
    const angle = Math.PI * 0.75 + (i / 8) * Math.PI * 1.5;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * radius * 0.78, y + Math.sin(angle) * radius * 0.78);
    ctx.lineTo(x + Math.cos(angle) * radius * 0.92, y + Math.sin(angle) * radius * 0.92);
    ctx.stroke();
  }
  const needle = Math.PI * 0.75 + clamp(fraction, 0, 1) * Math.PI * 1.5;
  ctx.strokeStyle = '#ff9f2e';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(needle) * radius * 0.78, y + Math.sin(needle) * radius * 0.78);
  ctx.stroke();
  ctx.fillStyle = PALETTE.gaugeLit;
  ctx.beginPath();
  ctx.arc(x, y, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '700 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + radius * 0.58);
  ctx.fillStyle = PALETTE.hudInk;
  ctx.font = '700 10px ui-monospace, monospace';
  ctx.fillText(valueText, x, y + radius * 1.24);
}

function drawInstrumentStrip(ctx, state, width, height) {
  const plane = state.plane;
  const w = 352;
  const x = width / 2 - w / 2;
  const y = height - 96;
  panel(ctx, x, y, w, 82);
  const cy = y + 32;
  drawMiniAttitude(ctx, x + 52, cy, 25, plane.pitchDeg, plane.bankDeg);
  const altFt = plane.y * DISPLAY.metersToFeet;
  drawMiniGauge(ctx, x + 132, cy, 25, 'ALT', (altFt % 1000) / 1000, `${Math.round(altFt)}`);
  drawMiniGauge(ctx, x + 212, cy, 25, 'HDG', wrapDegrees(plane.headingDeg) / 360, `${String(Math.round(wrapDegrees(plane.headingDeg))).padStart(3, '0')}°`);
  drawMiniGauge(ctx, x + 292, cy, 25, 'VSI', clamp((plane.verticalSpeed * 196.85 + 2000) / 4000, 0, 1), `${Math.round(plane.verticalSpeed * 196.85)}`);
}

function drawFlightData(ctx, state, width) {
  const plane = state.plane;
  panel(ctx, 16, 14, 380, 96);
  ctx.fillStyle = PALETTE.hudInk;
  ctx.textAlign = 'left';
  const altFt = Math.round(plane.y * DISPLAY.metersToFeet);
  const speedKt = Math.round(plane.speed * DISPLAY.msToKnots);
  const heading = String(Math.round(wrapDegrees(plane.headingDeg))).padStart(3, '0');
  ctx.font = '700 23px ui-monospace, monospace';
  ctx.fillText(`ALT ${altFt} FT`, 30, 45);
  ctx.fillText(`SPD ${speedKt} KT`, 30, 73);
  ctx.fillText(`HDG ${heading}°`, 214, 45);
  const vsFpm = Math.round(plane.verticalSpeed * 196.85);
  ctx.font = '600 15px ui-monospace, monospace';
  ctx.fillStyle = vsFpm < -900 ? '#c0392b' : PALETTE.hudInk;
  ctx.fillText(`${vsFpm >= 0 ? '+' : ''}${vsFpm} FPM`, 214, 71);
  const aglFt = Math.round(altitudeAboveGround(plane) * DISPLAY.metersToFeet);
  ctx.fillStyle = PALETTE.hudInk;
  ctx.font = '600 13px ui-monospace, monospace';
  ctx.fillText(`AGL ${aglFt} FT  THR ${Math.round(plane.throttle * 100)}%`, 30, 97);
  drawMiniAttitude(ctx, 352, 58, 26, plane.pitchDeg, plane.bankDeg);
  void width;
}

function drawCompassRibbon(ctx, state, width) {
  const plane = state.plane;
  const w = 340;
  const x = width / 2 - w / 2;
  panel(ctx, x, 14, w, 44);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, 14, w, 44, 10);
  ctx.clip();
  ctx.fillStyle = PALETTE.hudInk;
  ctx.font = '700 15px ui-monospace, monospace';
  ctx.textAlign = 'center';
  const heading = wrapDegrees(plane.headingDeg);
  const firstMark = Math.floor((heading - 65) / 10) * 10;
  for (let mark = firstMark; mark <= heading + 65; mark += 10) {
    const value = wrapDegrees(mark);
    const px = width / 2 + (mark - heading) * 2.6;
    const cardinal = value % 90 === 0;
    const label = cardinal ? ['N', 'E', 'S', 'W'][value / 90] : value % 30 === 0 ? String(value / 10).padStart(2, '0') : '';
    ctx.fillRect(px, 46, cardinal ? 2.2 : 1.6, value % 30 === 0 ? 9 : 5);
    if (label) {
      ctx.font = cardinal ? '800 17px ui-monospace, monospace' : '700 14px ui-monospace, monospace';
      ctx.fillStyle = cardinal ? PALETTE.hudAccent : PALETTE.hudInk;
      ctx.fillText(label, px, 40);
      ctx.fillStyle = PALETTE.hudInk;
    }
  }
  ctx.restore();
  ctx.fillStyle = PALETTE.hudAccent;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 7, 14);
  ctx.lineTo(width / 2 + 7, 14);
  ctx.lineTo(width / 2, 26);
  ctx.closePath();
  ctx.fill();
}

function drawMissionCard(ctx, state, width) {
  const w = 300;
  const x = width - w - 16;
  panel(ctx, x, 14, w, 96);
  ctx.fillStyle = PALETTE.hudInk;
  ctx.textAlign = 'left';
  ctx.font = '700 17px system-ui, sans-serif';
  ctx.fillText(state.mission ? state.mission.definition.name : '', x + 16, 40);
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillText(objectiveText(state), x + 16, 64);
  ctx.font = '700 16px ui-monospace, monospace';
  ctx.fillText(`TIME ${formatTime(state.sortieTime)}   SCORE ${state.score}`, x + 16, 90);
}

function drawBars(ctx, state, height) {
  const plane = state.plane;
  const x = 16;
  const y = height - 118;
  panel(ctx, x, y, 240, 102);
  ctx.textAlign = 'left';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudInk;
  ctx.fillText('THROTTLE', x + 14, y + 24);
  ctx.fillText('FUEL', x + 14, y + 54);
  ctx.fillText('HULL', x + 14, y + 84);
  const barX = x + 92;
  const barW = 130;
  const rows = [
    { value: plane.throttle, color: PALETTE.hudAccent },
    { value: plane.fuel / 100, color: plane.fuel < 18 ? '#e4572e' : '#39c2c9' },
    { value: plane.hull / 100, color: plane.hull < 45 ? '#e4572e' : '#58d977' },
  ];
  rows.forEach((row, i) => {
    const by = y + 14 + i * 30;
    ctx.fillStyle = 'rgba(16,32,47,0.18)';
    ctx.beginPath();
    ctx.roundRect(barX, by, barW, 12, 6);
    ctx.fill();
    ctx.fillStyle = row.color;
    ctx.beginPath();
    ctx.roundRect(barX, by, barW * clamp(row.value, 0, 1), 12, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(16,32,47,0.35)';
    ctx.lineWidth = 1;
    for (let t = 1; t < 4; t++) {
      ctx.beginPath();
      ctx.moveTo(barX + (barW / 4) * t, by + 1);
      ctx.lineTo(barX + (barW / 4) * t, by + 11);
      ctx.stroke();
    }
    ctx.fillStyle = PALETTE.hudInk;
    ctx.font = '700 11px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(clamp(row.value, 0, 1) * 100)}%`, barX + barW - 4, by + 10);
    ctx.textAlign = 'left';
  });
}

function objectiveTarget(state) {
  if (!state.mission) return null;
  const def = state.mission.definition;
  if (state.mission.objectivesDone) return { x: RUNWAY.centerX, z: RUNWAY.centerZ, label: 'RUNWAY' };
  if (def.kind === 'rings') {
    const ring = activeRing(state);
    return ring ? { x: ring.x, z: ring.z, label: 'RING' } : null;
  }
  if (def.kind === 'cargo') return { x: def.dropZone.x, z: def.dropZone.z, label: 'DROP ZONE' };
  if (def.kind === 'checkpoints') {
    const next = def.checkpoints.find((c) => !c.hit);
    return next ? { x: next.x, z: next.z, label: 'CHECKPOINT' } : null;
  }
  return { x: RUNWAY.centerX, z: RUNWAY.centerZ, label: 'RUNWAY' };
}

function drawNavArrow(ctx, state, width, height) {
  const target = objectiveTarget(state);
  if (!target) return;
  const plane = state.plane;
  const dx = target.x - plane.x;
  const dz = target.z - plane.z;
  const distance = Math.sqrt(dx * dx + dz * dz);
  const targetHeading = wrapDegrees(Math.atan2(dx, -dz) * 57.2958);
  let relative = targetHeading - wrapDegrees(plane.headingDeg);
  if (relative > 180) relative -= 360;
  if (relative < -180) relative += 360;
  const cx = width / 2;
  const cy = height * 0.3;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((relative * Math.PI) / 180);
  ctx.fillStyle = PALETTE.ringNext;
  ctx.strokeStyle = PALETTE.hudInk;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(9, 8);
  ctx.lineTo(0, 2);
  ctx.lineTo(-9, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(16,32,47,0.6)';
  ctx.font = '700 14px ui-monospace, monospace';
  ctx.textAlign = 'center';
  const label = `${target.label} ${(distance / 1000).toFixed(1)} KM`;
  ctx.lineWidth = 3;
  ctx.strokeText(label, cx, cy + 34);
  ctx.fillText(label, cx, cy + 34);
}

function drawMinimap(ctx, state, width, height) {
  const size = 150;
  const x = width - size - 16;
  const y = height - size - 16;
  panel(ctx, x, y, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 10);
  ctx.clip();
  ctx.fillStyle = '#2b93a8';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#6fae4e';
  ctx.beginPath();
  ctx.ellipse(x + size / 2, y + size / 2, size * 0.4, size * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  const toMap = (wx, wz) => ({
    x: x + size / 2 + (wx / 11000) * size,
    y: y + size / 2 + (wz / 9000) * size,
  });
  const runway = toMap(RUNWAY.centerX, RUNWAY.centerZ);
  ctx.fillStyle = '#3c4148';
  ctx.fillRect(runway.x - 2, runway.y - 9, 4, 18);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', x + size / 2, y + 14);
  if (state.mission && state.mission.definition.kind === 'rings') {
    for (const ring of state.mission.definition.rings) {
      const rp = toMap(ring.x, ring.z);
      ctx.fillStyle = ring.passed ? PALETTE.ringPassed : PALETTE.ringWaiting;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const target = objectiveTarget(state);
  if (target) {
    const t = toMap(target.x, target.z);
    ctx.fillStyle = PALETTE.ringNext;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const planePos = toMap(state.plane.x, state.plane.z);
  const axis = headingVector(state.plane.headingDeg);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(planePos.x, planePos.y);
  ctx.lineTo(planePos.x + axis.x * 10, planePos.y + axis.z * 10);
  ctx.stroke();
  ctx.fillStyle = PALETTE.planeBody;
  ctx.beginPath();
  ctx.arc(planePos.x, planePos.y, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCenterReticle(ctx, state, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 26, cy);
  ctx.lineTo(cx - 14, cy);
  ctx.moveTo(cx + 14, cy);
  ctx.lineTo(cx + 26, cy);
  ctx.stroke();
  const agl = altitudeAboveGround(state.plane);
  if (!state.plane.onGround && agl < 60) {
    ctx.fillStyle = '#ff5a4e';
    ctx.font = '700 15px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`RADIO ALT ${Math.round(agl * DISPLAY.metersToFeet)} FT`, cx, cy + 44);
  }
}

function drawBanners(ctx, state, width) {
  ctx.textAlign = 'center';
  if (state.popupTimer > 0) {
    ctx.font = '800 30px system-ui, sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(16,32,47,0.75)';
    ctx.strokeText(state.popup, width / 2, 118);
    ctx.fillStyle = '#ffd23d';
    ctx.fillText(state.popup, width / 2, 118);
  }
  if (state.messageTimer > 0 && state.message) {
    ctx.font = '600 17px system-ui, sans-serif';
    const w = Math.min(width - 60, ctx.measureText(state.message).width + 36);
    panel(ctx, width / 2 - w / 2, 128, w, 36);
    ctx.fillStyle = PALETTE.hudInk;
    ctx.fillText(state.message, width / 2, 151);
  }
  if (state.plane.stalled) {
    ctx.font = '800 24px system-ui, sans-serif';
    ctx.fillStyle = '#ff5a4e';
    ctx.fillText('STALL — NOSE DOWN, ADD POWER', width / 2, 196);
  }
}

export function drawHud(ctx, state, width, height) {
  if (state.screen === 'menu') return;
  drawFlightData(ctx, state, width);
  drawCompassRibbon(ctx, state, width);
  drawMissionCard(ctx, state, width);
  if (state.cameraMode !== 'cockpit') {
    drawBars(ctx, state, height);
    drawInstrumentStrip(ctx, state, width, height);
    drawMinimap(ctx, state, width, height);
  }
  drawNavArrow(ctx, state, width, height);
  drawCenterReticle(ctx, state, width, height);
  drawBanners(ctx, state, width);
}
