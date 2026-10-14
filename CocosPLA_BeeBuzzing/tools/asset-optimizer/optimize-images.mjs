#!/usr/bin/env node
/**
 * Lossy-palette PNG optimization for playable builds (every byte is inlined as base64).
 * Rewrites files in place (Cocos keeps the .meta uuid) and only when the result is smaller.
 *
 * Usage: node optimize-images.mjs <png-or-dir> [...]   (default: ../../assets/resources/bee/sprites)
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const targets = process.argv.slice(2);
if (targets.length === 0) targets.push('../../assets/resources/bee/sprites');

const files = targets.flatMap((t) => (fs.statSync(t).isDirectory()
    ? fs.readdirSync(t).filter((f) => f.endsWith('.png')).map((f) => path.join(t, f))
    : [t]));

let before = 0;
let after = 0;
for (const file of files) {
    const input = fs.readFileSync(file);
    const output = await sharp(input).png({ palette: true, quality: 85, effort: 10, compressionLevel: 9 }).toBuffer();
    before += input.length;
    if (output.length < input.length) {
        fs.writeFileSync(file, output);
        after += output.length;
        console.log(`${path.basename(file)}: ${input.length} -> ${output.length} B`);
    } else {
        after += input.length;
        console.log(`${path.basename(file)}: kept (${input.length} B)`);
    }
}
console.log(`[optimize-images] total ${before} -> ${after} B (${(100 * after / Math.max(1, before)).toFixed(1)}%)`);
