import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Star, Users, Share2 } from 'lucide-react';

interface Contestant {
  id: string;
  name: string;
  age: number;
  sex: string;
  profile_image: string | null;
  votes: number;
  is_approved: boolean;
  created_at: string;
}

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [contestant, setContestant] = useState<Contestant | null>(null);
  const [loadingContestant, setLoadingContestant] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchContestant();
    }
  }, [user]);

  const fetchContestant = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('contestants')
        .select('*')
        .eq('parent_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setContestant(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load your child's profile.",
        variant: "destructive",
      });
    } finally {
      setLoadingContestant(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleShare = () => {
    if (contestant) {
      const shareUrl = `${window.location.origin}/contestant/${contestant.id}`;
      navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Link Copied!",
        description: "Share this link with friends and family to get votes.",
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="container-main py-16 flex justify-center">
          <p>Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="container-main py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">
              {contestant ? `${contestant.name}'s Dashboard` : 'Dashboard'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {contestant ? 'Manage your contest profile' : 'Loading...'}
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>

        {loadingContestant ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading...
          </div>
        ) : contestant ? (
          <div className="space-y-6">
            {/* Profile Card */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="p-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  <img
                    src={contestant.profile_image || '/placeholder.svg'}
                    alt={contestant.name}
                    className="w-32 h-32 rounded-full object-cover border-4 border-primary/20"
                  />
                  <div className="flex-1 text-center sm:text-left">
                    <h2 className="text-2xl font-bold">{contestant.name}</h2>
                    <p className="text-muted-foreground">
                      {contestant.age} years old | {contestant.sex}
                    </p>
                    <div className="mt-3">
                      {contestant.is_approved ? (
                        <span className="inline-flex items-center gap-1.5 text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full">
                          <Star className="h-4 w-4" />
                          Approved & Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-sm bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full">
                          Pending Approval
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Votes</p>
                    <p className="text-3xl font-bold">{contestant.votes.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/10">
                    <Share2 className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Share Profile</p>
                    <Button 
                      variant="link" 
                      className="p-0 h-auto text-primary"
                      onClick={handleShare}
                    >
                      Copy share link
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-semibold mb-4">Quick Actions</h3>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link to={`/contestant/${contestant.id}`}>
                    View Public Profile
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/leaderboard">
                    View Leaderboard
                  </Link>
                </Button>
              </div>
            </div>

            {!contestant.is_approved && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 text-sm">
                  <strong>Note:</strong> Your child's profile is pending approval. Once approved, it will appear on the public leaderboard and can receive votes.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <p className="text-muted-foreground mb-4">
              No child profile found. Please register your child to participate.
            </p>
            <Button asChild>
              <Link to="/register">Register Your Child</Link>
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;