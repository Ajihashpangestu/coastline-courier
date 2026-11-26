// Mission definitions and objective tracking: ring courses, cargo drops and
// low coast checkpoints, each ending with a runway landing. updateObjectives
// watches the aircraft against the active goal and awards score as it goes.

import { RUNWAY, headingVector } from './config.js';
import { terrainHeightAt } from './terrain.js';
import { showMessage, showPopup } from './state.js';

function ringAt(x, z, altitudeAboveGround, headingDeg, radius = 46) {
  return {
    x,
    y: terrainHeightAt(x, z) + altitudeAboveGround,
    z,
    headingDeg,
    radius,
    passed: false,
  };
}

function checkpointAt(x, z, ceilingAboveGround) {
  return {
    x,
    z,
    y: terrainHeightAt(x, z),
    ceiling: ceilingAboveGround,
    radius: 240,
    hit: false,
  };
}

export const MISSIONS = [
  {
    id: 'ring-run',
    name: 'Ring Run',
    briefing: 'Take off north, thread all 6 rings, then land back on the runway.',
    detail: 'Six rings over the coast and hills. Centred passes pay more.',
    parSeconds: 170,
    fuel: 100,
    crates: 0,
    wind: { x: 0, z: 0 },
    kind: 'rings',
    rings: [
      ringAt(900, 500, 120, 0),
      ringAt(150, -350, 150, 315),
      ringAt(-1200, -850, 170, 285),
      ringAt(-2300, -150, 130, 225),
      ringAt(-1750, 950, 110, 150),
      ringAt(-250, 1500, 100, 100),
    ],
  },
  {
    id: 'cargo-drop',
    name: 'Cargo Drop',
    briefing: 'Drop 3 crates on the harbour target, then land. Mind the crosswind.',
    detail: 'Space drops a crate. Low and slow drops land closer.',
    parSeconds: 210,
    fuel: 100,
    crates: 3,
    wind: { x: 4.5, z: -1.5 },
    kind: 'cargo',
    dropZone: { x: -2650, z: 2050, radius: 130 },
  },
  {
    id: 'coast-patrol',
    name: 'Coast Patrol',
    briefing: 'Sweep 6 coast checkpoints. Stay low for bonus points, then land.',
    detail: 'Checkpoints pay double below the marked ceiling.',
    parSeconds: 240,
    fuel: 100,
    crates: 0,
    wind: { x: -2, z: 2.5 },
    kind: 'checkpoints',
    checkpoints: [
      checkpointAt(-1500, 2400, 130),
      checkpointAt(-2900, 1500, 130),
      checkpointAt(-3300, 200, 150),
      checkpointAt(-2100, -1200, 160),
      checkpointAt(-300, -1900, 160),
      checkpointAt(1500, -900, 140),
    ],
  },
  {
    id: 'free-flight',
    name: 'Free Flight',
    briefing: 'No clock, no cargo. Explore the island and land when you like.',
    detail: 'A gentle sortie. Landing quality still scores.',
    parSeconds: 0,
    fuel: 100,
    crates: 0,
    wind: { x: 0, z: 0 },
    kind: 'free',
  },
];

export function activeRing(state) {
  if (!state.mission || state.mission.definition.kind !== 'rings') return null;
  const rings = state.mission.definition.rings;
  const ring = rings[state.mission.ringIndex];
  return ring && !ring.passed ? ring : null;
}

export function objectiveText(state) {
  const mission = state.mission;
  if (!mission) return '';
  const def = mission.definition;
  if (mission.objectivesDone) return 'Objectives complete — land now';
  if (def.kind === 'rings') return `Ring ${mission.ringIndex + 1} of ${def.rings.length}`;
  if (def.kind === 'cargo') return `Crates dropped ${mission.cargoDropped} of ${def.crates}`;
  if (def.kind === 'checkpoints') return `Checkpoints ${mission.checkpointsHit} of ${def.checkpoints.length}`;
  return 'Free flight — land when ready';
}

function ringPlaneDistance(plane, ring) {
  const axis = headingVector(ring.headingDeg);
  return (plane.x - ring.x) * axis.x + (plane.z - ring.z) * axis.z;
}

