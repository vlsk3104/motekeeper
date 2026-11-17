// The screenshot scenes behind ?shot=start|play|frenzy|win|end. Each one plays the real
// rules forward from a fresh world, steered by the pilots in autopilot.js, so the frame is
// what a real game looks like at that moment and the same seed always gives the same frame:
// start is the title over its living demo night, play is a run half a minute in, frenzy is
// the deep night with the sky full, win is a run the pilot actually finished, and end is a
// run a careless pilot lost. Nothing is posed that the game itself did not do.

import { STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { carelessControls, pilotControls } from './autopilot.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './screens.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 26;
const FRENZY_SECONDS = 80;
const WIN_LIMIT_SECONDS = 1500;
const END_LIMIT_SECONDS = 420;

/** Run the good pilot for `seconds` of game time, or until the run ends either way. */
function playRun(world, seconds, ambient) {
  let events = 0;
  const steps = Math.floor(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    events = world.step(STEP, pilotControls(world.state, world), ambient);
    if (events & (EVENT_OVER | EVENT_WIN)) break;
  }
  return events;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the best score
 * to show. Any name the game does not know is the start scene.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    playRun(world, PLAY_SECONDS, false);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'frenzy') {
    playRun(world, FRENZY_SECONDS, false);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'win') {
    const events = playRun(world, WIN_LIMIT_SECONDS, false);
    if (events & EVENT_WIN) {
      // Let the last moment settle: a second of quiet steps fades the score notes and
      // sparks of the winning gather, so the victory screen reads clean.
      for (let index = 0; index < 70; index += 1) world.step(STEP, { x: 0, y: 0, pulse: false, dash: false }, false);
      return { screen: SCREEN_WIN, best: world.state.score };
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    for (let index = 0; index < Math.floor(END_LIMIT_SECONDS / STEP); index += 1) {
      const events = world.step(STEP, carelessControls(world.state), false);
      if (events & EVENT_OVER) break;
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  playRun(world, START_SECONDS, true);
  return { screen: SCREEN_TITLE, best: 0 };
}
