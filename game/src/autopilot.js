// A pilot that plays Motekeeper well enough to stage the screenshot scenes and run the
// title screen's demo. Most steps it simply steers like a player: toward the mote it wants,
// away from the shards closing in, off the walls. But before it commits, it looks a little
// way ahead along that path, and if a shard would land on it there, it vetoes the path and
// takes the safest heading that still gains ground. It pulses when a shard is inside the
// ring and dashes when one is about to land. It reads only the world's public state and
// answers with the same controls a player's hands would, so a staged scene is a real game
// played by a careful beginner.

import { FIELD, PLAYER, PULSE } from './config.js';

/** The look-ahead: how far, and in how many slices, a path is checked before it is taken. */
const LOOK_SECONDS = 0.62;
const LOOK_SLICES = 10;
/** How much predicted clearance a path needs before the pilot trusts it. */
const SAFE_CLEARANCE = 26;
/** Candidate headings for the veto: sixteen compass points, plus staying put. */
const HEADINGS = (() => {
  const list = [{ x: 0, y: 0 }];
  for (let index = 0; index < 16; index += 1) {
    const angle = (index / 16) * Math.PI * 2;
    list.push({ x: Math.cos(angle), y: Math.sin(angle) });
  }
  return list;
})();

/** The point the pilot wants most: a heart when hurt, else the nearest mote or pickup. */
function chooseTarget(state) {
  const player = state.player;
  let target = null;
  let targetDist = Infinity;
  for (const pickup of state.pickups) {
    if (pickup.kind !== 'heart' || player.hearts > 2) continue;
    const dist = Math.hypot(pickup.x - player.x, pickup.y - player.y);
    if (dist < targetDist) {
      targetDist = dist;
      target = pickup;
    }
  }
  if (target) return { target, targetDist };
  for (const mote of state.motes) {
    const dist = Math.hypot(mote.x - player.x, mote.y - player.y);
    if (dist < targetDist) {
      targetDist = dist;
      target = mote;
    }
  }
  for (const pickup of state.pickups) {
    const dist = Math.hypot(pickup.x - player.x, pickup.y - player.y);
    if (dist < targetDist * 0.8) {
      targetDist = dist;
      target = pickup;
    }
  }
  return { target, targetDist };
}

/** Where a shard will be in `t` seconds if it keeps hunting the keeper's current spot. */
function shardAhead(state, shard, t) {
  const player = state.player;
  const dx = player.x - shard.x;
  const dy = player.y - shard.y;
  const dist = Math.hypot(dx, dy) || 1;
  const hunt = Math.min(50, state.time * 0.28);
  const speed = shard.speed + hunt;
  return {
    x: shard.x + ((dx / dist) * speed + shard.vx) * t,
    y: shard.y + ((dy / dist) * speed + shard.vy) * t,
  };
}

/** The closest any shard would come, in body widths, if the keeper took `heading` for a look ahead. */
function pathClearance(state, heading) {
  const player = state.player;
  const slice = LOOK_SECONDS / LOOK_SLICES;
  let x = player.x;
  let y = player.y;
  let clearance = Infinity;
  for (let step = 1; step <= LOOK_SLICES; step += 1) {
    x += heading.x * PLAYER.speed * slice;
    y += heading.y * PLAYER.speed * slice;
    x = Math.max(player.radius, Math.min(FIELD.width - player.radius, x));
    y = Math.max(player.radius, Math.min(FIELD.height - player.radius, y));
    const t = slice * step;
    for (const shard of state.shards) {
      const ahead = shardAhead(state, shard, t);
      const gap = Math.hypot(ahead.x - x, ahead.y - y) - shard.radius - player.radius;
      if (gap < clearance) clearance = gap;
    }
  }
  return clearance;
}

/** The reactive steer: seek the target, flee the close shards, keep off the walls. */
function reactiveSteer(state, target, targetDist) {
  const player = state.player;
  let moveX = 0;
  let moveY = 0;
  if (target) {
    moveX += ((target.x - player.x) / (targetDist || 1)) * 1.7;
    moveY += ((target.y - player.y) / (targetDist || 1)) * 1.7;
  } else {
    moveX += (FIELD.width / 2 - player.x) / 400;
    moveY += (FIELD.height / 2 - player.y) / 400;
  }
  for (const shard of state.shards) {
    const dx = player.x - shard.x;
    const dy = player.y - shard.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < 150) {
      const weight = (150 - dist) / 150;
      moveX += (dx / dist) * weight * 2.0;
      moveY += (dy / dist) * weight * 2.0;
    }
  }
  if (player.x < 90) moveX += 1.6;
  if (player.x > FIELD.width - 90) moveX -= 1.6;
  if (player.y < 90) moveY += 1.6;
  if (player.y > FIELD.height - 90) moveY -= 1.6;
  const length = Math.hypot(moveX, moveY);
  if (length > 1) {
    moveX /= length;
    moveY /= length;
  }
  return { x: moveX, y: moveY };
}

/**
 * Decide one step of controls for `state`. `world` is asked whether the pulse is ready.
 * The result is { x, y, pulse, dash } in the same shape the keyboard produces.
 */
export function pilotControls(state, world) {
  const player = state.player;
  const { target, targetDist } = chooseTarget(state);
  let move = reactiveSteer(state, target, targetDist);

  // The veto: if the reactive path runs into a shard, take the safest heading that gains.
  if (state.shards.length > 0 && pathClearance(state, move) < SAFE_CLEARANCE) {
    let best = move;
    let bestScore = -Infinity;
    for (const heading of HEADINGS) {
      const clearance = pathClearance(state, heading);
      let gain = 0;
      if (target) {
        const endX = player.x + heading.x * PLAYER.speed * LOOK_SECONDS;
        const endY = player.y + heading.y * PLAYER.speed * LOOK_SECONDS;
        gain = targetDist - Math.hypot(target.x - endX, target.y - endY);
      }
      const score = Math.min(clearance, 90) * 2.2 + gain * 1.15;
      if (score > bestScore) {
        bestScore = score;
        best = heading;
      }
    }
    move = best;
  }

  let nearestShard = Infinity;
  let closeShards = 0;
  const pulseRadius = state.overglow > 0 ? PULSE.overglowRadius : PULSE.radius;
  for (const shard of state.shards) {
    const dist = Math.hypot(shard.x - player.x, shard.y - player.y) - shard.radius;
    nearestShard = Math.min(nearestShard, dist);
    if (dist < pulseRadius + 44) closeShards += 1;
  }

  return {
    x: move.x,
    y: move.y,
    pulse: world.pulseReady() && (nearestShard < pulseRadius + 20 || closeShards >= 2),
    dash: nearestShard < 74 && player.dashCooldown <= 0 && pathClearance(state, move) < 34,
  };
}

/**
 * A careless pilot for the game-over scene: it walks at the nearest mote and never pulses,
 * never dashes and never looks up, so the night catches it the way it catches a distracted
 * player. It answers the same controls shape as pilotControls.
 */
export function carelessControls(state) {
  const player = state.player;
  let target = null;
  let targetDist = Infinity;
  for (const mote of state.motes) {
    const dist = Math.hypot(mote.x - player.x, mote.y - player.y);
    if (dist < targetDist) {
      targetDist = dist;
      target = mote;
    }
  }
  if (!target) return { x: 0, y: 0, pulse: false, dash: false };
  const length = targetDist || 1;
  return {
    x: (target.x - player.x) / length,
    y: (target.y - player.y) / length,
    pulse: false,
    dash: false,
  };
}
