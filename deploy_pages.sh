#!/usr/bin/env bash
# deploy_pages.sh — publish GitHub Pages: the stakeholder MkDocs site at the
# root and the prototype under /app (the layout the in-app "Guide" links and
# the App Guide URLs assume). Replaces the previous ad-hoc force-push flow.
#
#   ./deploy_pages.sh          # build docs (strict), bundle prototype, push gh-pages
#
# Run from a clean main checkout — the deploy commit records the source SHA.
set -euo pipefail
cd "$(dirname "$0")"

SHA=$(git rev-parse --short HEAD)

echo "== building stakeholder docs (strict) =="
( cd site-stakeholder && python3 -m mkdocs build --strict )

echo "== assembling site tree =="
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"; git worktree remove --force "$WT" 2>/dev/null || true' EXIT
cp -R site-stakeholder/site/. "$STAGE"/
mkdir -p "$STAGE/app"
rsync -a --delete --exclude '.DS_Store' prototype/ "$STAGE/app/"
# MVP walkthrough (ux-review U8): same app served under /app/mvp/ — data.js
# detects the /mvp/ path and boots blank; replaces the ?data=empty share link
rsync -a --exclude '.DS_Store' prototype/ "$STAGE/app/mvp/"
touch "$STAGE/.nojekyll"

echo "== publishing to gh-pages =="
git fetch origin gh-pages
WT=$(mktemp -d)
git worktree add -B gh-pages "$WT" origin/gh-pages
rsync -a --delete --exclude '.git' "$STAGE"/ "$WT"/
(
  cd "$WT"
  git add -A
  if git diff --cached --quiet; then
    echo "nothing to deploy — gh-pages already up to date"
  else
    git commit -m "deploy: docs+app from $SHA"
    git push origin gh-pages
  fi
)
echo "== done: https://bovarafa.github.io/EDQMS/ (docs) · /app/ (prototype) · /app/mvp/ (MVP walkthrough) =="
