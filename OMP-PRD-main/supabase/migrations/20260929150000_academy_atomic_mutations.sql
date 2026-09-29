-- Forward-only: preserve all learner records. Deploy before the revised Edge handlers.
begin;

create or replace function public.academy_mutate(
  p_user_id uuid, p_topic_id uuid, p_action text,
  p_answers integer[] default null, p_recipient_name text default null,
  p_quiz_version timestamptz default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_topic public.learning_topics%rowtype;
  v_progress public.learning_progress%rowtype;
  v_quiz public.learning_quizzes%rowtype;
  v_certificate public.learning_certificates%rowtype;
  v_category_name text;
  v_score integer;
  v_now timestamptz;
  v_indexes integer[];
begin
  if p_user_id is null or p_topic_id is null or p_action is null or
     p_action not in ('start_lesson','complete_lab','submit_quiz','recover_certificate') then
    return jsonb_build_object('http_status',400,'error','Invalid progress action.');
  end if;
  if p_action = 'submit_quiz' and (p_answers is null or cardinality(p_answers) <> 4 or
      array_ndims(p_answers) <> 1 or array_lower(p_answers,1) <> 1 or
      exists(select 1 from unnest(p_answers) x where x is null or x < 0 or x > 3)) then
    return jsonb_build_object('http_status',400,'error','Invalid quiz submission.');
  end if;

  -- RLS is bypassed by service-role requests. Enforce AND lock the entire
  -- publication chain here, including while a concurrent admin unpublishes it.
  select t.* into v_topic from public.learning_topics t
    join public.learning_modules m on m.id=t.module_id and m.category_id=t.category_id
    join public.learning_paths p on p.id=m.path_id and p.category_id=m.category_id
    join public.learning_categories c on c.id=p.category_id
    where t.id=p_topic_id and t.status='published' and m.status='published'
      and p.status='published' and c.is_active
    for share of t,m,p,c;
  if not found then
    return jsonb_build_object('http_status',404,'error','Topic not available.');
  end if;
  select name into v_category_name from public.learning_categories where id=v_topic.category_id;

  -- The unique key serializes creation; FOR UPDATE serializes every subsequent
  -- action for this learner/topic. No application-side read/modify/write window.
  insert into public.learning_progress(user_id,topic_id,category_id)
    values(p_user_id,p_topic_id,v_topic.category_id)
    on conflict(user_id,topic_id) do nothing;
  select * into strict v_progress from public.learning_progress
    where user_id=p_user_id and topic_id=p_topic_id for update;
  v_now := clock_timestamp(); -- after waiting for the row lock

  if p_action = 'recover_certificate' and not v_progress.passed then
    return jsonb_build_object('http_status',409,'error','Pass the quiz before requesting a certificate.');
  end if;
  if p_action in ('start_lesson','complete_lab') then
    update public.learning_progress set
      lesson_started=true,
      lesson_completed=lesson_completed or p_action='complete_lab',
      lab_completed=lab_completed or p_action='complete_lab',
      state=case when passed then 'PASSED'
        when next_retry_at > v_now then 'RETRY_LOCKED'
        when lab_completed or p_action='complete_lab' then 'QUIZ_AVAILABLE'
        else 'IN_PROGRESS' end,
      updated_at=v_now
      where id=v_progress.id returning * into v_progress;
    return jsonb_build_object('http_status',200,'progress',to_jsonb(v_progress));
  end if;

  if not v_progress.passed then
    if not v_progress.lab_completed then
      return jsonb_build_object('http_status',409,'error','Complete the authorized practice lab before taking the quiz.');
    end if;
    if v_progress.next_retry_at > v_now then
      return jsonb_build_object('http_status',423,'status','RETRY_LOCKED',
        'score',v_progress.highest_score,'nextRetryAt',v_progress.next_retry_at,'progress',to_jsonb(v_progress));
    end if;
    select * into v_quiz from public.learning_quizzes where topic_id=p_topic_id for share;
    if not found then
      return jsonb_build_object('http_status',404,'error','Quiz not available.');
    end if;
    if p_quiz_version is distinct from v_quiz.updated_at then
      return jsonb_build_object('http_status',409,'error','This quiz has changed. Refresh the lesson before submitting again.','code','QUIZ_CHANGED');
    end if;
    if jsonb_typeof(v_quiz.questions) <> 'array' then raise exception 'Invalid quiz questions'; end if;
    if jsonb_array_length(v_quiz.questions) <> 4 or v_quiz.max_score <> 20 or
       v_quiz.passing_score <> 15 then raise exception 'Invalid quiz configuration'; end if;
    if exists(select 1 from jsonb_array_elements(v_quiz.questions) q
      where jsonb_typeof(q->'options') is distinct from 'array') then raise exception 'Invalid quiz options'; end if;
    if exists(select 1 from jsonb_array_elements(v_quiz.questions) q where jsonb_array_length(q->'options') <> 4)
      then raise exception 'Invalid quiz options'; end if;
    if exists(select 1 from jsonb_array_elements(v_quiz.questions) q
      where jsonb_typeof(q->'question') is distinct from 'string' or btrim(q->>'question')='')
      or exists(select 1 from jsonb_array_elements(v_quiz.questions) q, jsonb_array_elements(q->'options') o
      where jsonb_typeof(o) <> 'string' or btrim(o #>> '{}')='') then raise exception 'Empty quiz text'; end if;
    -- Lock key rows too. Invalid/missing/out-of-range keys must fail closed.
    perform 1 from public.learning_quiz_answers where quiz_id=v_quiz.id for share;
    select array_agg(question_index order by question_index) into v_indexes
      from public.learning_quiz_answers where quiz_id=v_quiz.id;
    if v_indexes is distinct from array[0,1,2,3] or exists(
      select 1 from public.learning_quiz_answers where quiz_id=v_quiz.id and answer_index not between 0 and 3)
      then raise exception 'Invalid quiz answer key'; end if;
    select count(*)::integer * 5 into v_score from public.learning_quiz_answers
      where quiz_id=v_quiz.id and p_answers[question_index+1]=answer_index;
    update public.learning_progress set
      lesson_started=true,lesson_completed=true,
      quiz_attempts=quiz_attempts+1,highest_score=greatest(highest_score,v_score),
      passed=v_score >= v_quiz.passing_score,
      state=case when v_score >= v_quiz.passing_score then 'PASSED' else 'RETRY_LOCKED' end,
      completed_at=case when v_score >= v_quiz.passing_score then v_now else null end,
      next_retry_at=case when v_score >= v_quiz.passing_score then null else v_now+interval '24 hours' end,
      last_attempt_at=v_now,updated_at=v_now
      where id=v_progress.id returning * into v_progress;
  else
    update public.learning_progress set state='PASSED',next_retry_at=null,
      completed_at=coalesce(completed_at,v_now),updated_at=v_now
      where id=v_progress.id returning * into v_progress;
    v_score := v_progress.highest_score;
  end if;

  if v_progress.passed then
    -- In the SAME transaction as the pass. Insert failure rolls everything back.
    -- Also repairs historic passed/no-certificate records on an idempotent retry.
    insert into public.learning_certificates(certificate_id,user_id,topic_id,category_id,
      recipient_name,topic_name,category_name,score)
      values('OMP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,24)),
        p_user_id,p_topic_id,v_topic.category_id,
        coalesce(nullif(left(btrim(p_recipient_name),100),''),'OMP Learner'),
        v_topic.name,v_category_name,v_progress.highest_score)
      on conflict(user_id,topic_id) do nothing;
    select * into strict v_certificate from public.learning_certificates
      where user_id=p_user_id and topic_id=p_topic_id;
  end if;
  return jsonb_build_object('http_status',200,'status',v_progress.state,'score',v_score,
    'nextRetryAt',v_progress.next_retry_at,'progress',to_jsonb(v_progress),
    'certificate',case when v_progress.passed then to_jsonb(v_certificate) else null end);
end;
$$;

create or replace function public.academy_quiz_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'learning_quizzes' then
    new.updated_at := clock_timestamp();
    return new;
  end if;
  if tg_op <> 'INSERT' then
    update public.learning_quizzes set updated_at=clock_timestamp() where id=old.quiz_id;
  end if;
  if tg_op <> 'DELETE' then
    update public.learning_quizzes set updated_at=clock_timestamp() where id=new.quiz_id;
  end if;
  return null;
end;
$$;
revoke all on function public.academy_quiz_changed() from public,anon,authenticated;
create trigger academy_quiz_revision before update on public.learning_quizzes
  for each row execute function public.academy_quiz_changed();
create trigger academy_answer_revision after insert or update or delete on public.learning_quiz_answers
  for each row execute function public.academy_quiz_changed();

-- The user ID is trusted ONLY because this function is service-role-only.
-- Browsers cannot call this RPC or directly mutate scores/certificates.
revoke all on function public.academy_mutate(uuid,uuid,text,integer[],text,timestamptz) from public,anon,authenticated;
grant execute on function public.academy_mutate(uuid,uuid,text,integer[],text,timestamptz) to service_role;
revoke insert,update,delete,truncate,references,trigger on
  public.learning_progress,public.learning_certificates,public.learning_quiz_answers,
  public.learning_quizzes,public.learning_topics,public.learning_labs,
  public.learning_categories,public.learning_paths,public.learning_modules
  from anon,authenticated;

-- Reconcile the specific historic stale-write inconsistency (A2) if it exists.
-- An already-issued certificate is evidence of completion. Never reset scores,
-- attempts, certificates or correctly passed rows; only restore a lost pass.
update public.learning_progress p set
  passed=true,state='PASSED',highest_score=greatest(p.highest_score,c.score),
  quiz_attempts=greatest(p.quiz_attempts,1),next_retry_at=null,
  completed_at=coalesce(p.completed_at,c.issued_at),updated_at=clock_timestamp()
from public.learning_certificates c
where p.user_id=c.user_id and p.topic_id=c.topic_id and not p.passed;
commit;
