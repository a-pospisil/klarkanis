// Vygeneruje img/og.png, ikony a favicon.ico z tools/og.html a favicon.svg.
// Spuštění (vyžaduje Playwright s Chromiem): node tools/render-assets.mjs
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch();

const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await og.goto('file://' + join(root, 'tools/og.html'));
await og.evaluate(() => document.fonts.ready);
await og.screenshot({ path: join(root, 'img/og.png') });

const svg = readFileSync(join(root, 'favicon.svg'), 'utf8');
const icon = await browser.newPage({ deviceScaleFactor: 1 });
const png = async (size) => {
  await icon.setViewportSize({ width: size, height: size });
  await icon.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  return icon.screenshot({ omitBackground: true });
};
for (const [name, size] of [['apple-touch-icon', 180], ['icon-192', 192], ['icon-512', 512], ['icon-48', 48]]) {
  writeFileSync(join(root, `img/${name}.png`), await png(size));
}

// favicon.ico: kontejner s PNG záznamy 16, 32 a 48 px
const entries = await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(size) })));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(entries.length, 4);
let offset = 6 + 16 * entries.length;
const dir = entries.map(({ size, data }) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(size === 256 ? 0 : size, 0); e.writeUInt8(size === 256 ? 0 : size, 1);
  e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(data.length, 8); e.writeUInt32LE(offset, 12);
  offset += data.length;
  return e;
});
writeFileSync(join(root, 'favicon.ico'), Buffer.concat([header, ...dir, ...entries.map((e) => e.data)]));

await browser.close();
console.log('ok: img/og.png, img/*.png, favicon.ico');
