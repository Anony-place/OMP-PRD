import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from 'jsr:@supabase/supabase-js@2/cors';

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'content-type':'application/json'}});
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  try{
    const id=new URL(req.url).searchParams.get('certificate_id')?.trim()||'';
    if(!/^OMP-[A-Z0-9]{24}$/.test(id)) return json({error:'Invalid certificate ID.'},400);
    const url=Deno.env.get('SUPABASE_URL')||'';
    const secret=Deno.env.get('SUPABASE_SECRET_KEYS') ? JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!).default : (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'');
    const admin=createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data,error}=await admin.from('learning_certificates').select('certificate_id,recipient_name,topic_name,category_name,score,issued_at').eq('certificate_id',id).maybeSingle();
    if(error) throw error;
    if(!data) return json({error:'Certificate not found.'},404);
    return json({valid:true,certificate:data});
  }catch(error){console.error('learning-certificate-verify',error);return json({error:'Verification failed.'},500);}
});