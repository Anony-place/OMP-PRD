-- ============================================================================
--  SEO overrides for articles.
--
--  Until now the <title> was generated as "headline | OopsMyPassword" and the
--  meta description was the summary, truncated. That is a reasonable default and
--  a poor ceiling: an author who cannot write the snippet cannot win the click,
--  and the snippet is most of what a search result IS.
--
--  Every column is nullable and every consumer falls back to the generated
--  value, so an article that sets none of these renders exactly as it did.
-- ============================================================================

alter table public.articles add column if not exists meta_title       text;
alter table public.articles add column if not exists meta_description text;
alter table public.articles add column if not exists og_image         text;
alter table public.articles add column if not exists canonical_url    text;
alter table public.articles add column if not exists robots_noindex   boolean not null default false;

comment on column public.articles.meta_title is
  'Exact <title>. Used verbatim, no brand suffix appended. Empty = headline + brand.';
comment on column public.articles.meta_description is
  'Meta description. Empty = summary (already truncated at the build).';
comment on column public.articles.canonical_url is
  'Absolute URL this page should canonicalise to. Empty = its own URL. Set this when content moved.';
comment on column public.articles.robots_noindex is
  'Excluded from the sitemap and marked noindex,follow. For thin or duplicate pages only.';
