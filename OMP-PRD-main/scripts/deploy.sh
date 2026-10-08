#!/usr/bin/env bash
#
# One-command release for OopsMyPassword.
#
#   ./scripts/deploy.sh
#
# Runs the whole chain in the only order that is safe: build, gate, deploy,
# verify. If the build or any test fails, nothing is deployed. Publishing from
# the panel writes a row to Supabase; this turns that row into a live page.
#
# Costs nothing at rest. It uses the Firebase CLI directly, never GitHub
# Actions, because the project is on the Spark plan.
#
# Flags:
#   --skip-tests   deploy without the gate (the release is then unverified)
#   --skip-build   gate and deploy the files already on disk
#   --verify-only  skip build, gate and deploy; just re-check what is live
#   -h, --help     this text

set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PROJECT_ID="password-e9a30"
NODE_VERSION="v24.19.0"
NODE_DIR="node-${NODE_VERSION}-linux-x64"
NODE_CACHE="${OMP_NODE_CACHE:-$HOME/.cache/omp-deploy}"
NODE_BIN="$NODE_CACHE/$NODE_DIR/bin"
NODE_URL="https://nodejs.org/dist/${NODE_VERSION}/${NODE_DIR}.tar.gz"

SKIP_TESTS=0
SKIP_BUILD=0
VERIFY_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --skip-tests)  SKIP_TESTS=1 ;;
    --skip-build)  SKIP_BUILD=1 ;;
    --verify-only) VERIFY_ONLY=1 ;;
    -h|--help)
      # The header comment is the help text, so it cannot drift out of date.
      sed -n '2,/^set -/p' "${BASH_SOURCE[0]}" | grep '^#' | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "unknown flag: $arg  (try --help)" >&2; exit 2 ;;
    *) echo "unknown flag: $arg  (try --help)" >&2; exit 2 ;;
  esac
done

# ---------------------------------------------------------------- output ----
if [ -t 1 ]; then B=$'\033[1m'; G=$'\033[32m'; R=$'\033[31m'; Y=$'\033[33m'; D=$'\033[2m'; Z=$'\033[0m'
else B=''; G=''; R=''; Y=''; D=''; Z=''; fi
START=$SECONDS
step()  { printf '\n%s==> %s%s\n' "$B" "$*" "$Z"; }
info()  { printf '    %s%s%s\n' "$D" "$*" "$Z"; }
ok()    { printf '    %s✓%s %s\n' "$G" "$Z" "$*"; }
warn()  { printf '    %s!%s %s\n' "$Y" "$Z" "$*"; }
die()   { printf '\n%sFAILED:%s %s\n' "$R" "$Z" "$*" >&2; exit 1; }

# Run a command, echo it, and abort the whole release if it fails.
run() {
  local label="$1"; shift
  local t0=$SECONDS
  info "$label"
  if ! "$@" >/tmp/omp-deploy-step.log 2>&1; then
    printf '%s\n' "$D"; tail -n 25 /tmp/omp-deploy-step.log | sed 's/^/    /' | sed "s/^/$B/"
    die "$label"
  fi
  ok "$label ($((SECONDS - t0))s)"
}

# ------------------------------------------------------- node with TS -------
# test_academy_backend.js loads the Supabase Edge Function sources as
# TypeScript. Some distro builds expose node:module.stripTypeScriptTypes but
# are not compiled with TypeScript, and fail at runtime with ERR_NO_TYPESCRIPT.
# Detect that by actually calling it, not by checking for the function, and
# fall back to an official build cached outside /tmp so it survives a reboot.
node_has_ts() { "$1" -e "require('node:module').stripTypeScriptTypes('const x: number = 1')" >/dev/null 2>&1; }

resolve_node() {
  if node_has_ts "$(command -v node || true)"; then
    NODE_BIN="$(dirname "$(command -v node)")"
    NODE_IS_SYSTEM=1
    return
  fi
  if [ ! -x "$NODE_BIN/node" ]; then
    step "Fetching Node ${NODE_VERSION}"
    info "system node cannot strip TypeScript; caching an official build in $NODE_CACHE"
    mkdir -p "$NODE_CACHE"
    curl -fsSL --retry 3 -o "$NODE_CACHE/node.tgz" "$NODE_URL" \
      || die "could not download $NODE_URL"
    tar xzf "$NODE_CACHE/node.tgz" -C "$NODE_CACHE" \
      || die "could not unpack the Node tarball"
    rm -f "$NODE_CACHE/node.tgz"
  fi
  node_has_ts "$NODE_BIN/node" || die "the cached Node build still cannot strip TypeScript"
  NODE_IS_SYSTEM=0
}

