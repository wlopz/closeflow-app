'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Mic, MicOff, AlertTriangle, CheckCircle2, Info, Lightbulb, Target, TrendingUp, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/supabase/hooks';
import { CallsService } from '@/lib/supabase/calls';
import { CallFeedbackModal } from '@/components/dashboard/call-feedback-modal';
import * as Ably from 'ably';

interface Message {
  id: string;
  text: string;
  speakerId: number;
  timestamp: number;
}

interface Analysis {
  type: 'objection' | 'opportunity' | 'buying-signal' | 'warning' | 'good-move' | 'next-step';
  content: string;
  timestamp: number;
  messageId?: string;
  speakerId?: number;
}

const SPEAKER_COLORS = [
  {
    bg: 'bg-blue-500',
    text: 'text-white',
    lightBg: 'bg-blue-50',
    darkBg: 'dark:bg-blue-900/20',
    name: 'You',
    side: 'right'
  },
  {
    bg: 'bg-green-500',
    text: 'text-white',
    lightBg: 'bg-green-50',
    darkBg: 'dark:bg-green-900/20',
    name: 'Customer',
    side: 'left'
  }
];

interface CallAnalyzerProps {
  onCallEnd?: () => void;
  onDesktopCallStateChange?: (isActive: boolean) => void;
  isDesktopInitiatedCall?: boolean;
}

