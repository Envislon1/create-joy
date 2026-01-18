import { useState } from "react";
import { CreditCard, Clock, XCircle } from "lucide-react";
import { CustomPaymentModal } from "./CustomPaymentModal";
import { useContestPhase } from "@/hooks/useContestPhase";

interface VoteSectionProps {
  contestantId: string;
  contestantName: string;
  onVoteSuccess: () => void;
}

export function VoteSection({ contestantId, contestantName, onVoteSuccess }: VoteSectionProps) {
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const { canVote, voteBlockedReason, phase, formattedStartDate } = useContestPhase();

  // Show different states based on contest phase
  if (phase === "before") {
    return (
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4 shadow-sm">
        <h3 className="font-semibold mb-3 text-white">Vote for {contestantName}</h3>
        <div className="flex items-center gap-2 text-yellow-300 mb-3">
          <Clock className="w-5 h-5" />
          <span className="text-sm">Voting not started</span>
        </div>
        <p className="text-white/70 text-sm mb-4">
          Voting opens on {formattedStartDate}
        </p>
        <button
          disabled
          className="w-full bg-white/50 text-section-blue/70 p-3 rounded-lg font-medium cursor-not-allowed flex items-center justify-center gap-2"
        >
          <CreditCard className="w-5 h-5" />
          Add Votes
        </button>
      </div>
    );
  }

  if (phase === "ended") {
    return (
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4 shadow-sm">
        <h3 className="font-semibold mb-3 text-white">Vote for {contestantName}</h3>
        <div className="flex items-center gap-2 text-red-400 mb-3">
          <XCircle className="w-5 h-5" />
          <span className="text-sm">Contest has ended</span>
        </div>
        <p className="text-white/70 text-sm mb-4">
          Thank you for participating! Winners will be announced soon.
        </p>
        <button
          disabled
          className="w-full bg-white/50 text-section-blue/70 p-3 rounded-lg font-medium cursor-not-allowed flex items-center justify-center gap-2"
        >
          <CreditCard className="w-5 h-5" />
          Voting Closed
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4 shadow-sm">
        <h3 className="font-semibold mb-3 text-white">Vote for {contestantName}</h3>
        <p className="text-white/70 text-sm mb-4">
          Support {contestantName} by adding votes.
        </p>
        <button
          onClick={() => setIsPaymentOpen(true)}
          className="w-full bg-white text-section-blue p-3 rounded-lg font-medium hover:bg-white/90 transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          <CreditCard className="w-5 h-5" />
          Add Votes
        </button>
      </div>

      <CustomPaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        contestantId={contestantId}
        contestantName={contestantName}
        onVoteSuccess={onVoteSuccess}
      />
    </>
  );
}
