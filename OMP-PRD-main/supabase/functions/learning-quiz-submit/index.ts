import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from 'jsr:@supabase/supabase-js@2/cors';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Authentication required.' }, 401);

    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const publishable = (() => {
      const raw = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          return parsed.default;
        } catch (_) {}
      }
      return Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    })();
    const secret = (() => {
      const raw = Deno.env.get('SUPABASE_SECRET_KEYS');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          return parsed.default;
        } catch (_) {}
      }
      return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    })();

    const userClient = createClient(url, publishable, {
      global: { headers: { Authorization: authHeader } }
    });
    const token = authHeader.slice(7);
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) return json({ error: 'Invalid session.' }, 401);

    const body = await req.json().catch(() => ({}));
    const topicId = typeof body.topic_id === 'string' ? body.topic_id : '';
    const answers = Array.isArray(body.answers) ? body.answers.map(Number) : [];
    if (!topicId || answers.length !== 4 || answers.some((x: number) => !Number.isInteger(x) || x < 0 || x > 9)) {
      return json({ error: 'Invalid quiz submission.' }, 400);
    }

    const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

    const [{ data: topic, error: topicError }, { data: quiz, error: quizError }] = await Promise.all([
      admin.from('learning_topics').select('id,category_id,status,name').eq('id', topicId).maybeSingle(),
      admin.from('learning_quizzes').select('id,topic_id,passing_score,max_score,questions').eq('topic_id', topicId).maybeSingle()
    ]);
    if (topicError || quizError) throw topicError || quizError;
    if (!topic || topic.status !== 'published' || !quiz) return json({ error: 'Quiz not available.' }, 404);

    const { data: current, error: progressError } = await admin
      .from('learning_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('topic_id', topicId)
      .maybeSingle();
    if (progressError) throw progressError;

    if (current?.passed) {
      const { data: existingCertificate } = await admin.from('learning_certificates')
        .select('*').eq('user_id', user.id).eq('topic_id', topicId).maybeSingle();
      return json({ status: 'PASSED', score: current.highest_score, progress: current, certificate: existingCertificate });
    }
    if (!current?.lab_completed) return json({ error: 'Complete the authorized practice lab before taking the quiz.' }, 409);

    if (current?.next_retry_at && new Date(current.next_retry_at) > new Date()) {
      return json({
        status: 'RETRY_LOCKED',
        score: current.highest_score ?? 0,
        nextRetryAt: current.next_retry_at,
        progress: current
      }, 423);
    }

    const { data: keys, error: keyError } = await admin
      .from('learning_quiz_answers')
      .select('question_index,answer_index')
      .eq('quiz_id', quiz.id)
      .order('question_index');
    if (keyError) throw keyError;
    if (!keys || keys.length !== 4) return json({ error: 'Quiz answer key is incomplete.' }, 500);

    let score = 0;
    for (const key of keys) {
      if (answers[key.question_index] === key.answer_index) score += 5;
    }

    const passed = score >= Number(quiz.passing_score ?? 15);
    const now = new Date();
    const nextRetryAt = passed ? null : new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const patch = {
      user_id: user.id,
      category_id: topic.category_id,
      topic_id: topicId,
      lesson_started: true,
      lesson_completed: true,
      lab_completed: current?.lab_completed ?? false,
      quiz_attempts: Number(current?.quiz_attempts ?? 0) + 1,
      highest_score: Math.max(Number(current?.highest_score ?? 0), score),
      passed,
      state: passed ? 'PASSED' : 'RETRY_LOCKED',
      completed_at: passed ? now.toISOString() : null,
      next_retry_at: nextRetryAt,
      last_attempt_at: now.toISOString(),
    };

    const { data: progress, error: saveError } = await admin
      .from('learning_progress')
      .upsert(patch, { onConflict: 'user_id,topic_id' })
      .select('*')
      .single();
    if (saveError) throw saveError;

    let certificate = null;
    if (passed) {
      const metadata = user.user_metadata ?? {};
      const recipientName =
        String(metadata.full_name || metadata.name || '').trim() ||
        'OMP Learner';
      const { data: category } = await admin
        .from('learning_categories')
        .select('name')
        .eq('id', topic.category_id)
        .maybeSingle();
      const certificateId = 'OMP-' + crypto.randomUUID().replaceAll('-', '').slice(0, 24).toUpperCase();
      const { data: existingCertificate } = await admin
        .from('learning_certificates')
        .select('*')
        .eq('user_id', user.id)
        .eq('topic_id', topicId)
        .maybeSingle();
      if (existingCertificate) {
        certificate = existingCertificate;
      } else {
        const { data: createdCertificate, error: certificateError } = await admin
          .from('learning_certificates')
          .insert({
            certificate_id: certificateId,
            user_id: user.id,
            topic_id: topicId,
            category_id: topic.category_id,
            recipient_name: recipientName,
            topic_name: topic.name,
            category_name: category?.name ?? 'Security Academy',
            score,
          })
          .select('*')
          .single();
        if (certificateError) throw certificateError;
        certificate = createdCertificate;
      }
    }

    return json({
      status: passed ? 'PASSED' : 'RETRY_LOCKED',
      score,
      nextRetryAt,
      progress,
      certificate
    });
  } catch (error) {
    console.error('learning-quiz-submit', error);
    return json({ error: 'Quiz submission failed.' }, 500);
  }
});
