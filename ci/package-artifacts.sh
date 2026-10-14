#!/bin/bash

set -euo pipefail

REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COCOS_PROJECT_DIR="${COCOS_PROJECT_DIR:-$("${REPOSITORY_ROOT}/ci/find-cocos-project.sh")}"
PROJECT_PATH="${REPOSITORY_ROOT}/${COCOS_PROJECT_DIR}"
SOURCE_PATH="${PROJECT_PATH}/build/super-html"
OUTPUT_PATH="${ARTIFACT_OUTPUT_DIR:-${REPOSITORY_ROOT}/dist}"

if [[ ! -d "${SOURCE_PATH}" ]]; then
    echo "super-html output directory not found: ${SOURCE_PATH}" >&2
    exit 2
fi

APP_NAME="$(node -e '
    const fs = require("node:fs");
    const packageJson = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    process.stdout.write(packageJson.name || "Playable");
' "${PROJECT_PATH}/package.json")"
SAFE_APP_NAME="$(printf '%s' "${APP_NAME}" | tr -cs 'A-Za-z0-9._-' '_' | sed 's/^_*//; s/_*$//')"
ARCHIVE_PATH="${OUTPUT_PATH}/${SAFE_APP_NAME:-Playable}_all-networks.zip"

mkdir -p "${OUTPUT_PATH}"
rm -f "${OUTPUT_PATH}"/*_all-networks.zip

(
    cd "${SOURCE_PATH}"
    find . -type f \( -name '*.zip' -o -name '*.html' \) -print \
        | LC_ALL=C sort \
        | /usr/bin/zip -q "${ARCHIVE_PATH}" -@
)

if [[ ! -s "${ARCHIVE_PATH}" ]]; then
    echo "Combined network archive was not created: ${ARCHIVE_PATH}" >&2
    exit 3
fi

echo "Combined network archive: ${ARCHIVE_PATH}"
