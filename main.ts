// A working best-game-01 entry (Node 22, standard library only): the game is this directory's
// game/ folder, plain static files a desktop browser loads offline (game/index.html and its ES
// modules, no library and no network request), and the program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library. A starting point, not a winner: Block Dodger, a
// plain 2D canvas game where a paddle dodges falling blocks and catches coins, with a title screen,
// score, lives and levels, game over and restart, flat colours and no sound. Build your own game
// (any genre, any library you vendor under game/, or none), put your 3 or 4 PNG or JPEG screenshots
// in screenshots/ (the first by name is the cover) and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Build inventory (added for this entry): once the dossier is written, walk the
// two folders that were just handed in and print what the build actually
// contains — one line per file with its size, then a closing total. It reads
// only the output directory, never touches the dossier, and exists so a human
// glancing at the build log can see the entry's shape at a glance.
async function printInventory(root) {
  const { readdir, stat } = await import('node:fs/promises');
  const rows = [];
  async function walk(dir, prefix) {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full, rel);
      else if (entry.isFile()) rows.push({ rel, bytes: (await stat(full)).size });
    }
  }
  for (const folder of ['game', 'screenshots']) {
    await walk(join(root, folder), folder);
  }
  // The dossier itself belongs in the inventory too: it is the third thing
  // the build hands in, and its size is the one that grows with the sources.
  rows.push({ rel: 'dossier.json', bytes: (await stat(join(root, 'dossier.json'))).size });
  let total = 0;
  for (const row of rows) {
    total += row.bytes;
    console.log(`${row.rel}  ${row.bytes} bytes`);
  }
  console.log(`inventory: ${rows.length} files, ${total} bytes total`);
}

await printInventory(out);
