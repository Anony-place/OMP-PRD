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
function pathParts(){ return location.pathname.split('/').filter(Boolean).map(decodeURIComponent); }

async function fetchCatalogue(){
  const [{data:categories,error:cErr},{data:topics,error:tErr},{data:labs,error:lErr},{data:quizzes,error:qErr}] = await Promise.all([
    supabase.from('learning_categories').select('id,slug,name,description,sort_order,is_active').eq('is_active',true).order('sort_order'),
    supabase.from('learning_topics').select('id,category_id,slug,name,description,difficulty,estimated_minutes,sort_order,status,content').eq('status','published').order('sort_order'),
    supabase.from('learning_labs').select('id,topic_id,title,provider,url,description,sort_order,is_active').eq('is_active',true).order('sort_order'),
    supabase.from('learning_quizzes').select('id,topic_id,passing_score,max_score,questions')
  ]);
  if(cErr||tErr||lErr||qErr) throw new Error((cErr||tErr||lErr||qErr).message);
  const cats=(categories||[]).map(c=>({...c,topics:[]}));
  const cm=new Map(cats.map(c=>[c.id,c]));
  for(const t of topics||[]) { const c=cm.get(t.category_id); if(c)c.topics.push(t); }
  return {categories:cats,topics:topics||[],labs:labs||[],quizzes:quizzes||[]};
}

async function getUser(){
  const {data:{user}} = await supabase.auth.getUser();
  return user;
}

async function loadProgress(topicIds=[]){
  const user = await getUser();
  if(!user || !topicIds.length) return new Map();
  const {data,error} = await supabase.from('learning_progress').select('*').eq('user_id',user.id).in('topic_id',topicIds);
  if(error) throw new Error(error.message);
  return new Map((data||[]).map(p=>[p.topic_id,p]));
}

function localState(topic){ return {topic_id:topic.id,lesson_started:false,lesson_completed:false,lab_completed:false,quiz_attempts:0,highest_score:0,passed:false,state:'NOT_STARTED',completed_at:null,next_retry_at:null}; }

async function upsertProgress(topic,patch={}){
  const user = await getUser();
  if(!user) return {user:null,progress:null};
  const {data:current} = await supabase.from('learning_progress').select('*').eq('user_id',user.id).eq('topic_id',topic.id).maybeSingle();
  const next={...(current||localState(topic)),...patch,user_id:user.id,category_id:topic.category_id,topic_id:topic.id};
  const {data,error}=await supabase.from('learning_progress').upsert(next,{onConflict:'user_id,topic_id'}).select('*').single();
  if(error) throw new Error(error.message);
  return {user,progress:data};
}

function progressState(p,t){
  if(!p)return 'NOT_STARTED';
  if(p.passed)return 'PASSED';
  if(p.next_retry_at && new Date(p.next_retry_at)>new Date())return 'RETRY_LOCKED';
  if(p.lesson_completed && !p.lab_completed)return 'LAB_PENDING';
  if(p.lab_completed)return 'QUIZ_AVAILABLE';
  if(p.lesson_started)return 'IN_PROGRESS';
  return 'NOT_STARTED';
}

function categoryCard(c,progressMap){
  const passed=(c.topics||[]).filter(t=>progressState(progressMap.get(t.id),t)==='PASSED').length;
  const total=c.topics.length, pct=total?Math.round(passed/total*100):0;
  const next=c.topics.find(t=>progressState(progressMap.get(t.id),t)!=='PASSED');
  return `<a class="card card-pad learning-card" href="/learning/${esc(c.slug)}">
    <div class="flex justify-between gap-12"><span class="card-icon" aria-hidden="true">${icon('book')}</span><span class="badge badge-demo">${total} Lessons</span></div>
    <h2>${esc(c.name)}</h2><p>${esc(c.description||'')}</p>
    <div class="learning-progress-head"><span>${passed} / ${total} Completed</span><strong>${pct}%</strong></div>
    <div class="progress-track" aria-label="${pct}% complete"><span style="width:${pct}%"></span></div>
    <span class="btn btn-secondary btn-sm mt-16">${next?'Continue':'Review'} <span aria-hidden="true">→</span></span>
  </a>`;
}