# ------------------------------------------------------------- preflight ----
step "Preflight"
command -v python3 >/dev/null || die "python3 not found"
command -v firebase >/dev/null || die "firebase CLI not found (npm i -g firebase-tools)"
resolve_node
export PATH="$NODE_BIN:$PATH"
export NODE_PATH="$ROOT/tools/qa-deps/node_modules"

info "node     $("$NODE_BIN/node" --version) ($([ "${NODE_IS_SYSTEM:-1}" = 1 ] && echo system || echo "official, cached at $NODE_CACHE"))"
info "python   $(python3 --version | cut -d' ' -f2)"
info "firebase $(firebase --version | sed 's/^Version //')"
ok "preflight passed"

# ----------------------------------------------------------------- build ----
# Order matters. build.py writes the static pages and the sitemap,
# build-academy.mjs renders the Academy from the live catalogue, the sync step
# refreshes the sitemap core that the SEO build imports, build-static-seo.mjs
# writes /articles/<slug>.html from Supabase and the sitemap, and the last two
# settle the canonical origin and mirror the sitemap for Google.
#
# Never run build-academy.mjs with --snapshot here. That flag overwrites the
# real catalogue with the 4-topic test fixture.
if [ "$VERIFY_ONLY" = 0 ] && [ "$SKIP_BUILD" = 0 ]; then
  step "Build"
  run "static pages and sitemap   (tools/build.py)"                 python3 tools/build.py
  run "academy from live data     (build-academy.mjs)"              node scripts/build-academy.mjs
  run "sitemap core sync          (sync-sitemap-core.js)"           node functions/sync-sitemap-core.js
  run "articles and sitemap       (build-static-seo.mjs)"           node scripts/build-static-seo.mjs
  run "canonical origin           (fix-site-origin.mjs)"            node scripts/fix-site-origin.mjs
  run "google sitemap mirror"                                         cp sitemap.xml google-sitemap.xml

  CHANGED="$(git status --porcelain -- '*.html' '*.xml' | wc -l | tr -d ' ')"
  NEW_PAGES="$(git status --porcelain -- '*.html' | grep -c '^??' || true)"
  if [ "$CHANGED" -gt 0 ]; then
    ok "$CHANGED generated file(s) differ from git, $NEW_PAGES new page(s)"
  else
    info "no generated file changed"
  fi
else
  step "Build"
  warn "skipped (--skip-build or --verify-only)"
fi

# ----------------------------------------------------------- consistency ----
# Every article URL in the sitemap must have a page on disk. A publish that has
# not been built is exactly what makes the hub render a link to a 404, so this
# runs BEFORE the deploy and aborts the release rather than shipping it.
#
# The extraction deliberately avoids a variable-length lookbehind: PCRE rejects
# those, and the first version of this check did, then reported a clean pass
# because the pipeline's exit status came from sed rather than grep. A silent
# check that always passes is worse than no check.
#
# It runs even under --skip-build, because that is exactly when a stale tree is
# most likely: --skip-build deploys the disk as-is, and this is the last thing
# standing between a stale tree and production.
if [ "$VERIFY_ONLY" = 0 ]; then
  step "Consistency"
  mapfile -t SLUGS < <(grep -oP '/articles/[a-z0-9-]+(?=</loc>)' sitemap.xml \
                        | sed 's|^/articles/||' | sort -u || true)
  if [ "${#SLUGS[@]}" -eq 0 ]; then
    die "could not read any article URL out of sitemap.xml, so this check cannot be trusted"
  fi
  # /articles/<slug> resolves to articles/ for database-published articles and
  # to guides/ for the hand-authored ones, so both directories count.
  # /osint/<slug> resolves to osint/ (built by build-static-seo.mjs).
  MISSING=()
  for slug in "${SLUGS[@]}"; do
    if [ ! -f "articles/$slug.html" ] && [ ! -f "guides/$slug.html" ]; then
      MISSING+=("$slug")
    fi
  done
  if [ "${#MISSING[@]}" -eq 0 ]; then
    ok "all ${#SLUGS[@]} article pages in the sitemap exist on disk"
  else
    printf '    %s!%s listed in the sitemap but not built:\n' "$Y" "$Z"
    printf '      /articles/%s.html\n' "${MISSING[@]}" | sed 's/^/      /'
    die "${#MISSING[@]} article page(s) missing; the build did not cover every published article"
  fi
  mapfile -t OSINT_SLUGS < <(grep -oP '/osint/[a-z0-9-]+(?=</loc>)' sitemap.xml \
                        | sed 's|^/osint/||' | sort -u || true)
  MISSING_OSINT=()
  for slug in "${OSINT_SLUGS[@]:-}"; do
    if [ ! -f "osint/$slug.html" ]; then
      MISSING_OSINT+=("$slug")
    fi
  done
  if [ "${#MISSING_OSINT[@]}" -eq 0 ]; then
    ok "all ${#OSINT_SLUGS[@]} osint pages in the sitemap exist on disk"
  else
    printf '    %s!%s listed in the sitemap but not built:\n' "$Y" "$Z"
    printf '      /osint/%s.html\n' "${MISSING_OSINT[@]}" | sed 's/^/      /'
    die "${#MISSING_OSINT[@]} osint page(s) missing; the build did not cover every published tool"
  fi
  mapfile -t PENTEST_SLUGS < <(grep -oP '/pentest/[a-z0-9-]+(?=</loc>)' sitemap.xml \
                        | sed 's|^/pentest/||' | sort -u || true)
  MISSING_PENTEST=()
  for slug in "${PENTEST_SLUGS[@]:-}"; do
    if [ ! -f "pentest/$slug.html" ]; then
      MISSING_PENTEST+=("$slug")
    fi
  done
  if [ "${#MISSING_PENTEST[@]}" -eq 0 ]; then
    ok "all ${#PENTEST_SLUGS[@]} pentest pages in the sitemap exist on disk"
  else
    printf '    %s!%s listed in the sitemap but not built:\n' "$Y" "$Z"
    printf '      /pentest/%s.html\n' "${MISSING_PENTEST[@]}" | sed 's/^/      /'
    die "${#MISSING_PENTEST[@]} pentest page(s) missing; the build did not cover every published tool"
  fi
