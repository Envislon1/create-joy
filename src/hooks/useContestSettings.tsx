import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ContestSettings {
  id: string;
  contest_name: string;
  contest_start_date: string;
  contest_end_date: string | null;
  vote_price: number;
  is_active: boolean;
}

export function useContestSettings() {
  const [settings, setSettings] = useState<ContestSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('contest_settings')
        .select('*')
        .limit(1)
        .single();

      if (error) throw error;
      setSettings(data);
    } catch (err: any) {
      setError(err.message);
      // Fallback to default settings if none exist
      setSettings({
        id: '',
        contest_name: 'Little Stars Contest',
        contest_start_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        contest_end_date: null,
        vote_price: 50,
        is_active: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return { settings, loading, error, refetch: fetchSettings };
}
