/* OSINT Hub follow-up: GRANTs for the authenticated role.
 *
 * Without these, every signed-in query failed with "permission denied for
 * table osint_tools" — Postgres checks GRANTs before RLS policies are even
 * evaluated. RLS remains the real gate (published-only reads for visitors,
 * all writes admin-only via public.is_admin()); the GRANTs merely let the
 * policies do their job. Mirrors the articles/products tables.
 */

grant select, insert, update, delete on public.osint_categories to authenticated;
grant select, insert, update, delete on public.osint_tools to authenticated;
