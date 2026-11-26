// Aircraft flight model: throttle, pitch and bank discipline, stall and
// sink, fuel burn, wind drift, ground handling and landing judgement.
// updateAircraft advances the plane one step and reports touchdown events.

import { AIRCRAFT, clamp, degToRad, headingVector, wrapDegrees } from './config.js';
import { isOnRunway, isOverWater, terrainHeightAt } from './terrain.js';
import { showMessage } from './state.js';

const GRAVITY = 9.8;

function moveToward(current, target, maxStep) {
  if (current < target) return Math.min(current + maxStep, target);
  return Math.max(current - maxStep, target);
}

function applyControls(plane, input, dt) {
  plane.throttle = clamp(plane.throttle + input.throttle * 0.55 * dt, 0, 1);
  const pitchTarget = input.pitch * AIRCRAFT.maxPitchDeg;
  const bankTarget = input.bank * AIRCRAFT.maxBankDeg;
  plane.pitchDeg = moveToward(plane.pitchDeg, pitchTarget, AIRCRAFT.pitchRate * 57.3 * dt * 0.9);
  plane.bankDeg = moveToward(plane.bankDeg, bankTarget, AIRCRAFT.bankRate * 57.3 * dt * 0.55);
  if (!plane.onGround) {
    const turnRate = (GRAVITY * Math.tan(degToRad(plane.bankDeg))) / Math.max(plane.speed, 18);
    plane.headingDeg = wrapDegrees(plane.headingDeg + (turnRate * 57.3 + input.rudder * 7) * dt);
  } else {
    plane.headingDeg = wrapDegrees(plane.headingDeg + input.rudder * 14 * dt * clamp(plane.speed / 20, 0, 1));
  }
}

function updateSpeedAndSink(plane, dt) {
  const effectiveThrottle = plane.engineOn ? plane.throttle : 0;
  const thrustSpeed = effectiveThrottle * AIRCRAFT.maxSpeed;
  const pitchDrag = Math.sin(degToRad(plane.pitchDeg)) * 16;
  plane.speed += ((thrustSpeed - plane.speed) * 0.32 - pitchDrag * 0.35) * dt * 2.2;
  plane.speed = clamp(plane.speed, 0, 96);
  plane.stalled = !plane.onGround && plane.speed < AIRCRAFT.stallSpeed;
  let sink = 0;
  if (plane.stalled) {
    sink = (AIRCRAFT.stallSpeed - plane.speed) * 0.55 + 2.5;
    plane.pitchDeg = moveToward(plane.pitchDeg, -12, 26 * dt);
    plane.buffet = Math.min(1, plane.buffet + dt * 3);
  } else {
    plane.buffet = Math.max(0, plane.buffet - dt * 2);
  }
  plane.verticalSpeed = plane.speed * Math.sin(degToRad(plane.pitchDeg)) - sink;
  if (plane.onGround) plane.verticalSpeed = 0;
}

function burnFuel(plane, dt) {
  if (!plane.engineOn) return;
  plane.fuel -= (0.16 + plane.throttle * 0.85) * dt * 0.55;
  if (plane.fuel <= 0) {
    plane.fuel = 0;
    plane.engineOn = false;
    plane.throttle = 0;
  }
}

function judgeTouchdown(state, groundHeight) {
  const plane = state.plane;
  const descent = -plane.verticalSpeed;
  const onRunway = isOnRunway(plane.x, plane.z);
  const overWater = isOverWater(plane.x, plane.z);
  const bank = Math.abs(plane.bankDeg);
  const aligned = Math.min(
    Math.abs(((plane.headingDeg % 360) + 360) % 360),
    Math.abs((((plane.headingDeg % 360) + 360) % 360) - 180),
  );
  let damage = 0;
  let grade = 'smooth';
  if (descent > 7) damage += 55;
  else if (descent > 4.5) damage += 28;
  else if (descent > 2.8) damage += 10;
  if (bank > 24) damage += 30;
  else if (bank > 14) damage += 12;
  if (onRunway && aligned > 24) damage += 16;
  if (!onRunway && !overWater) damage += 14;
  if (overWater) damage += 70;
  if (plane.speed > 62) damage += 18;
  if (damage >= 60) grade = 'crash';
  else if (damage >= 30) grade = 'rough';
  else if (damage >= 10) grade = 'firm';
  else if (descent <= 1.6 && bank <= 6 && onRunway) grade = 'butter';
  plane.hull = clamp(plane.hull - damage, 0, AIRCRAFT.maxHull);
  const centerline = onRunway ? Math.abs(plane.x - 900) : 999;
  return {
    grade,
    damage,
    descent,
    speed: plane.speed,
    onRunway,
    overWater,
    centerline,
    groundHeight,
    crashed: grade === 'crash' || plane.hull <= 0,
  };
}

export function updateAircraft(state, input, dt) {
  const plane = state.plane;
  const events = { touchdown: null, engineDied: false };
  const wasEngineOn = plane.engineOn;
  applyControls(plane, input, dt);
  updateSpeedAndSink(plane, dt);
  burnFuel(plane, dt);
  if (wasEngineOn && !plane.engineOn) {
    events.engineDied = true;
    showMessage(state, 'Fuel empty — engine out. Glide to a landing.', 5);
  }
  const axis = headingVector(plane.headingDeg);
  const wind = state.mission ? state.mission.definition.wind : { x: 0, z: 0 };
  const groundSpeed = plane.speed * Math.cos(degToRad(plane.pitchDeg));
  plane.x += (axis.x * groundSpeed + (plane.onGround ? 0 : wind.x)) * dt;
  plane.z += (axis.z * groundSpeed + (plane.onGround ? 0 : wind.z)) * dt;
  if (!plane.onGround) plane.y += plane.verticalSpeed * dt;
  const groundHeight = terrainHeightAt(plane.x, plane.z);
  const floorY = Math.max(groundHeight, 0) + AIRCRAFT.gearHeight;
  if (plane.onGround) {
    plane.y = floorY;
    plane.speed = Math.max(0, plane.speed - (plane.throttle > 0.05 ? -4 * dt : 7 * dt));
    if (plane.speed > 30 && plane.pitchDeg > 7) {
      plane.onGround = false;
      plane.y = floorY + 0.4;
      showMessage(state, 'Airborne. Fly the mission, then land.', 3);
    }
  } else if (plane.y <= floorY) {
    plane.y = floorY;
    events.touchdown = judgeTouchdown(state, groundHeight);
    if (!events.touchdown.crashed) {
      plane.onGround = true;
      plane.pitchDeg = 0;
      plane.bankDeg = 0;
      state.landing = events.touchdown;
    }
  }
  if (plane.onGround && plane.speed < 2.5 && state.landing && state.sortieTime > 5) {
    events.stopped = true;
  }
  return events;
}

export function altitudeAboveGround(plane) {
  return plane.y - Math.max(terrainHeightAt(plane.x, plane.z), 0);
}
