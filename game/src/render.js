// Painting the night: the gradient sky, a drifting starfield and nebula, the five dawn
// anchors strung across the top of the sky (they light up as the dawn meter fills, so the
// goal is always visible in the world itself), and every entity with its glow, plus the
// dressing the world leaves behind: pulse rings, particles and floating score notes.
// The HUD and the full screens live in their own files; this one only paints the world.

import { COLORS, FIELD, PULSE } from './config.js';
import { KIND_BRUTE, KIND_WEAVER, PICKUP_HEART } from './entities.js';
import { createRandom } from './random.js';
import { glowDot, heartPath, starPath } from './gfx.js';

/** Pickups start blinking this many seconds in, warning that they are about to fade. */
const PICKUP_FADE_START = 6.5;

/** The five anchor points, strung in a shallow arc across the sky. */
export const ANCHOR_POINTS = [
  { x: 250, y: 158 },
  { x: 445, y: 112 },
  { x: 640, y: 96 },
  { x: 835, y: 112 },
  { x: 1030, y: 158 },
];

/** The starfield, made once from a fixed seed: three layers that drift at different speeds. */
function makeStars() {
  const next = createRandom(20261117);
  const stars = [];
  for (let index = 0; index < 150; index += 1) {
    stars.push({
      x: next() * FIELD.width,
      y: next() * FIELD.height,
      layer: index % 3,
      size: 0.7 + next() * 1.5,
      phase: next() * Math.PI * 2,
    });
  }
  return stars;
}

/** The nebula, pre-rendered once to an offscreen canvas: soft violet and teal clouds. */
function makeNebula() {
  const canvas = document.createElement('canvas');
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;
  const ctx = canvas.getContext('2d');
  const next = createRandom(977);
  const clouds = [
    { x: 260, y: 180, r: 330, color: 'rgba(122, 82, 255, 0.20)' },
    { x: 1020, y: 300, r: 380, color: 'rgba(23, 183, 149, 0.13)' },
    { x: 680, y: 560, r: 420, color: 'rgba(255, 77, 126, 0.07)' },
    { x: 480, y: 380, r: 260, color: 'rgba(64, 96, 255, 0.12)' },
  ];
  for (const cloud of clouds) {
    const jitter = (next() - 0.5) * 60;
    const glow = ctx.createRadialGradient(cloud.x + jitter, cloud.y, 0, cloud.x + jitter, cloud.y, cloud.r);
    glow.addColorStop(0, cloud.color);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }
  return canvas;
}

