-- Course is the learner-facing name for learning_paths; retain IDs/table names
-- so existing progress, quizzes, certificates and canonical URLs keep working.
begin;
alter table public.learning_topics add column path_id uuid;
update public.learning_topics t set path_id=m.path_id
  from public.learning_modules m where m.id=t.module_id;
alter table public.learning_modules add constraint learning_modules_course_identity
  unique(id,path_id,category_id);
alter table public.learning_topics add constraint learning_topic_course_identity
  foreign key(module_id,path_id,category_id)
  references public.learning_modules(id,path_id,category_id) on delete restrict;
alter table public.learning_topics add constraint learning_topic_course_assignment
  check ((module_id is null) = (path_id is null));
alter table public.learning_topics drop constraint learning_topics_category_id_slug_key;
alter table public.learning_topics add constraint learning_topic_course_slug unique(path_id,slug);
alter table public.learning_paths add constraint learning_course_reserved_slug check (slug <> 'roadmap');
alter table public.learning_categories add constraint learning_category_reserved_slug check (slug <> 'roadmap');

-- Compatible with existing authors who set only module_id: derive its course.
-- Explicit mismatched course/category IDs still fail closed via composite FKs.
create function public.academy_topic_course() returns trigger
language plpgsql set search_path = '' as $$
declare course_id uuid;
begin
  if new.module_id is not null then
    select path_id into course_id from public.learning_modules where id=new.module_id;
    if new.path_id is null then
      new.path_id := course_id;
    elsif tg_op='UPDATE' then
      if new.module_id is distinct from old.module_id and new.path_id is not distinct from old.path_id then
        new.path_id := course_id;
      end if;
    end if;
  end if;
  if tg_op='UPDATE' and old.path_id is not null and new.path_id is distinct from old.path_id then
    if exists(select 1 from public.learning_progress where topic_id=old.id)
      or exists(select 1 from public.learning_certificates where topic_id=old.id) then
      raise exception 'A lesson with learner history cannot move across courses; create a new lesson ID';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.academy_topic_course() from public,anon,authenticated;
create trigger academy_topic_course_assignment before insert or update of module_id,path_id,category_id
  on public.learning_topics for each row execute function public.academy_topic_course();
-- Certificates are still LESSON certificates. Record their owning course so
-- identically named lessons in one subject cannot be mistaken for each other.
alter table public.learning_certificates add column course_id uuid references public.learning_paths(id) on delete restrict;
alter table public.learning_certificates add column course_name text;
update public.learning_certificates c set course_id=p.id,course_name=p.name
  from public.learning_topics t join public.learning_paths p on p.id=t.path_id
  where t.id=c.topic_id;
create function public.academy_certificate_course() returns trigger
language plpgsql set search_path = '' as $$
begin
  select p.id,p.name into new.course_id,new.course_name
    from public.learning_topics t join public.learning_paths p on p.id=t.path_id
    where t.id=new.topic_id;
  return new;
end;
$$;
revoke all on function public.academy_certificate_course() from public,anon,authenticated;
create trigger academy_certificate_course_snapshot before insert on public.learning_certificates
  for each row execute function public.academy_certificate_course();
comment on table public.learning_paths is 'Academy courses. Kept under the historical table name for compatibility; not a cross-course learning-path system.';
comment on column public.learning_topics.path_id is 'Owning course (learning_paths.id). Derived from module_id when omitted. Lesson slugs are unique within this course, not the entire subject.';
commit;
