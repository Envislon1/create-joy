import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { CountdownTimer } from "@/components/CountdownTimer";

interface Contestant {
  id: string;
  full_name: string;
  votes: number;
  photo_url: string | null;
  unique_slug: string;
}

const prizes: Record<number, string> = {
  0: "₦4,000,000",
  1: "₦2,000,000",
  2: "₦1,000,000",
  3: "Compensation",
  4: "Compensation",
};

const LeaderboardSkeleton = () => (
  <div className="max-w-2xl mx-auto px-4">
    <Skeleton className="h-7 w-32 mb-4" />
    <div className="border border-border rounded overflow-hidden">
      <div className="bg-muted p-2 sm:p-3 flex gap-4">
        <Skeleton className="h-5 w-12" />
        <Skeleton className="h-5 flex-1" />
        <Skeleton className="h-5 w-16" />
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="border-t border-border p-2 sm:p-3 flex items-center gap-4">
          <Skeleton className="h-5 w-8" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-5 flex-1" />
          <Skeleton className="h-5 w-12" />
        </div>
      ))}
    </div>
  </div>
);

export function Leaderboard() {
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [loading, setLoading] = useState(true);
  const [imageLoaded, setImageLoaded] = useState<Record<string, boolean>>({});

  const fetchContestants = useCallback(async () => {
    const { data, error } = await supabase
      .from("contestants")
      .select("id, full_name, votes, photo_url, unique_slug")
      .order("votes", { ascending: false });

    if (!error && data) {
      setContestants(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContestants();

    // Subscribe to realtime updates with optimized channel
    const channel = supabase
      .channel("leaderboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contestants" },
        (payload) => {
          // Optimistically update state for faster UI response
          if (payload.eventType === "UPDATE" && payload.new) {
            setContestants((prev) => {
              const updated = prev.map((c) =>
                c.id === payload.new.id ? { ...c, ...payload.new } : c
              );
              return updated.sort((a, b) => b.votes - a.votes);
            });
          } else {
            // For INSERT/DELETE, refetch the full list
            fetchContestants();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchContestants]);

  const handleImageLoad = (id: string) => {
    setImageLoaded((prev) => ({ ...prev, [id]: true }));
  };

  if (loading) {
    return <LeaderboardSkeleton />;
  }

  if (contestants.length === 0) {
    return <p className="text-center py-8 text-muted-foreground">No contestants yet. Be the first to register!</p>;
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-2 sm:px-4">
      <CountdownTimer />
      
      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <thead>
            <tr className="border-b-2 border-foreground">
              <th className="text-left p-2 sm:p-3 text-sm sm:text-base w-[15%] font-semibold">Pos</th>
              <th className="text-left p-2 sm:p-3 text-sm sm:text-base w-[55%] font-semibold">Name</th>
              <th className="text-right p-2 sm:p-3 text-sm sm:text-base w-[30%] font-semibold">Votes</th>
            </tr>
          </thead>
          <tbody>
            {contestants.map((contestant, index) => (
              <tr key={contestant.id}>
                <td className="p-2 sm:p-3 font-semibold text-sm sm:text-base">{index + 1}</td>
                <td className="p-2 sm:p-3 truncate">
                  <Link
                    to={`/contestant/${contestant.unique_slug}`}
                    className="hover:underline text-sm sm:text-base"
                  >
                    {contestant.full_name}
                  </Link>
                </td>
                <td className="p-2 sm:p-3 text-right text-sm sm:text-base whitespace-nowrap">{contestant.votes.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
