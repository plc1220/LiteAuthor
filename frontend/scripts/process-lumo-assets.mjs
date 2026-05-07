/**
 * Crops transparent Lumo pose assets from the 1024×1024 character sheet.
 * The output keeps breathing room around the mascot so UI animation has room
 * to move without clipping.
 *
 * Usage: node scripts/process-lumo-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const sheetPath = path.join(root, 'src/assets/lumo/lumo-character-sheet.png');
const outDir = path.join(root, 'src/assets/lumo');

/** Pose metadata is tuned around Lumo's body scale, not total silhouette width. */
const poses = {
  idle: {rect: {left: 42, top: 382, width: 190, height: 180}},
  blink: {rect: {left: 250, top: 378, width: 185, height: 184}},
  thinking: {rect: {left: 426, top: 376, width: 188, height: 176}, offsetX: 2, scale: 1.03},
  excited: {rect: {left: 622, top: 368, width: 172, height: 194}, offsetX: 3, scale: 1.03},
  wink: {rect: {left: 806, top: 382, width: 178, height: 180}, scale: 1.01},
  badge: {rect: {left: 78, top: 646, width: 152, height: 122}, offsetY: -2},
  notification: {rect: {left: 300, top: 626, width: 210, height: 150}, offsetX: 3},
  thought: {rect: {left: 580, top: 602, width: 182, height: 162}, offsetX: 0, scale: 1.08},
  wave: {rect: {left: 748, top: 602, width: 248, height: 164}, offsetX: -10, scale: 1.12},
};

const canvas = 256;
const sheetFrames = ['idle', 'blink', 'thinking', 'excited', 'wink', 'badge', 'notification', 'thought', 'wave'];

async function removeSheetBackground(input) {
  const {data, info} = await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  const {width, height} = info;
  const visited = new Uint8Array(width * height);
  const queue = [];
  const isSheetBackground = (idx) => {
    const offset = idx * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    return r > 232 && g > 232 && b > 226 && Math.max(r, g, b) - Math.min(r, g, b) < 24;
  };
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx] || !isSheetBackground(idx)) return;
    visited[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }

  for (let qi = 0; qi < queue.length; qi += 1) {
    const idx = queue[qi];
    const x = idx % width;
    const y = Math.floor(idx / width);
    data[idx * 4 + 3] = 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  for (let i = 0; i < visited.length; i += 1) {
    if (visited[i]) {
      data[i * 4 + 3] = 0;
    }
  }
  return sharp(data, {raw: info}).png().toBuffer();
}

async function main() {
  if (!fs.existsSync(sheetPath)) {
    console.error('Missing sheet:', sheetPath);
    process.exit(1);
  }
  const meta = await sharp(sheetPath).metadata();
  const W = meta.width ?? 1024;
  const H = meta.height ?? 1024;
  if (W !== 1024 || H !== 1024) {
    console.warn(`Expected 1024×1024 sheet, got ${W}×${H} — crops may need retuning.`);
  }

  fs.mkdirSync(outDir, {recursive: true});

  for (const [name, pose] of Object.entries(poses)) {
    const pngPath = path.join(outDir, `lumo-${name}.png`);
    const crop = await sharp(sheetPath).extract(pose.rect).png().toBuffer();
    const transparent = await removeSheetBackground(crop);
    const normalized = await sharp(transparent)
      .trim({background: {r: 0, g: 0, b: 0, alpha: 0}, threshold: 8})
      .png()
      .toBuffer();
    const meta = await sharp(normalized).metadata();
    const scale = pose.scale ?? 1;
    const width = Math.round((meta.width ?? canvas) * scale);
    const height = Math.round((meta.height ?? canvas) * scale);
    const scaled = scale === 1 ? normalized : await sharp(normalized).resize(width, height, {fit: 'fill'}).png().toBuffer();
    await sharp({
      create: {
        width: canvas,
        height: canvas,
        channels: 4,
        background: {r: 0, g: 0, b: 0, alpha: 0},
      },
    })
      .composite([
        {
          input: scaled,
          left: Math.round((canvas - width) / 2 + (pose.offsetX ?? 0)),
          top: Math.max(0, Math.round(canvas - height - 16 + (pose.offsetY ?? 0))),
        },
      ])
      .png()
      .toFile(pngPath);
    console.log('Wrote', path.relative(root, pngPath));
  }

  const spriteSheetPath = path.join(outDir, 'lumo-sprite-sheet.png');
  await sharp({
    create: {
      width: canvas * sheetFrames.length,
      height: canvas,
      channels: 4,
      background: {r: 0, g: 0, b: 0, alpha: 0},
    },
  })
    .composite(
      sheetFrames.map((name, index) => ({
        input: path.join(outDir, `lumo-${name}.png`),
        left: index * canvas,
        top: 0,
      })),
    )
    .png()
    .toFile(spriteSheetPath);
  console.log('Wrote', path.relative(root, spriteSheetPath), `(${sheetFrames.length} frames)`);

  const fabPath = path.join(outDir, 'lumo-fab.png');
  await fs.promises.copyFile(path.join(outDir, 'lumo-wave.png'), fabPath);
  console.log('Wrote', path.relative(root, fabPath), '(copy of lumo-wave)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
