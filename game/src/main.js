// Coastline Courier boot and game loop: sizes the canvas, wires input and
// audio, advances the sortie (flight model, objectives, timers), and draws
// world, aircraft, cockpit, HUD and screens in that order each frame.

import { createGameState, resetSortie } from './state.js';
import { createInput, readInput, consumePresses } from './input.js';
import { updateAircraft } from './aircraft.js';
import { dropCargo, updateObjectives } from './missions.js';
import { drawWorld } from './render-world.js';
import { drawChaseAircraft, drawCockpit } from './render-aircraft.js';
import { drawHud } from './render-hud.js';
import { drawMenu, drawPause, drawResults, finalizeResult, missionCardRects } from './screens.js';
import { createAudio } from './audio.js';
import { applyShotPreset } from './shots.js';

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
const ctx = canvas.getContext('2d');
const state = createGameState();
const input = createInput(canvas);
const audio = createAudio();
let viewWidth = 0;
let viewHeight = 0;
let lastTimestamp = 0;
let lastScore = 0;

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  viewWidth = window.innerWidth;
  viewHeight = window.innerHeight;
  canvas.width = Math.round(viewWidth * dpr);
  canvas.height = Math.round(viewHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function startMission(index) {
  audio.unlock();
  resetSortie(state, index);
  lastScore = 0;
}

function handleMenuPresses(presses) {
  if (presses.menuChoice >= 0) state.missionIndex = presses.menuChoice;
  if (presses.clicked) {
    const px = presses.clicked.x * viewWidth;
    const py = presses.clicked.y * viewHeight;
    for (const card of missionCardRects(viewWidth, viewHeight)) {
      if (px >= card.x && px <= card.x + card.w && py >= card.y && py <= card.y + card.h) {
        startMission(card.index);
        return;
      }
    }
  }
  if (presses.confirm) startMission(state.missionIndex);
}

function handleFlyingPresses(presses) {
  if (presses.camera) {
    state.cameraMode = state.cameraMode === 'chase' ? 'cockpit' : 'chase';
  }
  if (presses.drop && dropCargo(state)) audio.cargo();
  if (presses.pause) state.screen = 'paused';
  if (presses.restart) startMission(state.missionIndex);
}

function updateFlying(dt) {
  const presses = consumePresses(input);
  handleFlyingPresses(presses);
  if (state.screen !== 'flying') return;
  state.sortieTime += dt;
  const controls = readInput(input);
  const events = updateAircraft(state, controls, dt);
  updateObjectives(state, dt);
  if (state.score > lastScore) {
    if (state.popup.includes('RING') || state.popup.includes('CHECKPOINT')) audio.ring();
    lastScore = state.score;
  }
  if (events.touchdown) {
    audio.touchdown();
    if (events.touchdown.crashed) {
      state.landing = events.touchdown;
      finalizeResult(state);
      return;
    }
  }
  if (events.stopped && state.landing) {
    finalizeResult(state);
    return;
  }
  audio.updateEngine(state.plane.throttle, state.plane.speed, state.plane.engineOn);
}

function updateTimers(dt) {
  if (state.messageTimer > 0) state.messageTimer -= dt;
  if (state.popupTimer > 0) state.popupTimer -= dt;
}

function updateGame(dt) {
  state.time += dt;
  updateTimers(dt);
  if (state.screen === 'menu') {
    state.menuOrbit += dt * 0.07;
    handleMenuPresses(consumePresses(input));
  } else if (state.screen === 'flying') {
    updateFlying(dt);
  } else if (state.screen === 'paused') {
    const presses = consumePresses(input);
    if (presses.pause) state.screen = 'flying';
    if (presses.restart) startMission(state.missionIndex);
  } else if (state.screen === 'results') {
    const presses = consumePresses(input);
    if (presses.confirm) state.screen = 'menu';
    if (presses.restart) startMission(state.missionIndex);
  }
  statusLine.textContent = state.message;
}

function drawGame() {
  const camera = drawWorld(ctx, state, viewWidth, viewHeight);
  drawChaseAircraft(ctx, camera, state);
  drawCockpit(ctx, state, viewWidth, viewHeight);
  drawHud(ctx, state, viewWidth, viewHeight);
  if (state.screen === 'menu') drawMenu(ctx, state, viewWidth, viewHeight);
  if (state.screen === 'paused') drawPause(ctx, viewWidth, viewHeight);
  if (state.screen === 'results') drawResults(ctx, state, viewWidth, viewHeight);
}

function frame(timestamp) {
  const dt = Math.min(0.033, (timestamp - lastTimestamp) / 1000 || 0.016);
  lastTimestamp = timestamp;
  if (!state.frozenForShot) updateGame(dt);
  drawGame();
  requestAnimationFrame(frame);
}

const shotName = new URLSearchParams(window.location.search).get('shot');
if (shotName) applyShotPreset(state, shotName);
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
requestAnimationFrame(frame);
