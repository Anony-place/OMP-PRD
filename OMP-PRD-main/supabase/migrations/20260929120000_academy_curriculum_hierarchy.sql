-- Additive curriculum hierarchy. Existing topic IDs, progress, labs, quizzes and
-- certificates are preserved. Never re-run the old destructive reset seed.
begin;
create table public.learning_paths (
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
create unique index learning_path_start_here on public.learning_paths(category_id)
  where is_start_here and status = 'published';
create table public.learning_modules (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null, category_id uuid not null,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null, description text not null, outcome text not null,
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  foreign key (path_id,category_id) references public.learning_paths(id,category_id) on delete restrict,
  unique(path_id,slug), unique(id,category_id)
);
alter table public.learning_topics add column module_id uuid;
alter table public.learning_topics add constraint learning_topic_module_category_fk
  foreign key (module_id,category_id) references public.learning_modules(id,category_id) on delete restrict;
create index learning_topics_module_order on public.learning_topics(module_id,sort_order);
create index learning_modules_path_order on public.learning_modules(path_id,sort_order);

alter table public.learning_paths enable row level security;
alter table public.learning_modules enable row level security;
grant select on public.learning_paths, public.learning_modules to anon,authenticated;
grant all on public.learning_paths, public.learning_modules to service_role;
create policy learning_paths_public_select on public.learning_paths for select to anon,authenticated
  using (status = 'published' and exists (select 1 from public.learning_categories c where c.id = category_id and c.is_active));
create policy learning_modules_public_select on public.learning_modules for select to anon,authenticated
  using (status = 'published' and exists (select 1 from public.learning_paths p where p.id = path_id and p.status = 'published'));
-- Only the learner can retrieve their existing certificate link. Public
-- verification remains through the verification function, not a table listing.
create policy learning_certificates_select_own on public.learning_certificates for select to authenticated
  using ((select auth.uid()) = user_id);
grant select on public.learning_certificates to authenticated;

-- Seed reviewed hierarchy. Content below is mirrored in academy-curriculum.json
-- for the explicit local/offline build; live production builds read these tables.
insert into public.learning_paths(id,category_id,slug,name,description,audience,difficulty,prerequisites,outcomes,next_steps,is_start_here,sort_order,status) values
('40000000-0000-4000-8000-000000000001','d93dd172-940d-469c-9e2b-126acfc36bff','foundations','Web Security Foundations','Start with how web applications work, then learn how identity, sessions, and access decisions keep users and data safe.','Beginners, students, and developers who want to understand web security before studying individual vulnerabilities.','Beginner','["Comfort using a web browser and navigating websites.", "No previous security-testing experience required. Basic HTML is helpful, not required."]','["Map assets and trust boundaries in a web application.", "Read the security-relevant parts of an HTTP request and response.", "Explain how authentication differs from authorization.", "Recognize session and access-control risks, and describe defensive controls."]','Revisit any topic you cannot explain in your own words. Then explore beginner vulnerability labs using the external resources below. This foundation does not cover every vulnerability or qualify you as a professional tester.',true,0,'published');
insert into public.learning_modules(id,path_id,category_id,slug,name,description,outcome,sort_order,status) values
('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','d93dd172-940d-469c-9e2b-126acfc36bff','how-the-web-works','Understand the web','Build the mental model first: what needs protecting and how requests move through an application.','You can trace a request and identify the boundary where a security decision belongs.',0,'published'),
('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','d93dd172-940d-469c-9e2b-126acfc36bff','identity-and-access','Protect identity & access','Build on HTTP to understand who a user is, how a session persists, and what that user may do.','You can distinguish a login problem from an authorization problem and explain the relevant defenses.',1,'published');
update public.learning_topics set module_id = '50000000-0000-4000-8000-000000000001' where id = '10000000-0000-4000-8000-000000000001';
update public.learning_topics set module_id = '50000000-0000-4000-8000-000000000001' where id = '10000000-0000-4000-8000-000000000002';
update public.learning_topics set module_id = '50000000-0000-4000-8000-000000000002' where id = '10000000-0000-4000-8000-000000000003';
update public.learning_topics set module_id = '50000000-0000-4000-8000-000000000002' where id = '10000000-0000-4000-8000-000000000004';
-- Parent publication controls apply to direct public reads as well as the
-- static publisher. Unassigned topics stay private until organized/published.
drop policy if exists learning_topics_public_select on public.learning_topics;
create policy learning_topics_public_select on public.learning_topics for select to anon,authenticated
  using (status = 'published' and exists (select 1 from public.learning_modules m where m.id = module_id and m.status = 'published'));
drop policy if exists learning_labs_public_select on public.learning_labs;
create policy learning_labs_public_select on public.learning_labs for select to anon,authenticated
  using (is_active and exists (select 1 from public.learning_topics t where t.id = topic_id and t.status = 'published'));
commit;
