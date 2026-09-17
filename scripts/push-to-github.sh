#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_TOKEN:?Missing GITHUB_TOKEN}"

REPO_NAME="${GITHUB_REPO:-ai-coding-agent-ml-telegram}"
VISIBILITY="${GITHUB_VISIBILITY:-private}" # private | public

API_BASE="https://api.github.com"

# Fetch authenticated username from token
GITHUB_USERNAME="$(curl -sS -H "Authorization: Bearer ${GITHUB_TOKEN}" -H "Accept: application/vnd.github+json" "${API_BASE}/user" | sed -n 's/.*"login"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"

if [[ -z "${GITHUB_USERNAME}" ]]; then
  echo "Failed to resolve GitHub username from token."
  exit 1
fi

# Best-effort repo creation. Some fine-grained tokens cannot create repos (403).
HTTP_CODE="$(curl -sS -o /tmp/github-create-repo.json -w "%{http_code}" \
  -X POST "${API_BASE}/user/repos" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -d "{\"name\":\"${REPO_NAME}\",\"private\":$([[ "${VISIBILITY}" == "private" ]] && echo true || echo false)}")"

if [[ "${HTTP_CODE}" == "201" ]]; then
  echo "Repository created: ${GITHUB_USERNAME}/${REPO_NAME}"
elif [[ "${HTTP_CODE}" == "422" ]]; then
  echo "Repository already exists: ${GITHUB_USERNAME}/${REPO_NAME}"
else
  echo "Skipping repo creation (HTTP ${HTTP_CODE}). Will try direct push..."
fi

REMOTE_URL="https://${GITHUB_TOKEN}@github.com/${GITHUB_USERNAME}/${REPO_NAME}.git"

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi

set +e
git push -u origin main
PUSH_CODE=$?
set -e

if [[ $PUSH_CODE -ne 0 ]]; then
  echo "Push failed. Ensure repo exists and token has Contents write access."
  echo "Target: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}"
  exit $PUSH_CODE
fi

echo "Pushed successfully to https://github.com/${GITHUB_USERNAME}/${REPO_NAME}"
