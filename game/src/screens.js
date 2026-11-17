// The full screens that frame the play: title, pause, game over and victory. Each is drawn
// over the world (the title's night is alive behind it, played by the autopilot), and each
// names its buttons here as rectangles, so the shell can both draw them and take clicks on
// exactly the same spots. The end screens carry the run's whole story as stats, because a
// results screen is half the proof that a game is complete.

import { COLORS, FIELD } from './config.js';
import { drawPanel, drawText, glowDot } from './gfx.js';
import { formatTime } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/** The buttons, in stage coordinates, shared by the drawing here and the clicks in main. */
export const BUTTONS = {
  start: { x: 490, y: 528, w: 300, h: 56 },
  restart: { x: 490, y: 528, w: 300, h: 56 },
  continueWin: { x: 325, y: 528, w: 300, h: 56 },
  againWin: { x: 655, y: 528, w: 300, h: 56 },
};

/** Whether a stage point falls inside a button rectangle. */
export function pointInButton(point, button) {
  return point.x >= button.x && point.x <= button.x + button.w
    && point.y >= button.y && point.y <= button.y + button.h;
}

/** A button: a filled pill with a label, breathing gently while `pulse` is true. */
function drawButton(ctx, button, label, time, pulse) {
  const glow = pulse ? 0.5 + 0.3 * Math.sin(time * 3.4) : 0.4;
  ctx.save();
  ctx.shadowColor = COLORS.teal;
  ctx.shadowBlur = 22 * glow;
  drawPanel(ctx, button.x, button.y, button.w, button.h, 'rgba(23, 183, 149, 0.9)', COLORS.teal);
  ctx.restore();
  drawText(ctx, label, button.x + button.w / 2, button.y + button.h / 2 + 1, {
    size: 19, weight: 800, color: '#04231c', align: 'center',
  });
}

/** A translucent veil over the world, so screen text always reads. */
function veil(ctx, tint) {
  const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  gradient.addColorStop(0, 'rgba(6, 8, 22, 0.55)');
  gradient.addColorStop(0.5, tint);
  gradient.addColorStop(1, 'rgba(6, 8, 22, 0.78)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

/** One how-to row on the title screen: a key chip and what it does. */
function howToRow(ctx, y, keys, action) {
  drawPanel(ctx, 428, y - 15, 108, 30, 'rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.25)');
  drawText(ctx, keys, 482, y + 1, { size: 13, weight: 800, align: 'center' });
  drawText(ctx, action, 552, y + 1, { size: 15, color: COLORS.ink });
}

/** The run's story as two columns of stats, shared by the two end screens. */
function drawStats(ctx, state, best) {
  const rows = [
    ['SCORE', String(state.score)],
    ['BEST', String(Math.max(best, state.score))],
    ['TIME', formatTime(state.time)],
    ['MOTES GATHERED', String(state.motesGathered)],
    ['SHARDS BANISHED', String(state.kills)],
    ['BEST CHAIN', `${state.bestChain} motes`],
  ];
  rows.forEach((row, index) => {
    const column = index % 2;
    const line = Math.floor(index / 2);
    const x = column === 0 ? 452 : 668;
    const y = 372 + line * 40;
    drawText(ctx, row[0], x, y, { size: 12, color: COLORS.inkDim, weight: 700 });
    drawText(ctx, row[1], x + 176, y, { size: 17, weight: 800, align: 'right' });
  });
}

/** The title screen: the game's name over its living night, how to play, and the way in. */
export function drawTitle(ctx, state, best) {
  veil(ctx, 'rgba(10, 12, 34, 0.35)');
  glowDot(ctx, 640, 168, 26, COLORS.gold, '#fff3c4');
  ctx.save();
  ctx.shadowColor = COLORS.gold;
  ctx.shadowBlur = 34;
  drawText(ctx, 'MOTEKEEPER', 640, 226, { size: 82, weight: 800, color: '#fff6da', align: 'center' });
  ctx.restore();
  drawText(ctx, 'R E L I G H T   T H E   G L O A M I N G', 640, 282, {
    size: 17, weight: 700, color: COLORS.teal, align: 'center',
  });
  drawText(ctx, 'The hollow shards have snuffed the five dawn anchors. Gather the light motes,', 640, 330, {
    size: 16, color: COLORS.ink, align: 'center', weight: 500,
  });
  drawText(ctx, 'banish the shards with your pulse, and relight every anchor before your hearts go out.', 640, 354, {
    size: 16, color: COLORS.ink, align: 'center', weight: 500,
  });
  howToRow(ctx, 404, 'WASD · ARROWS', 'Steer the keeper (or hold the mouse)');
  howToRow(ctx, 442, 'SPACE', 'Pulse of light — banishes shards, keep it charged');
  howToRow(ctx, 480, 'SHIFT', 'Dash — slip through a shard unharmed');
  drawButton(ctx, BUTTONS.start, 'BEGIN THE NIGHT', state.time, true);
  drawText(ctx, best > 0 ? `Best score ${best} · P pause · M mute` : 'or press SPACE · P pause · M mute', 640, 622, {
    size: 13, color: COLORS.inkDim, align: 'center',
  });
}

/** The pause screen: a breath, and the way back. */
export function drawPaused(ctx, state) {
  veil(ctx, 'rgba(8, 10, 26, 0.5)');
  drawText(ctx, 'PAUSED', 640, 320, { size: 54, weight: 800, align: 'center' });
  drawText(ctx, 'The night waits. Press P or SPACE to go on.', 640, 372, {
    size: 16, color: COLORS.inkDim, align: 'center',
  });
  void state;
}

/** The game-over screen: what the run was, and the way back in. */
export function drawOver(ctx, state, best) {
  veil(ctx, 'rgba(40, 6, 20, 0.45)');
  drawText(ctx, 'THE NIGHT PREVAILS', 640, 218, { size: 58, weight: 800, color: '#ff8fab', align: 'center' });
  drawText(ctx, `The last light went out with ${state.anchorsLit} of 5 anchors lit. The motes will drift again.`, 640, 268, {
    size: 16, color: COLORS.ink, align: 'center', weight: 500,
  });
  drawStats(ctx, state, best);
  drawButton(ctx, BUTTONS.restart, 'TRY AGAIN', state.time, true);
  drawText(ctx, 'or press SPACE', 640, 622, { size: 13, color: COLORS.inkDim, align: 'center' });
}

/** The victory screen: dawn, the run's story, and the choice to keep gathering. */
export function drawWin(ctx, state, best) {
  veil(ctx, 'rgba(46, 32, 4, 0.42)');
  glowDot(ctx, 640, 150, 30, COLORS.gold, '#fff3c4');
  ctx.save();
  ctx.shadowColor = COLORS.gold;
  ctx.shadowBlur = 30;
  drawText(ctx, 'DAWN BREAKS', 640, 218, { size: 62, weight: 800, color: '#fff6da', align: 'center' });
  ctx.restore();
  drawText(ctx, 'All five anchors burn again. The Gloaming is lit — and the night is yours to keep.', 640, 268, {
    size: 16, color: COLORS.ink, align: 'center', weight: 500,
  });
  drawStats(ctx, state, best);
  drawButton(ctx, BUTTONS.continueWin, 'KEEP GATHERING', state.time, true);
  drawButton(ctx, BUTTONS.againWin, 'NEW NIGHT', state.time, false);
  drawText(ctx, 'SPACE keeps gathering · R starts a new night', 640, 622, {
    size: 13, color: COLORS.inkDim, align: 'center',
  });
}
