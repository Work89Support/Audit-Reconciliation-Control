import {createClient} from 'npm:@supabase/supabase-js@2';
const headers={'Access-Control-Allow-Origin':'https://work89support.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return reply({});if(req.method!=='POST')return reply({message:'Method not allowed'},405);
 try{
  const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');if(!token)return reply({message:'ต้องเข้าสู่ระบบ'},401);
  const server=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const {data:identity,error}=await server.auth.getUser(token);if(error||!identity.user)return reply({message:'Session หมดอายุ'},401);
  const b=await req.json(),password=String(b.password||'');
  if(password.length<9||password.length>128||!/[a-z]/i.test(password)||!/[0-9]/.test(password))return reply({message:'รหัสผ่าน 9–128 ตัว มีตัวอักษรและตัวเลข'},400);
  if(b.action==='change_first'){
   // getUser above verifies this JWT; use its session identity only after that verification.
   const encoded=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
   const claims=JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length/4)*4,'=')));
   const {data:gate,error:gateError}=await server.rpc('password_gate_context',{p_user:identity.user.id,p_password:password,p_session:claims.session_id});if(gateError)return reply({message:gateError.message},409);
   const updated=await server.auth.admin.updateUserById(identity.user.id,{password});if(updated.error)return reply({message:'ตั้งรหัสใหม่ไม่สำเร็จ บัญชียังไม่เปิดข้อมูล'},409);
   const {error:finishError}=await server.rpc('finish_first_password',{p_user:identity.user.id,p_operation:gate.operation_id});
   if(finishError)return reply({message:'ตั้งรหัสแล้วแต่ยังเปิดบัญชีไม่ได้ ให้ Admin ตรวจ ไม่เปลี่ยนรหัสซ้ำ'},409);
   return reply({ok:true});
  }
  if(!['create','reset'].includes(b.action)||!b.reviewed)return reply({message:'ต้องทบทวนข้อมูลก่อนดำเนินการ'},400);
  const {data:op,error:opError}=await server.rpc('begin_password_account',{p_id:b.request_key,p_actor:identity.user.id,p_email:String(b.email||'').trim().toLowerCase(),p_action:b.action,p_name:String(b.full_name||'').trim(),p_companies:b.companies,p_reason:b.reason});
  if(opError)return reply({message:opError.message},403);if(op.replayed)return reply({ok:true,replayed:true,user_id:op.user_id,sent_email:false});
  const result=b.action==='create'?await server.auth.admin.createUser({email:String(b.email).trim().toLowerCase(),password,email_confirm:true,user_metadata:{full_name:b.full_name}}):await server.auth.admin.updateUserById(op.user_id,{password});
  if(result.error||!result.data.user)return reply({message:'ยังยืนยันผลไม่ได้ ให้ Admin ตรวจคำขอ '+b.request_key+' ก่อนทำซ้ำ'},409);
  const {data:saved,error:saveError}=await server.rpc('finish_password_account',{p_id:b.request_key,p_user:result.data.user.id});
  if(saveError)return reply({message:'ตั้งบัญชี/รหัสแล้ว แต่สิทธิ์ยังถูกล็อก ให้ตรวจคำขอ '+b.request_key+' ไม่สร้าง/รีเซ็ตซ้ำ'},409);
  return reply(saved);
 }catch{return reply({message:'ยังยืนยันผลไม่ได้ ให้ตรวจคำขอเดิมก่อนทำซ้ำ'},500);}
});
