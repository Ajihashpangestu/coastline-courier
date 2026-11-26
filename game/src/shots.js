// Screenshot scene presets: each one puts the real game state into a moment
// worth photographing (a ring approach, the cockpit, a cargo drop, the
// landing report) and freezes physics so the render is repeatable. The
// scenes run through the same update-free draw path as normal play.

import { RUNWAY } from './config.js';
import { terrainHeightAt } from './terrain.js';
import { resetSortie } from './state.js';
import { finalizeResult } from './screens.js';

function placePlane(state, x, z, headingDeg, altitude, speed, throttle) {
  const plane = state.plane;
  plane.x = x;
  plane.z = z;
  plane.y = altitude;
  plane.headingDeg = headingDeg;
  plane.speed = speed;
  plane.throttle = throttle;
  plane.onGround = false;
  plane.engineOn = true;
  plane.pitchDeg = 2;
  plane.bankDeg = -6;
  plane.verticalSpeed = 1.2;
}

function ringApproachScene(state, cameraMode) {
  resetSortie(state, 0);
  const rings = state.mission.definition.rings;
  rings[0].passed = true;
  state.mission.ringIndex = 1;
  state.mission.ringsPassed = 1;
  state.score = 260;
  state.sortieTime = 34;
  state.cameraMode = cameraMode;
  const ring = rings[1];
  if (cameraMode === 'cockpit') {
    placePlane(state, 332, -168, 315, ring.y + 3, 56, 0.74);
  } else {
    placePlane(state, 432, -68, 315, ring.y + 5, 57, 0.76);
  }
  state.plane.fuel = 88;
  state.message = 'Ring 2 ahead — thread the gold ring.';
  state.messageTimer = 99;
}

function cargoDropScene(state) {
  resetSortie(state, 1);
  state.cameraMode = 'chase';
  state.score = 285;
  state.sortieTime = 95;
  state.cratesLeft = 2;
  state.mission.cargoDropped = 1;
  const altitude = terrainHeightAt(-2250, 1650) + 195;
  placePlane(state, -2250, 1650, 235, altitude, 46, 0.62);
  state.plane.fuel = 71;
  state.plane.bankDeg = 4;
  state.cargo.push({
    x: -2470,
    y: altitude - 70,
    z: 1870,
    vx: -18,
    vy: -22,
    vz: 14,
    landed: false,
    scored: false,
  });
  state.popup = 'CRATE AWAY';
  state.popupTimer = 99;
  state.message = 'Watch the crosswind — the target is the red rings.';
  state.messageTimer = 99;
}

function landingReportScene(state) {
  resetSortie(state, 0);
  const rings = state.mission.definition.rings;
  for (const ring of rings) ring.passed = true;
  state.mission.ringIndex = rings.length;
  state.mission.ringsPassed = rings.length;
  state.mission.objectivesDone = true;
  state.score = 1310;
  state.sortieTime = 149;
  state.cameraMode = 'chase';
  const plane = state.plane;
  plane.x = RUNWAY.centerX + 3;
  plane.z = RUNWAY.centerZ - 120;
  plane.y = RUNWAY.elevation + 1.6;
  plane.headingDeg = 0;
  plane.speed = 0;
  plane.throttle = 0;
  plane.fuel = 41;
  plane.onGround = true;
  plane.pitchDeg = 0;
  plane.bankDeg = 0;
  state.landing = {
    grade: 'butter',
    damage: 0,
    descent: 1.2,
    speed: 31,
    onRunway: true,
    overWater: false,
    centerline: 3,
    crashed: false,
  };
  state.messageTimer = 0;
  state.popupTimer = 0;
  finalizeResult(state);
}

export function applyShotPreset(state, name) {
  state.frozenForShot = true;
  state.shotName = name;
  state.time = 12.34;
  if (name === 'cover') ringApproachScene(state, 'chase');
  else if (name === 'cockpit') ringApproachScene(state, 'cockpit');
  else if (name === 'cargo') cargoDropScene(state);
  else if (name === 'landing') landingReportScene(state);
  else state.frozenForShot = false;
}
