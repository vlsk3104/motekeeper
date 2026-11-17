// Motekeeper: every tuning number in one place, so the game's balance can be read at a glance.
// The field is a fixed 1280x720 stage; the renderer scales it to the window, and every speed,
// radius and timer below is in stage pixels and seconds.

// The stage and the fixed simulation step (the world advances in whole steps of STEP only).
export const FIELD = { width: 1280, height: 720 };
export const STEP = 1 / 60;

// The keeper: a small lantern wisp the player steers.
export const PLAYER = {
  radius: 14,
  speed: 285,
  startHearts: 3,
  maxHearts: 5,
  // A hit costs a heart and buys this long of mercy invulnerability.
  mercySeconds: 1.25,
  // The dash: a short burst that passes through shards, on its own cooldown.
  dashSeconds: 0.16,
  dashSpeed: 800,
  dashCooldown: 1.2,
};

// The pulse: a ring of lantern light on its own cooldown. It is the only weapon.
export const PULSE = {
  radius: 122,
  cooldown: 1.9,
  // While Overglow burns the ring is wider and returns much sooner.
  overglowRadius: 176,
  overglowCooldown: 0.85,
  ringSeconds: 0.3,
};

// Light motes: the collectible. Gathering them fills the dawn meter and feeds the combo chain.
export const MOTE = {
  radius: 10,
  spawnEvery: 0.7,
  maxAlive: 12,
  lifetime: 15,
  score: 25,
  // Collect again within this window to grow the chain; the multiplier steps up every 4 chain.
  chainWindow: 2.75,
  chainPerStep: 4,
  maxMultiplier: 8,
};

// The dawn meter: lighting all five anchors wins the game. Each anchor wants more light
// than the last, counted in motes gathered since the previous anchor lit.
export const ANCHORS = [14, 20, 26, 28, 32];

// Hollow shards: the enemies. Three kinds, unlocked as the night deepens.
export const SHARD = {
  spawnStart: 2.4,
  spawnFloor: 0.68,
  // The spawn interval shrinks by this many seconds for every second survived.
  spawnRamp: 0.013,
  maxAlive: 26,
  weaverAt: 28,
  bruteAt: 62,
};

export const SHARD_KINDS = {
  drifter: { radius: 13, speed: 63, hp: 1, score: 40 },
  weaver: { radius: 11, speed: 108, hp: 1, score: 60 },
  brute: { radius: 25, speed: 45, hp: 3, score: 150 },
};

// How much faster shards hunt as the night deepens (added speed per second, capped).
export const HUNT_RAMP = { perSecond: 0.28, cap: 50 };

// Pickups: a heart when the keeper is hurt, an Overglow star otherwise.
export const PICKUP = {
  radius: 12,
  every: 17,
  lifetime: 9,
  magnetRange: 96,
  overglowSeconds: 8,
};

// Floating score text and particles are capped so a long run never slows down.
export const PARTICLE_CAP = 420;
export const TEXT_CAP = 24;

// The palette: deep night indigo, lantern gold, wisp teal, shard magenta, soft starlight.
export const COLORS = {
  nightTop: '#0b1026',
  nightBottom: '#131a3a',
  star: '#cdd8ff',
  gold: '#ffd257',
  goldSoft: '#ffdf8a',
  teal: '#57f2d4',
  tealDeep: '#17b795',
  magenta: '#ff4d7e',
  magentaDeep: '#c21847',
  violet: '#9a6bff',
  heart: '#ff6b81',
  ink: '#eef1ff',
  inkDim: '#9aa5d9',
  panel: 'rgba(10, 14, 34, 0.72)',
  panelEdge: 'rgba(140, 160, 255, 0.35)',
};

// Where the best score is kept between visits.
export const BEST_KEY = 'motekeeper-best-score';
