'use client';

import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertCircle, 
  AlertTriangle, 
  Brain, 
  CheckCircle, 
  Lightbulb, 
  MessageSquare, 
  Mic, 
  Target, 
  TrendingUp, 
  XCircle 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CallFeedbackModal } from '@/components/dashboard/call-feedback-modal';
import { useAuth } from '@/lib/supabase/hooks';
import { CallsService } from '@/lib/supabase/calls';
import { supabase } from '@/lib/supabase/client';
import { getAblyChannels, isAblyAvailable } from '@/lib/ably/client';
import { cn } from '@/lib/utils';

interface CallAnalyzerProps {
  onCallEnd: () => void;
  desktopCallActive: boolean;
}

interface Transcript {
  id: string;
  call_id: string;
  speaker_id: number;
  speaker_name: string | null;
  content: string;
  timestamp_offset: number;
  is_final: boolean;
  confidence?: number | null;
  temp_id?: string; // For tracking interim transcripts before they're persisted
}

interface Insight {
  id: string;
  type: 'objection' | 'opportunity' | 'buying-signal' | 'warning' | 'good-move' | 'next-step';
  content: string;
  timestamp_offset: number;
}

interface TranscriptGroup {
  speaker_id: number;
  speaker_name: string | null;
  transcripts: Transcript[];
  timestamp_offset: number;
  is_final: boolean;
}

