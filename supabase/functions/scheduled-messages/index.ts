import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import OpenAI from "npm:openai@4.28.0";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const openai = new OpenAI({ apiKey: openaiKey });

    // Find users who have a push_token and haven't chatted in the last 24 hours
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Get all profiles with a push token
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, companion_name, role, language, push_token")
      .not("push_token", "is", null);

    if (profilesError) throw profilesError;
    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No profiles with push tokens." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2. Batch-check recent activity: get user_ids who chatted in last 24h
    const { data: activeChats } = await supabase
      .from("chats")
      .select("user_id")
      .gte("created_at", cutoffTime);

    const activeUserIds = new Set(
      (activeChats ?? []).map((c: { user_id: string }) => c.user_id),
    );

    // Filter to only inactive users
    const inactiveProfiles = profiles.filter(
      (p) => !activeUserIds.has(p.user_id),
    );

    if (inactiveProfiles.length === 0) {
      return new Response(
        JSON.stringify({
          sent: 0,
          total: profiles.length,
          message: "All users active.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Generate personalized messages in parallel (batches of 10 to avoid rate limits)
    const BATCH_SIZE = 10;
    const pushMessages: Array<{
      to: string;
      title: string;
      body: string;
      sound: string;
      data: { screen: string };
    }> = [];

    for (let i = 0; i < inactiveProfiles.length; i += BATCH_SIZE) {
      const batch = inactiveProfiles.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (profile) => {
          const companionName = profile.companion_name || "Your companion";
          const role = profile.role || "friend";
          const language = profile.language || "Hinglish";

          const langInstruction =
            language.toLowerCase() === "hindi"
              ? "Respond in Hindi (Devanagari)."
              : language.toLowerCase() === "hinglish"
                ? "Mix Hindi and English naturally (Hinglish)."
                : "Respond in English.";

          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.9,
            max_tokens: 60,
            messages: [
              {
                role: "system",
                content: `You are ${companionName}, a ${role} texting your best friend on WhatsApp. ${langInstruction} Send ONE very short, warm, casual "thinking of you" message (max 15 words). No questions. Make it feel natural and human. Use 1-2 emojis max.`,
              },
              {
                role: "user",
                content: "Generate a short thinking-of-you message.",
              },
            ],
          });

          const aiMessage = completion.choices[0]?.message?.content?.trim();
          if (!aiMessage) return null;

          return {
            to: profile.push_token,
            title: companionName,
            body: aiMessage,
            sound: "default" as const,
            data: { screen: "chat" },
          };
        }),
      );

      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          pushMessages.push(result.value);
        } else if (result.status === "rejected") {
          console.error("❌ OpenAI generation failed:", result.reason);
        }
      }
    }

    // 4. Send all push notifications in one batched Expo Push API call
    if (pushMessages.length === 0) {
      return new Response(JSON.stringify({ sent: 0, total: profiles.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pushApiUrl = "https://exp.host/--/api/v2/push/send";
    const pushResponse = await fetch(pushApiUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pushMessages),
    });

    if (pushResponse.ok) {
      console.log(`✅ Batched push sent: ${pushMessages.length} notifications`);
    } else {
      const err = await pushResponse.text();
      console.error("❌ Batched push failed:", err);
    }

    return new Response(
      JSON.stringify({ sent: pushMessages.length, total: profiles.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("❌ Scheduled messages error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
