import { Contestant } from '@/lib/types';
import { Button } from '@/components/ui/button';

interface LeaderboardRowProps {
  contestant: Contestant;
  rank: number;
  onVote?: () => void;
}

export function LeaderboardRow({ contestant, rank, onVote }: LeaderboardRowProps) {
  const getRankStyle = (rank: number) => {
    if (rank === 1) return 'bg-[hsl(var(--gold))] text-white';
    if (rank === 2) return 'bg-[hsl(var(--silver))] text-white';
    if (rank === 3) return 'bg-[hsl(var(--bronze))] text-white';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-card rounded-lg border border-border hover:border-primary/20 transition-colors">
      <div className={`badge-rank ${getRankStyle(rank)}`}>
        {rank}
      </div>

      <div className="flex-shrink-0">
        <img
          src={contestant.profileImage}
          alt={contestant.name}
          className="w-12 h-12 rounded-lg object-cover"
        />
      </div>

      <div className="flex-grow min-w-0">
        <span className="font-medium block truncate">
          {contestant.name}
        </span>
        <p className="text-sm text-muted-foreground">
          {contestant.age} years | {contestant.sex === 'male' ? 'Boy' : 'Girl'}
        </p>
      </div>

      <div className="text-right flex-shrink-0">
        <span className="text-xl font-bold text-primary">{contestant.votes.toLocaleString()}</span>
        <span className="text-sm text-muted-foreground block">votes</span>
      </div>

      {onVote && (
        <Button size="sm" onClick={onVote}>
          Vote
        </Button>
      )}
    </div>
  );
}
