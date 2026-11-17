// The night itself: every rule of Motekeeper lives here, in a fixed-step simulation that
// knows nothing about the DOM, sound or drawing. Feed it controls, it advances one step and
// reports what happened as event flags, and the shell around it (main.js) turns those flags
// into sound and announcements. Given the same seed and the same controls, a run replays
// exactly, which is what lets the screenshot scenes stage real play.

import {
  ANCHORS, FIELD, HUNT_RAMP, MOTE, PARTICLE_CAP, PICKUP, PLAYER, PULSE, SHARD, STEP, TEXT_CAP,
} from './config.js';
import {
  KIND_BRUTE, KIND_DRIFTER, KIND_WEAVER, PICKUP_HEART, PICKUP_OVERGLOW,
  createFloatText, createMote, createParticle, createPickup, createPlayer, createShard, shardSpawnPoint,
} from './entities.js';
import { chance, range } from './random.js';

export const EVENT_COLLECT = 1;
export const EVENT_KILL = 2;
export const EVENT_PULSE = 4;
export const EVENT_DASH = 8;
export const EVENT_HIT = 16;
export const EVENT_PICKUP = 32;
export const EVENT_ANCHOR = 64;
export const EVENT_WIN = 128;
export const EVENT_OVER = 256;

/** Clamp a value into [min, max]. */
function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** Distance between two points. */
function distance(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Create a world driven by the seeded generator `next`. The controls a step takes are
 * { x, y } movement in [-1, 1], plus pulse and dash as held buttons the world gates
 * behind their cooldowns, so holding a button fires it the moment it is ready.
 */
export function createWorld(next) {
  const state = {};
  let pulseCooldown = 0;
  let moteTimer = 0;
  let shardTimer = 1.1;
  let pickupTimer = PICKUP.every * 0.6;

  /** Put every part of the night back to its first moment. */
  function reset() {
    state.time = 0;
    state.score = 0;
    state.motesGathered = 0;
    state.anchorsLit = 0;
    state.anchorProgress = 0;
    state.chain = 0;
    state.chainTimer = 0;
    state.multiplier = 1;
    state.bestChain = 0;
    state.kills = 0;
    state.pulses = 0;
    state.player = createPlayer();
    state.motes = [];
    state.shards = [];
    state.pickups = [];
    state.particles = [];
    state.texts = [];
    state.rings = [];
    state.overglow = 0;
    state.shake = 0;
    state.hitStop = 0;
    state.over = false;
    state.won = false;
    state.endless = false;
    pulseCooldown = 0;
    moteTimer = 0.2;
    shardTimer = 1.1;
    pickupTimer = PICKUP.every * 0.6;
    for (let index = 0; index < 4; index += 1) state.motes.push(createMote(next));
  }

  /** Add a burst of sparks, trimmed to the particle cap. */
  function burst(x, y, count, color, speed, life, size) {
    for (let index = 0; index < count; index += 1) {
      if (state.particles.length >= PARTICLE_CAP) return;
      const angle = next() * Math.PI * 2;
      const pace = range(next, speed * 0.25, speed);
      state.particles.push(createParticle(x, y, Math.cos(angle) * pace, Math.sin(angle) * pace,
        range(next, life * 0.5, life), range(next, size * 0.5, size), color, 2.6));
    }
  }

  /** Add a floating score note, trimmed to the text cap. */
  function note(x, y, text, color) {
    if (state.texts.length >= TEXT_CAP) state.texts.shift();
    state.texts.push(createFloatText(x, y, text, color));
  }

  /** Which shard kind the night sends next, given how deep the run has gone. */
  function pickShardKind() {
    if (state.time >= SHARD.bruteAt && chance(next, Math.min(0.17, (state.time - SHARD.bruteAt) / 500))) return KIND_BRUTE;
    if (state.time >= SHARD.weaverAt && chance(next, 0.36)) return KIND_WEAVER;
    return KIND_DRIFTER;
  }

  /** Fire the pulse if it is ready: damage and knockback for every shard inside the ring. */
  function firePulse(events) {
    const player = state.player;
    const radius = state.overglow > 0 ? PULSE.overglowRadius : PULSE.radius;
    pulseCooldown = state.overglow > 0 ? PULSE.overglowCooldown : PULSE.cooldown;
    state.pulses += 1;
    state.rings.push({ x: player.x, y: player.y, age: 0, maxRadius: radius });
    state.shake = Math.max(state.shake, 5);
    events |= EVENT_PULSE;
    for (const shard of state.shards) {
      if (!shard.active) continue;
      const dist = distance(player.x, player.y, shard.x, shard.y);
      if (dist > radius + shard.radius) continue;
      shard.hp -= 1;
      shard.flash = 0.14;
      const away = dist > 1 ? dist : 1;
      shard.vx += ((shard.x - player.x) / away) * 300;
      shard.vy += ((shard.y - player.y) / away) * 300;
      if (shard.hp <= 0) {
        shard.active = false;
        state.kills += 1;
        state.score += shard.score;
        events |= EVENT_KILL;
        burst(shard.x, shard.y, shard.kind === KIND_BRUTE ? 26 : 12, '#ff4d7e', 260, 0.6, 3.4);
        note(shard.x, shard.y - 16, `+${shard.score}`, '#ff8fab');
        if (shard.kind === KIND_BRUTE) {
          state.shake = Math.max(state.shake, 10);
          for (let index = 0; index < 2; index += 1) {
            const child = createShard(next, KIND_DRIFTER, shard.x + range(next, -14, 14), shard.y + range(next, -14, 14));
            state.shards.push(child);
          }
        }
      }
    }
    return events;
  }

  /** Move the keeper: dash burst first, honest steering otherwise, always inside the stage. */
  function movePlayer(dt, controls) {
    const player = state.player;
    let moveX = controls.x;
    let moveY = controls.y;
    const length = Math.sqrt(moveX * moveX + moveY * moveY);
    if (length > 1) {
      moveX /= length;
      moveY /= length;
    }
    if (moveX !== 0) player.faceX = Math.sign(moveX);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.mercy = Math.max(0, player.mercy - dt);
    if (controls.dash && player.dashCooldown <= 0 && player.dashTime <= 0) {
      player.dashTime = PLAYER.dashSeconds;
      player.dashCooldown = PLAYER.dashCooldown;
      player.dashDirX = moveX !== 0 || moveY !== 0 ? moveX : player.faceX;
      player.dashDirY = moveX !== 0 || moveY !== 0 ? moveY : 0;
      player.justDashed = true;
    }
    if (player.dashTime > 0) {
      player.dashTime -= dt;
      player.vx = player.dashDirX * PLAYER.dashSpeed;
      player.vy = player.dashDirY * PLAYER.dashSpeed;
    } else {
      player.vx = moveX * PLAYER.speed;
      player.vy = moveY * PLAYER.speed;
    }
    player.x = clamp(player.x + player.vx * dt, player.radius, FIELD.width - player.radius);
    player.y = clamp(player.y + player.vy * dt, player.radius, FIELD.height - player.radius);
    player.trail.unshift({ x: player.x, y: player.y, age: 0 });
    if (player.trail.length > 16) player.trail.pop();
    for (const point of player.trail) point.age += dt;
  }

  /** Steer one shard toward the keeper, each kind in its own way, plus any knockback it carries. */
  function moveShard(dt, shard) {
    const player = state.player;
    const hunt = Math.min(HUNT_RAMP.cap, state.time * HUNT_RAMP.perSecond);
    const dx = player.x - shard.x;
    const dy = player.y - shard.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    let seekX = (dx / dist) * (shard.speed + hunt);
    let seekY = (dy / dist) * (shard.speed + hunt);
    if (shard.kind === KIND_WEAVER) {
      shard.phase += dt * 6.5;
      const sway = Math.sin(shard.phase) * 74;
      seekX += (-dy / dist) * sway;
      seekY += (dx / dist) * sway;
    } else if (shard.kind === KIND_DRIFTER) {
      shard.phase += dt * 2.2;
      seekX += Math.cos(shard.phase) * 12;
      seekY += Math.sin(shard.phase) * 12;
    }
    shard.vx *= Math.max(0, 1 - 5.5 * dt);
    shard.vy *= Math.max(0, 1 - 5.5 * dt);
    shard.x += (seekX + shard.vx) * dt;
    shard.y += (seekY + shard.vy) * dt;
    shard.flash = Math.max(0, shard.flash - dt);
  }

  /** Gather a mote: score with the chain multiplier, feed the dawn meter, sparkle. */
  function collectMote(events, mote) {
    mote.active = false;
    state.motesGathered += 1;
    state.chain += 1;
    state.chainTimer = MOTE.chainWindow;
    state.bestChain = Math.max(state.bestChain, state.chain);
    state.multiplier = Math.min(MOTE.maxMultiplier, 1 + Math.floor(state.chain / MOTE.chainPerStep));
    const award = MOTE.score * state.multiplier;
    state.score += award;
    burst(mote.x, mote.y, 9, '#ffd257', 170, 0.5, 3);
    note(mote.x, mote.y - 14, state.multiplier > 1 ? `+${award} x${state.multiplier}` : `+${award}`, '#ffdf8a');
    events |= EVENT_COLLECT;
    if (state.anchorsLit < ANCHORS.length) {
      state.anchorProgress += 1;
      if (state.anchorProgress >= ANCHORS[state.anchorsLit]) {
        state.anchorProgress = 0;
        state.anchorsLit += 1;
        events |= EVENT_ANCHOR;
        burst(state.player.x, state.player.y, 30, '#57f2d4', 300, 0.8, 3.6);
        note(state.player.x, state.player.y - 34, `ANCHOR ${state.anchorsLit} LIT`, '#57f2d4');
        if (state.anchorsLit >= ANCHORS.length && !state.endless) {
          state.won = true;
          events |= EVENT_WIN;
        }
      }
    }
    return events;
  }

  /** Take a hit: a heart, a shake, a freeze-frame beat, and the shard that landed it is spent. */
  function takeHit(events, shard) {
    const player = state.player;
    shard.active = false;
    player.hearts -= 1;
    player.mercy = PLAYER.mercySeconds;
    state.shake = 15;
    state.hitStop = 0.055;
    state.chain = 0;
    state.multiplier = 1;
    burst(player.x, player.y, 20, '#ff6b81', 280, 0.6, 3.4);
    events |= EVENT_HIT;
    if (player.hearts <= 0) {
      state.over = true;
      events |= EVENT_OVER;
      burst(player.x, player.y, 46, '#57f2d4', 360, 1, 4);
    }
    return events;
  }

  /**
   * Advance the world one fixed step. `ambient` runs the title-screen demo: the night plays
   * itself out, but nothing can hurt the keeper and nothing is won or lost there.
   */
  function step(dt, controls, ambient) {
    let events = 0;
    if (state.hitStop > 0) {
      state.hitStop -= dt;
      return events;
    }
    state.time += dt;
    pulseCooldown = Math.max(0, pulseCooldown - dt);
    state.overglow = Math.max(0, state.overglow - dt);
    state.shake = Math.max(0, state.shake - 34 * dt);

    if (!state.over && !(state.won && !state.endless)) {
      movePlayer(dt, controls);
      if (controls.pulse && pulseCooldown <= 0) events = firePulse(events);
      if (state.player.justDashed) {
        state.player.justDashed = false;
        events |= EVENT_DASH;
      }

      // Spawning: motes drift in steadily; shards arrive faster the longer the night runs.
      moteTimer -= dt;
      if (moteTimer <= 0) {
        moteTimer = MOTE.spawnEvery;
        if (state.motes.filter((mote) => mote.active).length < MOTE.maxAlive) {
          const mote = createMote(next);
          // Never gift a mote: one that drifts in on top of the keeper appears across the stage.
          if (distance(mote.x, mote.y, state.player.x, state.player.y) < 190) {
            mote.x = FIELD.width - mote.x;
            mote.y = FIELD.height - mote.y;
          }
          state.motes.push(mote);
        }
      }
      shardTimer -= dt;
      if (shardTimer <= 0) {
        shardTimer = Math.max(SHARD.spawnFloor, SHARD.spawnStart - state.time * SHARD.spawnRamp);
        if (state.shards.filter((shard) => shard.active).length < SHARD.maxAlive) {
          const point = shardSpawnPoint(next);
          state.shards.push(createShard(next, pickShardKind(), point.x, point.y));
        }
      }
      pickupTimer -= dt;
      if (pickupTimer <= 0) {
        pickupTimer = PICKUP.every;
        if (state.pickups.length === 0) {
          const kind = state.player.hearts < PLAYER.maxHearts && chance(next, 0.55) ? PICKUP_HEART : PICKUP_OVERGLOW;
          state.pickups.push(createPickup(next, kind));
        }
      }

      // The chain lives only while the keeper keeps gathering.
      if (state.chainTimer > 0) {
        state.chainTimer -= dt;
        if (state.chainTimer <= 0) {
          state.chain = 0;
          state.multiplier = 1;
        }
      }
    }

    // Everything that drifts, hunts, ages or fades.
    for (const mote of state.motes) {
      mote.age += dt;
      mote.phase += dt * 2.4;
      mote.x += mote.vx * dt;
      mote.y += mote.vy * dt;
      if (mote.age > MOTE.lifetime) mote.active = false;
    }
    for (const shard of state.shards) if (shard.active) moveShard(dt, shard);
    for (const pickup of state.pickups) {
      pickup.age += dt;
      pickup.phase += dt * 3;
      const dist = distance(pickup.x, pickup.y, state.player.x, state.player.y);
      if (dist < PICKUP.magnetRange && dist > 1) {
        pickup.x += ((state.player.x - pickup.x) / dist) * 130 * dt;
        pickup.y += ((state.player.y - pickup.y) / dist) * 130 * dt;
      }
      if (pickup.age > PICKUP.lifetime) pickup.active = false;
    }
    for (const particle of state.particles) {
      particle.age += dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.max(0, 1 - particle.drag * dt);
      particle.vy *= Math.max(0, 1 - particle.drag * dt);
      if (particle.age > particle.life) particle.active = false;
    }
    for (const text of state.texts) {
      text.age += dt;
      text.y -= 36 * dt;
      if (text.age > text.life) text.active = false;
    }
    for (const ring of state.rings) ring.age += dt;
    state.rings = state.rings.filter((ring) => ring.age < PULSE.ringSeconds + 0.08);

    // Meetings: motes and pickups are gathered, shards are met.
    if (!state.over && !(state.won && !state.endless)) {
      const player = state.player;
      for (const mote of state.motes) {
        if (mote.active && distance(player.x, player.y, mote.x, mote.y) < player.radius + mote.radius + 3) {
          events = collectMote(events, mote);
        }
      }
      for (const pickup of state.pickups) {
        if (pickup.active && distance(player.x, player.y, pickup.x, pickup.y) < player.radius + pickup.radius + 4) {
          pickup.active = false;
          events |= EVENT_PICKUP;
          if (pickup.kind === PICKUP_HEART) {
            player.hearts = Math.min(PLAYER.maxHearts, player.hearts + 1);
            note(player.x, player.y - 30, '+1 HEART', '#ff8fab');
            burst(player.x, player.y, 14, '#ff6b81', 200, 0.6, 3.2);
          } else {
            state.overglow = PICKUP.overglowSeconds;
            note(player.x, player.y - 30, 'OVERGLOW!', '#c9a7ff');
            burst(player.x, player.y, 18, '#9a6bff', 230, 0.6, 3.2);
          }
        }
      }
      if (!ambient) {
        for (const shard of state.shards) {
          if (!shard.active) continue;
          if (distance(player.x, player.y, shard.x, shard.y) < player.radius + shard.radius - 3) {
            if (player.mercy <= 0 && player.dashTime <= 0) {
              events = takeHit(events, shard);
              if (state.over) break;
            }
          }
        }
      }
    }

    // Sweep the spent.
    state.motes = state.motes.filter((mote) => mote.active);
    state.shards = state.shards.filter((shard) => shard.active);
    state.pickups = state.pickups.filter((pickup) => pickup.active);
    state.particles = state.particles.filter((particle) => particle.active);
    state.texts = state.texts.filter((text) => text.active);
    return events;
  }

  reset();
  return { state, reset, step, pulseReady: () => pulseCooldown <= 0, pulseCooldown: () => pulseCooldown };
}

export { STEP };
