import { useState } from 'react';
import { Contestant } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface VoteModalProps {
  contestant: Contestant | null;
  isOpen: boolean;
  onClose: () => void;
  votePrice: number;
}

export function VoteModal({ contestant, isOpen, onClose, votePrice }: VoteModalProps) {
  const [voteCount, setVoteCount] = useState(1);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const totalAmount = voteCount * votePrice;

  const handleVoteCountChange = (value: string) => {
    const count = parseInt(value) || 1;
    setVoteCount(Math.max(1, count));
  };

  const handlePayment = async () => {
    if (!email || !contestant) return;

    setIsLoading(true);
    // TODO: Integrate with Paystack
    // For now, simulate payment
    setTimeout(() => {
      alert(`Payment of N${totalAmount.toLocaleString()} for ${voteCount} votes would be processed via Paystack. This feature requires backend integration.`);
      setIsLoading(false);
      onClose();
      setVoteCount(1);
      setEmail('');
    }, 1000);
  };

  const quickVotes = [1, 5, 10, 20, 50];

  if (!contestant) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vote for {contestant.name}</DialogTitle>
          <DialogDescription>
            Each vote costs N{votePrice}. You can vote multiple times.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center gap-4">
            <img
              src={contestant.profileImage}
              alt={contestant.name}
              className="w-16 h-16 rounded-lg object-cover"
            />
            <div>
              <p className="font-medium">{contestant.name}</p>
              <p className="text-sm text-muted-foreground">
                Current votes: {contestant.votes.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Quick Select</Label>
            <div className="flex flex-wrap gap-2">
              {quickVotes.map((count) => (
                <Button
                  key={count}
                  variant={voteCount === count ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setVoteCount(count)}
                >
                  {count} {count === 1 ? 'vote' : 'votes'}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="voteCount">Number of Votes</Label>
            <Input
              id="voteCount"
              type="number"
              min="1"
              value={voteCount}
              onChange={(e) => handleVoteCountChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Your Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total Amount:</span>
              <span className="text-2xl font-bold text-primary">
                N{totalAmount.toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {voteCount} vote{voteCount !== 1 ? 's' : ''} x N{votePrice} each
            </p>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={handlePayment}
            disabled={!email || isLoading}
          >
            {isLoading ? 'Processing...' : `Pay N${totalAmount.toLocaleString()}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
