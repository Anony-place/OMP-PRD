-- Additive curriculum hierarchy.
--
-- WHY THIS FILE WAS REWRITTEN
-- The first version did `create table public.learning_modules`, which only
-- works on a database where that table does not exist. On any environment that
-- has already run the Academy seed syncs the table is present, so the build
-- failed closed with:
--     Academy build: learning_paths returned 404. Apply the hierarchy migration
-- This version therefore EXTENDS learning_modules instead of creating it, so it
-- is safe on a fresh database and on a populated one. Nothing is dropped, and
-- existing module/topic IDs are preserved so progress, labs, quizzes and
-- certificates keep pointing at the same rows.
--
-- SCOPE
-- This migration owns the reviewed foundation curriculum only. The published
-- site additionally carries a "cyber-security" course and its modules, which
-- were seeded by the environment-specific Academy seed syncs rather than by this
-- repository. That course is left untouched here: its content is authored
-- outside this migration and must stay unpublished until reviewed.
--
-- SAFETY
-- * Nothing is removed or rebuilt. Topics that cannot be placed in a course keep
--   module_id NULL, and the public read policy keeps them private until a course
--   publishes them, so no lesson is exposed without a reviewed parent.
begin;

-- Courses. Not a cross-course system: one course per learning path.
create table if not exists public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.learning_categories(id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null, description text not null,
  audience text not null, difficulty text not null default 'Beginner',
  prerequisites jsonb not null default '[]' check (jsonb_typeof(prerequisites) = 'array'),
  outcomes jsonb not null default '[]' check (jsonb_typeof(outcomes) = 'array'),
  next_steps text not null default '', is_start_here boolean not null default false,
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  unique(category_id,slug), unique(id,category_id)
);
create unique index if not exists learning_path_start_here on public.learning_paths(category_id)
  where is_start_here and status = 'published';

-- Modules. `if not exists` makes this correct on a fresh database, where it
-- creates the reviewed shape, and on an environment that already seeded modules,
-- where it leaves the existing rows and their extra columns untouched. The
-- alter statements below are then no-ops after a fresh create, and backfill the
-- missing columns on a seeded table.
create table if not exists public.learning_modules (
  id uuid primary key default gen_random_uuid(),
  path_id uuid, category_id uuid not null references public.learning_categories(id) on delete restrict,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null, description text not null, outcome text not null,
  tagline text, difficulty text, estimated_minutes integer,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  unique(id,category_id)
);
alter table public.learning_modules add column if not exists path_id uuid;
alter table public.learning_modules add column if not exists outcome text;
alter table public.learning_modules add column if not exists status text;

update public.learning_modules m
   set status = case when coalesce(m.is_active, true) then 'published' else 'archived' end
 where m.status is null;

-- An outcome must be a real sentence, never empty, because the course page
-- prints it as "By the end of this module you will be able to:".
update public.learning_modules m
   set outcome = coalesce(
     nullif(btrim(m.tagline), ''),
     nullif(btrim(m.description), ''),
     btrim(m.name))
 where m.outcome is null or btrim(m.outcome) = '';

-- Reviewed foundation course. Mirrored in supabase/academy-curriculum.json so
-- the offline build and the live build publish the same course.
insert into public.learning_paths(id,category_id,slug,name,description,audience,difficulty,prerequisites,outcomes,next_steps,is_start_here,sort_order,status) values
('40000000-0000-4000-8000-000000000001','d93dd172-940d-469c-9e2b-126acfc36bff','foundations','Web Security Foundations','Start with how web applications work, then learn how identity, sessions, and access decisions keep users and data safe.','Beginners, students, and developers who want to understand web security before studying individual vulnerabilities.','Beginner','["Comfort using a web browser and navigating websites.", "No previous security-testing experience required. Basic HTML is helpful, not required."]','["Map assets and trust boundaries in a web application.", "Read the security-relevant parts of an HTTP request and response.", "Explain how authentication differs from authorization.", "Recognize session and access-control risks, and describe defensive controls."]','Revisit any topic you cannot explain in your own words. Then explore beginner vulnerability labs using the external resources below. This foundation does not cover every vulnerability or qualify you as a professional tester.',true,0,'published');

