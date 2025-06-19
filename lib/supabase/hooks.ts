'use client';

import { useEffect, useState } from 'react';
import { User } from '@supabase/auth-helpers-nextjs';
import { supabase } from './client';
import { Database } from './types';

type Profile = Database['public']['Tables']['profiles']['Row'];

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setProfile(profile);
      }
      
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          setProfile(profile);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return {
    user,
    profile,
    loading,
    signOut,
  };
}

export function useCalls() {
  const [calls, setCalls] = useState<Database['public']['Tables']['calls']['Row'][]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCalls = async () => {
      const { data, error } = await supabase
        .from('calls')
        .select('*')
        .order('created_at', { ascending: false });

      if (data && !error) {
        setCalls(data);
      }
      setLoading(false);
    };

    fetchCalls();

    // Subscribe to real-time changes
    const subscription = supabase
      .channel('calls')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'calls' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setCalls(prev => [payload.new as any, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setCalls(prev => prev.map(call => 
              call.id === payload.new.id ? payload.new as any : call
            ));
          } else if (payload.eventType === 'DELETE') {
            setCalls(prev => prev.filter(call => call.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { calls, loading };
}

export function useInsights(callId?: string) {
  const [insights, setInsights] = useState<Database['public']['Tables']['ai_insights']['Row'][]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!callId) {
      setLoading(false);
      return;
    }

    const fetchInsights = async () => {
      const { data, error } = await supabase
        .from('ai_insights')
        .select('*')
        .eq('call_id', callId)
        .order('created_at', { ascending: false });

      if (data && !error) {
        setInsights(data);
      }
      setLoading(false);
    };

    fetchInsights();

    // Subscribe to real-time changes
    const subscription = supabase
      .channel(`insights-${callId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'ai_insights',
          filter: `call_id=eq.${callId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setInsights(prev => [payload.new as any, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setInsights(prev => prev.map(insight => 
              insight.id === payload.new.id ? payload.new as any : insight
            ));
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [callId]);

  return { insights, loading };
}