function renderHub(data,progressMap){
  const overall = data.topics.length ? Math.round([...progressMap.values()].filter(p=>p.passed).length/data.topics.length*100):0;
  app.innerHTML=`<div class="learning-summary card card-pad"><div><span class="eyebrow">Security Academy</span><h2 class="h-2">Your learning progress</h2><p class="muted">Overall completion across the academy.</p></div><div class="learning-summary-stat"><strong>${overall}%</strong><span>complete</span></div></div>
  <div class="grid grid-3 mt-24">${data.categories.map(c=>categoryCard(c,progressMap)).join('')}</div>`;
}

function renderCategory(data,cat,progressMap){
  const total=cat.topics.length, passed=cat.topics.filter(t=>progressState(progressMap.get(t.id),t)==='PASSED').length, pct=total?Math.round(passed/total*100):0;
  app.innerHTML=`<div class="learning-breadcrumb"><a href="/learning">Learning</a><span>/</span><strong>${esc(cat.name)}</strong></div>
  <div class="page-hero compact"><div><span class="chip chip-accent">Category</span><h1 class="h-1 mt-16">${esc(cat.name)}</h1><p class="lead">${esc(cat.description||'')}</p></div><div class="category-progress card card-pad"><strong>${passed}/${total}</strong><span>completed</span><div class="progress-track"><span style="width:${pct}%"></span></div><small>${pct}%</small></div></div>
  <div class="learning-list mt-24">${cat.topics.map((t,i)=>topicCard(t,progressMap.get(t.id),i+1)).join('')}</div>`;
}
function topicCard(t,p,index){
  const state=progressState(p,t);
  const labels={NOT_STARTED:'Not Started',IN_PROGRESS:'In Progress',LAB_PENDING:'Lab Pending',QUIZ_AVAILABLE:'Quiz Available',PASSED:'Completed',RETRY_LOCKED:'Retry Locked'};
  const href=`/learning/${encodeURIComponent(registry.categories.find(c=>c.name)?.slug || '')}`;
  const regCat=registry.categories.find(c=>c.topics.some(x=>x[0]===t.slug));
  return `<a class="card card-pad learning-topic state-${state.toLowerCase()}" href="/learning/${esc(regCat.slug)}/${esc(t.slug)}"><div class="topic-index">${String(index).padStart(2,'0')}</div><div class="topic-body"><div class="flex justify-between gap-12 wrap"><h2>${esc(t.name)}</h2><span class="badge ${state==='PASSED'?'badge-live':'badge-demo'}">${labels[state]}</span></div><p>${esc(t.description||'')}</p><div class="topic-meta"><span>${esc(t.difficulty)}</span><span>•</span><span>${t.estimated_minutes} min</span></div></div><span class="topic-arrow" aria-hidden="true">→</span></a>`;
}

function generatedLesson(topic){
  const base = {
    overview:`<p>${esc(topic.name)} is a focused security concept. Start by identifying the trust boundary, the attacker-controlled input or action, and the server/client component that makes the security decision.</p>`,
    how:`<p>A useful mental model is <strong>input → interpretation → security decision → impact</strong>. The exact mechanics vary by technology, but the defensive goal is to keep untrusted data from changing privileged behavior.</p>`,
    history:`<p>${esc(topic.name)} is part of a longer evolution in application security. Modern guidance emphasizes explicit trust boundaries, secure defaults, least privilege and verification at the point where access is granted.</p>`,
    real:`<p>Real incidents should be studied from public documentation and post-incident reports. OMP keeps examples educational: what happened, root cause, impact, discovery context, and the defensive change—without turning the lesson into an unauthorized exploitation recipe.</p>`,
    look:`<ul><li>Identify user-controlled inputs and security-sensitive operations.</li><li>Check whether authorization or validation occurs at the actual trust boundary.</li><li>Look for inconsistent behavior between UI restrictions and server-side enforcement.</li></ul>`,
    defensive:`<ul><li>Validate and authorize on the server at the point of use.</li><li>Prefer allowlists and secure-by-default configuration.</li><li>Log meaningful security events without collecting unnecessary sensitive data.</li></ul>`
  };
  return {
    overview:base.overview, 'how-it-works':base.how, 'history':base.history, 'real-world':base.real, 'look-for':base.look, defensive:base.defensive,
    labs:'<p>Complete the authorized practice resources below. Only practice on systems you own or are explicitly authorized to test.</p>',
    quiz:'<p>Finish the lesson and complete the 4-question, 20-mark quiz. A score of 15/20 is required to pass.</p>'
  };
}

