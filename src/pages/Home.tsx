import { Link } from "react-router-dom";
import { useState } from "react";
import { CountdownTimer } from "@/components/CountdownTimer";
import { Skeleton } from "@/components/ui/skeleton";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Trophy, Medal, Award, Star } from "lucide-react";
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

      {/* Featured Contestants Carousel */}
      <section className="py-12 px-4 bg-muted">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
            Our Little Stars
          </h2>
          <Carousel
            opts={{
              align: "start",
              loop: true,
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-2 md:-ml-4">
              {contestants.map((contestant) => (
                <CarouselItem key={contestant.name} className="pl-2 md:pl-4 basis-1/2 md:basis-1/3 lg:basis-1/4">
                  <div className="text-center group">
                    <div className="aspect-square overflow-hidden rounded-xl shadow-lg mb-3 bg-background">
                      <OptimizedImage
                        src={contestant.image}
                        alt={contestant.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <p className="font-semibold text-foreground">{contestant.name}</p>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden sm:flex -left-4" />
            <CarouselNext className="hidden sm:flex -right-4" />
          </Carousel>
        </div>
      </section>

      {/* Prizes Section */}
      <section className="py-16 px-4 bg-gradient-to-b from-background to-muted">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">Win Amazing Prizes</h2>
            <p className="text-muted-foreground">Top performers take home incredible rewards!</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* 1st Place - Hero Card */}
            <div className="md:col-span-1 md:order-2">
              <div className="relative bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600 rounded-2xl p-6 text-center shadow-2xl transform md:-translate-y-4">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <div className="bg-yellow-300 rounded-full p-3 shadow-lg">
                    <Trophy className="w-8 h-8 text-yellow-700" />
                  </div>
                </div>
                <div className="mt-6">
                  <span className="text-yellow-100 font-medium text-sm uppercase tracking-wide">1st Place</span>
                  <div className="text-4xl md:text-5xl font-bold text-white mt-2 mb-1">₦4M</div>
                  <span className="text-yellow-100 text-sm">Four Million Naira</span>
                </div>
                <div className="mt-4 flex justify-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-200 text-yellow-200" />
                  ))}
                </div>
              </div>
            </div>
            
            {/* 2nd Place */}
            <div className="md:order-1">
              <div className="bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500 rounded-2xl p-6 text-center shadow-xl h-full flex flex-col justify-center">
                <div className="bg-slate-200 rounded-full p-3 w-fit mx-auto mb-4 shadow-md">
                  <Medal className="w-6 h-6 text-slate-600" />
                </div>
                <span className="text-slate-100 font-medium text-sm uppercase tracking-wide">2nd Place</span>
                <div className="text-3xl md:text-4xl font-bold text-white mt-2 mb-1">₦2M</div>
                <span className="text-slate-200 text-sm">Two Million Naira</span>
              </div>
            </div>
            
            {/* 3rd Place */}
            <div className="md:order-3">
              <div className="bg-gradient-to-br from-orange-400 via-orange-500 to-orange-700 rounded-2xl p-6 text-center shadow-xl h-full flex flex-col justify-center">
                <div className="bg-orange-200 rounded-full p-3 w-fit mx-auto mb-4 shadow-md">
                  <Award className="w-6 h-6 text-orange-700" />
                </div>
                <span className="text-orange-100 font-medium text-sm uppercase tracking-wide">3rd Place</span>
                <div className="text-3xl md:text-4xl font-bold text-white mt-2 mb-1">₦1M</div>
                <span className="text-orange-200 text-sm">One Million Naira</span>
              </div>
            </div>
          </div>
          
          {/* 4th & 5th Place */}
          <div className="bg-muted border border-border rounded-xl p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Star className="w-5 h-5 text-primary" />
              <span className="font-semibold text-lg">4th & 5th Place</span>
              <Star className="w-5 h-5 text-primary" />
            </div>
            <p className="text-muted-foreground">Special compensation packages for our runners-up</p>
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
