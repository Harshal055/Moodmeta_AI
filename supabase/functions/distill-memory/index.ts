import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const openai = new OpenAI({
      apiKey: Deno.env.get("OPENAI_API_KEY"),
    });

    // 1. Authenticate (optional but good practice for invoking via client)
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

    // 2. Fetch recent chat history
    console.log(`MEMORY: Distilling context for user ${userId}`);
    const { data: messages, error: chatError } = await supabaseClient
      .from("chats")
      .select("message, is_from_ai, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (chatError || !messages || messages.length === 0) {
      return new Response(JSON.stringify({ message: "No history to distill" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Format history for AI
    const historyText = messages
      .reverse()
      .map(m => `${m.is_from_ai ? "Companion" : "User"}: ${m.message}`)
      .join("\n");

    // 4. Request distillation from OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a memory distillation module for a companion AI. Your job is to extract long-term facts, interests, and emotional patterns from the provided chat history.
          Return a JSON object with the following fields:
          - interests (array of strings)
          - favorite_topics (array of strings)
          - life_events (array of strings - e.g. "started new job", "went to gym")
          - preferred_tone (string, e.g. "encouraging", "playful", "gentle")
          - summary (brief 1-sentence summary of the user's current vibe)
          
          Focus on facts shared by the User. If information is missing, use empty arrays. Format interests and topics concisely.`,
        },
        {
          role: "user",
          content: historyText,
        },
      ],
      response_format: { type: "json_object" },
    });

    const distillation = JSON.parse(response.choices[0].message.content || "{}");

    // 5. Update user_memories table
    const { error: memoryError } = await supabaseClient
      .from("user_memories" as any)
      .upsert({
        user_id: userId,
        interests: distillation.interests,
        favorite_topics: distillation.favorite_topics,
        recent_events: distillation.life_events,
        preferred_tone: distillation.preferred_tone,
        last_updated: new Date().toISOString(),
      });

    if (memoryError) throw memoryError;

    console.log(`MEMORY: Successfully updated memory for ${userId}`);

    return new Response(JSON.stringify({ success: true, distillation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("MEMORY: Fatal error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
