import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.115.0';

const SUPABASE_URL = 'https://aeehfulikupskyrvcpzb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'omp-learning-auth' }
});

const app = document.querySelector('#learning-app');
const registry = window.OMPLearningData || { categories: [], defaultLessonSections: [] };
const icon = (name) => ({book:'▤', check:'✓', arrow:'→', lab:'◈', quiz:'?', lock:'◷'}[name] || '•');
const esc = (v='') => String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const slugify = v => String(v||'').toLowerCase().trim().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');

function byRegistryCategory(slug){ return registry.categories.find(c => c.slug === slug); }
function byRegistryTopic(categorySlug, topicSlug){
  const c = byRegistryCategory(categorySlug); if(!c) return null;
  const t = c.topics.find(x => x[0] === topicSlug); if(!t) return null;
  return {slug:t[0],name:t[1],description:t[2],difficulty:t[3],estimated_minutes:t[4],category:c};
}