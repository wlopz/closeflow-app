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
}

export function CallAnalyzer({ onCallEnd }: CallAnalyzerProps) {
  const [live, setLive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [insights, setInsights] = useState<Analysis[]>([]);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [callStartTime, setCallStartTime] = useState<number>(0);
  const [desktopTriggered, setDesktopTriggered] = useState(false);
  const [desktopConnected, setDesktopConnected] = useState(false);
  
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
  
  const recorderRef = useRef<MediaRecorder>();
  const socketRef = useRef<WebSocket>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  // CRITICAL FIX: Use the useAuth hook to get authentication state
  const { user, loading: authLoading } = useAuth();

  // Check desktop connection status and listen for desktop triggers
  useEffect(() => {
    const checkDesktopConnection = async () => {
      try {
        console.log('🔍 ENHANCED LOGGING: Checking desktop connection status...');
        console.log('🔍 ENHANCED LOGGING: Making request to /api/desktop-sync?action=status');
        
        const response = await fetch('/api/desktop-sync?action=status');
        console.log('🔍 ENHANCED LOGGING: Desktop status response received');
        console.log('🔍 ENHANCED LOGGING: Response status:', response.status);
        console.log('🔍 ENHANCED LOGGING: Response ok:', response.ok);
        
        const data = await response.json();
        console.log('🔍 ENHANCED LOGGING: Desktop status data:', data);
        
        setDesktopConnected(data.connected);
        
        // ENHANCED LOGGING: Show pending messages count for web app
        console.log('🔍 PENDING MESSAGES DEBUG: Checking desktop status');
        console.log('🔍 PENDING MESSAGES DEBUG: Connected:', data.connected);
        console.log('🔍 PENDING MESSAGES DEBUG: Pending messages for desktop:', data.pendingMessages);
        console.log('🔍 PENDING MESSAGES DEBUG: Pending messages for web app:', data.pendingWebAppMessages);
        console.log('🔍 PENDING MESSAGES DEBUG: Call active:', data.callActive);
        console.log('🔍 PENDING MESSAGES DEBUG: Full response data:', data);
        
        // FIXED: Check for pending messages for web app (from desktop)
        if (data.connected && data.pendingWebAppMessages > 0) {
          console.log('📨 PENDING MESSAGES DEBUG: Found pending messages for web app, fetching them...');
          console.log('📨 PENDING MESSAGES DEBUG: About to fetch from /api/desktop-sync?action=get-messages-for-webapp');
          
          const messagesResponse = await fetch('/api/desktop-sync?action=get-messages-for-webapp');
          const messagesData = await messagesResponse.json();
          
          console.log('📨 PENDING MESSAGES DEBUG: Messages response status:', messagesResponse.status);
          console.log('📨 PENDING MESSAGES DEBUG: Messages response ok:', messagesResponse.ok);
          console.log('📨 PENDING MESSAGES DEBUG: Messages data:', messagesData);
          console.log('📨 PENDING MESSAGES DEBUG: Number of messages received:', messagesData.messages?.length || 0);
          
          for (const message of messagesData.messages) {
            console.log('📨 PENDING MESSAGES DEBUG: Processing message:', message);
            await handleDesktopMessage(message);
          }
        } else if (data.connected && data.pendingWebAppMessages === 0) {
          console.log('⚠️ PENDING MESSAGES DEBUG: Desktop connected but no pending messages for web app');
        } else if (!data.connected) {
          console.log('❌ PENDING MESSAGES DEBUG: Desktop not connected');
        }
      } catch (error) {
        console.error('❌ PENDING MESSAGES DEBUG: Error checking desktop status:', error);
        console.error('❌ PENDING MESSAGES DEBUG: Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        setDesktopConnected(false);
      }
    };

    checkDesktopConnection();
    const interval = setInterval(checkDesktopConnection, 2000); // Check every 2 seconds for faster response
    
    return () => clearInterval(interval);
  }, []);

  const handleDesktopMessage = async (message: any) => {
    console.log('📱 ENHANCED LOGGING: CallAnalyzer received desktop message:', message);
    console.log('📱 ENHANCED LOGGING: Message type:', message.type);
    console.log('📱 ENHANCED LOGGING: Current live state:', live);
    console.log('📱 ENHANCED LOGGING: Current connecting state:', connecting);
    
    switch (message.type) {
      case 'desktop-call-started':
        console.log('🎯 ENHANCED LOGGING: Desktop triggered call start - starting live analysis immediately');
        console.log('🎯 ENHANCED LOGGING: Device settings:', message.deviceSettings);
        console.log('🎯 ENHANCED LOGGING: Current state before start:', { live, connecting });
        
        if (!live && !connecting) {
          console.log('🎯 ENHANCED LOGGING: Conditions met, setting desktop triggered and starting live analysis');
          setDesktopTriggered(true);
          
          // Start the live analysis immediately
          console.log('🎯 ENHANCED LOGGING: About to call startLive(true)');
          await startLive(true);
          console.log('🎯 ENHANCED LOGGING: startLive(true) completed');
        } else {
          console.log('⚠️ ENHANCED LOGGING: Cannot start - already live or connecting');
          console.log('⚠️ ENHANCED LOGGING: Current state:', { live, connecting });
        }
        break;
      case 'desktop-call-stopped':
        console.log('🛑 ENHANCED LOGGING: Desktop triggered call stop');
        console.log('🛑 ENHANCED LOGGING: Current live state:', live);
        
        if (live) {
          console.log('🛑 ENHANCED LOGGING: Stopping live analysis');
          stopLive();
        } else {
          console.log('⚠️ ENHANCED LOGGING: Cannot stop - not currently live');
        }
        break;
      case 'insight-generated':
        console.log('🧠 ENHANCED LOGGING: Received insight from desktop:', message);
        // Handle insights from desktop if needed
        break;
      default:
        console.log('❓ ENHANCED LOGGING: Unknown message type from desktop:', message.type);
        console.log('❓ ENHANCED LOGGING: Full message:', message);
    }
  };

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

  // Handle new transcript from WebSocket server (which gets it from Deepgram)
  const handleTranscript = (transcript: string, isFinal: boolean, deepgramSpeaker?: number) => {
    if (!transcript || transcript.trim() === '') return;
    
    console.log(`🎤 ENHANCED LOGGING: Transcript received: "${transcript}" (Final: ${isFinal}, Speaker: ${deepgramSpeaker})`);
    
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

              // Notify desktop app of new insight
              try {
                await fetch('/api/desktop-sync', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    type: 'insight-generated',
                    content: insight.content,
                    insightType: insight.type
                  })
                });
              } catch (error) {
                console.error('Error notifying desktop of insight:', error);
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
    console.log('🔐 ENHANCED LOGGING: Auth loading state:', authLoading);
    console.log('🔐 ENHANCED LOGGING: User exists:', !!user);
    console.log('🔐 ENHANCED LOGGING: User ID:', user?.id);
    
    // CRITICAL FIX: Check authentication state before proceeding
    if (authLoading) {
      console.log('⚠️ ENHANCED LOGGING: Authentication still loading, cannot create call session yet');
      toast({
        variant: 'destructive',
        title: 'Authentication loading',
        description: 'Please wait for authentication to complete before starting a call.'
      });
      return null;
    }

    if (!user) {
      console.log('❌ ENHANCED LOGGING: No authenticated user found');
      toast({
        variant: 'destructive',
        title: 'Authentication required',
        description: 'Please log in to start a call session.'
      });
      return null;
    }

    console.log('✅ ENHANCED LOGGING: User authenticated, proceeding with call creation');
    console.log('✅ ENHANCED LOGGING: User details:', {
      id: user.id,
      email: user.email,
      created_at: user.created_at
    });

    try {
      const call = await CallsService.createCall({
        user_id: user.id,
        customer_name: desktopTriggered ? 'Desktop Zoom Call' : 'Live Call Session',
        status: 'active'
      });

      if (call) {
        console.log('✅ ENHANCED LOGGING: Created call session successfully:', call.id);
        
        // Notify desktop app of call start
        try {
          await fetch('/api/desktop-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'call-status-update',
              status: 'started',
              callId: call.id
            })
          });
        } catch (error) {
          console.error('Error notifying desktop of call start:', error);
        }
        
        return call.id;
      } else {
        throw new Error('Failed to create call session');
      }
    } catch (error) {
      console.error('❌ ENHANCED LOGGING: Error creating call session:', error);
      console.error('❌ ENHANCED LOGGING: Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
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
      
      // Notify desktop app of call end
      try {
        await fetch('/api/desktop-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'call-status-update',
            status: 'ended',
            callId: callId
          })
        });
      } catch (error) {
        console.error('Error notifying desktop of call end:', error);
      }
    } catch (error) {
      console.error('❌ Error ending call session:', error);
    }
  };

  // Connect to local WebSocket server instead of Deepgram directly
  async function connectWithRetry() {
    console.log('🔗 ENHANCED LOGGING: Starting connectWithRetry function');
    console.log('🔗 ENHANCED LOGGING: Current state:', { live, connecting, desktopTriggered });
    
    const token = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
    console.log('🔗 ENHANCED LOGGING: Deepgram API key check:', token ? 'Present' : 'Missing');
    
    if (!token) {
      console.error('❌ ENHANCED LOGGING: Deepgram API key is not configured');
      toast({
        variant: 'destructive',
        title: 'Configuration Error',
        description: 'Deepgram API key is not configured.'
      });
      return;
    }

    // Create call session in database
    console.log('🔗 ENHANCED LOGGING: Creating call session in database...');
    const callId = await createCallSession();
    if (!callId) {
      console.error('❌ ENHANCED LOGGING: Failed to create call session, aborting');
      return; // Error already shown in createCallSession
    }
    console.log('🔗 ENHANCED LOGGING: Call session created with ID:', callId);
    
    setCurrentCallId(callId);
    setCallStartTime(Date.now());

    try {
      // Connect to local WebSocket server instead of Deepgram directly
      console.log('🔗 ENHANCED LOGGING: About to create WebSocket connection to ws://localhost:8080/web-app');
      const ws = new WebSocket('ws://localhost:8080/web-app');
      socketRef.current = ws;
      setConnecting(true);
      console.log('🔗 ENHANCED LOGGING: WebSocket object created, setting connecting to true');

      ws.onopen = async () => {
        console.log('✅ ENHANCED LOGGING: WebSocket onopen event fired - Connected to local WebSocket server');
        console.log('✅ ENHANCED LOGGING: WebSocket readyState:', ws.readyState);
        console.log('✅ ENHANCED LOGGING: About to set live=true and connecting=false');
        
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
        
        console.log('✅ ENHANCED LOGGING: State reset completed, about to send start-transcription message');
        console.log('✅ ENHANCED LOGGING: Deepgram API key being sent:', token ? 'Present' : 'Missing');
        
        // Send Deepgram API key to WebSocket server to start transcription
        const startTranscriptionMessage = {
          type: 'start-transcription',
          deepgramApiKey: token
        };
        
        console.log('✅ ENHANCED LOGGING: Sending start-transcription message:', startTranscriptionMessage);
        ws.send(JSON.stringify(startTranscriptionMessage));
        console.log('✅ ENHANCED LOGGING: start-transcription message sent successfully');
        
        // CRITICAL: Send confirmation to desktop app that call analysis is truly active
        console.log('🔄 ENHANCED LOGGING: About to send call started confirmation to desktop app');
        console.log('🔄 ENHANCED LOGGING: Current timestamp:', Date.now());
        console.log('🔄 ENHANCED LOGGING: Desktop triggered flag:', desktopTriggered);
        
        try {
          console.log('🔄 ENHANCED LOGGING: Making fetch request to /api/desktop-sync');
          
          const confirmationResponse = await fetch('/api/desktop-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'web-app-call-started-confirmation',
              timestamp: Date.now()
            })
          });
          
          console.log('🔄 ENHANCED LOGGING: Fetch response received');
          console.log('🔄 ENHANCED LOGGING: Response status:', confirmationResponse.status);
          console.log('🔄 ENHANCED LOGGING: Response ok:', confirmationResponse.ok);
          console.log('🔄 ENHANCED LOGGING: Response headers:', Object.fromEntries(confirmationResponse.headers.entries()));
          
          if (confirmationResponse.ok) {
            const confirmationData = await confirmationResponse.json();
            console.log('✅ ENHANCED LOGGING: Successfully sent call started confirmation to desktop');
            console.log('✅ ENHANCED LOGGING: Confirmation response data:', confirmationData);
          } else {
            const errorText = await confirmationResponse.text();
            console.error('❌ ENHANCED LOGGING: Failed to send confirmation - HTTP error');
            console.error('❌ ENHANCED LOGGING: Error status:', confirmationResponse.status);
            console.error('❌ ENHANCED LOGGING: Error text:', errorText);
          }
        } catch (confirmationError) {
          console.error('❌ ENHANCED LOGGING: Error sending confirmation to desktop:', confirmationError);
          console.error('❌ ENHANCED LOGGING: Error name:', confirmationError.name);
          console.error('❌ ENHANCED LOGGING: Error message:', confirmationError.message);
          console.error('❌ ENHANCED LOGGING: Error stack:', confirmationError.stack);
          
          // Check if it's a network error
          if (confirmationError instanceof TypeError && confirmationError.message.includes('fetch')) {
            console.error('❌ ENHANCED LOGGING: This appears to be a network connectivity issue');
            console.error('❌ ENHANCED LOGGING: Check if the Next.js server is running on the expected port');
          }
        }
      };

      ws.onerror = (error) => {
        console.error('❌ ENHANCED LOGGING: WebSocket connection error occurred');
        console.error('❌ ENHANCED LOGGING: Error event:', error);
        console.error('❌ ENHANCED LOGGING: WebSocket readyState:', ws.readyState);
        console.error('❌ ENHANCED LOGGING: Error type:', error.type);
        console.error('❌ ENHANCED LOGGING: Error target:', error.target);
        
        setConnecting(false);
        stopLive();
      };

      ws.onmessage = (evt) => {
        try {
          console.log('📨 ENHANCED LOGGING: WebSocket message received');
          console.log('📨 ENHANCED LOGGING: Message data type:', typeof evt.data);
          console.log('📨 ENHANCED LOGGING: Message data length:', evt.data.length);
          
          const msg = JSON.parse(evt.data);
          console.log('📨 ENHANCED LOGGING: Parsed message:', msg);
          console.log('📨 ENHANCED LOGGING: Message type:', msg.type);
          
          if (msg.type === 'deepgram-result' && msg.data) {
            console.log('📨 ENHANCED LOGGING: Processing Deepgram result');
            const deepgramResult = msg.data;
            console.log('📨 ENHANCED LOGGING: Deepgram result type:', deepgramResult.type);
            
            if (deepgramResult.type === 'Results' && deepgramResult.channel?.alternatives?.[0]?.transcript) {
              const transcript = deepgramResult.channel.alternatives[0].transcript;
              const isFinal = deepgramResult.is_final || false;
              
              console.log('📨 ENHANCED LOGGING: Processing transcript:', transcript);
              console.log('📨 ENHANCED LOGGING: Is final:', isFinal);
              
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
              
              console.log('📨 ENHANCED LOGGING: Detected speaker ID:', speakerId);
              handleTranscript(transcript, isFinal, speakerId);
            }
          } else if (msg.type === 'deepgram-connected') {
            console.log('✅ ENHANCED LOGGING: WebSocket server connected to Deepgram');
          } else if (msg.type === 'deepgram-error') {
            console.error('❌ ENHANCED LOGGING: Deepgram error via WebSocket:', msg.error);
            toast({
              variant: 'destructive',
              title: 'Transcription Error',
              description: 'Failed to connect to transcription service.'
            });
          } else {
            console.log('📨 ENHANCED LOGGING: Unknown message type:', msg.type);
          }
        } catch (error) {
          console.error('❌ ENHANCED LOGGING: Error parsing WebSocket message:', error);
          console.error('❌ ENHANCED LOGGING: Raw message data:', evt.data);
        }
      };

      ws.onclose = async (event) => {
        console.log('🔗 ENHANCED LOGGING: WebSocket onclose event fired');
        console.log('🔗 ENHANCED LOGGING: Close event code:', event.code);
        console.log('🔗 ENHANCED LOGGING: Close event reason:', event.reason);
        console.log('🔗 ENHANCED LOGGING: Close event wasClean:', event.wasClean);
        
        finalizeCurrentConversation();
        setLive(false);
        setConnecting(false);
        
        // CRITICAL: Send confirmation to desktop app that call analysis has stopped
        console.log('🔄 ENHANCED LOGGING: About to send call stopped confirmation to desktop app');
        
        try {
          console.log('🔄 ENHANCED LOGGING: Making fetch request to send stop confirmation');
          
          const stopConfirmationResponse = await fetch('/api/desktop-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'web-app-call-stopped-confirmation',
              timestamp: Date.now()
            })
          });
          
          console.log('🔄 ENHANCED LOGGING: Stop confirmation response status:', stopConfirmationResponse.status);
          console.log('🔄 ENHANCED LOGGING: Stop confirmation response ok:', stopConfirmationResponse.ok);
          
          if (stopConfirmationResponse.ok) {
            const stopConfirmationData = await stopConfirmationResponse.json();
            console.log('✅ ENHANCED LOGGING: Successfully sent call stopped confirmation to desktop');
            console.log('✅ ENHANCED LOGGING: Stop confirmation response data:', stopConfirmationData);
          } else {
            const stopErrorText = await stopConfirmationResponse.text();
            console.error('❌ ENHANCED LOGGING: Failed to send stop confirmation');
            console.error('❌ ENHANCED LOGGING: Stop error text:', stopErrorText);
          }
        } catch (stopConfirmationError) {
          console.error('❌ ENHANCED LOGGING: Error sending stop confirmation to desktop:', stopConfirmationError);
          console.error('❌ ENHANCED LOGGING: Stop error details:', {
            name: stopConfirmationError.name,
            message: stopConfirmationError.message,
            stack: stopConfirmationError.stack
          });
        }
        
        // End call session in database and show feedback modal
        if (currentCallId) {
          endCallSession(currentCallId);
          setShowFeedbackModal(true);
        }
      };
    } catch (err) {
      console.error('❌ ENHANCED LOGGING: Connection error in connectWithRetry:', err);
      console.error('❌ ENHANCED LOGGING: Error name:', err.name);
      console.error('❌ ENHANCED LOGGING: Error message:', err.message);
      console.error('❌ ENHANCED LOGGING: Error stack:', err.stack);
      
      setConnecting(false);
      stopLive();
      
      // End call session if it was created
      if (currentCallId) {
        endCallSession(currentCallId);
        setCurrentCallId(null);
      }
    }
  }

  const startLive = async (triggeredByDesktop = false) => {
    console.log('🎯 ENHANCED LOGGING: startLive function called');
    console.log('🎯 ENHANCED LOGGING: triggeredByDesktop:', triggeredByDesktop);
    console.log('🎯 ENHANCED LOGGING: Current state:', { live, connecting });
    
    setDesktopTriggered(triggeredByDesktop);
    
    // For desktop-triggered calls, we don't need microphone access
    // The desktop app will handle audio capture via system audio
    if (!triggeredByDesktop) {
      console.log('🎯 ENHANCED LOGGING: Not triggered by desktop, requesting microphone access');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { 
            channelCount: 1, 
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true
          } 
        });

        const recorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus',
        });
        recorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(e.data);
          }
        };
        
        console.log('🎯 ENHANCED LOGGING: Microphone access granted and recorder set up');
      } catch (err) {
        console.error('❌ ENHANCED LOGGING: Failed to start recording:', err);
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
    await connectWithRetry();
    console.log('🎯 ENHANCED LOGGING: connectWithRetry completed');
  };

  const stopLive = async () => {
    console.log('🛑 ENHANCED LOGGING: stopLive function called');
    console.log('🛑 ENHANCED LOGGING: Current state:', { live, connecting });
    
    clearLongSpeechTimer();
    clearSilenceTimer();
    finalizeCurrentConversation();

    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      console.log('🛑 ENHANCED LOGGING: Stopping media recorder');
      rec.stop();
      rec.stream.getTracks().forEach(t => t.stop());
      recorderRef.current = undefined;
    }
    
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('🛑 ENHANCED LOGGING: Closing WebSocket connection');
      // Tell WebSocket server to stop transcription
      ws.send(JSON.stringify({ type: 'stop-transcription' }));
      ws.close();
    }
    socketRef.current = undefined;
    
    setLive(false);
    setConnecting(false);
    
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
    setDesktopTriggered(false);
    
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

  // Show loading state while authentication is being determined
  if (authLoading) {
    return (
      <div className="space-y-6">
        <div className="mb-6 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-muted-foreground">Initializing authentication...</p>
          </div>
        </div>
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
            disabled={connecting || desktopTriggered}
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
            {desktopTriggered && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                Desktop Triggered
              </div>
            )}
            {currentCallId && (
              <div className="text-sm text-muted-foreground">
                Call ID: {currentCallId.slice(0, 8)}...
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
                        <div className="flex-1">
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