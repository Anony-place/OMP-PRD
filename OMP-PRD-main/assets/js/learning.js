import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.115.0';

const SUPABASE_URL = 'https://aeehfulikupskyrvcpzb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'omp-learning-auth' }
});

const app = document.querySelector('#learning-app');
const registry = window.OMPLearningData || { categories: [], defaultLessonSections: [] };
const esc = (v='') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const parts = () => location.pathname.split('/').filter(Boolean).map(decodeURIComponent);

function registryCategory(slug) { return registry.categories.find(c => c.slug === slug); }
function registryTopic(categorySlug, topicSlug) {
  const c = registryCategory(categorySlug);
  const x = c?.topics.find(t => t[0] === topicSlug);
  return x ? { slug:x[0], name:x[1], description:x[2], difficulty:x[3], estimated_minutes:x[4], category:c } : null;
}

async function getUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user || null;
}

async function catalogue() {
  const [{data:cats,error:a},{data:topics,error:b},{data:labs,error:c},{data:quizzes,error:d}] = await Promise.all([
    supabase.from('learning_categories').select('id,slug,name,description,sort_order').eq('is_active',true).order('sort_order'),
    supabase.from('learning_topics').select('id,category_id,slug,name,description,difficulty,estimated_minutes,sort_order,content').eq('status','published').order('sort_order'),
    supabase.from('learning_labs').select('id,topic_id,title,provider,url,description,sort_order').eq('is_active',true).order('sort_order'),
    supabase.from('learning_quizzes').select('id,topic_id,passing_score,max_score,questions')
  ]);
  const err = a||b||c||d;
  if (err) throw err;
  const categories = (cats||[]).map(x => ({...x, topics:[]}));
  const byId = new Map(categories.map(x => [x.id,x]));
  for (const t of topics||[]) byId.get(t.category_id)?.topics.push(t);
  return {categories, topics:topics||[], labs:labs||[], quizzes:quizzes||[]};
}

async function progressFor(topicIds) {
  const user = await getUser();
  if (!user || !topicIds.length) return new Map();
  const {data,error} = await supabase.from('learning_progress').select('*').eq('user_id',user.id).in('topic_id',topicIds);
  if (error) throw error;
  return new Map((data||[]).map(x => [x.topic_id,x]));
}

function state(p) {
  if (!p) return 'NOT_STARTED';
  if (p.passed) return 'PASSED';
  if (p.next_retry_at && new Date(p.next_retry_at) > new Date()) return 'RETRY_LOCKED';
  if (p.lesson_completed && !p.lab_completed) return 'LAB_PENDING';
  if (p.lab_completed) return 'QUIZ_AVAILABLE';
  if (p.lesson_started) return 'IN_PROGRESS';
  return 'NOT_STARTED';
}

function topicRegistryCategory(topic) {
  return registry.categories.find(c => c.topics.some(t => t[0] === topic.slug));
}

function localProgress(topic) {
  return {topic_id:topic.id, category_id:topic.category_id, lesson_started:false, lesson_completed:false, lab_completed:false,
    quiz_attempts:0, highest_score:0, passed:false, state:'NOT_STARTED', completed_at:null, next_retry_at:null, last_attempt_at:null};
}

async function mutateProgress(topic, action) {
  const user = await getUser();
  if (!user) return {user:null, progress:null};
  const {data,error} = await supabase.functions.invoke('learning-progress', { body:{action, topic_id:topic.id} });
  if (error) throw error;
  return {user, progress:data.progress || null};
}

