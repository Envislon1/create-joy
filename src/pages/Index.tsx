import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { CountdownTimer } from '@/components/CountdownTimer';
import { Button } from '@/components/ui/button';
import { useContestSettings } from '@/hooks/useContestSettings';

const Index = () => {
  const { settings, loading } = useContestSettings();

  return (
    <Layout>
      {/* Hero Section with Countdown */}
      <section className="bg-gradient-to-b from-accent to-background py-16 sm:py-24">
        <div className="container-main text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-4">
            {settings?.contest_name || 'Little Stars Contest'}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
            Register your child and let the community vote for the brightest little star. 
            Every vote counts towards making your child shine.
          </p>

          {loading ? (
            <div className="py-8">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : (
            <CountdownTimer targetDate={settings?.contest_start_date || ''} />
          )}

          <div className="flex justify-center mt-10">
            <Button asChild size="lg">
              <Link to="/register">Register Your Child</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16">
        <div className="container-main">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Register</h3>
              <p className="text-muted-foreground">
                Fill out the registration form with your child's details and upload their best photo.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Get Votes</h3>
              <p className="text-muted-foreground">
                Share your child's profile with friends and family. Each vote costs N{settings?.vote_price || 50}.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Win Prizes</h3>
              <p className="text-muted-foreground">
                Top contestants win amazing cash prizes!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Prize Section */}
      <section className="py-16 bg-gradient-to-b from-primary/10 to-background">
        <div className="container-main">
          <h2 className="text-3xl font-bold text-center mb-4">Prize Pool</h2>
          <p className="text-center text-muted-foreground mb-10">
            Payments are released at 8am the following day after contest ends
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            <div className="bg-card border-2 border-gold rounded-lg p-6 text-center shadow-lg">
              <div className="text-gold text-sm font-semibold mb-2">🥇 1st Place</div>
              <div className="text-3xl font-bold text-foreground">₦4,000,000</div>
              <p className="text-muted-foreground text-sm mt-2">Grand Prize</p>
            </div>

            <div className="bg-card border-2 border-silver rounded-lg p-6 text-center shadow-md">
              <div className="text-silver text-sm font-semibold mb-2">🥈 2nd Place</div>
              <div className="text-2xl font-bold text-foreground">₦2,000,000</div>
              <p className="text-muted-foreground text-sm mt-2">Runner Up</p>
            </div>

            <div className="bg-card border-2 border-bronze rounded-lg p-6 text-center shadow-md">
              <div className="text-bronze text-sm font-semibold mb-2">🥉 3rd Place</div>
              <div className="text-2xl font-bold text-foreground">₦1,000,000</div>
              <p className="text-muted-foreground text-sm mt-2">Second Runner Up</p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 text-center">
              <div className="text-muted-foreground text-sm font-semibold mb-2">4th Place</div>
              <div className="text-xl font-bold text-foreground">Compensation</div>
              <p className="text-muted-foreground text-sm mt-2">Prize Awarded</p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 text-center">
              <div className="text-muted-foreground text-sm font-semibold mb-2">5th Place</div>
              <div className="text-xl font-bold text-foreground">Compensation</div>
              <p className="text-muted-foreground text-sm mt-2">Prize Awarded</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-muted/50">
        <div className="container-main text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Join?</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Don't miss this opportunity to showcase your child's talent and let them shine in our contest.
          </p>
          <Button asChild size="lg">
            <Link to="/register">Register Now</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
