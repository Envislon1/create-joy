import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';

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
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [loadingContestants, setLoadingContestants] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchContestants();
    }
  }, [user]);

  const fetchContestants = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('contestants')
        .select('*')
        .eq('parent_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContestants(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load your contestants.",
        variant: "destructive",
      });
    } finally {
      setLoadingContestants(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
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
            <h1 className="text-3xl font-bold">My Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Manage your registered children
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>

        {/* Register New Child CTA */}
        <div className="mb-8">
          <Button asChild size="lg">
            <Link to="/register">
              <Plus className="h-5 w-5 mr-2" />
              Register New Child
            </Link>
          </Button>
        </div>

        {/* My Children */}
        <div className="bg-card border border-border rounded-lg">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-lg">My Registered Children</h2>
          </div>

          {loadingContestants ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading...
            </div>
          ) : contestants.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground mb-4">
                You haven't registered any children yet.
              </p>
              <Button asChild>
                <Link to="/register">Register Your First Child</Link>
              </Button>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {contestants.map((contestant) => (
                <div
                  key={contestant.id}
                  className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg"
                >
                  <img
                    src={contestant.profile_image || '/placeholder.svg'}
                    alt={contestant.name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold">{contestant.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {contestant.age} years old | {contestant.sex}
                    </p>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-sm font-medium text-primary">
                        {contestant.votes.toLocaleString()} votes
                      </span>
                      {contestant.is_approved ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          Approved
                        </span>
                      ) : (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                          Pending Approval
                        </span>
                      )}
                    </div>
                  </div>
                  <Link
                    to={`/contestant/${contestant.id}`}
                    className="text-primary hover:underline text-sm"
                  >
                    View Profile
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
