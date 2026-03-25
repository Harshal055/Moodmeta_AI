import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 1. Authenticate the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    console.log(`DELETION: Starting full wipe for user ${userId} (${user.email})`);

    // 2. Delete all user-related data from tables
    // We do this first so we don't have orphan records that fail RLS or causes issues
    // List of tables to scrub:
    const tables = [
      "chats",
      "mood_logs",
      "feedback",
      "wellness_logs",
      "user_challenges",
      "user_memories",
      "profiles", // Profile last as others might depend on it via FK
    ];

    for (const table of tables) {
      console.log(`DELETION: Scrubbing ${table}...`);
      const { error: scrubError } = await supabaseClient
        .from(table)
        .delete()
        .eq("user_id", userId);
      
      if (scrubError) {
        console.error(`DELETION: Error scrubbing ${table}:`, scrubError.message);
        // We continue anyway to try and delete as much as possible
      }
    }

    // 3. Delete the Auth User via Admin API
    console.log(`DELETION: Removing auth user...`);
    const { error: adminError } = await supabaseClient.auth.admin.deleteUser(userId);

    if (adminError) {
      console.error(`DELETION: Auth deletion failed:`, adminError.message);
      return new Response(JSON.stringify({ error: "Auth deletion failed", details: adminError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`DELETION: Success. User ${userId} fully removed.`);

    return new Response(JSON.stringify({ success: true, message: "Account fully deleted" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("DELETION: Fatal error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
