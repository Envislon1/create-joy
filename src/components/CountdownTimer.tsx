import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  targetDate: string;
  label?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function CountdownTimer({ targetDate, label = "Contest Starts In" }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(targetDate).getTime() - new Date().getTime();

      if (difference <= 0) {
        setHasStarted(true);
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      };
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  if (hasStarted) {
    return (
      <div className="text-center">
        <p className="text-lg font-semibold text-success">Contest is Live!</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className="text-sm text-muted-foreground mb-4 uppercase tracking-wide">{label}</p>
      <div className="flex justify-center gap-3 sm:gap-4">
        <div className="countdown-unit">
          <span className="countdown-value">{String(timeLeft.days).padStart(2, '0')}</span>
          <span className="countdown-label">Days</span>
        </div>
        <div className="countdown-unit">
          <span className="countdown-value">{String(timeLeft.hours).padStart(2, '0')}</span>
          <span className="countdown-label">Hours</span>
        </div>
        <div className="countdown-unit">
          <span className="countdown-value">{String(timeLeft.minutes).padStart(2, '0')}</span>
          <span className="countdown-label">Mins</span>
        </div>
        <div className="countdown-unit">
          <span className="countdown-value">{String(timeLeft.seconds).padStart(2, '0')}</span>
          <span className="countdown-label">Secs</span>
        </div>
      </div>
    </div>
  );
}
