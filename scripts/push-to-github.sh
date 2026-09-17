#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_USERNAME:?Missing GITHUB_USERNAME}"
: "${GITHUB_REPO:?Missing GITHUB_REPO}"
: "${GITHUB_TOKEN:?Missing GITHUB_TOKEN}"

REMOTE_URL="https://${GITHUB_TOKEN}@github.com/${GITHUB_USERNAME}/${GITHUB_REPO}.git"

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi

git push -u origin main

echo "Pushed successfully to https://github.com/${GITHUB_USERNAME}/${GITHUB_REPO}"
