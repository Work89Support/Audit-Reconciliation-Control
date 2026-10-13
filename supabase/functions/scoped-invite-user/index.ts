import {createClient} from 'npm:@supabase/supabase-js@2';
const headers={'Access-Control-Allow-Origin':'https://work89support.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return reply({});if(req.method!=='POST')return reply({message:'Method not allowed'},405);
 try{
  const authorization=req.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))return reply({message:'ต้องเข้าสู่ระบบ'},401);
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const db=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
  const server=createClient(url,key,{auth:{persistSession:false}});
  const {data:identity,error:identityError}=await db.auth.getUser();if(identityError||!identity.user)return reply({message:'Session หมดอายุ'},401);
  const b=await req.json(),usernameMode=b.login_mode==='username',username=String(b.username||'').trim().toLowerCase(),password=String(b.password||'');
  if(usernameMode&&(!/^[a-z][a-z0-9_.-]{2,31}$/.test(username)||password.length<9||password.length>128||!/[a-z]/i.test(password)||!/[0-9]/.test(password)))return reply({message:'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'},400);
  const email=usernameMode?username+'@users.audit.invalid':String(b.email||'').trim().toLowerCase();
  if(!usernameMode&&email.endsWith('@users.audit.invalid'))return reply({message:'บัญชีภายในต้องใช้โหมดชื่อผู้ใช้'},400);
  const companies=[...new Set((Array.isArray(b.companies)?b.companies:[]).map((c:unknown)=>String(c).trim().toUpperCase()))].sort();
  const {data:ticket,error}=await db.rpc('prepare_scoped_user_invite',{p_request_key:b.request_key,p_email:email,p_name:b.full_name,p_role:b.role,p_companies:companies,p_active:b.active!==false,p_reason:b.reason});
  if(error)return reply({message:error.message},403);
  if(ticket.status==='completed')return reply({ok:true,user_id:ticket.new_user_id,replayed:true});
  const {data:claimed,error:claimError}=await server.rpc('claim_scoped_user_invite',{p_ticket:ticket.id});
  if(claimError)return reply({message:claimError.message},409);
  if(claimed.status==='completed')return reply({ok:true,user_id:claimed.new_user_id,replayed:true});
  // The claim is single-use. Never overwrite an existing Auth user or trust role metadata.
  const created=usernameMode?await server.auth.admin.createUser({email:claimed.email,password,email_confirm:true,user_metadata:{full_name:claimed.full_name,username}}):await server.auth.admin.inviteUserByEmail(claimed.email,{redirectTo:Deno.env.get('AUDIT_APP_URL')||undefined,data:{full_name:claimed.full_name}});
  if(created.error||!created.data.user)return reply({message:'สร้าง/ส่งคำเชิญไม่สำเร็จ หรืออีเมลมีอยู่แล้ว ให้ Admin ตรวจคำขอ '+ticket.id+' ก่อนส่งซ้ำ'},409);
  const {data:saved,error:saveError}=await server.rpc('finish_scoped_user_invite',{p_ticket:ticket.id,p_user:created.data.user.id});
  if(saveError)return reply({message:'สร้างบัญชีแล้วแต่ยังไม่เปิดสิทธิ์: '+saveError.message+' · ให้ Admin ตรวจคำขอ '+ticket.id+' ไม่ส่งซ้ำ'},409);
  return reply({...saved,invited:!usernameMode});
 }catch{return reply({message:'ยังยืนยันผลสร้างผู้ใช้ไม่ได้ กรุณาให้ Admin ตรวจคำขอก่อนส่งซ้ำ'},500);}
});
