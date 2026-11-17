// The player's hands: keyboard and pointer, read as one controls object for the world plus
// a set of one-shot action flags for the shell (confirm, pause, mute). Movement is WASD or
// the arrow keys; Space fires the pulse and Shift dashes (the mouse can steer too: hold the
// left button and the keeper swims toward the pointer). Nothing here knows the rules.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;

const MOVE_KEYS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

/**
 * Create the input reader bound to a canvas. `controls()` returns the held state for the
 * world; `takeActions()` returns and clears the action flags pressed since the last call;
 * `pointer()` gives the last pointer position in stage coordinates, for menu buttons.
 */
export function createInput(canvas, toStage) {
  const held = { up: false, down: false, left: false, right: false, pulse: false, dash: false };
  let actions = 0;
  let pointerDown = false;
  let pointerStage = { x: 0, y: 0 };
  let clicked = null;

  window.addEventListener('keydown', (event) => {
    const move = MOVE_KEYS[event.code];
    if (move) {
      held[move] = true;
      event.preventDefault();
      return;
    }
    if (event.code === 'Space') {
      held.pulse = true;
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
      return;
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      held.dash = true;
      return;
    }
    if (event.code === 'Enter' && !event.repeat) actions |= ACTION_CONFIRM;
    if (event.code === 'KeyR' && !event.repeat) actions |= ACTION_RESTART;
    if ((event.code === 'KeyP' || event.code === 'Escape') && !event.repeat) actions |= ACTION_PAUSE;
    if (event.code === 'KeyM' && !event.repeat) actions |= ACTION_MUTE;
  });

  window.addEventListener('keyup', (event) => {
    const move = MOVE_KEYS[event.code];
    if (move) held[move] = false;
    if (event.code === 'Space') held.pulse = false;
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.dash = false;
  });

  canvas.addEventListener('pointerdown', (event) => {
    pointerDown = true;
    pointerStage = toStage(event.clientX, event.clientY);
    clicked = pointerStage;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointermove', (event) => {
    pointerStage = toStage(event.clientX, event.clientY);
  });
  window.addEventListener('pointerup', () => {
    pointerDown = false;
  });
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = held.pulse = held.dash = false;
    pointerDown = false;
  });

  return {
    /** The held keyboard controls for one world step. Pointer steering is separate, below. */
    controls() {
      const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      return { x, y, pulse: held.pulse, dash: held.dash };
    },
    /** Pointer steering needs the keeper's position, so main.js asks with it each frame. */
    pointerControls(player) {
      if (!pointerDown) return null;
      const dx = pointerStage.x - player.x;
      const dy = pointerStage.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 12) return { x: 0, y: 0, pulse: held.pulse, dash: held.dash };
      return { x: dx / dist, y: dy / dist, pulse: held.pulse, dash: held.dash };
    },
    /** The action flags pressed since the last call; calling clears them. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The last click point in stage coordinates, or null; calling clears it. */
    takeClick() {
      const taken = clicked;
      clicked = null;
      return taken;
    },
    /** The current pointer position in stage coordinates (for hover). */
    pointer() {
      return pointerStage;
    },
  };
}
