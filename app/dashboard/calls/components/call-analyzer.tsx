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
  Target, 
  TrendingUp, 
  XCircle 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CallFeedbackModal } from '@/components/dashboard/call-feedback-modal';
import { useAuth } from '@/lib/supabase/hooks';
import { CallsService } from '@/lib/supabase/calls';
import { supabase } from '@/lib/supabase/client';

interface CallAnalyzerProps {
  onCallEnd: () => void;
  desktopCallActive: boolean;
}

interface Transcript {
  id: string;
  speaker_id: number;
  speaker_name: string;
  content: string;
  timestamp_offset: number;
  is_final: boolean;
}

interface Insight {
  id: string;
  type: 'objection' | 'opportunity' | 'buying-signal' | 'warning' | 'good-move' | 'next-step';
  content: string;
  timestamp_offset: number;
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
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);
  
  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const messagePollingRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Hooks
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Check if this is a desktop-initiated call
  useEffect(() => {
    console.log('🎯 ENHANCED LOGGING: CallAnalyzer checking desktop initiation');
    console.log('🎯 ENHANCED LOGGING: Current state:', { isLive, callId, desktopCallActive });
    console.log('🎯 ENHANCED LOGGING: User authenticated:', !!user);
    
    // If desktop call is active and we're not already live, start the call
    if (desktopCallActive && !isLive && user) {
      console.log('🎯 ENHANCED LOGGING: Desktop call is active, starting live analysis');
      startLive();
    } else if (desktopCallActive && !isLive && !user) {
      console.log('⏳ ENHANCED LOGGING: Desktop call initiated but authentication still loading');
    } else if (!desktopCallActive && isLive) {
      console.log('🛑 ENHANCED LOGGING: Desktop call stopped, stopping live analysis');
      stopLive();
    }
  }, [desktopCallActive, isLive, user]);
  
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
  
  // Auto-scroll to bottom when new transcripts arrive
  useEffect(() => {
    if (scrollRef.current && transcripts.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);
  
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
    };
  }, []);
  
  // Poll for desktop messages when desktop call is active
  useEffect(() => {
    const pollDesktopMessages = async () => {
      if (!desktopCallActive || !isLive || isPollingMessages) return;
      
      try {
        setIsPollingMessages(true);
        
        const response = await fetch('/api/desktop-sync?action=get-messages-for-webapp');
        const data = await response.json();
        
        console.log('📨 ENHANCED LOGGING: Polled for desktop messages, received:', data.messages?.length || 0);
        
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
                console.log('✅ ENHANCED LOGGING: Acknowledged message:', message.id);
              } catch (ackError) {
                console.error('❌ ENHANCED LOGGING: Error acknowledging message:', ackError);
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ ENHANCED LOGGING: Error polling for desktop messages:', error);
      } finally {
        setIsPollingMessages(false);
      }
    };
    
    if (desktopCallActive && isLive) {
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
  }, [desktopCallActive, isLive, isPollingMessages]);
  
  // Process messages from desktop app
  const processDesktopMessage = async (message: any) => {
    console.log('📨 ENHANCED LOGGING: Processing desktop message:', message);
    
    if (!message || !message.content) {
      console.log('⚠️ ENHANCED LOGGING: Invalid message format:', message);
      return;
    }
    
    const { content } = message;
    
    switch (content.type) {
      case 'desktop-call-started':
        console.log('🚀 ENHANCED LOGGING: Desktop call started message received');
        console.log('🚀 ENHANCED LOGGING: Device settings:', content.deviceSettings);
        
        // If we're not already live, start the call
        if (!isLive && user) {
          await startLive();
          
          // Confirm to desktop that we've started
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
            console.log('✅ ENHANCED LOGGING: Sent call started confirmation to desktop');
          } catch (error) {
            console.error('❌ ENHANCED LOGGING: Error sending call started confirmation:', error);
          }
        }
        break;
        
      case 'desktop-call-stopped':
        console.log('🛑 ENHANCED LOGGING: Desktop call stopped message received');
        
        // If we're live, stop the call
        if (isLive) {
          await stopLive();
          
          // Confirm to desktop that we've stopped
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
            console.log('✅ ENHANCED LOGGING: Sent call stopped confirmation to desktop');
          } catch (error) {
            console.error('❌ ENHANCED LOGGING: Error sending call stopped confirmation:', error);
          }
        }
        break;
        
      default:
        console.log('❓ ENHANCED LOGGING: Unknown message type from desktop:', content.type);
    }
  };
  
  // Start live call analysis
  const startLive = async () => {
    if (isLive || isInitializing) return;
    
    try {
      setIsInitializing(true);
      setIsLoading(true);
      
      console.log('🚀 ENHANCED LOGGING: Starting live call analysis');
      
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
      console.log('✅ ENHANCED LOGGING: Created call record:', newCall.id);
      
      // Set up real-time subscription for transcripts
      const transcriptSubscription = supabase
        .channel(`call-transcripts-${newCall.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'call_transcripts',
          filter: `call_id=eq.${newCall.id}`
        }, (payload) => {
          console.log('📝 ENHANCED LOGGING: New transcript received:', payload.new);
          
          const newTranscript = payload.new as Transcript;
          
          // Only add final transcripts to the UI
          if (newTranscript.is_final) {
            setTranscripts(prev => [...prev, newTranscript]);
            setLastTranscriptTime(Date.now());
          }
        })
        .subscribe();
      
      // Set up real-time subscription for insights
      const insightSubscription = supabase
        .channel(`call-insights-${newCall.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_insights',
          filter: `call_id=eq.${newCall.id}`
        }, (payload) => {
          console.log('🧠 ENHANCED LOGGING: New insight received:', payload.new);
          
          const newInsight = payload.new as Insight;
          setInsights(prev => [...prev, newInsight]);
          
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
      
      // If this is a desktop-initiated call, notify the desktop app
      if (desktopCallActive) {
        try {
          await fetch('/api/desktop-sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'web-app-call-started-confirmation',
              callId: newCall.id,
              timestamp: Date.now()
            })
          });
          console.log('✅ ENHANCED LOGGING: Sent call started confirmation to desktop');
        } catch (error) {
          console.error('❌ ENHANCED LOGGING: Error sending call started confirmation:', error);
        }
      }
      
      setIsLive(true);
      setIsLoading(false);
      setIsInitializing(false);
      
      console.log('✅ ENHANCED LOGGING: Live call analysis started successfully');
      
      return () => {
        transcriptSubscription.unsubscribe();
        insightSubscription.unsubscribe();
      };
      
    } catch (error) {
      console.error('❌ ENHANCED LOGGING: Error starting live call analysis:', error);
      
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
    console.log('🛑 ENHANCED LOGGING: stopLive function called');
    console.log('🛑 ENHANCED LOGGING: Current state:', { isLive, callId, isEndingCall });
    
    if (!isLive || !callId || isEndingCall) return;
    
    try {
      setIsEndingCall(true);
      
      // End the call in the database
      await CallsService.endCall(callId, 'pending');
      
      // If this is a desktop-initiated call, notify the desktop app
      if (desktopCallActive) {
        try {
          await fetch('/api/desktop-sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'web-app-call-stopped-confirmation',
              callId: callId,
              timestamp: Date.now()
            })
          });
          console.log('✅ ENHANCED LOGGING: Sent call stopped confirmation to desktop');
        } catch (error) {
          console.error('❌ ENHANCED LOGGING: Error sending call stopped confirmation:', error);
        }
      }
      
      // Reset state
      setIsLive(false);
      setShowFeedback(true);
      
    } catch (error) {
      console.error('❌ ENHANCED LOGGING: Error stopping live call analysis:', error);
      
      toast({
        title: "Failed to end call",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
      
    } finally {
      setIsEndingCall(false);
      
      // Notify parent component
      onCallEnd();
      
      console.log('🛑 ENHANCED LOGGING: stopLive completed');
    }
  };
  
  // Process transcript for analysis
  const processTranscript = async (transcript: Transcript) => {
    if (!callId || !transcript.content || transcript.content.length < 30) return;
    
    try {
      setIsProcessing(true);
      
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
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze transcript');
      }
      
      const data = await response.json();
      
      if (data.analysis && data.analysis.trim()) {
        // Determine insight type based on content
        const type = determineInsightType(data.analysis);
        
        // Store insight in database
        await CallsService.addInsight({
          call_id: callId,
          transcript_id: transcript.id,
          type,
          content: data.analysis,
          timestamp_offset: transcript.timestamp_offset
        });
      }
      
    } catch (error) {
      console.error('❌ ENHANCED LOGGING: Error processing transcript:', error);
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
  };
  
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
              </div>
            ) : (
              <div className="space-y-6">
                {transcripts.map((transcript) => (
                  <div key={transcript.id} className="flex gap-3">
                    <div className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium",
                      transcript.speaker_id === 0 
                        ? "bg-blue-500 text-white" 
                        : "bg-green-500 text-white"
                    )}>
                      {transcript.speaker_id === 0 ? 'Y' : 'C'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {transcript.speaker_name || `Speaker ${transcript.speaker_id + 1}`}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(transcript.timestamp_offset)}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed">{transcript.content}</p>
                    </div>
                  </div>
                ))}
                
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
          
          <ScrollArea className="h-[500px] p-4">
            {insights.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <Brain className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No insights yet</h3>
                <p className="text-muted-foreground max-w-md">
                  {isLive 
                    ? "AI is analyzing your conversation. Insights will appear here as the call progresses."
                    : "Start a call to receive AI-powered sales coaching insights."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {insights.map((insight) => (
                  <div key={insight.id} className="p-4 border rounded-lg">
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