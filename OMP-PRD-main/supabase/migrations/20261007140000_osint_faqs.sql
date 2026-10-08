/* OSINT Hub follow-up: per-tool FAQ field.
 *
 * Rendered as a "Common questions" section on tool detail pages
 * (assets/js/osint.js + scripts/build-static-seo.mjs read it, the admin
 * OSINT form writes it). Authors write each question as a `### ` heading
 * followed by its answer — the public renderer sanitizes it exactly like
 * overview/install_guide, and the headings double as long-tail SEO text.
 */

alter table public.osint_tools
  add column if not exists faqs text not null default '';
