import { supabase } from './client';
import { Database } from './types';

type Call = Database['public']['Tables']['calls']['Row'];
type CallInsert = Database['public']['Tables']['calls']['Insert'];
type CallUpdate = Database['public']['Tables']['calls']['Update'];
type Transcript = Database['public']['Tables']['call_transcripts']['Row'];
type TranscriptInsert = Database['public']['Tables']['call_transcripts']['Insert'];
type Insight = Database['public']['Tables']['ai_insights']['Row'];
type InsightInsert = Database['public']['Tables']['ai_insights']['Insert'];

export class CallsService {
  // Create a new call session
  static async createCall(data: Omit<CallInsert, 'id' | 'created_at' | 'updated_at'>): Promise<Call | null> {
    const { data: call, error } = await supabase
      .from('calls')
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error('Error creating call:', error);
      return null;
    }

    return call;
  }

  // Update call status or outcome
  static async updateCall(id: string, updates: CallUpdate): Promise<Call | null> {
    const { data: call, error } = await supabase
      .from('calls')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating call:', error);
      return null;
    }

    return call;
  }

  // End a call and calculate duration
  static async endCall(id: string, outcome?: 'closed' | 'pending' | 'lost' | 'no_show'): Promise<Call | null> {
    const endTime = new Date().toISOString();
    
    // Get the call to calculate duration
    const { data: call } = await supabase
      .from('calls')
      .select('start_time')
      .eq('id', id)
      .single();

    if (!call) return null;

    const startTime = new Date(call.start_time);
    const duration = Math.floor((new Date(endTime).getTime() - startTime.getTime()) / 1000);

    return this.updateCall(id, {
      status: 'completed',
      end_time: endTime,
      duration_seconds: duration,
      outcome
    });
  }

  // Add transcript segment
  static async addTranscript(data: Omit<TranscriptInsert, 'id' | 'created_at'>): Promise<Transcript | null> {
    const { data: transcript, error } = await supabase
      .from('call_transcripts')
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error('Error adding transcript:', error);
      return null;
    }

    return transcript;
  }

  // Add AI insight
  static async addInsight(data: Omit<InsightInsert, 'id' | 'created_at'>): Promise<Insight | null> {
    const { data: insight, error } = await supabase
      .from('ai_insights')
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error('Error adding insight:', error);
      return null;
    }

    return insight;
  }

  // Mark insight as helpful/unhelpful
  static async rateInsight(id: string, wasHelpful: boolean, feedback?: string): Promise<void> {
    const { error } = await supabase
      .from('ai_insights')
      .update({ 
        was_helpful: wasHelpful,
        user_feedback: feedback 
      })
      .eq('id', id);

    if (error) {
      console.error('Error rating insight:', error);
    }
  }

  // Get user's call history
  static async getUserCalls(userId: string, limit = 50): Promise<Call[]> {
    const { data: calls, error } = await supabase
      .from('calls')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching calls:', error);
      return [];
    }

    return calls || [];
  }

  // Get call with transcripts and insights - ENHANCED VERSION
  static async getCallDetails(id: string) {
    console.log('🔍 Fetching call details for ID:', id);
    
    const [callResult, transcriptsResult, insightsResult] = await Promise.all([
      supabase.from('calls').select('*').eq('id', id).single(),
      supabase
        .from('call_transcripts')
        .select('*')
        .eq('call_id', id)
        .eq('is_final', true) // Only get finalized transcripts
        .order('timestamp_offset', { ascending: true }), // Order by time
      supabase
        .from('ai_insights')
        .select('*')
        .eq('call_id', id)
        .order('timestamp_offset', { ascending: true }) // Order by time
    ]);

    console.log('📊 Call details results:', {
      call: callResult.data,
      transcriptsCount: transcriptsResult.data?.length || 0,
      insightsCount: insightsResult.data?.length || 0,
      errors: {
        call: callResult.error,
        transcripts: transcriptsResult.error,
        insights: insightsResult.error
      }
    });

    // Log transcript details for debugging
    if (transcriptsResult.data) {
      console.log('📝 Transcripts found:', transcriptsResult.data.map(t => ({
        id: t.id,
        speaker: t.speaker_name,
        content: t.content.substring(0, 50) + '...',
        timestamp: t.timestamp_offset,
        is_final: t.is_final
      })));
    }

    // Log insights details for debugging
    if (insightsResult.data) {
      console.log('🧠 Insights found:', insightsResult.data.map(i => ({
        id: i.id,
        type: i.type,
        content: i.content.substring(0, 50) + '...',
        timestamp: i.timestamp_offset
      })));
    }

    return {
      call: callResult.data,
      transcripts: transcriptsResult.data || [],
      insights: insightsResult.data || [],
      error: callResult.error || transcriptsResult.error || insightsResult.error
    };
  }

  // Get analytics for a user
  static async getUserAnalytics(userId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: calls, error } = await supabase
      .from('calls')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());

    if (error || !calls) {
      console.error('Error fetching analytics:', error);
      return null;
    }

    const totalCalls = calls.length;
    const completedCalls = calls.filter(c => c.status === 'completed').length;
    const closedCalls = calls.filter(c => c.outcome === 'closed').length;
    const avgDuration = calls
      .filter(c => c.duration_seconds)
      .reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / completedCalls || 0;

    return {
      totalCalls,
      completedCalls,
      closeRate: completedCalls > 0 ? (closedCalls / completedCalls) * 100 : 0,
      avgCallDuration: Math.round(avgDuration),
      period: days
    };
  }

  // Debug function to check what's in the database for a specific call
  static async debugCallData(callId: string) {
    console.log('🔍 DEBUG: Checking database for call:', callId);
    
    // Check all transcripts (including non-final)
    const { data: allTranscripts } = await supabase
      .from('call_transcripts')
      .select('*')
      .eq('call_id', callId)
      .order('created_at', { ascending: true });
    
    console.log('📝 All transcripts in DB:', allTranscripts?.length || 0);
    allTranscripts?.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.speaker_name}: "${t.content}" (final: ${t.is_final})`);
    });

    // Check all insights
    const { data: allInsights } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('call_id', callId)
      .order('created_at', { ascending: true });
    
    console.log('🧠 All insights in DB:', allInsights?.length || 0);
    allInsights?.forEach((i, idx) => {
      console.log(`  ${idx + 1}. ${i.type}: "${i.content}"`);
    });

    return { transcripts: allTranscripts, insights: allInsights };
  }
}