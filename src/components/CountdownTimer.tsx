import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEndDate();
  }, []);

  useEffect(() => {
    if (!endDate) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const end = endDate.getTime();
      const difference = end - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        clearInterval(timer);
        return;
      }

      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000),
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [endDate]);

  const fetchEndDate = async () => {
    const { data, error } = await supabase
      .from("contest_settings")
      .select("setting_value")
      .eq("setting_key", "contest_end_date")
      .single();

    if (!error && data) {
      setEndDate(new Date(data.setting_value));
    }
    setLoading(false);
  };

  const isEnded = timeLeft && timeLeft.days === 0 && timeLeft.hours === 0 && 
                  timeLeft.minutes === 0 && timeLeft.seconds === 0;

  if (isEnded) {
    return (
      <div className="text-center py-4 border border-white/30 rounded mb-6">
        <p className="text-lg font-semibold text-red-300">Contest Has Ended</p>
      </div>
    );
  }

  return (
    <div className="text-center py-4 border border-white/30 rounded mb-6">
      <p className="text-sm text-white/80 mb-2">Contest ends in:</p>
      <div className="flex justify-center gap-4 text-lg font-semibold">
        <div>
          <span className="text-2xl text-white">{loading || !timeLeft ? "--" : timeLeft.days}</span>
          <span className="text-sm text-white/80 ml-1">days</span>
        </div>
        <div>
          <span className="text-2xl text-white">{loading || !timeLeft ? "--" : timeLeft.hours}</span>
          <span className="text-sm text-white/80 ml-1">hrs</span>
        </div>
        <div>
          <span className="text-2xl text-white">{loading || !timeLeft ? "--" : timeLeft.minutes}</span>
          <span className="text-sm text-white/80 ml-1">min</span>
        </div>
        <div>
          <span className="text-2xl text-white">{loading || !timeLeft ? "--" : timeLeft.seconds}</span>
          <span className="text-sm text-white/80 ml-1">sec</span>
        </div>
      </div>
    </div>
  );
}
