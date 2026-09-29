/** Supabase supports grouped keys and legacy single-key environment variables. */
export function envKey(name: string, fallback: string): string {
  let grouped: unknown;
  try {
    grouped = JSON.parse(Deno.env.get(name) || "null");
  } catch {
    /* fall back */
  }
  const value =
    grouped && typeof grouped === "object" && !Array.isArray(grouped)
      ? (grouped as Record<string, unknown>).default
      : undefined;
  const key =
    typeof value === "string" && value.trim()
      ? value.trim()
      : (Deno.env.get(fallback) || "").trim();
  if (!key)
    throw new Error(`Missing server configuration: ${name} / ${fallback}`);
  return key;
}
