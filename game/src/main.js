// Boot and the one loop of Motekeeper. Input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), world events become
// sounds and announcements, and the painter draws the world, the HUD and whichever screen
// the game is on: title, play, paused, game over or victory. The title's night plays
// itself behind the menu, steered by the autopilot.
//
// ?seed=N fixes the night's pattern. ?shot=start|play|frenzy|win|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, FIELD, PULSE, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld, EVENT_ANCHOR, EVENT_COLLECT, EVENT_DASH, EVENT_HIT, EVENT_KILL,
  EVENT_OVER, EVENT_PICKUP, EVENT_PULSE, EVENT_WIN,
} from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createWorldPainter } from './render.js';
import { drawHud } from './hud.js';
import {
  BUTTONS, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN,
  drawOver, drawPaused, drawTitle, drawWin, pointInButton,
} from './screens.js';
import { pilotControls } from './autopilot.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const ctx = canvas.getContext('2d');
const world = createWorld(createRandom(seed));
const painter = createWorldPainter();
const audio = createAudio();

/** Fit the fixed 1280x720 stage into the window, letterboxed, and keep it centred. */
function fitStage() {
  const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
  canvas.style.width = `${Math.floor(FIELD.width * scale)}px`;
  canvas.style.height = `${Math.floor(FIELD.height * scale)}px`;
  canvas.style.left = `${Math.floor((window.innerWidth - FIELD.width * scale) / 2)}px`;
  canvas.style.top = `${Math.floor((window.innerHeight - FIELD.height * scale) / 2)}px`;
}

/** Convert a client point to stage coordinates through the letterbox. */
function toStage(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * FIELD.width,
    y: ((clientY - rect.top) / rect.height) * FIELD.height,
  };
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

/** Paint one frame: the world (shaken when the night lands a blow), then HUD, then screen. */
function draw(state, screen, best) {
  ctx.save();
  if (state.shake > 0.4) {
    const jolt = state.shake * 0.55;
    ctx.translate((Math.random() * 2 - 1) * jolt, (Math.random() * 2 - 1) * jolt);
  }
  painter.draw(ctx, state);
  ctx.restore();
  if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
    const cooldown = state.overglow > 0 ? PULSE.overglowCooldown : PULSE.cooldown;
    drawHud(ctx, state, 1 - world.pulseCooldown() / cooldown, best);
  }
  if (screen === SCREEN_TITLE) drawTitle(ctx, state, best);
  else if (screen === SCREEN_PAUSED) drawPaused(ctx, state);
  else if (screen === SCREEN_OVER) drawOver(ctx, state, best);
  else if (screen === SCREEN_WIN) drawWin(ctx, state, best);
}

/** The staged-scene path: set the scene, paint it twice, and say it is ready. */
function runShot(name) {
  fitStage();
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

/** The live game: a state machine over the five screens, stepping the fixed-step world. */
function runGame() {
  const input = createInput(canvas, toStage);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    audio.confirm();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Gather light motes and light all five anchors.');
  }

  function finishRun() {
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
  }

  function continueEndless() {
    world.state.endless = true;
    screen = SCREEN_PLAY;
    audio.confirm();
    announce('Endless night. The dawn stays lit; gather on.');
  }

  /** Turn one step's world events into sound, screens and announcements. */
  function hearEvents(events) {
    const state = world.state;
    if (events & EVENT_COLLECT) audio.collect(state.chain);
    if (events & EVENT_KILL) audio.kill();
    if (events & EVENT_PULSE) audio.pulse();
    if (events & EVENT_DASH) audio.dash();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_ANCHOR) audio.anchor();
    if (events & EVENT_HIT) {
      audio.hit();
      announce(state.player.hearts === 1 ? 'Hit. One heart left.' : `Hit. ${state.player.hearts} hearts left.`);
    }
    if (events & EVENT_WIN) {
      audio.win();
      finishRun();
      screen = SCREEN_WIN;
      announce(`Dawn breaks. Score ${state.score}.`);
    }
    if (events & EVENT_OVER) {
      audio.over();
      finishRun();
      screen = SCREEN_OVER;
      announce(`Game over. Score ${state.score}. Best ${best}.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    const click = input.takeClick();
    if (actions & ACTION_MUTE) {
      audio.unlock();
      announce(audio.toggleMute() ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if ((actions & ACTION_CONFIRM) || (click && pointInButton(click, BUTTONS.start))) startGame();
      return;
    }
    if (screen === SCREEN_OVER) {
      if ((actions & (ACTION_CONFIRM | ACTION_RESTART)) || (click && pointInButton(click, BUTTONS.restart))) startGame();
      return;
    }
    if (screen === SCREEN_WIN) {
      if (click && pointInButton(click, BUTTONS.againWin)) startGame();
      else if ((actions & ACTION_RESTART)) startGame();
      else if ((actions & ACTION_CONFIRM) || (click && pointInButton(click, BUTTONS.continueWin))) continueEndless();
      return;
    }
    if (screen === SCREEN_PLAY && (actions & ACTION_PAUSE)) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      return;
    }
    if (screen === SCREEN_PAUSED && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, pilotControls(world.state, world), true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const keys = input.controls();
    const pointer = input.pointerControls(world.state.player);
    const controls = keys.x !== 0 || keys.y !== 0 ? keys : (pointer ?? keys);
    hearEvents(world.step(STEP, controls, false));
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    draw(world.state, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  window.addEventListener('keydown', () => audio.unlock(), { once: true });

  fitStage();
  announce('Motekeeper. Press Space or choose Begin the Night to play.');
  requestAnimationFrame(frame);
}

window.addEventListener('resize', fitStage);
fitStage();
if (shot) runShot(shot);
else runGame();
