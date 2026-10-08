/* OSINT Hub follow-up: per-tool key-features field.
 *
 * Detail pages render this as a "Key features" bullet section
 * (assets/js/osint.js + scripts/build-static-seo.mjs read it, the admin
 * OSINT form writes it). Markdown or plain lines — the public renderer
 * sanitizes it exactly like overview/install_guide.
 */

alter table public.osint_tools
  add column if not exists key_features text not null default '';
