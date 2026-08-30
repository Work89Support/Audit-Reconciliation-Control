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
    const email = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.full_name || "").trim();
    const role = String(body.role || "monitor");
    const active = body.active !== false;
    const allowedRoles = new Set(["monitor", "lead", "shift_lead", "exec", "admin"]);
    const companies = [...new Set(
      (Array.isArray(body.companies) ? body.companies : [])
        .map((value: unknown) => String(value || "").trim().toUpperCase())
        .filter(Boolean),
    )];
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ message: "รูปแบบอีเมลไม่ถูกต้อง" }, 400);
    if (!fullName) return json({ message: "กรุณากรอกชื่อที่แสดง" }, 400);
    if (!allowedRoles.has(role)) return json({ message: "บทบาทไม่ถูกต้อง" }, 400);

    let targetUser = null;
    for (let page = 1; page <= 10 && !targetUser; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      targetUser = data.users.find((user) => String(user.email || "").toLowerCase() === email) || null;
      if (data.users.length < 1000) break;
    }

    let invited = false;
    if (!targetUser) {
      const redirectTo = Deno.env.get("AUDIT_APP_URL") || undefined;
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { full_name: fullName },
      });
      if (error) throw error;
      targetUser = data.user;
      invited = true;
    }
    if (!targetUser) throw new Error("สร้างบัญชีผู้ใช้ไม่สำเร็จ");

    const { error: profileError } = await admin.from("app_profiles").upsert({
      user_id: targetUser.id,
      email,
      full_name: fullName,
      role,
      active,
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

    await admin.from("audit_log").insert({
      actor: caller.email || authData.user.email || authData.user.id,
      actor_user_id: authData.user.id,
      action: invited ? "invite" : "update",
      entity: "user_access",
      target: email,
      detail: `${role} · ${companies.join(", ") || "ทุกบริษัทตามบทบาท"}`,
    });

    return json({ ok: true, invited, user_id: targetUser.id, email });
  } catch (error) {
    console.error("admin-invite-user", error);
    return json({ message: error instanceof Error ? error.message : "เพิ่มผู้ใช้ไม่สำเร็จ" }, 400);
  }
});
