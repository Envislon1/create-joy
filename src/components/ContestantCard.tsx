import { Link } from 'react-router-dom';
import { Contestant } from '@/lib/types';
import { Button } from '@/components/ui/button';

interface ContestantCardProps {
  contestant: Contestant;
  rank?: number;
  showVoteButton?: boolean;
  onVote?: (contestant: Contestant) => void;
}

export function ContestantCard({ contestant, rank, showVoteButton = true, onVote }: ContestantCardProps) {
  const getRankBadgeClass = (rank: number) => {
    if (rank === 1) return 'badge-rank badge-rank-gold';
    if (rank === 2) return 'badge-rank badge-rank-silver';
    if (rank === 3) return 'badge-rank badge-rank-bronze';
    return 'badge-rank badge-rank-default';
  };

  return (
    <div className="card-contestant overflow-hidden animate-fade-in">
      <div className="relative">
        <Link to={`/contestant/${contestant.id}`}>
          <img
            src={contestant.profileImage}
            alt={contestant.name}
            className="w-full aspect-square object-cover"
          />
        </Link>
        {rank && (
          <div className={`absolute top-3 left-3 ${getRankBadgeClass(rank)}`}>
            {rank}
          </div>
        )}
      </div>

      <div className="p-4">
        <Link to={`/contestant/${contestant.id}`}>
          <h3 className="font-semibold text-lg hover:text-primary transition-colors">
            {contestant.name}
          </h3>
        </Link>
        <p className="text-sm text-muted-foreground mt-1">
          {contestant.age} years old | {contestant.sex === 'male' ? 'Boy' : 'Girl'}
        </p>

        <div className="mt-3 flex items-center justify-between">
          <div>
            <span className="text-2xl font-bold text-primary">{contestant.votes.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground ml-1">votes</span>
          </div>

          {showVoteButton && (
            <Button
              size="sm"
              onClick={() => onVote?.(contestant)}
            >
              Vote Now
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