/** Create the world painter. It owns the nebula and the starfield. */
export function createWorldPainter() {
  const stars = makeStars();
  let nebula = null;

  /** The sky: gradient, nebula, twinkling parallax stars, and a soft horizon glow. */
  function drawSky(ctx, time) {
    const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, COLORS.nightTop);
    gradient.addColorStop(1, COLORS.nightBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    if (!nebula) nebula = makeNebula();
    ctx.drawImage(nebula, 0, 0);
    for (const star of stars) {
      const drift = (time * (2 + star.layer * 3)) % FIELD.width;
      const x = (star.x + drift) % FIELD.width;
      const twinkle = 0.55 + 0.45 * Math.sin(time * (1 + star.layer * 0.6) + star.phase);
      ctx.globalAlpha = 0.35 + 0.5 * twinkle * (0.4 + star.layer * 0.3);
      ctx.fillStyle = COLORS.star;
      ctx.beginPath();
      ctx.arc(x, star.y, star.size, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const horizon = ctx.createLinearGradient(0, FIELD.height - 130, 0, FIELD.height);
    horizon.addColorStop(0, 'rgba(255, 190, 90, 0)');
    horizon.addColorStop(1, 'rgba(255, 190, 90, 0.07)');
    ctx.fillStyle = horizon;
    ctx.fillRect(0, FIELD.height - 130, FIELD.width, 130);
  }

  /** The anchor arc: lines join the lit anchors; the next one pulses, waiting. */
  function drawAnchors(ctx, state) {
    ctx.save();
    ctx.lineWidth = 2;
    for (let index = 0; index < ANCHOR_POINTS.length - 1; index += 1) {
      const a = ANCHOR_POINTS[index];
      const b = ANCHOR_POINTS[index + 1];
      // A span of the arc glows once the anchors at both of its ends are lit.
      const bothLit = index + 1 < state.anchorsLit;
      ctx.strokeStyle = bothLit ? 'rgba(255, 210, 87, 0.55)' : 'rgba(150, 165, 220, 0.13)';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ANCHOR_POINTS.forEach((point, index) => {
      const lit = index < state.anchorsLit;
      const isNext = index === state.anchorsLit;
      const pulse = isNext ? 1 + 0.16 * Math.sin(state.time * 3.2) : 1;
      if (lit) glowDot(ctx, point.x, point.y, 9, COLORS.gold, COLORS.goldSoft);
      starPath(ctx, point.x, point.y, (lit ? 13 : 10) * pulse, (lit ? 5.4 : 4.2) * pulse);
      ctx.fillStyle = lit ? COLORS.gold : 'rgba(170, 182, 230, 0.5)';
      ctx.fill();
    });
    ctx.restore();
  }

  /** One mote: a breathing gold light with a tiny cross sparkle, blinking as it fades. */
  function drawMote(ctx, mote) {
    const fade = mote.age > 12 ? (Math.sin(mote.age * 14) > 0 ? 1 : 0.25) : 1;
    const bob = Math.sin(mote.phase) * 2.5;
    ctx.save();
    ctx.globalAlpha = fade;
    glowDot(ctx, mote.x, mote.y + bob, mote.radius * (0.9 + 0.14 * Math.sin(mote.phase)), COLORS.gold, '#fff3c4');
    ctx.strokeStyle = 'rgba(255, 243, 196, 0.85)';
    ctx.lineWidth = 1.6;
    const arm = mote.radius * 1.5;
    ctx.beginPath();
    ctx.moveTo(mote.x - arm, mote.y + bob);
    ctx.lineTo(mote.x + arm, mote.y + bob);
    ctx.moveTo(mote.x, mote.y + bob - arm);
    ctx.lineTo(mote.x, mote.y + bob + arm);
    ctx.stroke();
    ctx.restore();
  }

  /** One shard: a jagged hollow crystal, magenta dark at the core, white-hot when flashed. */
  function drawShard(ctx, shard) {
    const angle = Math.atan2(shard.vy, shard.vx);
    ctx.save();
    ctx.translate(shard.x, shard.y);
    ctx.rotate(shard.kind === KIND_WEAVER ? angle + Math.PI / 2 : shard.phase * 0.4);
    const r = shard.radius;
    ctx.beginPath();
    const points = shard.kind === KIND_BRUTE ? 8 : 4;
    for (let index = 0; index < points; index += 1) {
      const a = (index / points) * Math.PI * 2;
      const rr = index % 2 === 0 ? r : r * 0.62;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    const body = ctx.createRadialGradient(0, 0, 1, 0, 0, r);
    body.addColorStop(0, shard.flash > 0 ? '#ffffff' : '#2a0a1c');
    body.addColorStop(0.55, shard.flash > 0 ? '#ffd7e4' : COLORS.magentaDeep);
    body.addColorStop(1, COLORS.magenta);
    ctx.fillStyle = body;
    ctx.shadowColor = COLORS.magenta;
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(10, 4, 12, 0.85)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.34, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#ff8fab';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.13, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
    // A brute shows its wounds: one pip per hit point left, above the crystal.
    if (shard.kind === KIND_BRUTE && shard.hp < shard.maxHp) {
      for (let index = 0; index < shard.maxHp; index += 1) {
        ctx.fillStyle = index < shard.hp ? COLORS.magenta : 'rgba(255, 255, 255, 0.22)';
        ctx.fillRect(shard.x - 15 + index * 11, shard.y - shard.radius - 14, 8, 4);
      }
    }
  }

  /** The keeper: a teal lantern wisp with a bright core, a trail, and a mercy blink. */
  function drawPlayer(ctx, state) {
    const player = state.player;
    // The dash trail: fading ghosts along the recent path.
    for (const point of player.trail) {
      const fade = Math.max(0, 1 - point.age * 5);
      if (fade <= 0) continue;
      ctx.globalAlpha = fade * 0.25;
      ctx.fillStyle = COLORS.teal;
      ctx.beginPath();
      ctx.arc(point.x, point.y, player.radius * (0.5 + fade * 0.4), 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (player.mercy > 0 && Math.sin(state.time * 26) > 0) ctx.globalAlpha = 0.35;
    // The lantern aura widens while Overglow burns.
    const aura = state.overglow > 0 ? player.radius * 2.5 : player.radius * 1.9;
    const glow = ctx.createRadialGradient(player.x, player.y, 2, player.x, player.y, aura);
    glow.addColorStop(0, state.overglow > 0 ? 'rgba(154, 107, 255, 0.5)' : 'rgba(87, 242, 212, 0.4)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(player.x, player.y, aura, 0, 2 * Math.PI);
    ctx.fill();
    // The lantern body and its handle.
    ctx.strokeStyle = COLORS.tealDeep;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y - player.radius - 3, 6, Math.PI, 2 * Math.PI);
    ctx.stroke();
    const body = ctx.createRadialGradient(player.x - 4, player.y - 5, 2, player.x, player.y, player.radius + 3);
    body.addColorStop(0, '#eafffa');
    body.addColorStop(0.45, COLORS.teal);
    body.addColorStop(1, COLORS.tealDeep);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, 2 * Math.PI);
    ctx.fill();
    // The wisp's eye, looking the way it last moved.
    ctx.fillStyle = '#07332a';
    ctx.beginPath();
    ctx.arc(player.x + player.faceX * 4.5, player.y - 1.5, 2.6, 0, 2 * Math.PI);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /** A pickup: a pulsing heart, or a violet Overglow star turning slowly. */
  function drawPickup(ctx, pickup) {
    const bob = Math.sin(pickup.phase) * 3;
    const blink = pickup.age > PICKUP_FADE_START && Math.sin(pickup.age * 12) > 0 ? 0.3 : 1;
    ctx.save();
    ctx.globalAlpha = blink;
    if (pickup.kind === PICKUP_HEART) {
      glowDot(ctx, pickup.x, pickup.y + bob, 8, COLORS.heart, '#ffc2cd');
      heartPath(ctx, pickup.x, pickup.y + bob, 26);
      ctx.fillStyle = COLORS.heart;
      ctx.fill();
    } else {
      glowDot(ctx, pickup.x, pickup.y + bob, 8, COLORS.violet, '#e3d4ff');
      starPath(ctx, pickup.x, pickup.y + bob, 14, 6, 5, pickup.phase * 0.4);
      ctx.fillStyle = '#c9a7ff';
      ctx.fill();
    }
    ctx.restore();
  }

  /** Rings, particles and floating notes: the dressing the world leaves behind. */
  function drawEffects(ctx, state) {
    for (const ring of state.rings) {
      const fraction = ring.age / PULSE.ringSeconds;
      const radius = ring.maxRadius * (0.25 + 0.75 * fraction);
      ctx.globalAlpha = Math.max(0, 0.75 * (1 - fraction));
      ctx.strokeStyle = state.overglow > 0 ? '#c9a7ff' : COLORS.teal;
      ctx.lineWidth = 5 * (1 - fraction) + 1;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, radius, 0, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const particle of state.particles) {
      const fade = Math.max(0, 1 - particle.age / particle.life);
      ctx.globalAlpha = fade;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * fade + 0.6, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    for (const text of state.texts) {
      const fade = Math.max(0, 1 - text.age / text.life);
      ctx.globalAlpha = fade;
      ctx.font = '700 16px system-ui, "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = text.color;
      ctx.fillText(text.text, text.x, text.y);
    }
    ctx.globalAlpha = 1;
  }

  /** Paint the whole world for one frame. */
  function draw(ctx, state) {
    drawSky(ctx, state.time);
    drawAnchors(ctx, state);
    for (const mote of state.motes) drawMote(ctx, mote);
    for (const pickup of state.pickups) drawPickup(ctx, pickup);
    for (const shard of state.shards) drawShard(ctx, shard);
    if (!state.over) drawPlayer(ctx, state);
    drawEffects(ctx, state);
    // A red edge closes in for a breath after a hit (the shake itself is applied by main).
    if (state.shake > 9) {
      const edge = ctx.createRadialGradient(640, 360, 320, 640, 360, 760);
      edge.addColorStop(0, 'rgba(255, 60, 90, 0)');
      edge.addColorStop(1, `rgba(255, 60, 90, ${Math.min(0.3, (state.shake - 9) / 20)})`);
      ctx.fillStyle = edge;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  return { draw };
}
