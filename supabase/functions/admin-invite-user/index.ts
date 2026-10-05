import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ message: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Edge Function ยังไม่มีค่า SUPABASE_URL หรือ SERVICE_ROLE_KEY");

    const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ message: "กรุณาเข้าสู่ระบบก่อน" }, 401);

    /* service_role ใช้เฉพาะใน Edge Function และไม่ถูกส่งกลับไปยัง browser */
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ message: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่" }, 401);

    const { data: caller, error: callerError } = await admin
      .from("app_profiles")
      .select("role,active,email")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (callerError) throw callerError;
    if (!caller?.active || caller.role !== "admin") return json({ message: "เฉพาะผู้ดูแลระบบเท่านั้น" }, 403);

    const body = await request.json().catch(() => ({}));
    const usernameMode = body.login_mode === 'username';
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (usernameMode && !/^[a-z][a-z0-9_.-]{2,31}$/.test(username)) return json({message:'ชื่อผู้ใช้ต้องเป็นอังกฤษ 3–32 ตัว เริ่มด้วยตัวอักษร ใช้ตัวเลข _ . - ได้'},400);
    if (usernameMode && (password.length < 9 || password.length > 128 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password))) return json({message:'รหัสผ่านต้องยาว 9–128 ตัว มีตัวอักษรและตัวเลข'},400);
    const email = usernameMode ? `${username}@users.audit.invalid` : String(body.email || "").trim().toLowerCase();
    if (!usernameMode && email.endsWith('@users.audit.invalid')) return json({message:'บัญชีภายในต้องสร้างด้วยโหมดชื่อผู้ใช้'},400);
    const fullName = String(body.full_name || "").trim();
    const role = String(body.role || "monitor");
    const active = body.active !== false;
    const allowedRoles = new Set(["monitor", "audit_assistant", "lead", "shift_lead", "exec", "admin"]);
    const companies = [...new Set(
      (Array.isArray(body.companies) ? body.companies : [])
        .map((value: unknown) => String(value || "").trim().toUpperCase())
        .filter(Boolean),
    )];
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ message: "รูปแบบอีเมลไม่ถูกต้อง" }, 400);
    if (!fullName) return json({ message: "กรุณากรอกชื่อที่แสดง" }, 400);
    if (!allowedRoles.has(role)) return json({ message: "บทบาทไม่ถูกต้อง" }, 400);
    if ((usernameMode || role==='audit_assistant') && ['monitor','audit_assistant','shift_lead'].includes(role) && !companies.length) return json({message:'เลือกบริษัทที่รับผิดชอบก่อนสร้างบัญชี'},400);
    if ((usernameMode || role==='audit_assistant') && companies.includes('*')) return json({message:'เลือกบริษัทเป็นรายบริษัท ไม่ใช้สิทธิ์ *'},400);
    if ((usernameMode || role==='audit_assistant') && companies.length) {
      const {data:known,error} = await admin.from('audit_company_file_rules').select('company');
      if(error) throw error;
      if(companies.some(c=>!known?.some(row=>row.company===c))) return json({message:'บริษัทที่เลือกไม่อยู่ในทะเบียน'},400);
    }

    let targetUser = null;
    for (let page = 1; page <= 10 && !targetUser; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      targetUser = data.users.find((user) => String(user.email || "").toLowerCase() === email) || null;
      if (data.users.length < 1000) break;
    }

    let invited = false;
    if (usernameMode && targetUser) return json({message:'ชื่อผู้ใช้นี้มีอยู่แล้ว ไม่เปลี่ยนรหัสผ่านหรือสิทธิ์เดิม'},409);
    if (!targetUser) {
      const redirectTo = Deno.env.get("AUDIT_APP_URL") || undefined;
      const { data, error } = usernameMode ? await admin.auth.admin.createUser({
        email,password,email_confirm:true,user_metadata:{full_name:fullName,username},
      }) : await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { full_name: fullName },
      });
      if (error) throw error;
      targetUser = data.user;
      invited = !usernameMode;
    }
    if (!targetUser) throw new Error("สร้างบัญชีผู้ใช้ไม่สำเร็จ");

    const { error: profileError } = await admin.from("app_profiles").upsert({
      user_id: targetUser.id,
      email,
      full_name: fullName,
      role,
      active: usernameMode ? false : active,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (profileError) throw profileError;

    const { error: clearError } = await admin.from("user_company_access").delete().eq("user_id", targetUser.id);
    if (clearError) throw clearError;
    if (companies.length) {
      const { error: accessError } = await admin.from("user_company_access").insert(
        companies.map((company) => ({ user_id: targetUser.id, company })),
      );
      if (accessError) throw accessError;
    }

    if (usernameMode) {
      const {error} = await admin.from('app_profiles').update({active}).eq('user_id',targetUser.id);
      if(error) throw error;
    }

    await admin.from("audit_log").insert({
      actor: caller.email || authData.user.email || authData.user.id,
      actor_user_id: authData.user.id,
      action: usernameMode ? 'create_username' : invited ? "invite" : "update",
      entity: "user_access",
      target: email,
      detail: `${role} · ${companies.join(", ") || "ทุกบริษัทตามบทบาท"}`,
    });

    return json({ ok: true, invited, user_id: targetUser.id, email, ...(usernameMode ? {username} : {}) });
  } catch (error) {
    console.error("admin-invite-user", error);
    return json({ message: error instanceof Error ? error.message : "เพิ่มผู้ใช้ไม่สำเร็จ" }, 400);
  }
});