function categoryCard(c, pmap) {
  const total=c.topics.length, done=c.topics.filter(t => state(pmap.get(t.id))==='PASSED').length;
  const pct=total ? Math.round(done/total*100) : 0;
  const next=c.topics.find(t => state(pmap.get(t.id))!=='PASSED');
  return '<a class="card card-pad learning-card" href="/learning/'+esc(c.slug)+'">'+
    '<div class="flex justify-between gap-12"><span class="card-icon" aria-hidden="true">▤</span><span class="badge badge-demo">'+total+' Lessons</span></div>'+
    '<h2>'+esc(c.name)+'</h2><p>'+esc(c.description||'')+'</p>'+
    '<div class="learning-progress-head"><span>'+done+' / '+total+' Completed</span><strong>'+pct+'%</strong></div>'+
    '<div class="progress-track" role="progressbar" aria-valuenow="'+pct+'" aria-valuemin="0" aria-valuemax="100" aria-label="'+pct+'% complete"><span style="width:'+pct+'%"></span></div>'+
    '<span class="btn btn-secondary btn-sm mt-16">'+(next?'Continue':'Review')+' →</span></a>';
}

function topicCard(t,p,index) {
  const s=state(p), labels={NOT_STARTED:'Not Started',IN_PROGRESS:'In Progress',LAB_PENDING:'Lab Pending',QUIZ_AVAILABLE:'Quiz Available',PASSED:'Completed',RETRY_LOCKED:'Retry Locked'};
  const c=topicRegistryCategory(t);
  return '<a class="card card-pad learning-topic state-'+s.toLowerCase()+'" href="/learning/'+esc(c?.slug||'')+'/'+esc(t.slug)+'">'+
    '<div class="topic-index">'+String(index).padStart(2,'0')+'</div>'+
    '<div class="topic-body"><div class="flex justify-between gap-12 wrap"><h2>'+esc(t.name)+'</h2><span class="badge '+(s==='PASSED'?'badge-live':'badge-demo')+'">'+labels[s]+'</span></div>'+
    '<p>'+esc(t.description||'')+'</p><div class="topic-meta"><span>'+esc(t.difficulty)+'</span><span>•</span><span>'+t.estimated_minutes+' min</span></div></div>'+
    '<span class="topic-arrow" aria-hidden="true">→</span></a>';
}

function renderHub(data,pmap) {
  const done=[...pmap.values()].filter(p => p.passed).length;
  const pct=data.topics.length ? Math.round(done/data.topics.length*100) : 0;
  app.innerHTML='<div class="learning-summary card card-pad"><div><span class="eyebrow">Security Academy</span><h2 class="h-2">Your learning progress</h2><p class="muted">Overall completion across the academy.</p></div><div class="learning-summary-stat"><strong>'+pct+'%</strong><span>complete</span></div></div>'+
    '<div class="grid grid-3 mt-24">'+data.categories.map(c=>categoryCard(c,pmap)).join('')+'</div>';
}

function renderCategory(data,cat,pmap) {
  const total=cat.topics.length, done=cat.topics.filter(t=>state(pmap.get(t.id))==='PASSED').length, pct=total?Math.round(done/total*100):0;
  app.innerHTML='<div class="learning-breadcrumb"><a href="/learning">Learning</a><span>/</span><strong>'+esc(cat.name)+'</strong></div>'+
    '<div class="page-hero compact"><div><span class="chip chip-accent">Category</span><h1 class="h-1 mt-16">'+esc(cat.name)+'</h1><p class="lead">'+esc(cat.description||'')+'</p></div>'+
    '<div class="category-progress card card-pad"><strong>'+done+'/'+total+'</strong><span>completed</span><div class="progress-track"><span style="width:'+pct+'%"></span></div><small>'+pct+'%</small></div></div>'+
    '<div class="learning-list mt-24">'+cat.topics.map((t,i)=>topicCard(t,pmap.get(t.id),i+1)).join('')+'</div>';
}

function lessonContent(topic) {
  const db = topic.content || {};
  const renderBlock = (value, fallback) => {
    if (Array.isArray(value)) return '<ul>' + value.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
    return value ? '<p>' + esc(value) + '</p>' : fallback;
  };
  const base = {
    overview: renderBlock(db.overview, ''),
    how: renderBlock(db.how_it_works, ''),
    history: renderBlock(db.history, ''),
    real: renderBlock(db.real_world, ''),
    look: renderBlock(db.what_to_look_for, ''),
    defensive: renderBlock(db.defensive, ''),
  };
  return {...base, labs:'<p>Practice only on systems you own or are explicitly authorized to test.</p>'};
}

