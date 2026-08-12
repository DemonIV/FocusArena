// Crops the raw headless-Chrome shots down to the .phone frame (390x844 @3x).
const fs = require('fs');
const path = require('path');
const sharp = require('C:/Users/alper/node_modules/sharp');

const dir = __dirname;
const W = 1170;
const H = 2532;

(async () => {
  for (const file of fs.readdirSync(path.join(dir, 'raw')).filter((f) => f.endsWith('.png'))) {
    const src = path.join(dir, 'raw', file);
    const dst = path.join(dir, 'out', file);
    const meta = await sharp(src).metadata();
    if (meta.width < W || meta.height < H) {
      throw new Error(`${file}: raw shot ${meta.width}x${meta.height} smaller than ${W}x${H}`);
    }
    await sharp(src).extract({ left: 0, top: 0, width: W, height: H }).png().toFile(dst);
    console.log(`cropped ${file} (${meta.width}x${meta.height} -> ${W}x${H})`);
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
