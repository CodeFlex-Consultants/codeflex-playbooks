#!/usr/bin/env bash
set -euo pipefail

echo "CodeFlex Consultants npm Registry Setup"
echo "======================================="
echo ""

if [ -n "${GITHUB_NPM_TOKEN:-}" ]; then
  TOKEN="$GITHUB_NPM_TOKEN"
  echo "Using token from GITHUB_NPM_TOKEN environment variable"
else
  echo "Enter your GitHub Personal Access Token (needs read:packages scope):"
  echo "Generate one at: https://github.com/settings/tokens"
  read -rs TOKEN
  if [ -z "$TOKEN" ]; then
    echo "Error: Token cannot be empty"
    exit 1
  fi
fi

npm config set //npm.pkg.github.com/:_authToken "$TOKEN"
npm config set @codeflex-consultants:registry https://npm.pkg.github.com

echo ""
echo "npm configured. Installing @codeflex-consultants/codeflex-playbooks..."
npm install -g @codeflex-consultants/codeflex-playbooks

echo ""
echo "Setup complete. Verify with:"
echo "  codeflex-playbooks --version"