function quizView(quiz,p) {
  if (!quiz) return '<p>Quiz is being prepared.</p>';
  if (p.next_retry_at && new Date(p.next_retry_at)>new Date() && !p.passed) {
    return '<div class="notice-band"><p><strong>NOT PASSED</strong></p><p class="muted mt-8">Minimum passing score is 15/20.</p><p class="mt-8">Retry available '+esc(new Date(p.next_retry_at).toLocaleString())+'.</p></div>';
  }
  const qs=Array.isArray(quiz.questions)?quiz.questions.slice(0,4):[];
  if(qs.length!==4) return '<div class="notice-band"><p>Quiz content must contain exactly 4 questions.</p></div>';
  return '<form id="academy-quiz" class="quiz-form"><p class="muted">4 questions × 5 marks = 20 marks. Passing score: 15/20.</p>'+
    qs.map((q,i)=>'<fieldset class="card card-pad quiz-question"><legend><span class="topic-index">'+String(i+1).padStart(2,'0')+'</span> '+esc(q.question)+'</legend><div class="quiz-options">'+
    (q.options||[]).map((o,j)=>'<label class="quiz-option"><input type="radio" name="q'+i+'" value="'+j+'" required><span>'+esc(o)+'</span></label>').join('')+'</div></fieldset>').join('')+
    '<button class="btn btn-primary" type="submit">Submit quiz</button></form><div id="quiz-result"></div>';
}

function nextDay(){ return new Date(Date.now()+24*60*60*1000).toISOString(); }

