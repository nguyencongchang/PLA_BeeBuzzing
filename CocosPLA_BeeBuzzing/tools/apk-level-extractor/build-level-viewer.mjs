#!/usr/bin/env node
/**
 * Builds a single self-contained HTML page to browse extracted levels in 3D and copy their JSON.
 *
 * Usage: node build-level-viewer.mjs <levels-dir> <out.html>
 *
 * <levels-dir> is the output of extract_apk_levels.py (editor-format level JSON + index.json).
 * Every level goes through tools/level-compactor/compact-level.mjs (same validation as the game
 * build), and the palette comes from GamePalette.ts, so the page never drifts from the playable.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '../..');
const COMPACTOR = path.join(projectRoot, 'tools/level-compactor/compact-level.mjs');
const PALETTE_TS = path.join(projectRoot, 'assets/scripts/game/infrastructure/GamePalette.ts');
const TEMPLATE = path.join(here, 'level-viewer.template.html');

const [, , levelsDir, outPath] = process.argv;
if (!levelsDir || !outPath) {
    console.error('Usage: node build-level-viewer.mjs <levels-dir> <out.html>');
    process.exit(1);
}

/** GameColor → { hex, name } parsed from GamePalette.ts (single source of truth). */
function readPalette() {
    const palette = {};
    const entry = /(\d+):\s*'(#[0-9A-Fa-f]{6})',\s*\/\/\s*(\w+)/g;
    for (const [, code, hex, name] of fs.readFileSync(PALETTE_TS, 'utf8').matchAll(entry)) {
        palette[code] = { hex, name };
    }
    if (Object.keys(palette).length === 0) throw new Error(`[build-level-viewer] no palette entries in ${PALETTE_TS}`);
    return palette;
}

const index = JSON.parse(fs.readFileSync(path.join(levelsDir, 'index.json'), 'utf8'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'level-viewer-'));
const levels = [];
for (const entry of index.filter((e) => e.exported)) {
    const out = path.join(tmp, `${entry.name}.level.json`);
    execFileSync(process.execPath, [COMPACTOR, path.join(levelsDir, `${entry.name}.json`), out], { stdio: 'pipe' });
    levels.push({ ...entry, compact: JSON.parse(fs.readFileSync(out, 'utf8')) });
}
fs.rmSync(tmp, { recursive: true, force: true });

const data = { palette: readPalette(), levels, skipped: index.filter((e) => !e.exported) };
const html = fs.readFileSync(TEMPLATE, 'utf8').replace('/*__LEVEL_DATA__*/null', () => JSON.stringify(data));
fs.writeFileSync(outPath, html);
console.log(`[build-level-viewer] ${levels.length} levels -> ${outPath} (${(html.length / 1024).toFixed(0)} KB)`);