export function CallAnalyzer({ onCallEnd, desktopCallActive }: CallAnalyzerProps) {
  // State
  const [isLive, setIsLive] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTranscriptTime, setLastTranscriptTime] = useState(0);
  const [isEndingCall, setIsEndingCall] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isPollingMessages, setIsPollingMessages] = useState(false);
  const [deepgramApiKey, setDeepgramApiKey] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [desktopCallStarted, setDesktopCallStarted] = useState(false);
  const [deepgramErrors, setDeepgramErrors] = useState<string[]>([]);
  
  // Refs
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const insightsScrollRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const messagePollingRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const ablySubscriptionsRef = useRef<any[]>([]);
  
  // Hooks
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Handle desktop call state changes
  useEffect(() => {
    console.log('🎯 CallAnalyzer desktop state change - desktopCallActive:', desktopCallActive, 'isLive:', isLive);
    
    // Only stop if desktop call becomes inactive and we're currently live
    if (!desktopCallActive && isLive) {
      console.log('🛑 Desktop call stopped, stopping live analysis');
      stopLive();
    }
  }, [desktopCallActive, isLive]);

  // CRITICAL FIX: Add effect to start call when desktop call becomes active
  useEffect(() => {
    const handleDesktopCallActivation = async () => {
      // Only start if desktop call is active, we're not already live, and we have a user
      if (desktopCallActive && !isLive && user && desktopCallStarted && deepgramApiKey && mimeType) {
        console.log('🚀 Desktop call is active, starting live analysis automatically');
        console.log('🚀 Using Deepgram API key:', deepgramApiKey ? `${deepgramApiKey.substring(0, 8)}...` : 'none');
        console.log('🚀 Using MIME type:', mimeType);
        
        try {
          await startLive();
          console.log('✅ Successfully started live analysis in response to desktop call');
        } catch (error) {
          console.error('❌ Failed to auto-start live analysis:', error);
          toast({
            title: "Failed to start call analysis",
            description: "Could not automatically start call analysis. Please try manually.",
            variant: "destructive"
          });
        }
      }
    };

    handleDesktopCallActivation();
  }, [desktopCallActive, isLive, user, desktopCallStarted, deepgramApiKey, mimeType]);
  
  // Timer for elapsed time
  useEffect(() => {
    if (isLive) {
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsedTime(0);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isLive]);
  
  // Auto-scroll to top when new transcripts arrive (since latest is at top)
  useEffect(() => {
    if (scrollRef.current && transcripts.length > 0) {
      // Use requestAnimationFrame to ensure DOM has been updated
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = 0;
        }
      });
    }
  }, [transcripts]);
  
  // ENHANCED: Auto-scroll to top when new insights arrive with improved reliability
  useEffect(() => {
    if (insightsScrollRef.current && insights.length > 0) {
      // Use requestAnimationFrame to ensure DOM has been updated
      requestAnimationFrame(() => {
        if (insightsScrollRef.current) {
          // Scroll to the very top to show the newest insight
          insightsScrollRef.current.scrollTop = 0;
          
          // Add a small delay to handle any potential layout shifts
          setTimeout(() => {
            if (insightsScrollRef.current) {
              insightsScrollRef.current.scrollTop = 0;
            }
          }, 50);
        }
      });
    }
  }, [insights]);
  
  // Inactivity detection
  useEffect(() => {
    if (isLive && lastTranscriptTime > 0) {
      if (transcriptTimeoutRef.current) {
        clearTimeout(transcriptTimeoutRef.current);
      }
      
      transcriptTimeoutRef.current = setTimeout(() => {
        const inactiveTime = Date.now() - lastTranscriptTime;
        if (inactiveTime > 60000) { // 1 minute of inactivity
          toast({
            title: "No speech detected",
            description: "The call seems to be inactive. Consider ending it if the conversation is over.",
            variant: "destructive"
          });
        }
      }, 60000); // Check after 1 minute
    }
    
    return () => {
      if (transcriptTimeoutRef.current) {
        clearTimeout(transcriptTimeoutRef.current);
        transcriptTimeoutRef.current = null;
      }
    };
  }, [lastTranscriptTime, isLive, toast]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (messagePollingRef.current) clearInterval(messagePollingRef.current);
      if (transcriptTimeoutRef.current) clearTimeout(transcriptTimeoutRef.current);
      
      // Clean up Ably subscriptions
      ablySubscriptionsRef.current.forEach(subscription => {
        try {
          if (subscription && typeof subscription.unsubscribe === 'function') {
            subscription.unsubscribe();
          }
        } catch (error) {
          console.error('Error unsubscribing from Ably:', error);
        }
      });
      ablySubscriptionsRef.current = [];
    };
  }, []);
  
  // Poll for desktop messages when desktop call is active
  useEffect(() => {
    const pollDesktopMessages = async () => {
      if (!desktopCallActive || isPollingMessages) return;
      
      try {
        setIsPollingMessages(true);
        
        const response = await fetch('/api/desktop-sync?action=get-messages-for-webapp');
        const data = await response.json();
        
        if (data.messages && data.messages.length > 0) {
          for (const message of data.messages) {
            await processDesktopMessage(message);
            
            // Acknowledge message processing
            if (message.id) {
              try {
                await fetch('/api/desktop-sync', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    type: 'message-ack',
                    messageId: message.id
                  })
                });
                console.log('✅ Acknowledged message:', message.id);
              } catch (ackError) {
                console.error('❌ Error acknowledging message:', ackError);
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ Error polling for desktop messages:', error);
      } finally {
        setIsPollingMessages(false);
      }
    };
    
    if (desktopCallActive) {
      // Poll immediately on first activation
      pollDesktopMessages();
      
      // Set up polling interval
      messagePollingRef.current = setInterval(pollDesktopMessages, 2000);
    } else {
      // Clear polling interval when not needed
      if (messagePollingRef.current) {
        clearInterval(messagePollingRef.current);
        messagePollingRef.current = null;
      }
    }
    
    return () => {
      if (messagePollingRef.current) {
        clearInterval(messagePollingRef.current);
        messagePollingRef.current = null;
      }
    };
  }, [desktopCallActive, isPollingMessages]);
  
  // Process messages from desktop app
  const processDesktopMessage = async (message: any) => {
    console.log('📨 Processing desktop message:', message);
    
    if (!message || !message.content) {
      console.log('⚠️ Invalid message format:', message);
      return;
    }
    
    const { content } = message;
    
    switch (content.type) {
      case 'desktop-call-started':
        console.log('🚀 Desktop call started message received');
        console.log('🚀 Device settings:', content.deviceSettings);
        
        // Store the API key and audio parameters for later use
        if (content.deepgramApiKey) {
          setDeepgramApiKey(content.deepgramApiKey);
          console.log('🔑 Stored Deepgram API key:', content.deepgramApiKey ? `${content.deepgramApiKey.substring(0, 8)}...` : 'none');
        }
        if (content.deviceSettings?.mimeType) {
          setMimeType(content.deviceSettings.mimeType);
          console.log('🎤 Stored MIME type:', content.deviceSettings.mimeType);
        }
        
        // Mark that we've received the desktop call started message
        setDesktopCallStarted(true);
        
        break;
        
      case 'desktop-call-stopped':
        console.log('🛑 Desktop call stopped message received');
        
        // If we're live, stop the call
        if (isLive) {
          await stopLive();
        }
        break;
        
      default:
        console.log('❓ Unknown message type from desktop:', content.type);
    }
  };
  
  // Start live call analysis
  const startLive = async () => {
    if (isLive || isInitializing) return;
    
    try {
      setIsInitializing(true);
      setIsLoading(true);
      
      console.log('🚀 Starting live call analysis');
      console.log('🚀 Deepgram API key available:', !!deepgramApiKey);
      console.log('🚀 MIME type available:', !!mimeType);
      
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to start call analysis",
          variant: "destructive"
        });
        return;
      }
      
      // Create a new call record
      const newCall = await CallsService.createCall({
        user_id: user.id,
        status: 'active',
        start_time: new Date().toISOString()
      });
      
      if (!newCall) {
        throw new Error("Failed to create call record");
      }
      
      setCallId(newCall.id);
      console.log('✅ Created call record:', newCall.id);
      
      // If this is a desktop-initiated call, set up Ably communication
      if (desktopCallActive && isAblyAvailable()) {
        const channels = getAblyChannels();
        
        if (channels && deepgramApiKey && mimeType) {
          console.log('🔗 Setting up Ably communication for desktop call');
          
          // Send start-transcription message to desktop
          await channels.controlChannel.publish('start-transcription', {
            deepgramApiKey: deepgramApiKey,
            mimeType: mimeType,
            callId: newCall.id,
            timestamp: Date.now()
          });
          
          console.log('✅ Sent start-transcription message to desktop');
          
          // Subscribe to Deepgram results from desktop
          const resultsSubscription = channels.resultsChannel.subscribe((message) => {
            console.log('📨 Received Deepgram result via Ably:', message.name);
            handleDeepgramResult(message, newCall.id);
          });
          
          // Subscribe to Deepgram errors from desktop
          const errorSubscription = channels.resultsChannel.subscribe('deepgram-error', (message) => {
            console.error('❌ Received Deepgram error via Ably:', message.data);
            
            // Add error to state
            setDeepgramErrors(prev => [...prev, `${message.data.error}: ${message.data.details || 'No details provided'}`]);
            
            // Show toast notification
            toast({
              title: "Deepgram Error",
              description: message.data.error || "An error occurred with speech recognition",
              variant: "destructive"
            });
          });
          
          ablySubscriptionsRef.current.push(resultsSubscription, errorSubscription);
          console.log('✅ Subscribed to Deepgram results channel');
        } else {
          console.error('❌ Missing required data for Ably communication');
          console.log('Channels available:', !!channels);
          console.log('Deepgram API key available:', !!deepgramApiKey);
          console.log('MIME type available:', !!mimeType);
          
          toast({
            title: "Configuration Error",
            description: "Missing required configuration for call analysis. Check console for details.",
            variant: "destructive"
          });
        }
      } else {
        // Set up regular Supabase real-time subscriptions for manual calls
        console.log('📡 Setting up Supabase real-time subscriptions');
        
        const transcriptSubscription = supabase
          .channel(`call-transcripts-${newCall.id}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'call_transcripts',
            filter: `call_id=eq.${newCall.id}`
          }, (payload) => {
            console.log('📝 New transcript received:', payload.new);
            
            const newTranscript = payload.new as Transcript;
            
            // Show all transcripts for debugging, not just final ones
            setTranscripts(prev => [...prev, newTranscript]);
            setLastTranscriptTime(Date.now());
          })
          .subscribe();
        
        const insightSubscription = supabase
          .channel(`call-insights-${newCall.id}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'ai_insights',
            filter: `call_id=eq.${newCall.id}`
          }, (payload) => {
            console.log('🧠 New insight received:', payload.new);
            
            const newInsight = payload.new as Insight;
            setInsights(prev => [newInsight, ...prev]); // Add new insights at the beginning
            
            // Show toast for important insights
            if (['objection', 'buying-signal', 'warning'].includes(newInsight.type)) {
              toast({
                title: getInsightTitle(newInsight.type),
                description: newInsight.content,
                variant: newInsight.type === 'warning' ? 'destructive' : 'default'
              });
            }
          })
          .subscribe();
        
        ablySubscriptionsRef.current.push(transcriptSubscription, insightSubscription);
      }
      
      setIsLive(true);
      setIsLoading(false);
      setIsInitializing(false);
      
      console.log('✅ Live call analysis started successfully');
      
      // Notify web app that call has started
      try {
        await fetch('/api/desktop-sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'web-app-call-started-confirmation',
            timestamp: Date.now()
          })
        });
        console.log('✅ Sent web-app-call-started-confirmation to API');
      } catch (error) {
        console.error('❌ Error sending call started confirmation:', error);
      }
      
    } catch (error) {
      console.error('❌ Error starting live call analysis:', error);
      
      toast({
        title: "Failed to start call",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
      
      setIsLive(false);
      setIsLoading(false);
      setIsInitializing(false);
    }
  };
  
  // Stop live call analysis
  const stopLive = async () => {
    console.log('🛑 stopLive function called');
    console.log('🛑 Current state:', { isLive, callId, isEndingCall });
    
    if (!isLive || !callId || isEndingCall) return;
    
    try {
      setIsEndingCall(true);
      
      // If this is a desktop-initiated call, send stop message via Ably
      if (desktopCallActive && isAblyAvailable()) {
        const channels = getAblyChannels();
        
        if (channels) {
          await channels.controlChannel.publish('stop-transcription', {
            callId: callId,
            timestamp: Date.now()
          });
          
          console.log('✅ Sent stop-transcription message to desktop');
        }
      }
      
      // Clean up Ably subscriptions
      ablySubscriptionsRef.current.forEach(subscription => {
        try {
          if (subscription && typeof subscription.unsubscribe === 'function') {
            subscription.unsubscribe();
          }
        } catch (error) {
          console.error('Error unsubscribing from Ably:', error);
        }
      });
      ablySubscriptionsRef.current = [];
      
      // End the call in the database
      await CallsService.endCall(callId, 'pending');
      
      // Reset state
      setIsLive(false);
      setShowFeedback(true);
      setDesktopCallStarted(false);
      setDeepgramErrors([]);
      
      // Notify web app that call has stopped
      try {
        await fetch('/api/desktop-sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'web-app-call-stopped-confirmation',
            timestamp: Date.now()
          })
        });
        console.log('✅ Sent web-app-call-stopped-confirmation to API');
      } catch (error) {
        console.error('❌ Error sending call stopped confirmation:', error);
      }
      
    } catch (error) {
      console.error('❌ Error stopping live call analysis:', error);
      
      toast({
        title: "Failed to end call",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
      
    } finally {
      setIsEndingCall(false);
      
      // Notify parent component
      onCallEnd();
      
      console.log('🛑 stopLive completed');
    }
  };
  
  // FIXED: Handle Deepgram results from Ably with robust transcript management
  const handleDeepgramResult = async (message: any, currentCallId: string) => {
    try {
      console.log('🔍 Processing Deepgram result message:', message);
      
      // Check if this is a connection status message
      if (message.name === 'deepgram-connected') {
        console.log('🔗 Received Deepgram connected status');
        return;
      }
      
      if (message.name === 'deepgram-disconnected') {
        console.log('🔗 Received Deepgram disconnected status');
        return;
      }
      
      if (message.name === 'deepgram-error') {
        console.error('❌ Received Deepgram error:', message.data);
        
        // Add to errors state
        setDeepgramErrors(prev => [...prev, `${message.data.error}: ${message.data.details || 'No details provided'}`]);
        
        return;
      }
      
      // For actual transcription results
      if (message.name === 'deepgram-result' && message.data?.data?.type === 'Results' && message.data.data.channel?.alternatives?.[0]?.transcript) {
        const alternative = message.data.data.channel.alternatives[0];
        const transcript = alternative.transcript.trim();
        const isFinal = message.data.data.is_final;
        
        if (transcript) {
          console.log('📝 Processing transcript from Deepgram:', transcript);
          console.log('📝 Is final:', isFinal);
          
          // FIXED: Extract speaker ID from Deepgram's speaker diarization
          let speakerId = 0; // Default to salesperson
          let speakerName = 'You'; // Default speaker name
          
          // Check if we have word-level speaker information
          if (alternative.words && alternative.words.length > 0) {
            // Count speaker occurrences to determine dominant speaker
            const speakerCounts = new Map<number, number>();
            
            alternative.words.forEach((word: any) => {
              if (word.speaker !== undefined) {
                const currentCount = speakerCounts.get(word.speaker) || 0;
                speakerCounts.set(word.speaker, currentCount + 1);
              }
            });
            
            if (speakerCounts.size > 0) {
              // Find the speaker with the most words in this segment
              let maxCount = 0;
              let dominantSpeaker = 0;
              
              for (const [speaker, count] of speakerCounts.entries()) {
                if (count > maxCount) {
                  maxCount = count;
                  dominantSpeaker = speaker;
                }
              }
              
              speakerId = dominantSpeaker;
              speakerName = dominantSpeaker === 0 ? 'You' : 'Customer';
              
              console.log('🎯 Speaker diarization results:');
              console.log('🎯 Speaker counts:', Object.fromEntries(speakerCounts));
              console.log('🎯 Dominant speaker:', dominantSpeaker);
              console.log('🎯 Assigned speaker name:', speakerName);
            }
          }
          
          // CRITICAL FIX: Robust transcript state management
          const tempId = uuidv4(); // Generate temporary ID for interim transcripts
          
          setTranscripts(prev => {
            const newTranscripts = [...prev];
            
            // Check if this is an update to an existing interim transcript
            if (!isFinal && newTranscripts.length > 0) {
              const lastTranscript = newTranscripts[newTranscripts.length - 1];
              
              // If the last transcript is from the same speaker and is not final, update it
              if (lastTranscript.speaker_id === speakerId && !lastTranscript.is_final) {
                console.log('🔄 Updating existing interim transcript');
                lastTranscript.content = transcript;
                lastTranscript.confidence = alternative.confidence || 0.9;
                return newTranscripts;
              }
            }
            
            // Create new transcript entry
            const newTranscript: Transcript = {
              id: isFinal ? '' : tempId, // Will be updated with DB ID if final
              call_id: currentCallId,
              speaker_id: speakerId,
              speaker_name: speakerName,
              content: transcript,
              timestamp_offset: Math.floor(elapsedTime),
              confidence: alternative.confidence || 0.9,
              is_final: isFinal,
              temp_id: isFinal ? undefined : tempId
            };
            
            console.log('➕ Adding new transcript:', {
              speaker: speakerName,
              isFinal,
              content: transcript.substring(0, 50) + '...'
            });
            
            newTranscripts.push(newTranscript);
            return newTranscripts;
          });
          
          setLastTranscriptTime(Date.now());
          
          // FIXED: Only persist and process final transcripts
          if (isFinal) {
            try {
              // Create transcript record in database
              const persistedTranscript = await CallsService.addTranscript({
                call_id: currentCallId,
                speaker_id: speakerId,
                speaker_name: speakerName,
                content: transcript,
                timestamp_offset: Math.floor(elapsedTime),
                confidence: alternative.confidence || 0.9,
                is_final: true
              });
              
              if (persistedTranscript) {
                // Update the transcript in state with the database ID
                setTranscripts(prev => 
                  prev.map(t => 
                    t.temp_id === tempId || (t.speaker_id === speakerId && t.content === transcript && !t.id)
                      ? { ...t, id: persistedTranscript.id, temp_id: undefined }
                      : t
                  )
                );
                
                console.log('✅ Transcript persisted with ID:', persistedTranscript.id);
                
                // CRITICAL FIX: Process for AI insights with enhanced logging
                console.log('🧠 AI INSIGHTS: About to process transcript for AI analysis');
                console.log('🧠 AI INSIGHTS: Transcript content:', transcript);
                console.log('🧠 AI INSIGHTS: Transcript length:', transcript.length);
                console.log('🧠 AI INSIGHTS: Speaker:', speakerName);
                console.log('🧠 AI INSIGHTS: Call ID:', currentCallId);
                
                await processTranscript(persistedTranscript, currentCallId);
              }
            } catch (error) {
              console.error('❌ Error persisting transcript:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Error handling Deepgram result:', error);
      
      // Add to errors state
      setDeepgramErrors(prev => [...prev, `Error processing transcript: ${error instanceof Error ? error.message : String(error)}`]);
      
      // Show toast notification for critical errors
      toast({
        title: "Transcription Error",
        description: "Failed to process speech recognition result",
        variant: "destructive"
      });
    }
  };
  
  // CRITICAL FIX: Process transcript for analysis with explicit callId parameter
  const processTranscript = async (transcript: Transcript, currentCallId: string) => {
    console.log('🧠 AI INSIGHTS: processTranscript called');
    console.log('🧠 AI INSIGHTS: Call ID:', currentCallId);
    console.log('🧠 AI INSIGHTS: Transcript content:', transcript.content);
    console.log('🧠 AI INSIGHTS: Content length:', transcript.content.length);
    
    if (!currentCallId || !transcript.content) {
      console.log('🧠 AI INSIGHTS: Skipping - missing callId or content');
      return;
    }
    
    // CRITICAL FIX: Relaxed minimum length requirement (was 30, now 10)
    if (transcript.content.length < 10) {
      console.log('🧠 AI INSIGHTS: Skipping - content too short (less than 10 characters)');
      return;
    }
    
    try {
      setIsProcessing(true);
      console.log('🧠 AI INSIGHTS: Starting AI analysis request');
      
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: transcript.content,
          speakerId: transcript.speaker_id
        })
      });
      
      console.log('🧠 AI INSIGHTS: API response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('🧠 AI INSIGHTS: API error response:', errorData);
        throw new Error(errorData.error || 'Failed to analyze transcript');
      }
      
      const data = await response.json();
      console.log('🧠 AI INSIGHTS: API response data:', data);
      
      // CRITICAL FIX: Relaxed filtering for AI analysis results
      if (data.analysis && data.analysis.trim() && data.analysis.trim().length > 5) {
        console.log('🧠 AI INSIGHTS: Valid analysis received:', data.analysis);
        
        // Determine insight type based on content
        const type = determineInsightType(data.analysis);
        console.log('🧠 AI INSIGHTS: Determined insight type:', type);
        
        // Store insight in database
        const newInsight = await CallsService.addInsight({
          call_id: currentCallId,
          transcript_id: transcript.id,
          type,
          content: data.analysis,
          timestamp_offset: transcript.timestamp_offset
        });
        
        if (newInsight) {
          console.log('🧠 AI INSIGHTS: Insight stored in database:', newInsight.id);
          setInsights(prev => [newInsight, ...prev]); // Add new insights at the beginning
          
          // Show toast for important insights
          if (['objection', 'buying-signal', 'warning'].includes(type)) {
            toast({
              title: getInsightTitle(type),
              description: data.analysis,
              variant: type === 'warning' ? 'destructive' : 'default'
            });
          }
          
          console.log('🧠 AI INSIGHTS: Insight successfully added to state and UI');
        } else {
          console.error('🧠 AI INSIGHTS: Failed to store insight in database');
        }
      } else {
        console.log('🧠 AI INSIGHTS: No valid analysis content received or content too short');
        console.log('🧠 AI INSIGHTS: Raw analysis:', data.analysis);
      }
      
    } catch (error) {
      console.error('❌ AI INSIGHTS: Error processing transcript:', error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Determine insight type based on content
  const determineInsightType = (content: string): Insight['type'] => {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('objection') || lowerContent.includes('concern')) {
      return 'objection';
    } else if (lowerContent.includes('buying signal') || lowerContent.includes('interest')) {
      return 'buying-signal';
    } else if (lowerContent.includes('warning') || lowerContent.includes('caution')) {
      return 'warning';
    } else if (lowerContent.includes('good move') || lowerContent.includes('well done')) {
      return 'good-move';
    } else if (lowerContent.includes('next step') || lowerContent.includes('should')) {
      return 'next-step';
    } else {
      return 'opportunity';
    }
  };
  
  // Get insight title based on type
  const getInsightTitle = (type: Insight['type']): string => {
    switch (type) {
      case 'objection': return 'Customer Objection';
      case 'opportunity': return 'Sales Opportunity';
      case 'buying-signal': return 'Buying Signal Detected';
      case 'warning': return 'Warning';
      case 'good-move': return 'Good Move';
      case 'next-step': return 'Suggested Next Step';
      default: return 'AI Insight';
    }
  };
  
  // Get insight icon based on type
  const getInsightIcon = (type: Insight['type']) => {
    switch (type) {
      case 'objection': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'opportunity': return <Lightbulb className="h-4 w-4 text-blue-500" />;
      case 'buying-signal': return <Target className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'good-move': return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'next-step': return <TrendingUp className="h-4 w-4 text-purple-500" />;
      default: return <Brain className="h-4 w-4 text-gray-500" />;
    }
  };
  
  // Get insight color class based on type
  const getInsightColorClass = (type: Insight['type']): string => {
    switch (type) {
      case 'objection': 
        return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
      case 'opportunity': 
        return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800';
      case 'buying-signal': 
        return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800';
      case 'warning': 
        return 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800';
      case 'good-move': 
        return 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800';
      case 'next-step': 
        return 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800';
      default: 
        return 'bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-800';
    }
  };
  
  // Format timestamp
  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  // Handle feedback modal close
  const handleFeedbackClose = () => {
    setShowFeedback(false);
    setCallId(null);
    setTranscripts([]);
    setInsights([]);
    setDeepgramApiKey(null);
    setMimeType(null);
    setDeepgramErrors([]);
  };
  
  // FIXED: Group transcripts by speaker for chat bubble display with robust speaker separation
  const groupedTranscripts = transcripts.reduce((groups: TranscriptGroup[], transcript, index) => {
    // If this is the first transcript or the speaker changed from the previous one
    if (index === 0 || transcript.speaker_id !== transcripts[index - 1].speaker_id) {
      // Start a new group
      groups.push({
        speaker_id: transcript.speaker_id,
        speaker_name: transcript.speaker_name,
        transcripts: [transcript],
        timestamp_offset: transcript.timestamp_offset,
        is_final: transcript.is_final
      });
    } else {
      // Add to the last group and update the group's final status
      const lastGroup = groups[groups.length - 1];
      lastGroup.transcripts.push(transcript);
      lastGroup.is_final = transcript.is_final; // Update to latest transcript's final status
    }
    return groups;
  }, []);
  
  // Reverse the groups so latest conversation appears at the top
  const reversedGroups = [...groupedTranscripts].reverse();
  
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transcript Column */}
        <Card>
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Live Transcript</h3>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {formatTimestamp(elapsedTime)}
              </Badge>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={stopLive}
                disabled={isEndingCall || !isLive}
              >
                {isEndingCall ? "Ending..." : "End Call"}
              </Button>
            </div>
          </div>
          
          <ScrollArea className="h-[500px] p-4" ref={scrollRef}>
            {transcripts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No transcripts yet</h3>
                <p className="text-muted-foreground max-w-md">
                  {isLive 
                    ? "Waiting for conversation to begin. Start speaking to see the transcript appear here."
                    : "Start a call to begin transcription and analysis."}
                </p>
                
                {/* Display Deepgram errors if any */}
                {deepgramErrors.length > 0 && (
                  <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md w-full max-w-md">
                    <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Deepgram Connection Issues
                    </h4>
                    <ul className="mt-2 text-xs text-red-600 dark:text-red-400 space-y-1">
                      {deepgramErrors.slice(0, 3).map((error, index) => (
                        <li key={index} className="ml-4 list-disc">{error}</li>
                      ))}
                      {deepgramErrors.length > 3 && (
                        <li className="ml-4 list-disc">{`${deepgramErrors.length - 3} more errors...`}</li>
                      )}
                    </ul>
                    <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                      Try checking your microphone and audio settings, or restart the call.
                    </p>
                  </div>
                )}
                
                {/* Audio status information */}
                {isLive && transcripts.length === 0 && (
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md w-full max-w-md">
                    <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                      <Mic className="h-4 w-4" />
                      Audio Status
                    </h4>
                    <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                      <p className="mb-1">• MIME Type: {mimeType || 'Not detected'}</p>
                      <p className="mb-1">• Deepgram Connected: {deepgramErrors.length === 0 ? 'Yes' : 'No'}</p>
                    </div>
                    <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                      Speak clearly to begin transcription. If no audio is detected, check your microphone settings.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {/* ENHANCED: Render grouped transcripts as chat bubbles with colored backgrounds */}
                {reversedGroups.map((group, groupIndex) => {
                  const isSalesperson = group.speaker_id === 0;
                  
                  // Combine all transcript content in the group
                  const combinedContent = group.transcripts.map(t => t.content).join(' ');
                  
                  return (
                    <div 
                      key={`group-${groupIndex}-${group.speaker_id}-${group.timestamp_offset}`} 
                      className={cn(
                        "flex w-full",
                        isSalesperson ? "justify-end" : "justify-start"
                      )}
                    >
                      <div className={cn(
                        "flex gap-3 max-w-[80%]",
                        isSalesperson ? "flex-row-reverse" : "flex-row"
                      )}>
                        <div className={cn(
                          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium",
                          isSalesperson ? "bg-blue-500 text-white" : "bg-green-500 text-white"
                        )}>
                          {isSalesperson ? 'Y' : 'C'}
                        </div>
                        
                        <div className="flex-1 space-y-2">
                          <div className={cn(
                            "flex items-center gap-2 mb-1",
                            isSalesperson ? "justify-end" : "justify-start"
                          )}>
                            <span className="text-sm font-medium">
                              {group.speaker_name || `Speaker ${group.speaker_id + 1}`}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatTimestamp(group.timestamp_offset)}
                            </span>
                          </div>
                          
                          <div className={cn(
                            "p-3 rounded-lg",
                            isSalesperson 
                              ? "bg-blue-100 dark:bg-blue-900/20 text-foreground rounded-tr-none" 
                              : "bg-green-100 dark:bg-green-900/20 text-foreground rounded-tl-none"
                          )}>
                            <div className="flex flex-col">
                              <p className="text-sm leading-relaxed">{combinedContent}</p>
                              <div className="flex items-center justify-end gap-2 mt-1">
                                <Badge 
                                  variant={group.is_final ? "default" : "outline"} 
                                  className="text-[10px] px-1 py-0 h-4"
                                >
                                  {group.is_final ? "Final" : "Interim"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* Loading indicator for new transcripts */}
                {isProcessing && (
                  <div className="flex items-center justify-center py-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span className="ml-2 text-xs text-muted-foreground">Processing...</span>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </Card>
        
        {/* Insights Column */}
        <Card>
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">AI Insights</h3>
            </div>
            <Badge variant="outline">
              {insights.length} insights
            </Badge>
          </div>
          
          <ScrollArea className="h-[500px] p-4" ref={insightsScrollRef}>
            {insights.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <Brain className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No insights yet</h3>
                <p className="text-muted-foreground max-w-md">
                  {isLive 
                    ? "AI is analyzing your conversation. Insights will appear here as the call progresses."
                    : "Start a call to receive AI-powered sales coaching insights."}
                </p>
                
                {/* Debug information for AI insights */}
                {isLive && (
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md w-full max-w-md">
                    <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                      <Brain className="h-4 w-4" />
                      AI Analysis Status
                    </h4>
                    <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                      <p className="mb-1">• Processing: {isProcessing ? 'Active' : 'Idle'}</p>
                      <p className="mb-1">• Final transcripts: {transcripts.filter(t => t.is_final).length}</p>
                      <p className="mb-1">• OpenAI configured: Yes</p>
                    </div>
                    <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                      Insights are generated when conversation segments are finalized.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* ENHANCED: Display insights with newest at top and color-coded backgrounds */}
                {insights.map((insight) => (
                  <div 
                    key={insight.id} 
                    className={cn(
                      "p-4 border rounded-lg", 
                      getInsightColorClass(insight.type)
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {getInsightIcon(insight.type)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline">
                            {getInsightTitle(insight.type)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(insight.timestamp_offset)}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed">{insight.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </Card>
      </div>
      
      {/* Call Feedback Modal */}
      {showFeedback && callId && (
        <CallFeedbackModal
          isOpen={showFeedback}
          onClose={handleFeedbackClose}
          callId={callId}
          callDuration={elapsedTime}
          transcripts={transcripts}
          insights={insights}
        />
      )}
    </>
  );
}