export function CallAnalyzer({ onCallEnd, onDesktopCallStateChange, isDesktopInitiatedCall }: CallAnalyzerProps) {
  const [live, setLive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [insights, setInsights] = useState<Analysis[]>([]);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [callStartTime, setCallStartTime] = useState<number>(0);
  const [desktopConnected, setDesktopConnected] = useState(false);
  const [deepgramConnected, setDeepgramConnected] = useState(false);
  
  // CRITICAL FIX: Add state for Deepgram API key received from desktop
  const [deepgramApiKeyFromDesktop, setDeepgramApiKeyFromDesktop] = useState<string | null>(null);
  const [mimeTypeFromDesktop, setMimeTypeFromDesktop] = useState<string | null>(null);
  
  // State for building complete conversations
  const [currentSpeaker, setCurrentSpeaker] = useState<number | null>(null);
  const [currentConversation, setCurrentConversation] = useState<string>('');
  
  // Refs for managing conversation accumulation
  const conversationAccumulator = useRef<string>('');
  const lastSpeaker = useRef<number | null>(null);
  const silenceTimer = useRef<NodeJS.Timeout | null>(null);
  const lastTranscriptTime = useRef<number>(Date.now());
  const longSpeechTimer = useRef<NodeJS.Timeout | null>(null);
  const currentSegmentStartTime = useRef<number>(0);
  
  // Ably client and channels
  const ablyClient = useRef<Ably.Realtime | null>(null);
  const controlChannel = useRef<Ably.RealtimeChannel | null>(null);
  const resultsChannel = useRef<Ably.RealtimeChannel | null>(null);
  
  const recorderRef = useRef<MediaRecorder>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user, loading } = useAuth();

  // NEW: Function to fetch messages from desktop_messages_queue
  const fetchDesktopMessages = async () => {
    try {
      console.log('📨 ENHANCED LOGGING: Fetching messages from desktop_messages_queue');
      
      const response = await fetch('/api/desktop-sync?action=get-messages-for-webapp');
      const data = await response.json();
      
      console.log('🔍 DEBUG: Raw messages received from API:', data.messages);

      if (data.messages && data.messages.length > 0) {
        for (const msg of data.messages) {
          console.log('🔍 DEBUG: Processing message:', msg);
          console.log('🔍 DEBUG: Message content:', msg.content);
          console.log('🔍 DEBUG: Type of message content:', typeof msg.content);

          if (msg.message_type === 'desktop-call-started') {
            console.log('🎯 ENHANCED LOGGING: Received desktop-call-started message');
            console.log('🎯 ENHANCED LOGGING: Device settings received:', msg.content.deviceSettings);
            console.log('🎯 ENHANCED LOGGING: Deepgram API key received:', msg.content.deepgramApiKey ? 'Present' : 'Missing');
            console.log('🎯 ENHANCED LOGGING: MIME type from desktop:', msg.content.deviceSettings?.mimeType);
            
            // CRITICAL FIX: Store the Deepgram API key in state instead of process.env
            setDeepgramApiKeyFromDesktop(msg.content.deepgramApiKey);
            setMimeTypeFromDesktop(msg.content.deviceSettings?.mimeType || null);
            
            // Acknowledge the message
            await acknowledgeMessage(msg.id);
            
            // Trigger start of live analysis
            if (!live && !connecting) {
              console.log('🎯 ENHANCED LOGGING: Starting live analysis with desktop-provided API key');
              await startLive(true);
            }
          } else if (msg.message_type === 'desktop-call-stopped') {
            console.log('🛑 ENHANCED LOGGING: Received desktop-call-stopped message');
            await acknowledgeMessage(msg.id);
            if (live) {
              stopLive();
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ ENHANCED LOGGING: Error fetching desktop messages:', error);
    }
  };

  // NEW: Function to acknowledge message processing
  const acknowledgeMessage = async (messageId: string) => {
    try {
      console.log('✅ ENHANCED LOGGING: Acknowledging message:', messageId);
      
      const response = await fetch('/api/desktop-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'message-ack',
          messageId
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to acknowledge message');
      }
      
      console.log('✅ ENHANCED LOGGING: Message acknowledged successfully:', messageId);
      return true;
    } catch (error) {
      console.error('❌ ENHANCED LOGGING: Error acknowledging message:', error);
      return false;
    }
  };

  // NEW: Periodically check for messages from desktop
  useEffect(() => {
    if (desktopConnected) {
      console.log('📨 ENHANCED LOGGING: Setting up desktop message polling');
      
      // Initial check
      fetchDesktopMessages();
      
      // Set up interval for checking
      const interval = setInterval(fetchDesktopMessages, 2000);
      
      return () => {
        console.log('📨 ENHANCED LOGGING: Cleaning up desktop message polling');
        clearInterval(interval);
      };
    }
  }, [desktopConnected]);

  // CRITICAL FIX: React to desktop call initiation from parent
  useEffect(() => {
    const handleDesktopInitiation = async () => {
      console.log('🎯 ENHANCED LOGGING: CallAnalyzer checking desktop initiation');
      console.log('🎯 ENHANCED LOGGING: isDesktopInitiatedCall:', isDesktopInitiatedCall);
      console.log('🎯 ENHANCED LOGGING: Current state:', { live, connecting, loading });
      console.log('🎯 ENHANCED LOGGING: User authenticated:', !!user);
      
      // Only proceed if desktop initiated, not already live/connecting, auth is complete, and user is authenticated
      if (isDesktopInitiatedCall && !live && !connecting && !loading && user) {
        console.log('🎯 ENHANCED LOGGING: All conditions met, starting live analysis for desktop call');
        
        // Signal to parent that we're now actively handling the desktop call
        if (onDesktopCallStateChange) {
          onDesktopCallStateChange(true);
        }
        
        // Start the live analysis
        await startLive(true);
      } else if (isDesktopInitiatedCall && loading) {
        console.log('⏳ ENHANCED LOGGING: Desktop call initiated but authentication still loading');
      } else if (isDesktopInitiatedCall && !user) {
        console.log('❌ ENHANCED LOGGING: Desktop call initiated but no authenticated user');
        
        // Signal to parent that we can't handle the desktop call
        if (onDesktopCallStateChange) {
          onDesktopCallStateChange(false);
        }
      }
    };
    
    handleDesktopInitiation();
  }, [isDesktopInitiatedCall, live, connecting, loading, user]);

  // Check desktop connection status
  useEffect(() => {
    const checkDesktopConnection = async () => {
      try {
        const response = await fetch('/api/desktop-sync?action=status');
        const data = await response.json();
        setDesktopConnected(data.connected);
      } catch (error) {
        console.error('Error checking desktop status:', error);
        setDesktopConnected(false);
      }
    };

    checkDesktopConnection();
    const interval = setInterval(checkDesktopConnection, 3000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentConversation]);

  // Clear silence timer
  const clearSilenceTimer = () => {
    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
  };

  // Clear long speech timer
  const clearLongSpeechTimer = () => {
    if (longSpeechTimer.current) {
      clearTimeout(longSpeechTimer.current);
      longSpeechTimer.current = null;
    }
  };

  // Finalize the current speaker's complete conversation
  const finalizeCurrentConversation = async () => {
    const finalText = conversationAccumulator.current.trim();
    if (finalText && lastSpeaker.current !== null) {
      console.log(`✅ Finalizing conversation for Speaker ${lastSpeaker.current}: "${finalText}"`);
      
      const newMessage: Message = {
        id: `msg-${Date.now()}-${lastSpeaker.current}`,
        text: finalText,
        speakerId: lastSpeaker.current,
        timestamp: Date.now()
      };
      
      // Add completed message to the top (newest first)
      setMessages(prev => [newMessage, ...prev]);
      
      // Store transcript in database if we have an active call
      if (currentCallId) {
        await CallsService.addTranscript({
          call_id: currentCallId,
          speaker_id: lastSpeaker.current,
          speaker_name: SPEAKER_COLORS[lastSpeaker.current]?.name || `Speaker ${lastSpeaker.current + 1}`,
          content: finalText,
          timestamp_offset: Math.floor((Date.now() - callStartTime) / 1000),
          is_final: true
        });
      }
      
      // Analyze if long enough
      if (finalText.length >= 30) {
        analyzeMessage(finalText, lastSpeaker.current, newMessage.id);
      }
    }
    
    // Reset accumulator and current conversation
    conversationAccumulator.current = '';
    setCurrentConversation('');
    setCurrentSpeaker(null);
    lastSpeaker.current = null;
    
    // Clear timers and reset segment start time
    clearLongSpeechTimer();
    currentSegmentStartTime.current = 0;
  };

  // Handle new transcript from Ably (which gets it from Deepgram via desktop app)
  const handleTranscript = (transcript: string, isFinal: boolean, deepgramSpeaker?: number) => {
    if (!transcript || transcript.trim() === '') return;
    
    console.log(`🎤 Transcript: "${transcript}" (Final: ${isFinal}, Speaker: ${deepgramSpeaker})`);
    
    // Update last transcript time
    lastTranscriptTime.current = Date.now();
    
    // Determine speaker (use Deepgram's speaker or alternate based on message count)
    let speakerId = 0;
    if (deepgramSpeaker !== undefined && deepgramSpeaker >= 0) {
      speakerId = deepgramSpeaker;
    } else {
      // Simple alternating logic if no speaker info
      speakerId = messages.length % 2;
    }
    
    // Check if this is a different speaker
    const isDifferentSpeaker = lastSpeaker.current !== null && lastSpeaker.current !== speakerId;
    
    if (isDifferentSpeaker) {
      // Different speaker detected - finalize previous speaker's conversation
      console.log(`🔄 Speaker change detected: ${lastSpeaker.current} → ${speakerId}`);
      finalizeCurrentConversation();
    }
    
    // Update current speaker
    setCurrentSpeaker(speakerId);
    lastSpeaker.current = speakerId;
    
    if (isFinal) {
      // Set segment start time if this is a new segment
      if (conversationAccumulator.current === '' && currentSegmentStartTime.current === 0) {
        currentSegmentStartTime.current = Date.now();
      }
      
      // For final results, add to the accumulator with proper spacing
      const cleanTranscript = transcript.trim();
      if (conversationAccumulator.current) {
        // Add space if the accumulator doesn't end with punctuation
        const lastChar = conversationAccumulator.current.slice(-1);
        const needsSpace = !['.', '!', '?', ','].includes(lastChar);
        conversationAccumulator.current += (needsSpace ? ' ' : '') + cleanTranscript;
      } else {
        conversationAccumulator.current = cleanTranscript;
      }
      
      // Update the current conversation display
      setCurrentConversation(conversationAccumulator.current);
      
      // Set a timer to finalize after silence (4 seconds for better UX)
      clearSilenceTimer();
      silenceTimer.current = setTimeout(() => {
        // Double-check if enough time has passed since last transcript
        if (Date.now() - lastTranscriptTime.current >= 3500) {
          finalizeCurrentConversation();
        }
      }, 4000);
      
      // Set a timer to finalize after a long continuous speech (e.g., 15 seconds)
      clearLongSpeechTimer();
      longSpeechTimer.current = setTimeout(() => {
        // Only finalize if the current segment has been accumulating for a while
        if (Date.now() - currentSegmentStartTime.current >= 14500) { // 14.5 seconds
          finalizeCurrentConversation();
        }
      }, 15000); // Check every 15 seconds
      
    } else {
      // For interim results, show the accumulated text + current interim
      const cleanTranscript = transcript.trim();
      let displayText = conversationAccumulator.current;
      
      if (displayText && cleanTranscript) {
        // Add space if needed
        const lastChar = displayText.slice(-1);
        const needsSpace = !['.', '!', '?', ','].includes(lastChar);
        displayText += (needsSpace ? ' ' : '') + cleanTranscript;
      } else if (cleanTranscript) {
        displayText = cleanTranscript;
      }
      
      setCurrentConversation(displayText);
    }
  };

  // Analyze message
  const analyzeMessage = async (text: string, speakerId: number, messageId: string) => {
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text, speakerId }),
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.analysis && data.analysis.trim()) {
          const parsedAnalysis = parseAnalysis(data.analysis, messageId, speakerId);
          setInsights(prev => [...parsedAnalysis, ...prev]);
          
          // Store insights in database if we have an active call
          if (currentCallId && parsedAnalysis.length > 0) {
            for (const insight of parsedAnalysis) {
              await CallsService.addInsight({
                call_id: currentCallId,
                type: insight.type,
                content: insight.content,
                timestamp_offset: Math.floor((insight.timestamp - callStartTime) / 1000)
              });

              // Notify desktop app of new insight via Ably
              try {
                if (controlChannel.current) {
                  await controlChannel.current.publish('insight-generated', {
                    content: insight.content,
                    insightType: insight.type,
                    timestamp: Date.now()
                  });
                }
              } catch (error) {
                console.error('Error notifying desktop of insight via Ably:', error);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('Analysis error:', e);
    }
  };

  // Create a new call session in the database
  const createCallSession = async (): Promise<string | null> => {
    console.log('🔐 ENHANCED LOGGING: createCallSession called');
    console.log('🔐 ENHANCED LOGGING: Auth loading state:', loading);
    console.log('🔐 ENHANCED LOGGING: User exists:', !!user);
    
    if (loading) {
      console.log('⚠️ ENHANCED LOGGING: Authentication still loading, cannot create call session yet');
      toast({
        variant: 'destructive',
        title: 'Authentication loading',
        description: 'Please wait for the authentication to complete before starting a call.'
      });
      return null;
    }

    if (!user) {
      console.log('⚠️ ENHANCED LOGGING: No authenticated user, cannot create call session');
      toast({
        variant: 'destructive',
        title: 'Authentication required',
        description: 'Please log in to start a call session.'
      });
      return null;
    }

    try {
      console.log('🔐 ENHANCED LOGGING: Creating call with user ID:', user.id);
      const call = await CallsService.createCall({
        user_id: user.id,
        customer_name: isDesktopInitiatedCall ? 'Desktop Zoom Call' : 'Live Call Session',
        status: 'active'
      });

      if (call) {
        console.log('✅ Created call session:', call.id);
        
        // Notify desktop app of call start via Ably
        try {
          if (controlChannel.current) {
            await controlChannel.current.publish('call-status-update', {
              status: 'started',
              callId: call.id,
              timestamp: Date.now()
            });
          }
        } catch (error) {
          console.error('Error notifying desktop of call start via Ably:', error);
        }
        
        return call.id;
      } else {
        throw new Error('Failed to create call session');
      }
    } catch (error) {
      console.error('❌ Error creating call session:', error);
      toast({
        variant: 'destructive',
        title: 'Database error',
        description: 'Failed to create call session. Please try again.'
      });
      return null;
    }
  };

  // End the call session in the database
  const endCallSession = async (callId: string) => {
    try {
      await CallsService.endCall(callId);
      console.log('✅ Ended call session:', callId);
      
      // Notify desktop app of call end via Ably
      try {
        if (controlChannel.current) {
          await controlChannel.current.publish('call-status-update', {
            status: 'ended',
            callId: callId,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.error('Error notifying desktop of call end via Ably:', error);
      }
    } catch (error) {
      console.error('❌ Error ending call session:', error);
    }
  };

  // Connect to Ably and set up channels
  async function connectWithRetry(deepgramApiKey?: string) {
    console.log('🔗 ENHANCED LOGGING: connectWithRetry function entered');
    console.log('🔗 ENHANCED LOGGING: Starting connectWithRetry function with Ably');
    console.log('🔗 ENHANCED LOGGING: Current state:', { live, connecting });
    console.log('🔗 ENHANCED LOGGING: Deepgram API key provided:', !!deepgramApiKey);
    
    const ablyApiKey = process.env.NEXT_PUBLIC_ABLY_API_KEY;
    
    // CRITICAL FIX: Use the provided deepgramApiKey parameter or fallback to environment
    const finalDeepgramApiKey = deepgramApiKey || process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
    
    console.log('🔑 ENHANCED LOGGING: Ably API key check - Present:', !!ablyApiKey);
    console.log('🔑 ENHANCED LOGGING: Final Deepgram API key check - Present:', !!finalDeepgramApiKey);
    
    if (!ablyApiKey) {
      console.log('❌ ENHANCED LOGGING: No Ably API key found');
      toast({
        variant: 'destructive',
        title: 'Configuration Error',
        description: 'Ably API key is not configured.'
      });
      return;
    }

    if (!finalDeepgramApiKey) {
      console.log('❌ ENHANCED LOGGING: No Deepgram API key found');
      toast({
        variant: 'destructive',
        title: 'Configuration Error',
        description: 'Deepgram API key is not configured.'
      });
      return;
    }

    // Check authentication state before proceeding
    if (loading) {
      console.log('⏳ ENHANCED LOGGING: Authentication still loading, waiting...');
      toast({
        variant: 'destructive',
        title: 'Authentication loading',
        description: 'Please wait for the authentication to complete before starting a call.'
      });
      return;
    }

    if (!user) {
      console.log('❌ ENHANCED LOGGING: No authenticated user, cannot proceed');
      toast({
        variant: 'destructive',
        title: 'Authentication required',
        description: 'Please log in to start a call session.'
      });
      return;
    }

    // Create call session in database
    console.log('🔗 ENHANCED LOGGING: Creating call session in database...');
    const callId = await createCallSession();
    if (!callId) {
      console.log('❌ ENHANCED LOGGING: Failed to create call session, aborting');
      return; // Error already shown in createCallSession
    }
    setCurrentCallId(callId);
    setCallStartTime(Date.now());

    try {
      setConnecting(true);
      
      // Initialize Ably client
      console.log('🔗 ENHANCED LOGGING: Initializing Ably client...');
      const client = new Ably.Realtime({
        key: ablyApiKey,
        clientId: `webapp-${Date.now()}`,
      });
      
      ablyClient.current = client;

      // Wait for Ably connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Ably connection timeout'));
        }, 10000);

        client.connection.on('connected', () => {
          clearTimeout(timeout);
          console.log('✅ ENHANCED LOGGING: Connected to Ably successfully');
          resolve();
        });

        client.connection.on('failed', (error) => {
          clearTimeout(timeout);
          console.error('❌ ENHANCED LOGGING: Ably connection failed:', error);
          reject(error);
        });
      });

      // Set up channels
      console.log('🔗 ENHANCED LOGGING: Setting up Ably channels...');
      controlChannel.current = client.channels.get('closeflow:desktop-control');
      resultsChannel.current = client.channels.get('closeflow:deepgram-results');

      // Subscribe to Deepgram results
      resultsChannel.current.subscribe((message) => {
        console.log('📨 ENHANCED LOGGING: Received message from Ably:', message.name);
        
        try {
          if (message.name === 'deepgram-result' && message.data?.data) {
            const deepgramResult = message.data.data;
            
            if (deepgramResult.type === 'Results' && deepgramResult.channel?.alternatives?.[0]?.transcript) {
              const transcript = deepgramResult.channel.alternatives[0].transcript;
              const isFinal = deepgramResult.is_final || false;
              
              // Try to get speaker from words array
              let speakerId = undefined;
              const words = deepgramResult.channel.alternatives[0].words;
              if (words && words.length > 0) {
                const speakerCounts = new Map();
                words.forEach((word: any) => {
                  if (word.speaker !== undefined) {
                    speakerCounts.set(word.speaker, (speakerCounts.get(word.speaker) || 0) + 1);
                  }
                });
                
                if (speakerCounts.size > 0) {
                  let maxCount = 0;
                  for (const [speaker, count] of speakerCounts.entries()) {
                    if (count > maxCount) {
                      maxCount = count;
                      speakerId = speaker;
                    }
                  }
                }
              }
              
              handleTranscript(transcript, isFinal, speakerId);
            }
          } else if (message.name === 'deepgram-connected') {
            console.log('✅ ENHANCED LOGGING: Deepgram connected via Ably');
            setDeepgramConnected(true);
            
            toast({
              title: 'Transcription Ready',
              description: 'Connected to Deepgram transcription service via Ably.'
            });
          } else if (message.name === 'deepgram-error') {
            console.error('❌ ENHANCED LOGGING: Deepgram error via Ably:', message.data?.error);
            setDeepgramConnected(false);
            
            toast({
              variant: 'destructive',
              title: 'Transcription Error',
              description: 'Failed to connect to transcription service: ' + message.data?.error
            });
          } else if (message.name === 'deepgram-disconnected') {
            console.log('⚠️ ENHANCED LOGGING: Deepgram disconnected via Ably:', message.data?.closeCode, message.data?.closeReason);
            setDeepgramConnected(false);
            
            if (message.data?.closeCode === 1011) {
              toast({
                variant: 'destructive',
                title: 'Transcription Timeout',
                description: 'Deepgram connection timed out. This may be due to no audio being detected.'
              });
            }
          }
        } catch (error) {
          console.error('❌ ENHANCED LOGGING: Error processing Ably message:', error);
        }
      });

      // Send start transcription command to desktop app
      console.log('🔗 ENHANCED LOGGING: Sending start-transcription command via Ably...');
      console.log('🔑 ENHANCED LOGGING: Deepgram API key being sent from web app:', !!finalDeepgramApiKey);
      console.log('🎤 ENHANCED LOGGING: MIME type being sent:', mimeTypeFromDesktop);
      
      await controlChannel.current.publish('start-transcription', {
        deepgramApiKey: finalDeepgramApiKey,
        mimeType: mimeTypeFromDesktop, // Include MIME type from desktop
        timestamp: Date.now()
      });

      console.log('✅ ENHANCED LOGGING: Start transcription command sent via Ably');
      
      setLive(true);
      setConnecting(false);
      setMessages([]);
      setInsights([]);
      setCurrentConversation('');
      setCurrentSpeaker(null);
      conversationAccumulator.current = '';
      lastSpeaker.current = null;
      clearSilenceTimer();
      clearLongSpeechTimer();
      currentSegmentStartTime.current = 0;
      
      toast({
        title: 'Call Analysis Started',
        description: 'Connected to desktop app via Ably. Transcription is active.'
      });

    } catch (err) {
      console.error('❌ ENHANCED LOGGING: Ably connection error:', err);
      setConnecting(false);
      stopLive();
      
      // End call session if it was created
      if (currentCallId) {
        endCallSession(currentCallId);
        setCurrentCallId(null);
      }
      
      toast({
        variant: 'destructive',
        title: 'Connection Error',
        description: 'Failed to connect to desktop app via Ably. Please try again.'
      });
    }
  }

  const startLive = async (triggeredByDesktop = false) => {
    console.log('🎯 ENHANCED LOGGING: startLive function entered');
    console.log('🎯 ENHANCED LOGGING: startLive function called');
    console.log('🎯 ENHANCED LOGGING: triggeredByDesktop:', triggeredByDesktop);
    console.log('🎯 ENHANCED LOGGING: Current state:', { live, connecting });
    console.log('🎯 ENHANCED LOGGING: Deepgram API key from desktop available:', !!deepgramApiKeyFromDesktop);
    
    // Check authentication state before proceeding
    if (loading) {
      console.log('⏳ ENHANCED LOGGING: Authentication still loading, cannot start call');
      
      toast({
        variant: 'destructive',
        title: 'Authentication loading',
        description: 'Please wait for the authentication to complete before starting a call.'
      });
      return;
    }

    if (!user) {
      console.log('❌ ENHANCED LOGGING: No authenticated user, cannot start call');
      
      toast({
        variant: 'destructive',
        title: 'Authentication required',
        description: 'Please log in to start a call session.'
      });
      return;
    }
    
    // For desktop-triggered calls, we don't need microphone access
    // The desktop app will handle audio capture via system audio
    if (!triggeredByDesktop) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { 
            channelCount: 1, 
            sampleRate: 48000, // CRITICAL FIX: Changed from 16000 to 48000 Hz for Opus compatibility
            echoCancellation: true,
            noiseSuppression: true
          } 
        });

        const recorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus',
        });
        recorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          // Note: For Ably integration, audio data would need to be sent via Ably channels
          // This is currently handled by the desktop app
          console.log('🎤 Audio data available (handled by desktop app via Ably)');
        };
      } catch (err) {
        console.error('Failed to start recording:', err);
        toast({
          variant: 'destructive',
          title: 'Microphone error',
          description: 'Please check your microphone permissions'
        });
        return;
      }
    } else {
      console.log('🎯 ENHANCED LOGGING: Desktop triggered - skipping microphone setup');
    }

    console.log('🎯 ENHANCED LOGGING: About to call connectWithRetry');
    // CRITICAL FIX: Pass the Deepgram API key from desktop to connectWithRetry
    await connectWithRetry(deepgramApiKeyFromDesktop || undefined);
    console.log('🎯 ENHANCED LOGGING: connectWithRetry completed');
  };

  const stopLive = () => {
    console.log('🛑 ENHANCED LOGGING: stopLive function called');
    console.log('🛑 ENHANCED LOGGING: Current state:', { live, connecting });
    
    clearLongSpeechTimer();
    clearSilenceTimer();
    finalizeCurrentConversation();

    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.stop();
      rec.stream.getTracks().forEach(t => t.stop());
      recorderRef.current = undefined;
    }
    
    // Send stop transcription command via Ably
    if (controlChannel.current) {
      console.log('🛑 ENHANCED LOGGING: Sending stop-transcription command via Ably...');
      controlChannel.current.publish('stop-transcription', {
        timestamp: Date.now()
      }).catch(error => {
        console.error('Error sending stop command via Ably:', error);
      });
    }
    
    // Close Ably connection
    if (ablyClient.current) {
      console.log('🛑 ENHANCED LOGGING: Closing Ably connection...');
      ablyClient.current.close();
      ablyClient.current = null;
    }
    
    controlChannel.current = null;
    resultsChannel.current = null;
    
    setLive(false);
    setConnecting(false);
    setDeepgramConnected(false);
    
    // CRITICAL: Signal to parent that desktop call is no longer active
    if (onDesktopCallStateChange) {
      onDesktopCallStateChange(false);
    }
    
    // Show feedback modal if we have a call session
    if (currentCallId) {
      setShowFeedbackModal(true);
    }
    
    console.log('🛑 ENHANCED LOGGING: stopLive completed');
  };

  const handleFeedbackModalClose = () => {
    setShowFeedbackModal(false);
    setCurrentCallId(null);
    setCallStartTime(0);
    
    // Trigger refresh in parent component
    if (onCallEnd) {
      onCallEnd();
    }
  };

  const parseAnalysis = (analysisText: string, messageId: string, speakerId: number): Analysis[] => {
    const insights = [];
    
    // Enhanced parsing for different coaching categories
    if (analysisText.includes('🚨') || analysisText.toLowerCase().includes('objection')) {
      insights.push({
        type: 'objection' as const,
        content: analysisText,
        timestamp: Date.now(),
        messageId,
        speakerId
      });
    } else if (analysisText.includes('💡') || analysisText.toLowerCase().includes('opportunity')) {
      insights.push({
        type: 'opportunity' as const,
        content: analysisText,
        timestamp: Date.now(),
        messageId,
        speakerId
      });
    } else if (analysisText.includes('🎯') || analysisText.toLowerCase().includes('buying signal')) {
      insights.push({
        type: 'buying-signal' as const,
        content: analysisText,
        timestamp: Date.now(),
        messageId,
        speakerId
      });
    } else if (analysisText.includes('⚠️') || analysisText.toLowerCase().includes('warning')) {
      insights.push({
        type: 'warning' as const,
        content: analysisText,
        timestamp: Date.now(),
        messageId,
        speakerId
      });
    } else if (analysisText.includes('✅') || analysisText.toLowerCase().includes('good move')) {
      insights.push({
        type: 'good-move' as const,
        content: analysisText,
        timestamp: Date.now(),
        messageId,
        speakerId
      });
    } else if (analysisText.includes('🔄') || analysisText.toLowerCase().includes('next step')) {
      insights.push({
        type: 'next-step' as const,
        content: analysisText,
        timestamp: Date.now(),
        messageId,
        speakerId
      });
    } else {
      // Default to opportunity for general coaching advice
      insights.push({
        type: 'opportunity' as const,
        content: analysisText,
        timestamp: Date.now(),
        messageId,
        speakerId
      });
    }
    
    return insights;
  };

  const getInsightIcon = (type: Analysis['type']) => {
    switch (type) {
      case 'objection': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'opportunity': return <Lightbulb className="h-4 w-4 text-blue-500" />;
      case 'buying-signal': return <Target className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'good-move': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'next-step': return <TrendingUp className="h-4 w-4 text-purple-500" />;
    }
  };

  const getInsightClass = (type: Analysis['type']) => {
    switch (type) {
      case 'objection': return 'border-red-200 bg-red-50 dark:bg-red-900/20';
      case 'opportunity': return 'border-blue-200 bg-blue-50 dark:bg-blue-900/20';
      case 'buying-signal': return 'border-green-200 bg-green-50 dark:bg-green-900/20';
      case 'warning': return 'border-orange-200 bg-orange-50 dark:bg-orange-900/20';
      case 'good-move': return 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20';
      case 'next-step': return 'border-purple-200 bg-purple-50 dark:bg-purple-900/20';
    }
  };

  const getInsightLabel = (type: Analysis['type']) => {
    switch (type) {
      case 'objection': return 'Objection Alert';
      case 'opportunity': return 'Opportunity';
      case 'buying-signal': return 'Buying Signal';
      case 'warning': return 'Warning';
      case 'good-move': return 'Good Move';
      case 'next-step': return 'Next Step';
    }
  };

  const getSpeakerColors = (speakerId: number) => {
    return SPEAKER_COLORS[speakerId % SPEAKER_COLORS.length];
  };

  // Render message bubble
  const renderMessageBubble = (message: Message) => {
    const colors = getSpeakerColors(message.speakerId);
    const isRightSide = colors.side === 'right';
    
    return (
      <div
        key={message.id}
        className={cn(
          "flex items-start gap-3 mb-4 max-w-[85%]",
          isRightSide ? "ml-auto flex-row-reverse" : "mr-auto"
        )}
      >
        <div className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
          colors.bg,
          colors.text
        )}>
          {message.speakerId + 1}
        </div>
        
        <div className={cn(
          "rounded-2xl px-4 py-3 shadow-sm",
          isRightSide 
            ? "bg-primary text-primary-foreground rounded-br-md" 
            : cn(colors.lightBg, colors.darkBg, "border rounded-bl-md")
        )}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium opacity-70">
              {colors.name}
            </span>
            <span className="text-xs opacity-50">
              {new Date(message.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
          </div>
          <p className="text-sm leading-relaxed break-words">
            {message.text}
          </p>
        </div>
      </div>
    );
  };

  // Render current conversation being built
  const renderCurrentConversation = () => {
    if (!currentConversation || currentSpeaker === null) return null;
    
    const colors = getSpeakerColors(currentSpeaker);
    const isRightSide = colors.side === 'right';
    
    return (
      <div className={cn(
        "flex items-start gap-3 mb-4 max-w-[85%] opacity-90",
        isRightSide ? "ml-auto flex-row-reverse" : "mr-auto"
      )}>
        <div className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
          colors.bg,
          colors.text
        )}>
          {currentSpeaker + 1}
        </div>
        
        <div className={cn(
          "rounded-2xl px-4 py-3 shadow-sm border-2 border-dashed",
          isRightSide 
            ? "bg-primary/10 text-primary border-primary/30 rounded-br-md" 
            : cn(colors.lightBg, colors.darkBg, "border-gray-300 rounded-bl-md")
        )}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium opacity-70">
                {colors.name} is speaking...
              </span>
              <div className="flex gap-1">
                <div className="w-1 h-1 bg-current rounded-full animate-bounce" />
                <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
          <p className="text-sm leading-relaxed break-words">
            {currentConversation}
          </p>
        </div>
      </div>
    );
  };

  // Get call data for feedback modal
  const getCallDataForFeedback = () => {
    if (!currentCallId) return { transcripts: [], insights: [] };
    
    const transcripts = messages.map(msg => ({
      id: msg.id,
      speaker_name: getSpeakerColors(msg.speakerId).name,
      content: msg.text,
      timestamp_offset: Math.floor((msg.timestamp - callStartTime) / 1000)
    }));

    const insightData = insights.map(insight => ({
      id: insight.messageId || '',
      type: insight.type,
      content: insight.content,
      timestamp_offset: Math.floor((insight.timestamp - callStartTime) / 1000)
    }));

    return { transcripts, insights: insightData };
  };

  useEffect(() => () => stopLive(), []);

  // Render authentication loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
        <h3 className="text-lg font-medium mb-2">Authentication loading</h3>
        <p className="text-muted-foreground text-center max-w-md">
          Please wait for the authentication to complete before starting a call.
        </p>
      </div>
    );
  }

  // Render authentication required state
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-8 h-[400px]">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <h3 className="text-lg font-medium mb-2">Authentication Required</h3>
        <p className="text-muted-foreground text-center max-w-md">
          Please log in to start a call session.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="mb-6 flex items-center justify-between">
          <Button
            onClick={live ? stopLive : () => startLive()}
            variant={live ? 'destructive' : 'default'}
            disabled={connecting}
          >
            {connecting ? (
              'Connecting...'
            ) : live ? (
              <>
                <MicOff className="h-4 w-4 mr-2" /> End Call
              </>
            ) : (
              <>
                <Mic className="h-4 w-4 mr-2" /> Start Live
              </>
            )}
          </Button>
          
          <div className="flex items-center gap-4">
            <div className={cn(
              "text-sm flex items-center gap-2",
              desktopConnected ? "text-green-600" : "text-red-600"
            )}>
              <div className={cn(
                "w-2 h-2 rounded-full",
                desktopConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
              )}></div>
              Desktop {desktopConnected ? 'Connected' : 'Disconnected'}
            </div>
            
            <div className={cn(
              "text-sm flex items-center gap-2",
              deepgramConnected ? "text-green-600" : "text-yellow-600"
            )}>
              <div className={cn(
                "w-2 h-2 rounded-full",
                deepgramConnected ? "bg-green-500 animate-pulse" : "bg-yellow-500"
              )}></div>
              Transcription {deepgramConnected ? 'Active' : 'Connecting...'}
            </div>
            
            {isDesktopInitiatedCall && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                Desktop Initiated
              </div>
            )}
            {currentCallId && (
              <div className="text-sm text-muted-foreground">
                Call ID: {currentCallId.slice(0, 8)}...
              </div>
            )}
            {deepgramApiKeyFromDesktop && (
              <div className="text-sm text-muted-foreground">
                Desktop API Key: Active
              </div>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Live Transcript
                {messages.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    ({messages.length} message{messages.length > 1 ? 's' : ''})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]" ref={scrollRef}>
                <div className="space-y-2 p-2">
                  {/* Show current conversation being built at the top */}
                  {renderCurrentConversation()}
                  
                  {messages.length === 0 && !currentConversation && (
                    <div className="flex items-center justify-center h-32 text-muted-foreground">
                      <div className="text-center">
                        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Start speaking to see complete conversation bubbles...</p>
                        {desktopConnected && (
                          <p className="text-xs mt-1">Desktop app is connected and ready</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* All completed messages (newest first) */}
                  {messages.map((message) => renderMessageBubble(message))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Sales Coaching
                {insights.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    ({insights.length} insight{insights.length > 1 ? 's' : ''})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {insights.length === 0 && (
                    <div className="flex items-center justify-center h-32 text-muted-foreground">
                      <div className="text-center">
                        <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">AI sales coaching will appear here...</p>
                        {desktopConnected && (
                          <p className="text-xs mt-1">Insights will be shared with desktop app</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {insights.map((insight, index) => {
                    const speakerColors = insight.speakerId !== undefined ? getSpeakerColors(insight.speakerId) : null;
                    
                    return (
                      <div
                        key={index}
                        className={cn(
                          "p-4 border rounded-lg flex items-start gap-3",
                          getInsightClass(insight.type)
                        )}
                      >
                        {getInsightIcon(insight.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {getInsightLabel(insight.type)}
                              </span>
                              {speakerColors && (
                                <span className={cn(
                                  "text-xs px-2 py-1 rounded-full",
                                  speakerColors.bg,
                                  speakerColors.text
                                )}>
                                  {speakerColors.name}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(insight.timestamp).toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed">{insight.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Call Feedback Modal */}
      {showFeedbackModal && currentCallId && (
        <CallFeedbackModal
          isOpen={showFeedbackModal}
          onClose={handleFeedbackModalClose}
          callId={currentCallId}
          callDuration={Math.floor((Date.now() - callStartTime) / 1000)}
          {...getCallDataForFeedback()}
        />
      )}
    </>
  );
}