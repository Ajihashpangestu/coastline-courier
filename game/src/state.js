// Game state: one object every system reads and updates. createGameState
// builds a fresh sortie; resetSortie puts the aircraft back on the runway
// threshold for the chosen mission without touching menu choices.

import { AIRCRAFT, RUNWAY } from './config.js';
import { MISSIONS } from './missions.js';
import { buildCloudField } from './terrain.js';

export function createGameState() {
  return {
    screen: 'menu',
    cameraMode: 'chase',
    missionIndex: 0,
    time: 0,
    sortieTime: 0,
    score: 0,
    message: '',
    messageTimer: 0,
    popup: '',
    popupTimer: 0,
    frozenForShot: false,
    shotName: '',
    plane: freshPlane(),
    mission: null,
    cargo: [],
    cratesLeft: 0,
    landing: null,
    result: null,
    clouds: buildCloudField(),
    menuOrbit: 0,
    soundOn: true,
  };
}

function freshPlane() {
  return {
    x: RUNWAY.centerX,
    y: RUNWAY.elevation + AIRCRAFT.gearHeight,
    z: RUNWAY.centerZ + RUNWAY.length / 2 - 60,
    headingDeg: 0,
    pitchDeg: 0,
    bankDeg: 0,
    speed: 0,
    verticalSpeed: 0,
    throttle: 0,
    fuel: 100,
    hull: AIRCRAFT.maxHull,
    onGround: true,
    engineOn: true,
    stalled: false,
    buffet: 0,
  };
}

export function resetSortie(state, missionIndex) {
  const mission = MISSIONS[missionIndex];
  state.missionIndex = missionIndex;
  state.plane = freshPlane();
  state.plane.fuel = mission.fuel;
  state.sortieTime = 0;
  state.score = 0;
  state.cargo = [];
  state.cratesLeft = mission.crates;
  state.landing = null;
  state.result = null;
  state.message = mission.briefing;
  state.messageTimer = 6;
  state.popup = '';
  state.popupTimer = 0;
  state.mission = {
    definition: mission,
    ringIndex: 0,
    ringsPassed: 0,
    ringsMissed: 0,
    checkpointsHit: 0,
    lowCheckpointBonus: 0,
    cargoScore: 0,
    cargoDropped: 0,
    objectivesDone: false,
    ringPlaneSide: 0,
  };
  state.screen = 'flying';
}

export function showMessage(state, text, seconds = 3.5) {
  state.message = text;
  state.messageTimer = seconds;
}

export function showPopup(state, text, seconds = 2.2) {
  state.popup = text;
  state.popupTimer = seconds;
}