async function renderTopic(data,cat,topic,p) {
  const user=await getUser();
  p=p ? {...p} : localProgress(topic);
  const labs=data.labs.filter(x=>x.topic_id===topic.id), quiz=data.quizzes.find(x=>x.topic_id===topic.id), c=lessonContent(topic);
  const sections=[
    ['01','Overview',c.overview],['02','How It Works',c.how],['03','History / Background',c.history],
    ['04','Real-World Examples',c.real],['05','What To Look For',c.look],['06','Defensive Perspective',c.defensive],
    ['07','Legal Practice Labs',c.labs+'<div class="labs-grid mt-16">'+
      (labs.length?labs.map(l=>'<div class="card card-pad"><div class="flex justify-between gap-12"><strong>'+esc(l.title)+'</strong><span class="badge badge-live">'+esc(l.provider)+'</span></div><p class="mt-8">'+esc(l.description||'')+'</p><a class="btn btn-secondary btn-sm mt-16" href="'+esc(l.url)+'" target="_blank" rel="noopener noreferrer">Open Lab ↗</a><button class="btn btn-primary btn-sm mt-16" data-lab-complete>Mark lab complete</button></div>').join(''):'<div class="notice-band"><p>No authorized lab resources published yet for this topic.</p></div>')+
      '</div>'],
    ['08','Knowledge Quiz',quizView(quiz,p)]
  ];
  const st=state(p);
  app.innerHTML='<div class="learning-breadcrumb"><a href="/learning">Learning</a><span>/</span><a href="/learning/'+esc(cat.slug)+'">'+esc(cat.name)+'</a><span>/</span><strong>'+esc(topic.name)+'</strong></div>'+
    '<div class="page-hero compact"><div><span class="chip chip-accent">'+esc(topic.difficulty)+' · '+topic.estimated_minutes+' min</span><h1 class="h-1 mt-16">'+esc(topic.name)+'</h1><p class="lead">'+esc(topic.description||'')+'</p></div>'+
    '<div class="card card-pad topic-state-panel"><span class="subhead-sm">Current state</span><strong>'+esc(st.replaceAll('_',' '))+'</strong><span class="muted">Sign in to persist progress.</span></div></div>'+
    '<div class="lesson-layout mt-24"><aside class="toc card card-pad"><div class="subhead-sm">Lesson</div><ul role="list">'+sections.map(s=>'<li><a href="#s-'+s[0]+'">'+s[0]+' — '+esc(s[1])+'</a></li>').join('')+'</ul></aside>'+
    '<article class="prose learning-prose">'+sections.map(s=>'<section id="s-'+s[0]+'"><h2>'+esc(s[1])+'</h2>'+s[2]+'</section>').join('')+'</article></div>';
  
  if(user && !p.lesson_started) {
    try { await mutateProgress(topic,'start_lesson'); } catch(e) {}
  }
  
  document.querySelectorAll('[data-lab-complete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const u=await getUser();
      if(!u) { app.querySelector('.topic-state-panel .muted').textContent='Sign in to persist progress.'; return; }
      btn.disabled=true;
      try { await mutateProgress(topic,'complete_lab'); btn.textContent='Lab completed ✓'; }
      catch(e) { btn.disabled=false; if(window.ompToast) window.ompToast('Could not save progress'); }
    });
  });

  const form=document.querySelector('#academy-quiz');
  if(form && quiz) form.addEventListener('submit', async e => {
    e.preventDefault();
    const u=await getUser();
    if(!u) { document.querySelector('#quiz-result').innerHTML='<div class="notice-band"><p>Sign in to save quiz results and unlock completion.</p></div>'; return; }
    if(p.next_retry_at && new Date(p.next_retry_at)>new Date() && !p.passed) return;
    const answers=quiz.questions.slice(0,4).map((_,i)=>{
      const input=form.querySelector('input[name="q'+i+'"]:checked');
      return input ? Number(input.value) : -1;
    });
    try {
      const {data:result,error:fnError}=await supabase.functions.invoke('learning-quiz-submit',{body:{topic_id:topic.id,answers}});
      if(fnError) throw fnError;
      form.querySelector('button[type="submit"]').disabled=true;
      if(result.status==='PASSED') {
        const cert=result.certificate;
        const certUrl=cert ? '/certificate?id='+encodeURIComponent(cert.certificate_id) : '';
        document.querySelector('#quiz-result').innerHTML='<div class="notice-band callout-tip"><p><strong>Score: '+result.score+' / 20 — PASSED ✓</strong></p><p class="mt-8">Topic completed. Your OMP Security Academy certificate is ready.</p><div class="flex gap-8 wrap mt-16">'+
          (cert ? '<a class="btn btn-primary btn-sm" href="'+esc(certUrl)+'">View Certificate</a><button class="btn btn-secondary btn-sm" type="button" id="share-certificate" data-cert-url="'+esc(certUrl)+'">Share Achievement</button>' : '')+
          '<a class="btn btn-secondary btn-sm" href="/learning/'+esc(cat.slug)+'">Back to category</a></div>'+
          '<div id="share-note" class="small muted mt-8"></div></div>';
        const shareBtn=document.querySelector('#share-certificate');
        if(shareBtn) shareBtn.addEventListener('click',async()=>{
          const url=new URL(shareBtn.dataset.certUrl,location.origin).href;
          const shareData={title:'OMP Security Academy Certificate',text:'I completed '+topic.name+' on OopsMyPassword Security Academy.',url};
          try{
            if(navigator.share) await navigator.share(shareData);
            else { await navigator.clipboard.writeText(url); document.querySelector('#share-note').textContent='Certificate link copied to clipboard.'; }
          }catch(_){}
        });
      } else if(result.status==='RETRY_LOCKED') {
        document.querySelector('#quiz-result').innerHTML='<div class="notice-band callout-warn"><p><strong>Score: '+result.score+' / 20 — NOT PASSED</strong></p><p class="mt-8">Minimum passing score is 15/20.</p><p class="mt-8">Retry available tomorrow.</p></div>';
        form.querySelector('button[type="submit"]').disabled=true;
      }
    } catch(err) {
      document.querySelector('#quiz-result').innerHTML='<div class="notice-band"><p>Could not submit quiz. Please try again.</p></div>';
      form.querySelector('button[type="submit"]').disabled=false;
    }
  });
}

