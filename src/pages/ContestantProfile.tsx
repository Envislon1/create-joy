import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { VoteSection } from "@/components/VoteSection";
import { CountdownTimer } from "@/components/CountdownTimer";

interface Contestant {
  id: string;
  full_name: string;
  age: number;
  sex: string;
  photo_url: string | null;
  votes: number;
  unique_slug: string;
}

export default function ContestantProfile() {
  const { slug } = useParams<{ slug: string }>();
  const [contestant, setContestant] = useState<Contestant | null>(null);
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState<number | null>(null);

  useEffect(() => {
    if (slug) {
      fetchContestant();
    }
  }, [slug]);

  const fetchContestant = async () => {
    // Fetch the contestant
    const { data, error } = await supabase
      .from("contestants")
      .select("*")
      .eq("unique_slug", slug)
      .single();

    if (!error && data) {
      setContestant(data);
      
      // Fetch position
      const { data: allContestants } = await supabase
        .from("contestants")
        .select("id, votes")
        .order("votes", { ascending: false });

      if (allContestants) {
        const pos = allContestants.findIndex((c) => c.id === data.id) + 1;
        setPosition(pos);
      }
    }
    setLoading(false);
  };

  const shareLink = window.location.href;

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    alert("Link copied to clipboard!");
  };

  if (loading) {
    return (
      <div className="min-h-screen p-4">
        <p className="text-center py-8">Loading...</p>
      </div>
    );
  }

  if (!contestant) {
    return (
      <div className="min-h-screen p-4">
        <p className="text-center py-8">Contestant not found</p>
        <p className="text-center">
          <Link to="/" className="underline">Go back home</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto">
      <Link to="/" className="text-sm underline mb-4 inline-block">
        ← Back to Leaderboard
      </Link>

      <CountdownTimer />

      <div className="text-center mb-6">
        {contestant.photo_url ? (
          <img
            src={contestant.photo_url}
            alt={contestant.full_name}
            className="w-32 h-32 rounded-full object-cover mx-auto mb-4"
          />
        ) : (
          <div className="w-32 h-32 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center text-4xl">
            👶
          </div>
        )}

        <h1 className="text-2xl font-bold">{contestant.full_name}</h1>
        <p className="text-muted-foreground">
          {contestant.age} years old • {contestant.sex === "male" ? "Boy" : "Girl"}
        </p>
      </div>

      <div className="border border-border rounded p-4 mb-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-muted-foreground">Current Votes</p>
            <p className="text-3xl font-bold">{contestant.votes.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Position</p>
            <p className="text-3xl font-bold">#{position}</p>
          </div>
        </div>
      </div>

      <div className="border border-border rounded p-4 mb-4">
        <p className="text-sm text-muted-foreground mb-2">Share this link:</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={shareLink}
            readOnly
            className="flex-1 border border-border p-2 rounded text-sm"
          />
          <button
            onClick={copyLink}
            className="border border-border px-3 py-2 rounded text-sm"
          >
            Copy
          </button>
        </div>
      </div>

      <VoteSection
        contestantId={contestant.id}
        contestantName={contestant.full_name}
        onVoteSuccess={fetchContestant}
      />
    </div>
  );
}
