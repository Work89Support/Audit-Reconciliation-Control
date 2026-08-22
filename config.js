/* Public production configuration.
   The publishable key is designed for browser use. Database access remains
   protected by Supabase Auth and Row Level Security (RLS). Never put a secret
   or service_role key in this file. */
window.APP_CONFIG = Object.freeze({
  environment: "production",
  supabaseUrl: "https://xiglllwmdotwyrcpycao.supabase.co",
  supabasePublishableKey: "sb_publishable_lQYH2b2Ekv2eyFk99a8BTQ_gZysqfTD",
  storageBucket: "audit-files",
  defaultRoute: "cloud",
  defaultRole: "lead",
  roleByEmail: Object.freeze({
    "work.ltd89@gmail.com": "admin",
  }),
});
