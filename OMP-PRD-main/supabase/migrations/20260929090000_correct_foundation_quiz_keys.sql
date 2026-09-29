-- Correct mismatched keys in the 2026-09-27 foundation seed.
-- All four published questions in each seeded quiz put the correct answer at
-- index 3, but the old keys incorrectly used 3,2,1,0. Do not rewrite questions,
-- progress, certificates or any answer key for an independently edited question.
begin;
with expected(quiz_id, question_index, correct_option) as (
  values
    ('30000000-0000-4000-8000-000000000001'::uuid, 1, 'The user can still send the underlying request directly to the server'),
    ('30000000-0000-4000-8000-000000000001'::uuid, 2, 'Who can perform this action and what server-side rule proves it?'),
    ('30000000-0000-4000-8000-000000000001'::uuid, 3, 'A more verifiable set of application-security requirements'),
    ('30000000-0000-4000-8000-000000000002'::uuid, 1, 'They can carry security-relevant metadata such as cookies, authorization, content type, and caching directives'),
    ('30000000-0000-4000-8000-000000000002'::uuid, 2, 'It can associate subsequent requests with an authenticated session'),
    ('30000000-0000-4000-8000-000000000002'::uuid, 3, 'Different components may parse or cache the same request differently'),
    ('30000000-0000-4000-8000-000000000003'::uuid, 1, 'It is another path that can change or recover account access'),
    ('30000000-0000-4000-8000-000000000003'::uuid, 2, 'The application establishes a strong, unpredictable session and handles its lifecycle securely'),
    ('30000000-0000-4000-8000-000000000003'::uuid, 3, 'Different responses reveal whether a username exists'),
    ('30000000-0000-4000-8000-000000000004'::uuid, 1, 'Accessing another user''s resources at a similar privilege level'),
    ('30000000-0000-4000-8000-000000000004'::uuid, 2, 'A user-controlled object reference may let a user access an object they are not authorized to access'),
    ('30000000-0000-4000-8000-000000000004'::uuid, 3, 'On the trusted server-side path that performs the action')
)
update public.learning_quiz_answers as answer
set answer_index = 3
from expected, public.learning_quizzes as quiz
where answer.quiz_id = expected.quiz_id
  and answer.question_index = expected.question_index
  and quiz.id = expected.quiz_id
  and quiz.questions -> expected.question_index -> 'options' ->> 3 = expected.correct_option;
commit;