-- Reviewed foundation modules.
insert into public.learning_modules(id,path_id,category_id,slug,name,description,outcome,sort_order,status) values
('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','d93dd172-940d-469c-9e2b-126acfc36bff','how-the-web-works','Understand the web','Build the mental model first: what needs protecting and how requests move through an application.','You can trace a request and identify the boundary where a security decision belongs.',0,'published'),
('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','d93dd172-940d-469c-9e2b-126acfc36bff','identity-and-access','Protect identity & access','Build on HTTP to understand who a user is, how a session persists, and what that user may do.','You can distinguish a login problem from an authorization problem and explain the relevant defenses.',1,'published');

-- Attach the reviewed modules to their course, then refuse to publish while any
-- module has no course: an orphan module would silently hide its lessons.
update public.learning_modules m
   set path_id = '40000000-0000-4000-8000-000000000001'
 where m.path_id is null
   and m.category_id = 'd93dd172-940d-469c-9e2b-126acfc36bff';

do $$
declare orphans integer;
begin
  select count(*) into orphans from public.learning_modules m
   where m.category_id = 'd93dd172-940d-469c-9e2b-126acfc36bff' and m.path_id is null;
  if orphans > 0 then
    raise exception 'learning_modules in the foundation path without a course: %', orphans;
  end if;
end $$;

alter table public.learning_modules
  add constraint learning_modules_path_fk
  foreign key (path_id,category_id) references public.learning_paths(id,category_id) on delete restrict;
alter table public.learning_modules
  add constraint learning_modules_path_slug_key unique(path_id,slug);

-- Place the four foundation lessons in their module.
alter table public.learning_topics add column if not exists module_id uuid;
update public.learning_topics set module_id = '50000000-0000-4000-8000-000000000001' where id = '10000000-0000-4000-8000-000000000001';
update public.learning_topics set module_id = '50000000-0000-4000-8000-000000000001' where id = '10000000-0000-4000-8000-000000000002';
update public.learning_topics set module_id = '50000000-0000-4000-8000-000000000002' where id = '10000000-0000-4000-8000-000000000003';
update public.learning_topics set module_id = '50000000-0000-4000-8000-000000000002' where id = '10000000-0000-4000-8000-000000000004';

-- A lesson is bound to its module and the module's learning path. The composite
-- (module_id, path_id) key is tightened later by the multi-subject migration,
-- which also adds learning_topics.path_id; this migration stays self-contained
-- by keying on (module_id, category_id) only.
alter table public.learning_topics
  add constraint learning_topic_module_category_fk
  foreign key (module_id,category_id)
  references public.learning_modules(id,category_id) on delete restrict;
create index if not exists learning_topics_module_order on public.learning_topics(module_id,sort_order);
create index if not exists learning_modules_path_order on public.learning_modules(path_id,sort_order);

-- Read policies. A lesson is public only through a published module in a
-- published course, so an unreviewed course cannot publish content early.
alter table public.learning_paths enable row level security;
alter table public.learning_modules enable row level security;
grant select on public.learning_paths, public.learning_modules to anon,authenticated;
grant all on public.learning_paths, public.learning_modules to service_role;

drop policy if exists learning_paths_public_select on public.learning_paths;
create policy learning_paths_public_select on public.learning_paths for select to anon,authenticated
  using (status = 'published' and exists (select 1 from public.learning_categories c where c.id = category_id and c.is_active));

drop policy if exists learning_modules_public_select on public.learning_modules;
create policy learning_modules_public_select on public.learning_modules for select to anon,authenticated
  using (status = 'published' and exists (select 1 from public.learning_paths p where p.id = path_id and p.status = 'published'));

-- Only the learner can retrieve their existing certificate link. Public
-- verification remains through the verification function, not a table listing.
drop policy if exists learning_certificates_select_own on public.learning_certificates;
create policy learning_certificates_select_own on public.learning_certificates for select to authenticated
  using ((select auth.uid()) = user_id);
grant select on public.learning_certificates to authenticated;

drop policy if exists learning_topics_public_select on public.learning_topics;
create policy learning_topics_public_select on public.learning_topics for select to anon,authenticated
  using (status = 'published' and exists (select 1 from public.learning_modules m where m.id = module_id and m.status = 'published'));

drop policy if exists learning_labs_public_select on public.learning_labs;
create policy learning_labs_public_select on public.learning_labs for select to anon,authenticated
  using (is_active and exists (select 1 from public.learning_topics t where t.id = topic_id and t.status = 'published'));

comment on table public.learning_paths is
  'Academy courses. One course per learning path; modules and lessons hang off it.';
commit;
