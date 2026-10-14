#!/bin/bash

set -euo pipefail

REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -n "${COCOS_PROJECT_DIR:-}" ]]; then
    if [[ ! -f "${REPOSITORY_ROOT}/${COCOS_PROJECT_DIR}/package.json" ]]; then
        echo "Configured Cocos project does not exist: ${COCOS_PROJECT_DIR}" >&2
        exit 2
    fi
    printf '%s\n' "${COCOS_PROJECT_DIR}"
    exit 0
fi

PROJECTS=()
while IFS= read -r PACKAGE_FILE; do
    if grep -q '"creator"' "${PACKAGE_FILE}"; then
        PROJECTS+=("$(basename "$(dirname "${PACKAGE_FILE}")")")
    fi
done < <(find "${REPOSITORY_ROOT}" -mindepth 2 -maxdepth 2 -type f -name package.json | sort)

if [[ ${#PROJECTS[@]} -ne 1 ]]; then
    echo "Expected exactly one Cocos project at the repository root, found ${#PROJECTS[@]}." >&2
    echo "Set COCOS_PROJECT_DIR explicitly when the repository contains multiple projects." >&2
    exit 2
fi

printf '%s\n' "${PROJECTS[0]}"
