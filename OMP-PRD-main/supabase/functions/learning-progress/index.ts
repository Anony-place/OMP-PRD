import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from 'jsr:@supabase/supabase-js@2/cors';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } });

function envKey(name: string, fallback: string) {
  try { const obj = JSON.parse(Deno.env.get(name) ?? '{}'); return obj.default ?? ''; } catch (_) { return Deno.env.get(fallback) ?? ''; }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return json({ error: 'Authentication required.' }, 401);

  try {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const publishable = envKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
    const secret = envKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');

    const userClient = createClient(url, publishable, { global: { headers: { Authorization: auth } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser(auth.slice(7));
    if (userError || !user) return json({ error: 'Invalid session.' }, 401);

    const body = await req.json().catch(() => ({}));
    const topicId = typeof body.topic_id === 'string' ? body.topic_id : '';
    const action = typeof body.action === 'string' ? body.action : '';
    if (!topicId || !['start_lesson','complete_lab'].includes(action)) {
      return json({ error: 'Invalid progress action.' }, 400);
    }

    const admin = createClient(url, secret, { auth: { persistSession:false, autoRefreshToken:false } });
    const { data: topic, error: topicError } = await admin
      .from('learning_topics').select('id,category_id,status').eq('id', topicId).maybeSingle();
    if (topicError) throw topicError;
    if (!topic || topic.status !== 'published') return json({ error: 'Topic not available.' }, 404);

    const { data: current, error: currentError } = await admin
      .from('learning_progress').select('*').eq('user_id', user.id).eq('topic_id', topicId).maybeSingle();
    if (currentError) throw currentError;

    const patch = {
      user_id:user.id, category_id:topic.category_id, topic_id:topic.id,
      lesson_started:true,
      lesson_completed:action === 'complete_lab' ? true : Boolean(current?.lesson_completed),
      lab_completed:action === 'complete_lab' ? true : Boolean(current?.lab_completed),
      quiz_attempts:Number(current?.quiz_attempts ?? 0),
      highest_score:Number(current?.highest_score ?? 0),
      passed:Boolean(current?.passed),
      state:current?.passed ? 'PASSED' : action === 'complete_lab' ? 'QUIZ_AVAILABLE' : 'IN_PROGRESS',
      completed_at:current?.completed_at ?? null,
      next_retry_at:current?.next_retry_at ?? null,
      last_attempt_at:current?.last_attempt_at ?? null
    };

    const { data: progress, error: saveError } = await admin.from('learning_progress')
      .upsert(patch,{onConflict:'user_id,topic_id'}).select('*').single();
    if (saveError) throw saveError;
    return json({ progress });
  } catch (error) {
    console.error('learning-progress', error);
    return json({ error:'Progress update failed.' },500);
  }
});