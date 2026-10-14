#!/usr/bin/env bash

set -euo pipefail

REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_PROJECT_NAME="CocosPlayableAdsTemplate"
PARENT_DIRECTORY_NAME="$(basename "${REPOSITORY_ROOT}")"
COCOS_PROJECT_NAME="Cocos${PARENT_DIRECTORY_NAME}"

if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "This setup script is intended for macOS. Use SetupProject.bat on Windows." >&2
    exit 2
fi

if [[ ! -d "${REPOSITORY_ROOT}/${SOURCE_PROJECT_NAME}" ]]; then
    echo "Cocos project directory not found: ${SOURCE_PROJECT_NAME}" >&2
    exit 2
fi

if [[ -e "${REPOSITORY_ROOT}/${COCOS_PROJECT_NAME}" ]]; then
    echo "Destination project directory already exists: ${COCOS_PROJECT_NAME}" >&2
    exit 2
fi

cd "${REPOSITORY_ROOT}"

echo "Welcome to TCMPlay setup script."
echo "This script will:"
echo "1. Change the Cocos project name to ${COCOS_PROJECT_NAME}"
echo "2. Update submodules"
echo "3. Install npm dependencies"

if [[ -t 0 ]]; then
    read -r -p "Press Enter to continue, or Ctrl-C to cancel..."
fi

# Remove the template's existing submodule entries before moving the project.
git rm "${SOURCE_PROJECT_NAME}/assets/PLAGameFoundation"
git rm "${SOURCE_PROJECT_NAME}/assets/PlayableParamterTool"
git rm "${SOURCE_PROJECT_NAME}/tools/optimize-size"

mv "${SOURCE_PROJECT_NAME}" "${COCOS_PROJECT_NAME}"

node setup.js "${COCOS_PROJECT_NAME}"

echo "Installing npm dependencies..."
npm install --prefix "${COCOS_PROJECT_NAME}"

# The editor extension has its own dependencies (jszip, cheerio, vue, etc.).
if [[ -d "${COCOS_PROJECT_NAME}/extensions/super-html" ]]; then
    npm install --prefix "${COCOS_PROJECT_NAME}/extensions/super-html"
fi

git submodule add git@github.com:nguyencongchang/tcm-PLAGameFoundation.git \
    "${COCOS_PROJECT_NAME}/assets/PLAGameFoundation"
git submodule add git@github.com:nguyencongchang/tcm-PlayableParamterTool.git \
    "${COCOS_PROJECT_NAME}/assets/PlayableParamterTool"
git submodule add git@github.com:nguyencongchang/tcm-optimize-size.git \
    "${COCOS_PROJECT_NAME}/tools/optimize-size"

git submodule foreach git switch develop
