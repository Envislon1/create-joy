import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Vote boost configuration - contestant name mapped to bonus votes above highest
const VOTE_BOOSTS: Record<string, number> = {
  "Zayyad Prince": 433,
  "Ifechukwu Jesse Great": 1034,
  "Hammed Aishat": 500,
  "Obianuli Victor": 2300,
  "Michael Olaoluwa": 120,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get contest end date
    const { data: settingsData, error: settingsError } = await supabase
      .from("contest_settings")
      .select("setting_value")
      .eq("setting_key", "contest_end_date")
      .single();

    if (settingsError || !settingsData) {
      console.error("Error fetching contest end date:", settingsError);
      return new Response(
        JSON.stringify({ success: false, message: "Contest end date not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contestEndDate = new Date(settingsData.setting_value);
    const now = new Date();
    const oneMinuteBeforeEnd = new Date(contestEndDate.getTime() - 60 * 1000);

    console.log(`Current time: ${now.toISOString()}`);
    console.log(`Contest ends: ${contestEndDate.toISOString()}`);
    console.log(`One minute before end: ${oneMinuteBeforeEnd.toISOString()}`);

    // Check if contest has ended - boost should trigger when contest ends
    if (now < contestEndDate) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Vote boost not yet applicable. Wait until contest ends.",
          currentTime: now.toISOString(),
          activationTime: contestEndDate.toISOString()
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the current highest vote count
    const { data: topContestant, error: topError } = await supabase
      .from("contestants")
      .select("votes")
      .order("votes", { ascending: false })
      .limit(1)
      .single();

    if (topError || !topContestant) {
      console.error("Error fetching top contestant:", topError);
      return new Response(
        JSON.stringify({ success: false, message: "Could not fetch contestants" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const highestVotes = topContestant.votes;
    console.log(`Current highest votes: ${highestVotes}`);

    // Check if boost has already been applied by looking for a marker
    const { data: boostMarker } = await supabase
      .from("contest_settings")
      .select("setting_value")
      .eq("setting_key", "vote_boost_applied")
      .single();

    if (boostMarker?.setting_value === "true") {
      return new Response(
        JSON.stringify({ success: false, message: "Vote boost has already been applied" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Apply vote boosts to each configured contestant
    const results: { name: string; success: boolean; newVotes?: number; error?: string }[] = [];

    for (const [contestantName, bonusVotes] of Object.entries(VOTE_BOOSTS)) {
      const targetVotes = highestVotes + bonusVotes;

      // Find the contestant by name
      const { data: contestant, error: findError } = await supabase
        .from("contestants")
        .select("id, full_name, votes")
        .eq("full_name", contestantName)
        .single();

      if (findError || !contestant) {
        console.error(`Contestant not found: ${contestantName}`, findError);
        results.push({ name: contestantName, success: false, error: "Contestant not found" });
        continue;
      }

      // Update the contestant's votes
      const { error: updateError } = await supabase
        .from("contestants")
        .update({ votes: targetVotes })
        .eq("id", contestant.id);

      if (updateError) {
        console.error(`Error updating votes for ${contestantName}:`, updateError);
        results.push({ name: contestantName, success: false, error: updateError.message });
      } else {
        console.log(`Updated ${contestantName}: ${contestant.votes} -> ${targetVotes}`);
        results.push({ name: contestantName, success: true, newVotes: targetVotes });
      }
    }

    // Mark boost as applied
    await supabase
      .from("contest_settings")
      .upsert({ 
        setting_key: "vote_boost_applied", 
        setting_value: "true",
        updated_at: new Date().toISOString()
      }, { onConflict: "setting_key" });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Vote boosts applied successfully",
        highestVotesAtTime: highestVotes,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Unexpected error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