async function renderTopic(data,cat,topic,progress){
  const labs=data.labs.filter(l=>l.topic_id===topic.id), quiz=data.quizzes.find(q=>q.topic_id===topic.id);
  const user=await getUser();
  let p=progress || localState(topic); p.state=progressState(p,topic);
  const content = generatedLesson(topic);
  const example = topic.slug==='xss' ? '<p><strong>Publicly documented pattern:</strong> a web application renders attacker-controlled content in a browser context where it was treated as trusted markup. The root cause is an unsafe data-to-HTML boundary; the defensive fix is context-appropriate output handling plus a layered browser policy.</p>' : content['real-world'];
  const sections=[
    ['01','Overview',content.overview],['02','How It Works',content['how-it-works']],['03','History / Background',content.history],
    ['04','Real-World Examples',example],['05','What To Look For',content['look-for']],['06','Defensive Perspective',content.defensive],
    ['07','Legal Practice Labs',`${content.labs}<div class="labs-grid mt-16">${labs.map(l=>`<div class="card card-pad"><div class="flex justify-between gap-12"><strong>${esc(l.title)}</strong><span class="badge badge-live">${esc(l.provider)}</span></div><p class="mt-8">${esc(l.description||'')}</p><a class="btn btn-secondary btn-sm mt-16" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">Open Lab ↗</a><button class="btn btn-primary btn-sm mt-16" data-lab-complete="${esc(l.id)}">Mark lab complete</button></div>`).join('')}</div>`],
    ['08','Knowledge Quiz', quiz ? quizView(quiz,p) : '<p>Quiz is being prepared.</p>']
  ];
  app.innerHTML=`<div class="learning-breadcrumb"><a href="/learning">Learning</a><span>/</span><a href="/learning/${esc(cat.slug)}">${esc(cat.name)}</a><span>/</span><strong>${esc(topic.name)}</strong></div>
  <div class="page-hero compact"><div><span class="chip chip-accent">${esc(topic.difficulty)} · ${topic.estimated_minutes} min</span><h1 class="h-1 mt-16">${esc(topic.name)}</h1><p class="lead">${esc(topic.description||'')}</p></div><div class="card card-pad topic-state-panel"><span class="subhead-sm">Current state</span><strong>${esc(p.state.replaceAll('_',' '))}</strong><span class="muted">Progress persists for signed-in users.</span></div></div>
  <div class="lesson-layout mt-24"><aside class="toc card card-pad"><div class="subhead-sm">Lesson</div><ul role="list">${sections.map(s=>`<li><a href="#s-${s[0]}">${s[0]} — ${esc(s[1])}</a></li>`).join('')}</ul></aside><article class="prose learning-prose">${sections.map(s=>`<section id="s-${s[0]}"><h2>${esc(s[1])}</h2>${s[2]}</section>`).join('')}</article></div>`;
  bindTopicActions(topic,quiz,p);
  if(user && (!p.lesson_started)){ await upsertProgress(topic,{lesson_started:true,state:'IN_PROGRESS'}); }
}
function quizView(quiz,p){
  const locked=p.next_retry_at && new Date(p.next_retry_at)>new Date() && !p.passed;
  if(locked) return `<div class="notice-band"><p><strong>NOT PASSED</strong></p><p class="muted mt-8">Minimum passing score is 15/20.</p><p class="mt-8">Retry available ${new Date(p.next_retry_at).toLocaleString()}.</p></div>`;
  const qs=Array.isArray(quiz.questions)?quiz.questions.slice(0,4):[];
  if(!qs.length) return '<p>No quiz questions published yet.</p>';
  return `<form id="academy-quiz" class="quiz-form"><p class="muted">4 questions × 5 marks = 20 marks. Passing score: 15/20.</p>${qs.map((q,i)=>`<fieldset class="card card-pad quiz-question"><legend><span class="topic-index">${String(i+1).padStart(2,'0')}</span> ${esc(q.question)}</legend><div class="quiz-options">${(q.options||[]).map((o,j)=>`<label class="quiz-option"><input type="radio" name="q${i}" value="${j}" required><span>${esc(o)}</span></label>`).join('')}</div></fieldset>`).join('')}<button class="btn btn-primary" type="submit">Submit quiz</button></form><div id="quiz-result"></div>`;
}
function nextDay(){return new Date(Date.now()+24*60*60*1000).toISOString();}
async function bindTopicActions(topic,quiz,p){
  document.querySelectorAll('[data-lab-complete]').forEach(btn=>btn.onclick=async()=>{btn.disabled=true;try{const r=await upsertProgress(topic,{lab_completed:true,lesson_started:true,lesson_completed:true,state:'QUIZ_AVAILABLE'}); if(!r.user){alert('Sign in to persist learning progress.');btn.disabled=false;return;} btn.textContent='Lab completed ✓';}catch(e){btn.disabled=false;alert(e.message);}});
  const form=document.querySelector('#academy-quiz'); if(!form||!quiz)return;
  form.addEventListener('submit',async e=>{
    e.preventDefault(); const r=await getUser(); if(!r){document.querySelector('#quiz-result').innerHTML='<div class="notice-band"><p>Sign in to save quiz results and unlock completion.</p></div>';return;}
    const qs=(Array.isArray(quiz.questions)?quiz.questions.slice(0,4):[]); let score=0;
    qs.forEach((q,i)=>{const picked=Number(form.querySelector(`input[name="q${i}"]:checked`)?.value); if(picked===Number(q.answer))score+=5;});
    const passed=score>=15; const patch={lesson_started:true,lesson_completed:true,quiz_attempts:Number(p.quiz_attempts||0)+1,highest_score:Math.max(Number(p.highest_score||0),score),passed,state:passed?'PASSED':'RETRY_LOCKED',completed_at:passed?new Date().toISOString():null,next_retry_at:passed?null:nextDay(),last_attempt_at:new Date().toISOString()};
    try{const saved=await upsertProgress(topic,patch);const target=document.querySelector('#quiz-result');target.innerHTML=passed?'<div class="notice-band callout-tip"><p><strong>Score: '+score+' / 20 — PASSED ✓</strong></p><p class="mt-8">Topic completed. Return to the category to continue.</p><p class="mt-16"><a class="btn btn-primary btn-sm" href="/learning/'+encodeURIComponent(topic.category.slug)+'">Back to category</a></p></div>':'<div class="notice-band callout-warn"><p><strong>Score: '+score+' / 20 — NOT PASSED</strong></p><p class="mt-8">Minimum passing score is 15/20.</p><p class="mt-8">Retry available tomorrow.</p></div>';form.querySelector('button').disabled=true; }catch(err){alert(err.message);}
  });
}

async function init(){
  try{
    const data=await fetchCatalogue();
    const parts=pathParts();
    const allTopicIds=data.topics.map(t=>t.id);
    const progressMap=await loadProgress(allTopicIds);
    if(parts.length===0){renderHub(data,progressMap);return;}
    if(parts[0]!=='learning'){return;}
    if(parts.length===1){renderHub(data,progressMap);return;}
    const cat=data.categories.find(c=>c.slug===parts[1]); if(!cat){app.innerHTML='<div class="notice-band"><p>Category not found.</p></div>';return;}
    if(parts.length===2){renderCategory(data,cat,progressMap);return;}
    const topic=data.topics.find(t=>t.category_id===cat.id&&t.slug===parts[2]); if(!topic){app.innerHTML='<div class="notice-band"><p>Topic not found.</p></div>';return;}
    await renderTopic(data,cat,topic,progressMap.get(topic.id));
  }catch(e){app.innerHTML='<div class="notice-band"><p><strong>Learning unavailable.</strong></p><p class="muted mt-8">'+esc(e.message)+'</p></div>';}
}
init();