fi

# ------------------------------------------------------------------ gate ----
# Anything failing here stops the release. A test that is skipped is worse
# than one that fails, so the list is explicit rather than globbed.
if [ "$VERIFY_ONLY" = 0 ] && [ "$SKIP_TESTS" = 0 ]; then
  step "Gate"
  SUITES=(
    test_academy_backend.js test_academy_concurrency.js test_academy_migrations.js
    test_academy_course_database.js test_academy_multisubject.mjs test_academy_local.mjs
    test_site_contracts.js test_site_database.js test_functions.cjs
    admin_products_harness.js products_app_harness.js osint_app_harness.js pentest_app_harness.js test_release_verifier.mjs
    audit_academy_publishing.mjs test_academy_build.mjs test_academy_seo.mjs
    test_sitemap.js test_runtime.js
  )
  for s in "${SUITES[@]}"; do run "node tools/$s" node "tools/$s"; done
  run "python tools/test_academy_content.py" python3 tools/test_academy_content.py
  run "python tools/qa.py"                    python3 tools/qa.py
  run "node scripts/verify-seo.mjs"           node scripts/verify-seo.mjs
  ok "${#SUITES[@]} node suites + 3 checks passed"
else
  step "Gate"
  warn "skipped (--skip-tests or --verify-only)"
  [ "$SKIP_TESTS" = 1 ] && [ "$VERIFY_ONLY" = 0 ] && warn "this release is UNVERIFIED"
fi

BEFORE_HEAD="$(git rev-parse --short HEAD 2>/dev/null || echo none)"

# --------------------------------------------------------------- deploy ----
if [ "$VERIFY_ONLY" = 0 ]; then
  step "Deploy"
  info "hosting only, project $PROJECT_ID, no functions (Spark plan cannot run them)"
  t0=$SECONDS
  if ! firebase deploy --project "$PROJECT_ID" --only hosting --non-interactive \
        >/tmp/omp-deploy-step.log 2>&1; then
    tail -n 25 /tmp/omp-deploy-step.log | sed 's/^/    /' | sed "s/^/$B/"
    die "firebase deploy"
  fi
  ok "hosting released ($((SECONDS - t0))s)"
else
  step "Deploy"
  warn "skipped (--verify-only)"
fi
# ---------------------------------------------------------------- verify ----
step "Verify live"
run "hash every sitemap artifact" node scripts/verify-live-release.mjs

# --------------------------------------------------------------- summary ----
step "Done in $((SECONDS - START))s"
printf '    commit   %s\n' "$BEFORE_HEAD"
if [ "$VERIFY_ONLY" = 0 ]; then
  DIRTY="$(git status --porcelain | wc -l | tr -d ' ')"
  if [ "$DIRTY" -gt 0 ]; then
    printf '    %s!%s %s uncommitted file(s). The site is live; commit when convenient:\n' "$Y" "$Z" "$DIRTY"
    git status --porcelain | head -n 12 | sed 's/^/      /'
  else
    printf '    %s✓%s working tree clean, deployed tree matches git\n' "$G" "$Z"
  fi
  printf '    site     https://oopsmypassword.web.app\n'
  [ "$SKIP_TESTS" = 1 ] && printf '    %s!%s deployed WITHOUT the test gate\n' "$Y" "$Z"
fi
exit 0
