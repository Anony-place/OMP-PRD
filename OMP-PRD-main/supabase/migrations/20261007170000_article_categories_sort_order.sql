/* Repair production drift: article_categories is missing sort_order.
 *
 * assets/js/articles.js queries
 *   article_categories?select=name,slug,sort_order&order=sort_order.asc
 * so the missing column made PostgREST answer 400 and the whole /articles
 * hub rendered its error state. The committed base schema
 * (supabase/00_schema_migrations.sql) always declared this column —
 * production simply never got it. Additive and idempotent.
 */

alter table public.article_categories
  add column if not exists sort_order int not null default 0;

update public.article_categories set sort_order = 1 where slug = 'news';
update public.article_categories set sort_order = 2 where slug = 'deep-dives';
update public.article_categories set sort_order = 3 where slug = 'how-to';
update public.article_categories set sort_order = 4 where slug = 'fundamentals';
