import { Leaderboard } from "@/components/Leaderboard";

const LeaderboardPage = () => {
  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2">Leaderboard</h1>
        <p className="text-muted-foreground text-center mb-8">
          See who's leading the contest. Click on a contestant to vote for them!
        </p>
        
        <Leaderboard />
      </div>
    </div>
  );
};

export default LeaderboardPage;
