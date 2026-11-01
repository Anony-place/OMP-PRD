#!/usr/bin/env bash
# ============================================================
# Build step for the Vercel deployment.
#
# The repo is built for Firebase: every canonical, og:url, JSON-LD @id and
# sitemap entry says https://oopsmypassword.web.app. Vercel serves the same
# committed tree, so without this step the new host would tell Google that the
# old host is the real one - and after the 301 from web.app, "the old host" is a
# URL that redirects back here. That loop is how a migration collapses.
#
# So: rewrite the origin, then strip the build tooling that Firebase never
# served either (firebase.json only serves files that exist, but Vercel with
# outputDirectory "." would serve everything left in the tree).
#
# Kept as a script rather than inline in the Vercel project settings because
# the inline build command is capped at 256 characters and cannot be reviewed,
# tested or diffed.
#
# Usage (Vercel build command):  bash vercel-build.sh
#
# This file sits at the project root on purpose: .vercelignore excludes the
# scripts/ directory from the upload, so a script living there is not present
# when the build command runs (it failed with exit 127 exactly once).
# ============================================================
set -euo pipefail

OLD_ORIGIN="https://oopsmypassword.web.app"
NEW_ORIGIN="https://oopsmypassword.vercel.app"

echo "Rewriting ${OLD_ORIGIN} -> ${NEW_ORIGIN}"

# Text files only. Anything binary (images, fonts, pdf) is untouched, and the
# alternation is explicit so a new asset type never gets silently included.
rewritten=0
while IFS= read -r -d '' file; do
  if grep -q "oopsmypassword\.web\.app" "$file"; then
    sed -i "s|oopsmypassword\.web\.app|oopsmypassword.vercel.app|g" "$file"
    rewritten=$((rewritten + 1))
  fi
done < <(find . -type f \
  \( -name '*.html' -o -name '*.xml' -o -name '*.txt' -o -name '*.json' \
     -o -name '*.js' -o -name '*.css' -o -name '*.webmanifest' \) \
  -not -path './node_modules/*' -print0)

echo "rewritten files: ${rewritten}"

# Nothing that is not part of the published site should be reachable.
echo "Removing build tooling from the served tree"
rm -rf tools scripts functions supabase .github .claude node_modules
rm -f .vercelignore package.json package-lock.json
rm -f ./*.md

# A rewrite that missed a file is a canonical pointing at the old host again;
# fail the build instead of shipping it.
# This script names the old origin on purpose, so it is not evidence of a miss.
leftover=$(grep -rl "oopsmypassword\.web\.app" . 2>/dev/null \
  | grep -v '^\./vercel-build\.sh$' | head -5 || true)
if [ -n "$leftover" ]; then
  echo "::error::files still reference the old origin after the rewrite:"
  printf '%s\n' "$leftover"
  exit 1
fi

echo "Vercel build tree ready"
