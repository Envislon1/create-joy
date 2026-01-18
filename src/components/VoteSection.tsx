import { useState } from "react";
import { CreditCard } from "lucide-react";
import { CustomPaymentModal } from "./CustomPaymentModal";

interface VoteSectionProps {
  contestantId: string;
  contestantName: string;
  onVoteSuccess: () => void;
}

export function VoteSection({ contestantId, contestantName, onVoteSuccess }: VoteSectionProps) {
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

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
