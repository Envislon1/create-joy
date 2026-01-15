import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { VoteModal } from '@/components/VoteModal';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useContestSettings } from '@/hooks/useContestSettings';
import { Contestant } from '@/lib/types';

interface DBContestant {
  id: string;
  name: string;
  age: number;
  sex: string;
  profile_image: string | null;
  gallery_images: string[] | null;
  votes: number;
  parent_id: string;
  is_approved: boolean;
  created_at: string;
}

const ContestantProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { settings } = useContestSettings();
  
  const [contestant, setContestant] = useState<DBContestant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
  const [rank, setRank] = useState(0);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    fetchContestant();
  }, [id, user]);

  const fetchContestant = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('contestants')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Check if user is owner or if contestant is approved
      if (data) {
        const ownerCheck = user?.id === data.parent_id;
        setIsOwner(ownerCheck);
        
        if (!data.is_approved && !ownerCheck) {
          // Not owner and not approved - show not found
          setContestant(null);
        } else {
          setContestant(data);
          // Fetch rank
          const { data: allContestants } = await supabase
            .from('contestants')
            .select('id, votes')
            .eq('is_approved', true)
            .order('votes', { ascending: false });

          if (allContestants) {
            const contestantRank = allContestants.findIndex(c => c.id === id) + 1;
            setRank(contestantRank > 0 ? contestantRank : 0);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching contestant:', error);
      setContestant(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading || authLoading) {
    return (
      <Layout>
        <div className="container-main py-16 text-center">
          <p>Loading...</p>
        </div>
      </Layout>
    );
  }

  if (!contestant) {
    return (
      <Layout>
        <div className="container-main py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">Contestant Not Found</h1>
          <p className="text-muted-foreground mb-8">
            The contestant you're looking for doesn't exist or has been removed.
          </p>
          <Button asChild>
            <Link to="/leaderboard">View Leaderboard</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const getRankLabel = (rank: number) => {
    if (rank === 0) return 'Not Ranked';
    if (rank === 1) return '1st Place';
    if (rank === 2) return '2nd Place';
    if (rank === 3) return '3rd Place';
    return `${rank}th Place`;
  };

  const contestantForModal: Contestant = {
    id: contestant.id,
    name: contestant.name,
    age: contestant.age,
    sex: contestant.sex.toLowerCase() as 'male' | 'female',
    profileImage: contestant.profile_image || '/placeholder.svg',
    galleryImages: contestant.gallery_images || [],
    votes: contestant.votes,
    registeredAt: contestant.created_at,
    parentName: '',
    parentEmail: '',
    parentPhone: '',
  };

  return (
    <Layout>
      <div className="container-main py-8">
        <Link
          to={isOwner ? "/dashboard" : "/leaderboard"}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          {isOwner ? 'Back to Dashboard' : 'Back to Leaderboard'}
        </Link>

        {!contestant.is_approved && isOwner && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800">
              This profile is pending approval. It will appear on the leaderboard once approved.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Profile Image */}
          <div>
            <img
              src={contestant.profile_image || '/placeholder.svg'}
              alt={contestant.name}
              className="w-full aspect-square object-cover rounded-lg"
            />

            {/* Gallery */}
            {contestant.gallery_images && contestant.gallery_images.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold mb-3">Gallery</h3>
                <div className="grid grid-cols-3 gap-2">
                  {contestant.gallery_images.map((image, index) => (
                    <img
                      key={index}
                      src={image}
                      alt={`${contestant.name} gallery ${index + 1}`}
                      className="w-full aspect-square object-cover rounded-lg"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Profile Info */}
          <div>
            <div className="mb-6">
              {rank > 0 && (
                <span className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium mb-3">
                  {getRankLabel(rank)}
                </span>
              )}
              <h1 className="text-3xl font-bold mb-2">{contestant.name}</h1>
              <p className="text-muted-foreground">
                {contestant.age} years old | {contestant.sex === 'Male' ? 'Boy' : 'Girl'}
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 mb-6">
              <div className="text-center">
                <span className="text-4xl font-bold text-primary">
                  {contestant.votes.toLocaleString()}
                </span>
                <p className="text-muted-foreground mt-1">Total Votes</p>
              </div>

              {contestant.is_approved && (
                <div className="mt-6">
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => setIsVoteModalOpen(true)}
                  >
                    Vote for {contestant.name}
                  </Button>
                  <p className="text-sm text-muted-foreground text-center mt-2">
                    N{settings?.vote_price || 50} per vote
                  </p>
                </div>
              )}
            </div>

            <div className="bg-muted/50 rounded-lg p-6">
              <h3 className="font-semibold mb-4">Contest Information</h3>
              <dl className="space-y-3">
                {rank > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Current Rank</dt>
                    <dd className="font-medium">{getRankLabel(rank)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Registered</dt>
                  <dd className="font-medium">
                    {new Date(contestant.created_at).toLocaleDateString()}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="font-medium">
                    {contestant.is_approved ? 'Approved' : 'Pending Approval'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <VoteModal
        contestant={contestantForModal}
        isOpen={isVoteModalOpen}
        onClose={() => setIsVoteModalOpen(false)}
        votePrice={settings?.vote_price || 50}
      />
    </Layout>
  );
};

export default ContestantProfile;
