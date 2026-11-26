// Keyboard and mouse input: arrows fly the aircraft, W/S work the throttle,
// A/D nudge the rudder, holding the mouse button turns pointer movement into
// a stick, and the wheel trims throttle. readInput folds it all into one
// small control object the flight model consumes.

import { clamp } from './config.js';

export function createInput(canvas) {
  const keys = new Set();
  const input = {
    pitch: 0,
    bank: 0,
    rudder: 0,
    throttle: 0,
    dropPressed: false,
    cameraPressed: false,
    pausePressed: false,
    restartPressed: false,
    confirmPressed: false,
    menuChoice: -1,
    pointerX: 0,
    pointerY: 0,
    pointerDown: false,
    mouseStick: false,
    wheelSteps: 0,
    clicked: null,
  };
  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    keys.add(key);
    if (key === ' ') input.dropPressed = true;
    if (key === 'c') input.cameraPressed = true;
    if (key === 'p' || key === 'escape') input.pausePressed = true;
    if (key === 'r') input.restartPressed = true;
    if (key === 'enter') input.confirmPressed = true;
    if (key >= '1' && key <= '4') input.menuChoice = Number(key) - 1;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.key.toLowerCase());
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.pointerX = (event.clientX - rect.left) / rect.width;
    input.pointerY = (event.clientY - rect.top) / rect.height;
    if (input.pointerDown) input.mouseStick = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    input.pointerDown = true;
    const rect = canvas.getBoundingClientRect();
    input.clicked = {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  });
  window.addEventListener('pointerup', () => {
    input.pointerDown = false;
    input.mouseStick = false;
  });
  canvas.addEventListener('wheel', (event) => {
    input.wheelSteps += event.deltaY < 0 ? 1 : -1;
    event.preventDefault();
  }, { passive: false });
  input.keys = keys;
  return input;
}

export function readInput(input) {
  const keys = input.keys;
  let pitch = 0;
  let bank = 0;
  if (keys.has('arrowup')) pitch += 1;
  if (keys.has('arrowdown')) pitch -= 1;
  if (keys.has('arrowleft')) bank -= 1;
  if (keys.has('arrowright')) bank += 1;
  if (input.mouseStick) {
    bank = clamp((input.pointerX - 0.5) * 2.6, -1, 1);
    pitch = clamp((0.5 - input.pointerY) * 2.6, -1, 1);
  }
  let throttle = 0;
  if (keys.has('w')) throttle += 1;
  if (keys.has('s')) throttle -= 1;
  throttle += clamp(input.wheelSteps, -1, 1) * 1.6;
  input.wheelSteps = 0;
  let rudder = 0;
  if (keys.has('a')) rudder -= 1;
  if (keys.has('d')) rudder += 1;
  return { pitch, bank, rudder, throttle };
}

export function consumePresses(input) {
  const presses = {
    drop: input.dropPressed,
    camera: input.cameraPressed,
    pause: input.pausePressed,
    restart: input.restartPressed,
    confirm: input.confirmPressed,
    menuChoice: input.menuChoice,
    clicked: input.clicked,
  };
  input.dropPressed = false;
  input.cameraPressed = false;
  input.pausePressed = false;
  input.restartPressed = false;
  input.confirmPressed = false;
  input.menuChoice = -1;
  input.clicked = null;
  return presses;
}
