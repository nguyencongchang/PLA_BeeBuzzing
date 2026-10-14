#!/usr/bin/env node
/**
 * Re-runs the super-html packer on build/web-mobile with JS obfuscation OFF.
 *
 * super-html hard-codes `is_obfuscator: true`. Its string-array obfuscation routes every
 * property access through a decoder call, which made the pathfinding hot loop ~70x slower
 * (1 ms → 76 ms per solve) and dropped the playable to ~25 FPS. Minification stays on.
 *
 * Usage: node ci/repack-super-html.cjs <cocos-project-dir>
 * Env:   SUPER_HTML_OBFUSCATE=true   keep obfuscation (protect source at a runtime cost)
 */
const path = require('path');

const project = path.resolve(process.argv[2] || 'CocosPLA_BeeBuzzing');
const dist = path.join(project, 'extensions/super-html/dist');

// Minimal Editor surface the packer touches when run outside Cocos Creator.
global.Editor = {
    Project: { path: project, name: path.basename(project) },
    App: { version: '3.8.7' },
    log: (...args) => console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
};

const core = require(path.join(dist, 'core/build.js'));
core.config.is_obfuscator = process.env.SUPER_HTML_OBFUSCATE === 'true';
console.log(`[repack-super-html] obfuscation: ${core.config.is_obfuscator}`);

const hooks = require(path.join(dist, '3x/hooks.js'));
hooks.onAfterBuild({ platform: 'web-mobile' }, { dest: path.join(project, 'build/web-mobile'), platform: 'web-mobile' })
    .then(() => console.log('[repack-super-html] done'))
    .catch((err) => {
        console.error('[repack-super-html] failed', err);
        process.exit(1);
    });