function updateRingObjective(state, dt) {
  const mission = state.mission;
  const ring = activeRing(state);
  if (!ring) return;
  const plane = state.plane;
  const side = ringPlaneDistance(plane, ring);
  if (mission.ringPlaneSide < 0 && side >= 0 && !plane.onGround) {
    const dx = plane.x - ring.x;
    const dy = plane.y - ring.y;
    const dz = plane.z - ring.z;
    const axis = headingVector(ring.headingDeg);
    const along = dx * axis.x + dz * axis.z;
    const radial = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - along * along));
    if (radial <= ring.radius) {
      ring.passed = true;
      mission.ringsPassed++;
      const precision = Math.round(120 * (1 - radial / ring.radius));
      const points = 180 + precision;
      state.score += points;
      showPopup(state, `+${points}  RING ${mission.ringsPassed}/${mission.definition.rings.length}`);
      mission.ringIndex++;
      mission.ringPlaneSide = 0;
      if (mission.ringIndex >= mission.definition.rings.length) {
        mission.objectivesDone = true;
        showMessage(state, 'All rings clear. Bring her home and land.', 5);
      }
      return;
    }
    mission.ringsMissed++;
    showMessage(state, 'Missed the ring — circle back and thread it.', 3.5);
  }
  mission.ringPlaneSide = side;
  void dt;
}

function updateCheckpointObjective(state) {
  const mission = state.mission;
  const plane = state.plane;
  if (plane.onGround) return;
  for (const point of mission.definition.checkpoints) {
    if (point.hit) continue;
    const dx = plane.x - point.x;
    const dz = plane.z - point.z;
    if (dx * dx + dz * dz <= point.radius * point.radius) {
      point.hit = true;
      mission.checkpointsHit++;
      const heightAbove = plane.y - terrainHeightAt(plane.x, plane.z);
      const low = heightAbove <= point.ceiling;
      const points = low ? 220 : 110;
      if (low) mission.lowCheckpointBonus += 110;
      state.score += points;
      showPopup(state, `+${points}  CHECKPOINT ${mission.checkpointsHit}/${mission.definition.checkpoints.length}`);
      if (mission.checkpointsHit >= mission.definition.checkpoints.length) {
        mission.objectivesDone = true;
        showMessage(state, 'Patrol complete. Land on the runway to finish.', 5);
      }
    }
  }
}

export function dropCargo(state) {
  const mission = state.mission;
  if (!mission || mission.definition.kind !== 'cargo') return false;
  if (state.cratesLeft <= 0 || state.plane.onGround) return false;
  state.cratesLeft--;
  mission.cargoDropped++;
  const axis = headingVector(state.plane.headingDeg);
  state.cargo.push({
    x: state.plane.x,
    y: state.plane.y - 2,
    z: state.plane.z,
    vx: axis.x * state.plane.speed,
    vy: state.plane.verticalSpeed,
    vz: axis.z * state.plane.speed,
    landed: false,
    scored: false,
  });
  showMessage(state, `Crate away. ${state.cratesLeft} left.`, 2.5);
  return true;
}

function updateCargo(state, dt) {
  const mission = state.mission;
  if (!mission || mission.definition.kind !== 'cargo') return;
  const zone = mission.definition.dropZone;
  for (const crate of state.cargo) {
    if (crate.landed) continue;
    crate.vy -= 9.8 * dt;
    crate.vx += (mission.definition.wind.x - crate.vx) * 0.25 * dt;
    crate.vz += (mission.definition.wind.z - crate.vz) * 0.25 * dt;
    crate.x += crate.vx * dt;
    crate.y += crate.vy * dt;
    crate.z += crate.vz * dt;
    const ground = Math.max(terrainHeightAt(crate.x, crate.z), 0);
    if (crate.y <= ground + 1) {
      crate.y = ground + 1;
      crate.landed = true;
      const dx = crate.x - zone.x;
      const dz = crate.z - zone.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      const points = distance <= zone.radius ? Math.round(320 * (1 - distance / (zone.radius * 1.6))) : 25;
      crate.scored = true;
      mission.cargoScore += points;
      state.score += points;
      showPopup(state, distance <= zone.radius ? `+${points}  ON TARGET` : `+${points}  ${Math.round(distance)} m OUT`);
    }
  }
  if (!mission.objectivesDone && mission.cargoDropped >= mission.definition.crates && state.cargo.every((c) => c.landed)) {
    mission.objectivesDone = true;
    showMessage(state, 'All crates down. Land on the runway to finish.', 5);
  }
}

export function updateObjectives(state, dt) {
  if (!state.mission) return;
  const kind = state.mission.definition.kind;
  if (kind === 'rings') updateRingObjective(state, dt);
  if (kind === 'checkpoints') updateCheckpointObjective(state);
  if (kind === 'cargo') updateCargo(state, dt);
  if (kind === 'free') state.mission.objectivesDone = true;
}

export function runwayApproachPoint() {
  return { x: RUNWAY.centerX, z: RUNWAY.centerZ + RUNWAY.length / 2 + 700 };
}
