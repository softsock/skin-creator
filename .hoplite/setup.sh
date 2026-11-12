#!/usr/bin/env bash
# installs dependencies for cloud workspaces, the preview itself is started with `pnpm dev`
set -euo pipefail
pnpm install --frozen-lockfile
