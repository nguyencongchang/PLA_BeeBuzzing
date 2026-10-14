const childProcess = require('node:child_process');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');

const webhookValue = process.env.DISCORD_WEBHOOK_URL?.trim();

if (!webhookValue) {
    console.log('Discord notification skipped: DISCORD_WEBHOOK_URL is empty.');
    process.exit(0);
}

let webhookUrl;

try {
    webhookUrl = new URL(webhookValue);
} catch {
    console.error('Discord notification failed: invalid webhook URL.');
    process.exit(1);
}

const allowedHosts = new Set(['discord.com', 'www.discord.com', 'discordapp.com', 'www.discordapp.com']);

if (
    webhookUrl.protocol !== 'https:' ||
    !allowedHosts.has(webhookUrl.hostname) ||
    !webhookUrl.pathname.startsWith('/api/webhooks/')
) {
    console.error('Discord notification failed: URL must be a Discord HTTPS webhook.');
    process.exit(1);
}

webhookUrl.searchParams.set('wait', 'true');

const buildResult = process.env.DISCORD_BUILD_RESULT || 'UNKNOWN';
const buildNumber = process.env.BUILD_NUMBER || '?';
const buildUrl = process.env.BUILD_URL || '';
const projectDirectory = process.env.COCOS_PROJECT_DIR || '';
const packageJsonPath = path.join(process.cwd(), projectDirectory, 'package.json');
const colorByResult = {
    SUCCESS: 0x2ecc71,
    UNSTABLE: 0xf1c40f,
    FAILURE: 0xe74c3c,
    ABORTED: 0x95a5a6,
};
const truncate = (value, maximumLength) => value.length > maximumLength
    ? `${value.slice(0, maximumLength - 1)}…`
    : value;

let appName = process.env.JOB_NAME || 'Playable';

try {
    appName = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).name || appName;
} catch {
    console.warn(`Discord notification: app name fallback is ${appName}.`);
}

const bundleDirectory = path.join(process.cwd(), 'dist');
let bundleName = '';
let bundleSize = 0;

try {
    bundleName = fs
        .readdirSync(bundleDirectory)
        .find((fileName) => fileName.endsWith('_all-networks.zip')) || '';

    if (bundleName) {
        bundleSize = fs.statSync(path.join(bundleDirectory, bundleName)).size;
    }
} catch {
}

let latestCommit = 'Unavailable';

try {
    const commitLine = childProcess
        .execFileSync('git', ['log', '-1', '--pretty=format:%h\t%s'], {
            encoding: 'utf8',
            timeout: 5_000,
        })
        .trim();
    const [commit, ...subjectParts] = commitLine.split('\t');
    const subject = subjectParts.join(' ').replaceAll('@', '@\u200b').replaceAll('`', '\\`');

    latestCommit = commit ? `\`${commit}\` ${subject}` : 'Unavailable';
} catch {
}

const bundleRelativePath = bundleName ? `dist/${bundleName}` : '';
const bundleUrl = buildUrl && bundleRelativePath
    ? `${buildUrl}artifact/${bundleRelativePath.split('/').map(encodeURIComponent).join('/')}`
    : '';
const bundleSizeMiB = bundleSize ? `${(bundleSize / 1048576).toFixed(2)} MiB` : '';
const bundleValue = bundleName
    ? `${bundleUrl ? `[${bundleName}](${bundleUrl})` : bundleName} (${bundleSizeMiB})`
    : 'Not generated';
const payload = JSON.stringify({
    username: 'Jenkins',
    embeds: [
        {
            title: truncate(`${appName} build #${buildNumber} — ${buildResult}`, 256),
            url: buildUrl || undefined,
            color: colorByResult[buildResult] || 0x3498db,
            fields: [
                { name: 'App', value: truncate(appName, 1024), inline: true },
                { name: 'Status', value: buildResult, inline: true },
                { name: 'File build', value: truncate(bundleValue, 1024) },
                { name: 'Commit', value: truncate(latestCommit, 1024) },
            ],
            timestamp: new Date().toISOString(),
        },
    ],
});

const request = https.request(
    webhookUrl,
    {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 10_000,
    },
    (response) => {
        response.resume();

        if (response.statusCode >= 200 && response.statusCode < 300) {
            console.log('Discord notification sent.');
            return;
        }

        console.error(`Discord notification failed with HTTP ${response.statusCode}.`);
        process.exitCode = 1;
    },
);

request.on('timeout', () => {
    request.destroy(new Error('Discord request timed out.'));
});

request.on('error', (error) => {
    console.error(`Discord notification failed: ${error.message}`);
    process.exitCode = 1;
});

request.end(payload);
