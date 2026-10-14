#!/bin/bash

set -euo pipefail

REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COCOS_PROJECT_DIR="${COCOS_PROJECT_DIR:-$("${REPOSITORY_ROOT}/ci/find-cocos-project.sh")}"
COCOS_BUILD_CONFIG="${COCOS_BUILD_CONFIG:-ci/cocos-build.json}"
COCOS_CREATOR_PATH="${COCOS_CREATOR_PATH:-/Applications/Cocos/Creator/3.8.7/CocosCreator.app/Contents/MacOS/CocosCreator}"
CLEAN_BUILD="${CLEAN_BUILD:-true}"

PROJECT_PATH="${REPOSITORY_ROOT}/${COCOS_PROJECT_DIR}"
BUILD_CONFIG_PATH="${REPOSITORY_ROOT}/${COCOS_BUILD_CONFIG}"
BUILD_PATH="${PROJECT_PATH}/build"
SUPER_HTML_BUILD_PATH="${BUILD_PATH}/super-html"
BUILD_LOG="${REPOSITORY_ROOT}/cocos-build.log"
ARTIFACT_MANIFEST="${REPOSITORY_ROOT}/ci-artifacts.txt"

if [[ ! -x "${COCOS_CREATOR_PATH}" ]]; then
    echo "Cocos Creator executable not found: ${COCOS_CREATOR_PATH}" >&2
    exit 2
fi

if [[ ! -d "${PROJECT_PATH}" ]]; then
    echo "Cocos project not found: ${PROJECT_PATH}" >&2
    exit 2
fi

if [[ ! -f "${BUILD_CONFIG_PATH}" ]]; then
    echo "Cocos build config not found: ${BUILD_CONFIG_PATH}" >&2
    exit 2
fi

if [[ ! -d "${PROJECT_PATH}/extensions/super-html/node_modules" ]]; then
    echo "super-html dependencies are missing. Run npm install in the extension directory." >&2
    exit 2
fi

if [[ "${CLEAN_BUILD}" == "true" ]]; then
    rm -rf "${BUILD_PATH}" "${PROJECT_PATH}/temp"
fi

rm -f "${BUILD_LOG}" "${ARTIFACT_MANIFEST}"

echo "Cocos Creator: ${COCOS_CREATOR_PATH}"
echo "Project:       ${PROJECT_PATH}"
echo "Build config:  ${BUILD_CONFIG_PATH}"

set +e
caffeinate -dimsu "${COCOS_CREATOR_PATH}" \
    --project "${PROJECT_PATH}" \
    --build "configPath=${BUILD_CONFIG_PATH}" \
    2>&1 | tee "${BUILD_LOG}"
COCOS_EXIT_CODE=${PIPESTATUS[0]}
set -e

case "${COCOS_EXIT_CODE}" in
    0|36)
        echo "Cocos build completed with exit code ${COCOS_EXIT_CODE}."
        ;;
    *)
        echo "Cocos build failed with exit code ${COCOS_EXIT_CODE}." >&2
        exit "${COCOS_EXIT_CODE}"
        ;;
esac

if [[ ! -d "${BUILD_PATH}" ]]; then
    echo "Build directory was not created: ${BUILD_PATH}" >&2
    exit 3
fi

if [[ ! -d "${SUPER_HTML_BUILD_PATH}" ]]; then
    echo "super-html output directory was not created: ${SUPER_HTML_BUILD_PATH}" >&2
    exit 3
fi

find "${SUPER_HTML_BUILD_PATH}" -type f \( -name '*.zip' -o -name '*.html' \) -print \
    | sed "s#^${REPOSITORY_ROOT}/##" \
    | sort \
    > "${ARTIFACT_MANIFEST}"

if [[ ! -s "${ARTIFACT_MANIFEST}" ]]; then
    echo "No ZIP or HTML artifact was generated under ${SUPER_HTML_BUILD_PATH}." >&2
    exit 3
fi

echo "Artifacts:"
cat "${ARTIFACT_MANIFEST}"
