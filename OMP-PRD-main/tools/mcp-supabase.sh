#!/usr/bin/env bash
#
# mcp-supabase.sh — Wrapper for the Supabase MCP server (@supabase/mcp-server-supabase)
#
# Loads environment variables from .env.mcp (gitignored) and starts the MCP
# server in stdio mode for Claude Desktop / Claude Code.
#
# The .env.mcp file must contain:
#   SUPABASE_ACCESS_TOKEN=<your-personal-access-token>
#
# Optional overrides in .env.mcp:
#   SUPABASE_PROJECT_REF  (default: aeehfulikupskyrvcpzb)
#   SUPABASE_URL          (default: https://aeehfulikupskyrvcpzb.supabase.co)
#   SUPABASE_CONTENT_API_URL
#
# Usage:
#   This script is intended to be invoked by an MCP host (Claude Desktop,
#   Claude Code, etc.) — not run directly. It communicates via stdio.
#
set -euo pipefail

# Resolve the project root (parent of the tools/ directory).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load .env.mcp if it exists (gitignored, never committed).
ENV_FILE="$PROJECT_ROOT/.env.mcp"
if [ -f "$ENV_FILE" ]; then
    set -o allexport
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +o allexport
fi

# Validate that the PAT is available.
if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
    echo "ERROR: SUPABASE_ACCESS_TOKEN is not set." >&2
    echo "  Copy .env.mcp.example to .env.mcp and add your PAT." >&2
    echo "  Create one at: https://supabase.com/dashboard/account/access-tokens" >&2
    exit 1
fi

# Determine the project ref (env var or default).
PROJECT_REF="${SUPABASE_PROJECT_REF:-aeehfulikupskyrvcpzb}"

# Locate the MCP server binary.
BINARY="$PROJECT_ROOT/node_modules/.bin/mcp-server-supabase"
if [ ! -x "$BINARY" ]; then
    echo "ERROR: mcp-server-supabase binary not found at $BINARY" >&2
    echo "  Run: npm install (or) npx @supabase/mcp-server-supabase --version" >&2
    exit 1
fi

# Hand off to the MCP server in stdio mode.
exec "$BINARY" --project-ref "$PROJECT_REF"
