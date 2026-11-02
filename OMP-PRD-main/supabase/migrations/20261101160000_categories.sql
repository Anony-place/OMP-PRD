-- ============================================================================
--  Categories that cannot lose their articles.
--
--  article_categories has existed since the first schema and nothing in the
--  panel could touch it: the five canonical chips, plus whatever was inserted
--  through the SQL editor. Two problems followed.
--
--  1. Deleting a category is a one-line DELETE, and articles.category_id is
--     "on delete set null" - so every article filed under it quietly becomes
--     uncategorised. No warning, no count, no undo. The person who deleted it
--     finds out weeks later, from a filter chip that has gone empty.
--
--  2. Nothing stopped two categories from sharing a name. The slugs are unique,
--     so "Guides" and "guides " both go in and the second is invisible in the
--     filter because the first slug wins.
--
--  Both are fixed where they belong: in the database, so the panel, the CLI and
--  the SQL editor all get the same behaviour.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. One name, one category. Case-insensitively, because "Guides" and "guides"
--    are the same word to a reader.
-- ---------------------------------------------------------------------------
create unique index if not exists article_categories_name_unique
  on public.article_categories (lower(btrim(name)));

-- Existing duplicates would make the index fail, and a migration that stops
-- half-way is worse than one that says what is wrong. The index creation above
-- raises an error in that case; this comment is the instruction:
--
--   select lower(btrim(name)), count(*) from public.article_categories
--    group by 1 having count(*) > 1;
--
-- Rename one of them, then apply this migration again.

-- ---------------------------------------------------------------------------
-- 2. Deleting a category is a decision about its articles, so it is a function
--    with an argument for the decision - not a DELETE that decides for you.
--
--      delete_article_category(id, NULL)   -> articles become uncategorised
--      delete_article_category(id, other)  -> articles move to `other`
--
--    One transaction: either the articles move and the category goes, or
--    nothing happens. The panel calls this; it never deletes a row directly.
-- ---------------------------------------------------------------------------
create or replace function public.delete_article_category(
  category uuid,
  move_to  uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  moved integer;
begin
  if not public.is_admin() then
    raise exception 'not an admin' using errcode = '42501';
  end if;

  if not exists (select 1 from public.article_categories where id = category) then
    raise exception 'no such category' using errcode = 'P0002';
  end if;

  if move_to is not null then
    if move_to = category then
      raise exception 'cannot move articles into the category being deleted'
        using errcode = '22023';
    end if;
    /* Moving into a category that does not exist would fail the foreign key
       half-way through; say so before touching a row. */
    if not exists (select 1 from public.article_categories where id = move_to) then
      raise exception 'destination category does not exist' using errcode = 'P0002';
    end if;
  end if;

  update public.articles set category_id = move_to where category_id = category;
  get diagnostics moved = row_count;

  delete from public.article_categories where id = category;

  return moved;
end;
$$;

comment on function public.delete_article_category(uuid, uuid) is
  'Deletes a category, moving its articles to move_to or leaving them uncategorised when NULL. Returns how many articles it touched. Admin only.';

revoke all on function public.delete_article_category(uuid, uuid) from public, anon;
grant execute on function public.delete_article_category(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. A category needs a slug that can be filtered on. The client builds
--    "#/c/<slug>" from it, so an empty or padded slug is a filter nobody can
--    reach.
-- ---------------------------------------------------------------------------
create or replace function public.clean_category()
returns trigger
language plpgsql
as $$
begin
  new.name := btrim(new.name);
  new.slug := lower(btrim(coalesce(nullif(new.slug, ''), new.name)));
  /* Same rule as scripts/new-article.mjs and the panel: lowercase, words joined
     by single hyphens, nothing that needs escaping in a URL. */
  new.slug := regexp_replace(new.slug, '[^a-z0-9]+', '-', 'g');
  new.slug := regexp_replace(new.slug, '-+', '-', 'g');
  new.slug := btrim(new.slug, '-');

  if new.name = '' then
    raise exception 'a category needs a name' using errcode = '23514';
  end if;
  if new.slug = '' then
    raise exception 'a category needs a slug, and this name has none: %', new.name
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists article_categories_clean on public.article_categories;
create trigger article_categories_clean
  before insert or update on public.article_categories
  for each row execute function public.clean_category();
