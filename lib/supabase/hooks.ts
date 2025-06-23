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
    console.log('🔐 ENHANCED LOGGING: useAuth hook initializing');
    
    // Get initial session
    const getInitialSession = async () => {
      console.log('🔐 ENHANCED LOGGING: Getting initial session from Supabase');
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log('🔐 ENHANCED LOGGING: Initial session response received');
        console.log('🔐 ENHANCED LOGGING: Session exists:', !!session);
        console.log('🔐 ENHANCED LOGGING: Session user exists:', !!session?.user);
        console.log('🔐 ENHANCED LOGGING: Session error:', error);
        
        if (error) {
          console.error('❌ ENHANCED LOGGING: Error getting initial session:', error);
        }
        
        setUser(session?.user ?? null);
        console.log('🔐 ENHANCED LOGGING: User state set to:', session?.user ? 'authenticated user' : 'null');
        
        if (session?.user) {
          console.log('🔐 ENHANCED LOGGING: User authenticated, fetching profile');
          console.log('🔐 ENHANCED LOGGING: User ID:', session.user.id);
          console.log('🔐 ENHANCED LOGGING: User email:', session.user.email);
          
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
            
          console.log('🔐 ENHANCED LOGGING: Profile fetch completed');
          console.log('🔐 ENHANCED LOGGING: Profile data exists:', !!profile);
          console.log('🔐 ENHANCED LOGGING: Profile error:', profileError);
          
          if (profileError) {
            console.error('❌ ENHANCED LOGGING: Error fetching profile:', profileError);
          }
          
          setProfile(profile);
        } else {
          console.log('🔐 ENHANCED LOGGING: No user session, setting profile to null');
          setProfile(null);
        }
        
        setLoading(false);
        console.log('🔐 ENHANCED LOGGING: Initial session setup completed, loading set to false');
        
      } catch (error) {
        console.error('❌ ENHANCED LOGGING: Unexpected error in getInitialSession:', error);
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    console.log('🔐 ENHANCED LOGGING: Setting up auth state change listener');
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 ENHANCED LOGGING: Auth state change event received');
        console.log('🔐 ENHANCED LOGGING: Event type:', event);
        console.log('🔐 ENHANCED LOGGING: Session exists:', !!session);
        console.log('🔐 ENHANCED LOGGING: Session user exists:', !!session?.user);
        
        setUser(session?.user ?? null);
        console.log('🔐 ENHANCED LOGGING: User state updated to:', session?.user ? 'authenticated user' : 'null');
        
        if (session?.user) {
          console.log('🔐 ENHANCED LOGGING: Auth change - user authenticated, fetching profile');
          console.log('🔐 ENHANCED LOGGING: User ID:', session.user.id);
          
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
            
          console.log('🔐 ENHANCED LOGGING: Auth change - profile fetch completed');
          console.log('🔐 ENHANCED LOGGING: Profile data exists:', !!profile);
          console.log('🔐 ENHANCED LOGGING: Profile error:', profileError);
          
          if (profileError) {
            console.error('❌ ENHANCED LOGGING: Error fetching profile on auth change:', profileError);
          }
          
          setProfile(profile);
        } else {
          console.log('🔐 ENHANCED LOGGING: Auth change - no user, setting profile to null');
          setProfile(null);
        }
        
        setLoading(false);
        console.log('🔐 ENHANCED LOGGING: Auth state change processing completed, loading set to false');
      }
    );

    return () => {
      console.log('🔐 ENHANCED LOGGING: Cleaning up auth state change listener');
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    console.log('🔐 ENHANCED LOGGING: Sign out requested');
    
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ ENHANCED LOGGING: Error during sign out:', error);
      } else {
        console.log('✅ ENHANCED LOGGING: Sign out successful');
      }
    } catch (error) {
      console.error('❌ ENHANCED LOGGING: Unexpected error during sign out:', error);
    }
  };

  console.log('🔐 ENHANCED LOGGING: useAuth hook returning state:', {
    userExists: !!user,
    profileExists: !!profile,
    loading
  });

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