// Screens and scoring: the mission menu over the live island, the pause
// overlay, and the landing report that turns objectives, time, fuel and
// touchdown quality into a final grade.

import { PALETTE } from './config.js';
import { MISSIONS } from './missions.js';

function panel(ctx, x, y, w, h, alpha = 0.92) {
  ctx.fillStyle = `rgba(246,248,244,${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(16,32,47,0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function missionCardRects(width, height) {
  const cardW = Math.min(250, width * 0.21);
  const cardH = 150;
  const gap = 16;
  const totalW = cardW * 4 + gap * 3;
  const startX = width / 2 - totalW / 2;
  const y = height * 0.52;
  return MISSIONS.map((mission, i) => ({
    x: startX + i * (cardW + gap),
    y,
    w: cardW,
    h: cardH,
    mission,
    index: i,
  }));
}

export function drawMenu(ctx, state, width, height) {
  ctx.fillStyle = 'rgba(10,24,38,0.35)';
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 54px system-ui, sans-serif';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(16,32,47,0.65)';
  ctx.strokeText('COASTLINE COURIER', width / 2, height * 0.2);
  ctx.fillText('COASTLINE COURIER', width / 2, height * 0.2);
  ctx.font = '600 19px system-ui, sans-serif';
  ctx.fillText('Island flight missions — rings, cargo and careful landings', width / 2, height * 0.2 + 34);
  for (const card of missionCardRects(width, height)) {
    const selected = card.index === state.missionIndex;
    panel(ctx, card.x, card.y, card.w, card.h, selected ? 0.97 : 0.88);
    if (selected) {
      ctx.strokeStyle = PALETTE.hudAccent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(card.x, card.y, card.w, card.h, 14);
      ctx.stroke();
    }
    ctx.fillStyle = PALETTE.hudInk;
    ctx.textAlign = 'left';
    ctx.font = '800 19px system-ui, sans-serif';
    ctx.fillText(`${card.index + 1}. ${card.mission.name}`, card.x + 16, card.y + 34);
    ctx.font = '500 13.5px system-ui, sans-serif';
    wrapText(ctx, card.mission.detail, card.x + 16, card.y + 58, card.w - 32, 18);
    ctx.font = '700 13px ui-monospace, monospace';
    const par = card.mission.parSeconds ? `PAR ${Math.floor(card.mission.parSeconds / 60)}:${String(card.mission.parSeconds % 60).padStart(2, '0')}` : 'NO CLOCK';
    ctx.fillText(par, card.x + 16, card.y + card.h - 16);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText('Click a mission or press 1–4, then Enter to take off', width / 2, height * 0.52 + 186);
  ctx.font = '500 14.5px system-ui, sans-serif';
  ctx.fillText('Arrows fly · W/S throttle · A/D rudder · hold mouse to steer · wheel trims throttle · Space drops cargo · C camera · P pause', width / 2, height - 26);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

export function drawPause(ctx, width, height) {
  ctx.fillStyle = 'rgba(10,24,38,0.45)';
  ctx.fillRect(0, 0, width, height);
  const w = 420;
  const h = 210;
  const x = width / 2 - w / 2;
  const y = height / 2 - h / 2;
  panel(ctx, x, y, w, h);
  ctx.fillStyle = PALETTE.hudInk;
  ctx.textAlign = 'center';
  ctx.font = '800 30px system-ui, sans-serif';
  ctx.fillText('PAUSED', width / 2, y + 52);
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText('P or Esc to resume · R to restart the sortie', width / 2, y + 96);
  ctx.font = '500 14.5px system-ui, sans-serif';
  ctx.fillText('Arrows fly · W/S throttle · Space cargo · C camera', width / 2, y + 132);
  ctx.fillText('Land gently on the runway to finish the mission.', width / 2, y + 158);
}

export function finalizeResult(state) {
  const mission = state.mission;
  const def = mission.definition;
  const landing = state.landing || { grade: 'crash', descent: 0, speed: 0, onRunway: false, centerline: 999 };
  const crashed = landing.grade === 'crash' || state.plane.hull <= 0;
  let objectivePoints = state.score;
  let timeBonus = 0;
  if (!crashed && def.parSeconds > 0 && mission.objectivesDone) {
    timeBonus = Math.max(0, Math.round((def.parSeconds - state.sortieTime) * 3));
  }
  const landingPoints = crashed ? 0 : { butter: 400, smooth: 300, firm: 180, rough: 80 }[landing.grade] || 0;
  const centerlineBonus = !crashed && landing.onRunway ? Math.max(0, Math.round(120 - landing.centerline * 2)) : 0;
  const fuelBonus = crashed ? 0 : Math.round(state.plane.fuel * 1.5);
  const incompletePenalty = !mission.objectivesDone && def.kind !== 'free' ? -250 : 0;
  const total = Math.max(0, objectivePoints + timeBonus + landingPoints + centerlineBonus + fuelBonus + incompletePenalty);
  let grade = 'C';
  if (crashed) grade = '—';
  else if (total >= 1900) grade = 'S';
  else if (total >= 1400) grade = 'A';
  else if (total >= 900) grade = 'B';
  state.result = {
    crashed,
    objectivePoints,
    timeBonus,
    landingPoints,
    centerlineBonus,
    fuelBonus,
    incompletePenalty,
    total,
    grade,
    landing,
    objectivesDone: mission.objectivesDone,
  };
  state.screen = 'results';
  return state.result;
}

export function drawResults(ctx, state, width, height) {
  if (!state.result) return;
  const result = state.result;
  const landing = result.landing;
  ctx.fillStyle = 'rgba(10,24,38,0.35)';
  ctx.fillRect(0, 0, width, height);
  const w = 520;
  const h = 430;
  const x = width / 2 - w / 2;
  const y = height / 2 - h / 2;
  panel(ctx, x, y, w, h, 0.96);
  ctx.fillStyle = PALETTE.hudInk;
  ctx.textAlign = 'center';
  ctx.font = '800 30px system-ui, sans-serif';
  ctx.fillText(result.crashed ? 'AIRCRAFT DOWN' : 'LANDING REPORT', width / 2, y + 48);
  ctx.font = '700 18px system-ui, sans-serif';
  const verdict = result.crashed
    ? 'The sortie ended in a crash. The island keeps the wreck.'
    : landing.grade === 'butter'
      ? 'A butter-smooth touchdown on the centreline.'
      : landing.grade === 'smooth'
        ? 'A smooth arrival. The courier van is already waiting.'
        : landing.grade === 'firm'
          ? 'A firm arrival, but everything still works.'
          : 'A rough arrival. The mechanics have questions.';
  ctx.fillText(verdict, width / 2, y + 80);
  ctx.textAlign = 'left';
  ctx.font = '600 16px ui-monospace, monospace';
  const rows = [
    ['Objectives', result.objectivePoints],
    ['Time bonus', result.timeBonus],
    [`Landing (${landing.grade})`, result.landingPoints],
    ['Centreline', result.centerlineBonus],
    ['Fuel remaining', result.fuelBonus],
  ];
  if (result.incompletePenalty) rows.push(['Objectives incomplete', result.incompletePenalty]);
  rows.forEach((row, i) => {
    ctx.fillText(row[0], x + 44, y + 128 + i * 30);
    ctx.textAlign = 'right';
    ctx.fillText(String(row[1]), x + w - 44, y + 128 + i * 30);
    ctx.textAlign = 'left';
  });
  const totalY = y + 128 + rows.length * 30 + 12;
  ctx.strokeStyle = 'rgba(16,32,47,0.3)';
  ctx.beginPath();
  ctx.moveTo(x + 44, totalY - 22);
  ctx.lineTo(x + w - 44, totalY - 22);
  ctx.stroke();
  ctx.font = '800 22px ui-monospace, monospace';
  ctx.fillText('TOTAL', x + 44, totalY + 8);
  ctx.textAlign = 'right';
  ctx.fillText(String(result.total), x + w - 44, totalY + 8);
  ctx.textAlign = 'center';
  ctx.font = '800 44px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.hudAccent;
  ctx.fillText(`GRADE ${result.grade}`, width / 2, totalY + 62);
  ctx.fillStyle = PALETTE.hudInk;
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillText('Enter for the menu · R to fly this mission again', width / 2, y + h - 24);
}
