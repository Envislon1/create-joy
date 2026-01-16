import { Link } from "react-router-dom";
import { useState } from "react";
import { CountdownTimer } from "@/components/CountdownTimer";
import { Skeleton } from "@/components/ui/skeleton";
import heroImage from "@/assets/hero-family.jpg";
import amaraImg from "@/assets/contestants/amara.jpg";
import adaezeImg from "@/assets/contestants/adaeze.jpg";
import chidiImg from "@/assets/contestants/chidi.jpg";
import nkechiImg from "@/assets/contestants/nkechi.jpg";
import zuriImg from "@/assets/contestants/zuri.jpg";
import tundeImg from "@/assets/contestants/tunde.jpg";

const contestants = [
  { name: "Amara", image: amaraImg },
  { name: "Adaeze", image: adaezeImg },
  { name: "Chidi", image: chidiImg },
  { name: "Nkechi", image: nkechiImg },
  { name: "Zuri", image: zuriImg },
  { name: "Tunde", image: tundeImg },
];

const OptimizedImage = ({ 
  src, 
  alt, 
  className 
}: { 
  src: string; 
  alt: string; 
  className?: string;
}) => {
  const [loaded, setLoaded] = useState(false);
  
  return (
    <div className="relative w-full h-full">
      {!loaded && <Skeleton className="absolute inset-0 w-full h-full" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`${className} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
      />
    </div>
  );
};

const Home = () => {
  const [heroLoaded, setHeroLoaded] = useState(false);
  
  return (
    <div className="min-h-screen">
      {/* Hero Banner */}
      <section className="relative w-full h-[50vh] md:h-[60vh] overflow-hidden bg-black">
        {!heroLoaded && <div className="absolute inset-0 w-full h-full bg-black" />}
        <img
          src={heroImage}
          alt="Happy family - Little Stars Contest"
          loading="eager"
          decoding="async"
          onLoad={() => setHeroLoaded(true)}
          className={`w-full h-full object-cover object-center ${heroLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-500`}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <h1 className="text-4xl md:text-6xl font-bold text-white drop-shadow-lg mb-4">
            Little Stars Contest
          </h1>
          <p className="text-lg md:text-xl text-white/90 drop-shadow-md max-w-2xl">
            Vote for your favorite child contestant! ₦50 per vote.
          </p>
        </div>
      </section>

      {/* Countdown & Actions */}
      <section className="py-12 px-4 bg-background">
        <div className="max-w-3xl mx-auto text-center">
          <CountdownTimer />

          <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
            <Link
              to="/register"
              className="bg-primary text-primary-foreground px-6 py-3 rounded font-medium hover:opacity-90 transition"
            >
              Register Your Child
            </Link>
            <Link
              to="/leaderboard"
              className="border border-border px-6 py-3 rounded font-medium hover:bg-muted transition"
            >
              View Leaderboard
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Contestants */}
      <section className="py-12 px-4 bg-muted">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
            Our Little Stars
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {contestants.map((contestant) => (
              <div key={contestant.name} className="text-center group">
                <div className="aspect-square overflow-hidden rounded-xl shadow-lg mb-3 bg-background">
                  <OptimizedImage
                    src={contestant.image}
                    alt={contestant.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <p className="font-semibold text-foreground">{contestant.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Prizes Section */}
      <section className="py-12 px-4 bg-background">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Prizes</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-4 bg-muted rounded border border-border">
              <span className="font-medium">1st Place</span>
              <span className="text-lg font-bold">₦4,000,000</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-muted rounded border border-border">
              <span className="font-medium">2nd Place</span>
              <span className="text-lg font-bold">₦2,000,000</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-muted rounded border border-border">
              <span className="font-medium">3rd Place</span>
              <span className="text-lg font-bold">₦1,000,000</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-muted rounded border border-border">
              <span className="font-medium">4th & 5th Place</span>
              <span className="text-muted-foreground">Compensation</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 px-4 bg-muted">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">How It Works</h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-bold">
                1
              </div>
              <p className="text-muted-foreground">Register your child with their details and photo.</p>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-bold">
                2
              </div>
              <p className="text-muted-foreground">Get a unique link for your child's profile - copy and keep this safe!</p>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-bold">
                3
              </div>
              <p className="text-muted-foreground">Share the link with family and friends to vote.</p>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-bold">
                4
              </div>
              <p className="text-muted-foreground">Each vote costs ₦50. Multiple votes allowed!</p>
            </div>
          </div>
        </div>
      </section>

      {/* Terms and Conditions Link */}
      <section className="py-8 px-4 bg-background border-t border-border">
        <div className="max-w-2xl mx-auto text-center">
          <Link
            to="/terms"
            className="text-primary hover:underline font-medium"
          >
            Terms and Conditions
          </Link>
        </div>
      </section>
    </div>
  );
};

export default Home;
