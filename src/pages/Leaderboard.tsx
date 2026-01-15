import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { LeaderboardRow } from '@/components/LeaderboardRow';
import { VoteModal } from '@/components/VoteModal';
import { supabase } from '@/integrations/supabase/client';
import { useContestSettings } from '@/hooks/useContestSettings';

interface Contestant {
  id: string;
  name: string;
  age: number;
  sex: string;
  profile_image: string | null;
  votes: number;
}

const Leaderboard = () => {
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContestant, setSelectedContestant] = useState<Contestant | null>(null);
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
  const { settings } = useContestSettings();

  useEffect(() => {
    fetchContestants();
  }, []);

  const fetchContestants = async () => {
    try {
      const { data, error } = await supabase
        .from('contestants')
        .select('id, name, age, sex, profile_image, votes')
        .eq('is_approved', true)
        .order('votes', { ascending: false });

      if (error) throw error;
      setContestants(data || []);
    } catch (error) {
      console.error('Error fetching contestants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = (contestant: Contestant) => {
    setSelectedContestant(contestant);
    setIsVoteModalOpen(true);
  };

  const totalVotes = contestants.reduce((sum, c) => sum + c.votes, 0);

  return (
    <Layout>
      <div className="container-main py-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-2">Leaderboard</h1>
          <p className="text-muted-foreground">
            Live rankings based on total votes. Updated in real-time.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Loading contestants...</p>
          </div>
        ) : contestants.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No approved contestants yet.</p>
          </div>
        ) : (
          <>
            {/* Top 3 Highlight */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
              {contestants.slice(0, 3).map((contestant, index) => {
                const positions = ['1st', '2nd', '3rd'];
                const bgColors = [
                  'bg-gradient-to-br from-[hsl(45,90%,50%)] to-[hsl(35,90%,45%)]',
                  'bg-gradient-to-br from-[hsl(210,10%,70%)] to-[hsl(210,10%,60%)]',
                  'bg-gradient-to-br from-[hsl(30,60%,50%)] to-[hsl(25,60%,40%)]',
                ];

                return (
                  <div
                    key={contestant.id}
                    className={`${bgColors[index]} text-white rounded-lg p-6 text-center cursor-pointer hover:opacity-90 transition-opacity ${
                      index === 0 ? 'md:order-2' : index === 1 ? 'md:order-1' : 'md:order-3'
                    }`}
                    onClick={() => handleVote(contestant)}
                  >
                    <div className="text-sm font-medium opacity-90 mb-2">{positions[index]} Place</div>
                    <img
                      src={contestant.profile_image || '/placeholder.svg'}
                      alt={contestant.name}
                      className="w-20 h-20 rounded-full object-cover mx-auto mb-3 border-4 border-white/30"
                    />
                    <h3 className="font-bold text-lg">{contestant.name}</h3>
                    <p className="text-sm opacity-90 mb-2">
                      {contestant.age} years | {contestant.sex === 'Male' ? 'Boy' : 'Girl'}
                    </p>
                    <div className="text-2xl font-bold">{contestant.votes.toLocaleString()} votes</div>
                  </div>
                );
              })}
            </div>

            {/* Full Rankings */}
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/50">
                <h2 className="font-semibold">Full Rankings</h2>
              </div>

              <div className="p-4 space-y-3">
                {contestants.map((contestant, index) => (
                  <LeaderboardRow
                    key={contestant.id}
                    contestant={{
                      id: contestant.id,
                      name: contestant.name,
                      age: contestant.age,
                      sex: contestant.sex.toLowerCase() as 'male' | 'female',
                      profileImage: contestant.profile_image || '/placeholder.svg',
                      galleryImages: [],
                      votes: contestant.votes,
                      registeredAt: '',
                      parentName: '',
                      parentEmail: '',
                      parentPhone: '',
                    }}
                    rank={index + 1}
                    onVote={() => handleVote(contestant)}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Stats */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <span className="text-3xl font-bold text-primary">
              {contestants.length}
            </span>
            <p className="text-muted-foreground mt-1">Total Contestants</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <span className="text-3xl font-bold text-primary">
              {totalVotes.toLocaleString()}
            </span>
            <p className="text-muted-foreground mt-1">Total Votes</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <span className="text-3xl font-bold text-primary">
              N{settings?.vote_price || 50}
            </span>
            <p className="text-muted-foreground mt-1">Per Vote</p>
          </div>
        </div>
      </div>

      {selectedContestant && (
        <VoteModal
          contestant={{
            id: selectedContestant.id,
            name: selectedContestant.name,
            age: selectedContestant.age,
            sex: selectedContestant.sex.toLowerCase() as 'male' | 'female',
            profileImage: selectedContestant.profile_image || '/placeholder.svg',
            galleryImages: [],
            votes: selectedContestant.votes,
            registeredAt: '',
            parentName: '',
            parentEmail: '',
            parentPhone: '',
          }}
          isOpen={isVoteModalOpen}
          onClose={() => setIsVoteModalOpen(false)}
          votePrice={settings?.vote_price || 50}
        />
      )}
    </Layout>
  );
};

export default Leaderboard;
