// Small canvas drawing helpers shared by the renderer, the HUD and the screens: rounded
// panels, glow dots, hearts, stars and tidy text. Everything is drawn in code; the game
// ships no image assets at all.

/** A rounded rectangle path (not filled or stroked; the caller decides). */
export function panelPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/** Fill a rounded panel with a translucent night colour and a soft edge. */
export function drawPanel(ctx, x, y, width, height, fill, edge) {
  panelPath(ctx, x, y, width, height, 14);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** A filled circle with a radial glow halo, the game's one light trick, used everywhere. */
export function glowDot(ctx, x, y, radius, color, coreColor) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 3.2);
  glow.addColorStop(0, color);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 3.2, 0, 2 * Math.PI);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = coreColor || color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fill();
}

/** A heart path centred on (x, y) with the given width. */
export function heartPath(ctx, x, y, size) {
  const s = size / 32;
  ctx.beginPath();
  ctx.moveTo(x, y + 11 * s);
  ctx.bezierCurveTo(x - 17 * s, y - 4 * s, x - 10 * s, y - 15 * s, x, y - 6 * s);
  ctx.bezierCurveTo(x + 10 * s, y - 15 * s, x + 17 * s, y - 4 * s, x, y + 11 * s);
  ctx.closePath();
}

/** A star path centred on (x, y); five points unless told otherwise. */
export function starPath(ctx, x, y, outer, inner, points = 5, rotation = -Math.PI / 2) {
  ctx.beginPath();
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = rotation + (index * Math.PI) / points;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** One line of text with the game's typography; returns nothing, leaves no state changed. */
export function drawText(ctx, text, x, y, options = {}) {
  const {
    size = 16, weight = 600, color = '#eef1ff', align = 'left', alpha = 1, font = 'system-ui',
  } = options;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px "${font}", "Segoe UI", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** A horizontal meter: a dim track and a bright fill, both rounded. */
export function drawMeter(ctx, x, y, width, height, fraction, color) {
  const filled = Math.max(0, Math.min(1, fraction));
  panelPath(ctx, x, y, width, height, height / 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.fill();
  if (filled > 0) {
    panelPath(ctx, x, y, Math.max(height, width * filled), height, height / 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}