async function renderCertificate(certificateId) {
  app.innerHTML='<div class="certificate-shell card card-pad"><span class="chip chip-accent">OMP Security Academy</span><h1 class="h-1 mt-16">Certificate of Completion</h1><p class="lead">Verifiable learning achievement</p><div id="certificate-content" class="mt-24"><p class="muted">Verifying certificate…</p></div></div>';
  try {
    const endpoint=SUPABASE_URL+'/functions/v1/learning-certificate-verify?certificate_id='+encodeURIComponent(certificateId);
    const response=await fetch(endpoint,{headers:{'apikey':SUPABASE_PUBLISHABLE_KEY}});
    const result=await response.json();
    if(!response.ok || !result.valid) throw new Error(result.error||'Certificate not found.');
    const c=result.certificate;
    const url=location.href;
    document.title='Certificate — '+c.topic_name+' — OopsMyPassword';
    document.querySelector('#certificate-content').innerHTML=
      '<div class="certificate-seal">✓</div><div class="certificate-name">'+esc(c.recipient_name)+'</div>'+
      '<p class="muted mt-8">has successfully completed</p><h2 class="h-2 mt-8">'+esc(c.topic_name)+'</h2>'+
      '<p class="muted mt-8">'+esc(c.category_name)+' · Score '+esc(c.score)+' / 20</p>'+
      '<div class="certificate-meta mt-24"><span>Certificate ID <strong class="mono">'+esc(c.certificate_id)+'</strong></span><span>Issued '+esc(new Date(c.issued_at).toLocaleDateString())+'</span></div>'+
      '<div class="flex gap-8 wrap mt-24"><button class="btn btn-primary btn-sm" id="share-cert">Share Certificate</button><a class="btn btn-secondary btn-sm" href="/learning">Back to Academy</a></div><p id="cert-share-note" class="small muted mt-8"></p>';
    document.querySelector('#share-cert').addEventListener('click',async()=>{
      try {
        if(navigator.share) await navigator.share({title:'OMP Security Academy Certificate',text:c.recipient_name+' completed '+c.topic_name,url});
        else {await navigator.clipboard.writeText(url);document.querySelector('#cert-share-note').textContent='Certificate link copied.';}
      } catch(_){}
    });
  } catch(e) {
    app.innerHTML='<div class="notice-band"><p><strong>Certificate not found.</strong></p><p class="muted mt-8">'+esc(e.message||'Unable to verify certificate')+'</p><p class="mt-16"><a class="btn btn-secondary btn-sm" href="/learning">Back to Academy</a></p></div>';
  }
}

async function init() {
  const certId=new URLSearchParams(location.search).get('certificate');
  if(location.pathname==='/certificate' && certId) return renderCertificate(certId);
  try {
    const data=await catalogue();
    const p=parts();
    const pmap=await progressFor(data.topics.map(t=>t.id));
    if(!p.length || p[0]==='learning' && p.length===1) return renderHub(data,pmap);
    if(p[0]!=='learning') return;
    const cat=data.categories.find(c=>c.slug===p[1]);
    if(!cat) return app.innerHTML='<div class="notice-band"><p>Category not found.</p></div>';
    if(p.length===2) return renderCategory(data,cat,pmap);
    const topic=data.topics.find(t=>t.category_id===cat.id && t.slug===p[2]);
    if(!topic) return app.innerHTML='<div class="notice-band"><p>Topic not found.</p></div>';
    await renderTopic(data,cat,topic,pmap.get(topic.id));
  } catch(e) {
    app.innerHTML='<div class="notice-band"><p><strong>Learning unavailable.</strong></p><p class="muted mt-8">'+esc(e.message||'Unable to load academy')+'</p></div>';
  }
}
init();