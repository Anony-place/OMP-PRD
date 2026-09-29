import { createClient } from "npm:@supabase/supabase-js@2.115.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.115.0/cors";
import { envKey } from "../_shared/academy-env.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed." }, 405);
  try {
    const id =
      new URL(req.url).searchParams.get("certificate_id")?.trim() || "";
    if (!/^OMP-[A-Z0-9]{24}$/.test(id))
      return json({ error: "Invalid certificate ID." }, 400);
    const url = Deno.env.get("SUPABASE_URL") || "";
    const secret = envKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(url, secret, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await admin
      .from("learning_certificates")
      .select(
        "certificate_id,recipient_name,topic_name,category_name,course_name,score,issued_at",
      )
      .eq("certificate_id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return json({ error: "Certificate not found." }, 404);
    return json({ valid: true, certificate: data });
  } catch (error) {
    console.error("learning-certificate-verify", error);
    return json({ error: "Verification failed." }, 500);
  }
});
