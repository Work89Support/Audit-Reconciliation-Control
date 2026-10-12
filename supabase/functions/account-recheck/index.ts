import { createClient } from 'npm:@supabase/supabase-js@2';
const headers={'Access-Control-Allow-Origin':'https://work89support.github.io','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Content-Type':'application/json','Cache-Control':'no-store'};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return response({});
 if(req.method!=='POST')return response({message:'Method not allowed'},405);
 try{
  const authorization=req.headers.get('Authorization');
  if(!authorization?.startsWith('Bearer '))return response({message:'ต้องเข้าสู่ระบบ'},401);
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
  const hook=Deno.env.get('ACCOUNT_RECHECK_WEBHOOK_URL'),secret=Deno.env.get('ACCOUNT_RECHECK_WEBHOOK_SECRET');
  // Fail before creating a queue row if the immediate worker is unavailable.
  if(!hook||!secret||!hook.startsWith('https://work8989.app.n8n.cloud/webhook/'))return response({message:'ยังไม่ได้ติดตั้ง Worker ตรวจเฉพาะบัญชี'},503);
  const db=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const b=await req.json();
  const {data:q,error}=await db.rpc('request_account_recheck',{
   p_company:b.company,p_date:b.date,p_account:b.account,p_direction:b.direction,p_mode:b.mode,p_request_key:b.requestKey,p_file_ids:b.fileIds||null
  });
  if(error)return response({message:error.message},400);
  const publicJob={id:q.id,company:q.company,business_date:q.business_date,account:q.account,direction:q.direction,mode:q.mode,status:q.status,revision:q.revision};
  if(q.status!=='queued')return response(publicJob);
  let dispatchError='';
  try{
   const dispatched=await fetch(hook,{method:'POST',headers:{'Content-Type':'application/json','X-Account-Recheck-Secret':secret},body:JSON.stringify({job_id:q.id}),signal:AbortSignal.timeout(15000)});
   if(!dispatched.ok)dispatchError='Worker ไม่รับงาน ('+dispatched.status+')';
  }catch{dispatchError='ยังยืนยันการส่งงานไม่ได้ ใช้ Request key เดิมเพื่อตรวจสถานะ ห้ามสั่งซ้ำด้วย key ใหม่';}
  // An unknown dispatch outcome is not a failed job: the worker may be running.
  return response({...publicJob,dispatch_error:dispatchError||null},202);
 }catch{return response({message:'ตรวจเฉพาะบัญชีไม่สำเร็จ กรุณาตรวจสถานะก่อนสั่งซ้ำ'},500);}
});
