-- Forward-only, after the answer-key correction. Change options AND keys together;
-- no learner scores, attempts or certificate records are reset.
begin;
do $$
declare q record; item record; options jsonb; v_questions jsonb;
begin
  for q in select * from public.learning_quizzes where topic_id in (
    '10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004') for update
  loop
    v_questions := '[]'::jsonb;
    for item in select value,ordinality::integer-1 as idx from jsonb_array_elements(q.questions) with ordinality loop
      if jsonb_array_length(item.value->'options') <> 4 then raise exception 'Expected four options'; end if;
      select jsonb_agg(value order by (ordinality-1+item.idx+1)%4) into options
        from jsonb_array_elements(item.value->'options') with ordinality;
      v_questions := v_questions || jsonb_build_array(jsonb_set(item.value,'{options}',options));
      update public.learning_quiz_answers set answer_index=(answer_index+item.idx+1)%4
        where quiz_id=q.id and question_index=item.idx;
    end loop;
    update public.learning_quizzes set questions=v_questions,updated_at=now() where id=q.id;
  end loop;
end;
$$;
commit;
