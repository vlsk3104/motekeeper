// Everything that lives in the night, as plain objects made by the factories here: the keeper,
// light motes, the three hollow shard kinds, pickups, and the short-lived dressing (particles
// and floating score text). This file knows shapes and spawning, never rules: the world moves
// them, the renderer draws them.

import { FIELD, MOTE, PICKUP, PLAYER, SHARD_KINDS } from './config.js';
import { range } from './random.js';

export const KIND_DRIFTER = 'drifter';
export const KIND_WEAVER = 'weaver';
export const KIND_BRUTE = 'brute';

export const PICKUP_HEART = 'heart';
export const PICKUP_OVERGLOW = 'overglow';

/** The keeper at the centre of the stage, whole and ready. */
export function createPlayer() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    radius: PLAYER.radius,
    hearts: PLAYER.startHearts,
    mercy: 0,
    dashTime: 0,
    dashCooldown: 0,
    dashDirX: 1,
    dashDirY: 0,
    justDashed: false,
    faceX: 1,
    trail: [],
  };
}

/** A light mote drifting somewhere in the night, never right beside the keeper. */
export function createMote(next) {
  const margin = 90;
  return {
    x: range(next, margin, FIELD.width - margin),
    y: range(next, margin, FIELD.height - margin),
    vx: range(next, -16, 16),
    vy: range(next, -16, 16),
    radius: MOTE.radius,
    age: 0,
    phase: range(next, 0, Math.PI * 2),
    active: true,
  };
}

/** A hollow shard of one kind, born just outside the stage edge nearest its first hunt. */
export function createShard(next, kind, x, y) {
  const spec = SHARD_KINDS[kind];
  return {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: spec.radius,
    hp: spec.hp,
    maxHp: spec.hp,
    speed: spec.speed,
    score: spec.score,
    phase: range(next, 0, Math.PI * 2),
    flash: 0,
    active: true,
  };
}

/** Where a shard enters: a random point a little beyond a random edge. */
export function shardSpawnPoint(next) {
  const out = 36;
  const edge = Math.floor(next() * 4);
  if (edge === 0) return { x: range(next, 0, FIELD.width), y: -out };
  if (edge === 1) return { x: range(next, 0, FIELD.width), y: FIELD.height + out };
  if (edge === 2) return { x: -out, y: range(next, 0, FIELD.height) };
  return { x: FIELD.width + out, y: range(next, 0, FIELD.height) };
}

/** A pickup: a heart, or an Overglow star, dropped near the middle of the stage. */
export function createPickup(next, kind) {
  return {
    kind,
    x: range(next, 150, FIELD.width - 150),
    y: range(next, 130, FIELD.height - 130),
    radius: PICKUP.radius,
    age: 0,
    phase: range(next, 0, Math.PI * 2),
    active: true,
  };
}

/** One spark of a burst: position, velocity, drag, life and colour are set by the caller. */
export function createParticle(x, y, vx, vy, life, size, color, drag) {
  return { x, y, vx, vy, age: 0, life, size, color, drag, active: true };
}

/** One floating score note, rising and fading above where it was earned. */
export function createFloatText(x, y, text, color) {
  return { x, y, text, color, age: 0, life: 0.9, active: true };
}
