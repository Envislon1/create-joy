import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { generateReference, VOTE_PRICE_NAIRA } from "@/lib/paystack";
import { supabase } from "@/integrations/supabase/client";

interface VoteSectionProps {
  contestantId: string;
  contestantName: string;
  onVoteSuccess: () => void;
}

// Format number with commas and kobo
const formatCurrency = (value: number): string => {
  return value.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export function VoteSection({ contestantId, contestantName, onVoteSuccess }: VoteSectionProps) {
  const [rawAmount, setRawAmount] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Calculate vote count from amount
  const numericAmount = parseInt(rawAmount) || 0;
  const voteCount = Math.floor(numericAmount / VOTE_PRICE_NAIRA);
  const validAmount = voteCount * VOTE_PRICE_NAIRA;

  const handlePayment = () => {
    if (!email) {
      toast({ title: "Please enter your email", variant: "destructive" });
      return;
    }

    if (voteCount < 1) {
      toast({ title: `Minimum amount is ₦${VOTE_PRICE_NAIRA}`, variant: "destructive" });
      return;
    }

    setLoading(true);
    const reference = generateReference();
    const amountInKobo = validAmount * 100;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (window as any).PaystackPop.setup({
      key: "pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxx", // Replace with your Paystack public key
      email: email,
      amount: amountInKobo,
      currency: "NGN",
      ref: reference,
      metadata: {
        contestant_id: contestantId,
        vote_count: voteCount,
      },
      callback: async (response: { reference: string }) => {
        try {
          const { data, error } = await supabase.functions.invoke("verify-payment", {
            body: {
              reference: response.reference,
              contestant_id: contestantId,
              vote_count: voteCount,
              voter_email: email,
            },
          });

          if (error) throw error;

          if (data.success) {
            toast({ title: `Successfully added ${voteCount} vote(s) for ${contestantName}!` });
            onVoteSuccess();
            setRawAmount("");
            setEmail("");
          } else {
            toast({ title: data.message || "Vote failed", variant: "destructive" });
          }
        } catch (error: any) {
          console.error("Verification error:", error);
          toast({ title: "Payment verification failed", variant: "destructive" });
        }
        setLoading(false);
      },
      onClose: () => {
        setLoading(false);
      },
    });

    handler.openIframe();
  };

  return (
    <div className="border border-border rounded p-4 mt-4">
      <h3 className="font-semibold mb-3">Vote for {contestantName}</h3>
      
      <div className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Your Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-border p-2 rounded"
            placeholder="email@example.com"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Amount - Minimum ₦{formatCurrency(VOTE_PRICE_NAIRA)}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₦</span>
            <input
              type="text"
              inputMode="numeric"
              value={rawAmount ? formatCurrency(numericAmount) : ""}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, "");
                setRawAmount(value);
              }}
              className="w-full border border-border p-2 pl-7 rounded"
              placeholder={`0.00`}
            />
          </div>
        </div>

        {numericAmount > 0 && (
          <p className="text-sm text-muted-foreground">
            ₦{formatCurrency(validAmount)} = <strong>{voteCount} vote{voteCount !== 1 ? 's' : ''}</strong> (₦{formatCurrency(VOTE_PRICE_NAIRA)} per vote)
            {numericAmount !== validAmount && numericAmount >= VOTE_PRICE_NAIRA && (
              <span className="block text-xs mt-1">
                ₦{formatCurrency(numericAmount - validAmount)} will not be charged (partial vote)
              </span>
            )}
          </p>
        )}

        <button
          onClick={handlePayment}
          disabled={loading || voteCount < 1}
          className="w-full bg-primary text-primary-foreground p-2 rounded disabled:opacity-50"
        >
          {loading ? "Processing..." : `Add ${voteCount} Vote${voteCount !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}
