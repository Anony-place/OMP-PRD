/* OSINT Hub follow-up: per-tool real-world example field.
 *
 * Rendered as a "Real-world example" walkthrough section on tool detail
 * pages (assets/js/osint.js + scripts/build-static-seo.mjs read it, the
 * admin OSINT form writes it). A concrete, lawful scenario showing how
 * the tool is actually used — this first-hand-style narrative is what
 * separates a rankable guide from a thin listing.
 */

alter table public.osint_tools
  add column if not exists use_case text not null default '';
