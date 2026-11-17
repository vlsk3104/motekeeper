// The heads-up display, drawn over the world while playing: score and best on the left,
// the dawn anchors and the road to the next one in the middle, the clock and the combo
// chain on the right, hearts along the bottom left, and the pulse and dash readiness
// along the bottom right. Everything sits on translucent panels so it stays readable
// over the busiest sky, in play and in screenshots alike.

import { ANCHORS, COLORS, MOTE, PLAYER } from './config.js';
import { drawMeter, drawPanel, drawText, heartPath, starPath } from './gfx.js';

/** Format a run time as m:ss. */
export function formatTime(seconds) {
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${rest < 10 ? '0' : ''}${rest}`;
}

/** Draw the whole HUD for one frame. `pulseFraction` is 0..1, full when the pulse is ready. */
export function drawHud(ctx, state, pulseFraction, best) {
  // Score block, top left.
  drawPanel(ctx, 18, 16, 218, 64, COLORS.panel, COLORS.panelEdge);
  drawText(ctx, 'SCORE', 34, 36, { size: 11, color: COLORS.inkDim, weight: 700 });
  drawText(ctx, String(state.score).padStart(6, '0'), 34, 58, { size: 24, weight: 800, color: COLORS.ink });
  drawText(ctx, `BEST ${Math.max(best, state.score)}`, 226, 58, { size: 12, color: COLORS.inkDim, align: 'right' });

  // Dawn block, top centre: the five anchors as stars, and the road to the next one.
  drawPanel(ctx, 452, 16, 376, 64, COLORS.panel, COLORS.panelEdge);
  drawText(ctx, 'DAWN', 470, 32, { size: 10, color: COLORS.inkDim, weight: 700 });
  for (let index = 0; index < ANCHORS.length; index += 1) {
    const x = 528 + index * 58;
    const lit = index < state.anchorsLit;
    starPath(ctx, x, 42, lit ? 13 : 10, lit ? 5.4 : 4.2);
    ctx.fillStyle = lit ? COLORS.gold : 'rgba(170, 182, 230, 0.4)';
    ctx.fill();
  }
  if (state.anchorsLit < ANCHORS.length) {
    const needed = ANCHORS[state.anchorsLit];
    drawText(ctx, `${state.anchorProgress}/${needed}`, 810, 42, { size: 13, weight: 800, color: COLORS.goldSoft, align: 'right' });
    drawMeter(ctx, 490, 64, 300, 7, state.anchorProgress / needed, COLORS.gold);
  } else {
    drawText(ctx, 'ALL LIT — ENDLESS', 810, 42, { size: 11, weight: 800, color: COLORS.gold, align: 'right' });
    drawMeter(ctx, 490, 64, 300, 7, 1, COLORS.gold);
  }

  // Clock and chain block, top right.
  drawPanel(ctx, 1044, 16, 218, 64, COLORS.panel, COLORS.panelEdge);
  drawText(ctx, formatTime(state.time), 1226, 40, { size: 20, weight: 800, align: 'right' });
  if (state.multiplier > 1) {
    drawText(ctx, `CHAIN x${state.multiplier}`, 1226, 64, { size: 13, weight: 800, color: COLORS.goldSoft, align: 'right' });
    drawMeter(ctx, 1076, 71, 150, 5, state.chainTimer / MOTE.chainWindow, COLORS.gold);
  } else {
    drawText(ctx, `CHAIN ${state.chain}`, 1226, 64, { size: 12, color: COLORS.inkDim, align: 'right' });
  }

  // Hearts, bottom left: filled for whole hearts, hollow for the ones the night has taken.
  for (let index = 0; index < state.player.hearts; index += 1) {
    heartPath(ctx, 42 + index * 34, 678, 27);
    ctx.fillStyle = COLORS.heart;
    ctx.fill();
  }
  for (let index = state.player.hearts; index < PLAYER.maxHearts; index += 1) {
    heartPath(ctx, 42 + index * 34, 678, 27);
    ctx.strokeStyle = 'rgba(255, 139, 171, 0.35)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  // Readiness, bottom right: the pulse ring refilling, a dash pip, and the Overglow clock.
  drawText(ctx, 'PULSE', 1076, 664, { size: 11, color: COLORS.inkDim, weight: 700, align: 'right' });
  drawMeter(ctx, 1086, 656, 150, 13, pulseFraction, pulseFraction >= 1 ? COLORS.teal : '#3d7f74');
  if (pulseFraction >= 1) drawText(ctx, 'SPACE', 1161, 664, { size: 10, weight: 800, color: '#07332a', align: 'center' });
  drawText(ctx, 'DASH', 1076, 690, { size: 11, color: COLORS.inkDim, weight: 700, align: 'right' });
  const dashFraction = 1 - state.player.dashCooldown / PLAYER.dashCooldown;
  drawMeter(ctx, 1086, 682, 150, 13, dashFraction, dashFraction >= 1 ? COLORS.gold : '#8a6d2f');
  if (dashFraction >= 1) drawText(ctx, 'SHIFT', 1161, 690, { size: 10, weight: 800, color: '#33270a', align: 'center' });
  if (state.overglow > 0) {
    drawText(ctx, `OVERGLOW ${state.overglow.toFixed(0)}s`, 1236, 628, {
      size: 13, weight: 800, color: '#c9a7ff', align: 'right',
    });
  }
}
