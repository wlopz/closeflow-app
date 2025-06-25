"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Headphones, 
  Mic, 
  MicOff, 
  Phone,
  Volume2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CallAnalyzer } from './components/call-analyzer';
import { CallHistoryDetailed } from '@/components/dashboard/call-history-detailed';
import { supabase } from '@/lib/supabase/client';

export default function CallsPage() {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isDesktopCallInitiated, setIsDesktopCallInitiated] = useState(false);
  const [isDesktopCallActiveFromAnalyzer, setIsDesktopCallActiveFromAnalyzer] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [desktopConnected, setDesktopConnected] = useState(false);
  
  // CRITICAL FIX: Include desktop call initiation in the derived state
  const actualCallActive = isCallActive || isDesktopCallInitiated || isDesktopCallActiveFromAnalyzer;
  
  // Timer for call duration
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (actualCallActive) {
      timer = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    
    return () => clearInterval(timer);
  }, [actualCallActive]);

  // CRITICAL FIX: Proactive desktop message polling and processing
  useEffect(() => {
    const checkDesktopStatus = async () => {
      try {
        console.log('📊 ENHANCED LOGGING: CallsPage checking desktop status');
        
        const response = await fetch('/api/desktop-sync?action=status');
        const data = await response.json();
        
        console.log('📊 ENHANCED LOGGING: Desktop status response:', data);
        console.log('📊 ENHANCED LOGGING: Connected:', data.connected);
        console.log('📊 ENHANCED LOGGING: Pending web app messages:', data.pendingWebAppMessages);
        
        setDesktopConnected(data.connected);
        
        // CRITICAL: Proactively check for desktop call initiation messages
        if (data.pendingWebAppMessages > 0) {
          console.log('📨 ENHANCED LOGGING: Found pending messages for web app, fetching...');
          
          const messagesResponse = await fetch('/api/desktop-sync?action=get-messages-for-webapp');
          
          if (messagesResponse.ok) {
            const messagesData = await messagesResponse.json();
            console.log('📨 ENHANCED LOGGING: Messages received:', messagesData.messages);
            
            // Process each message
            for (const message of messagesData.messages) {
              console.log('📨 ENHANCED LOGGING: Processing message:', message);
              
              if (message.type === 'desktop-call-started') {
                console.log('🎯 ENHANCED LOGGING: Desktop call started message detected in CallsPage');
                
                // CRITICAL: Set desktop call initiated immediately
                setIsDesktopCallInitiated(true);
                
                // CRITICAL: Acknowledge the message to prevent reprocessing
                try {
                  await fetch('/api/desktop-sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      type: 'message-ack',
                      messageId: message.id
                    })
                  });
                  console.log('✅ ENHANCED LOGGING: Message acknowledged by CallsPage');
                } catch (error) {
                  console.error('❌ ENHANCED LOGGING: Error acknowledging message:', error);
                }
              } else if (message.type === 'desktop-call-stopped') {
                console.log('🛑 ENHANCED LOGGING: Desktop call stopped message detected in CallsPage');
                
                // Reset desktop call states
                setIsDesktopCallInitiated(false);
                setIsDesktopCallActiveFromAnalyzer(false);
                
                // Acknowledge the message
                try {
                  await fetch('/api/desktop-sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      type: 'message-ack',
                      messageId: message.id
                    })
                  });
                  console.log('✅ ENHANCED LOGGING: Stop message acknowledged by CallsPage');
                } catch (error) {
                  console.error('❌ ENHANCED LOGGING: Error acknowledging stop message:', error);
                }
              }
            }
          }
        }
        
        // CRITICAL: Reset desktop call initiation if desktop reports no active call
        if (data.connected && !data.callActive && isDesktopCallInitiated && !isDesktopCallActiveFromAnalyzer) {
          console.log('⚠️ ENHANCED LOGGING: Desktop reports no active call, resetting initiation state');
          setIsDesktopCallInitiated(false);
        }
        
      } catch (error) {
        console.error('❌ ENHANCED LOGGING: Error checking desktop status from CallsPage:', error);
        setDesktopConnected(false);
        setIsDesktopCallInitiated(false);
      }
    };

    checkDesktopStatus();
    const interval = setInterval(checkDesktopStatus, 2000); // Check every 2 seconds for fast response
    return () => clearInterval(interval);
  }, [isDesktopCallInitiated, isDesktopCallActiveFromAnalyzer]);
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  const handleCallToggle = () => {
    if (!actualCallActive) {
      setIsCallActive(true);
      setElapsedTime(0);
    } else {
      setIsCallActive(false);
    }
  };

  // CRITICAL: Callback to handle desktop call state changes from CallAnalyzer
  const handleDesktopCallStateChange = (isActive: boolean) => {
    console.log('📞 ENHANCED LOGGING: Desktop call state change from analyzer:', isActive);
    setIsDesktopCallActiveFromAnalyzer(isActive);
    
    // If the analyzer reports the call is no longer active, also reset the initiation state
    if (!isActive) {
      setIsDesktopCallInitiated(false);
    }
  };

  const handleCallEnd = () => {
    console.log('📞 ENHANCED LOGGING: handleCallEnd called');
    setIsCallActive(false);
    setIsDesktopCallInitiated(false); // CRITICAL: Reset desktop call initiation
    setIsDesktopCallActiveFromAnalyzer(false); // CRITICAL: Reset desktop call state
    setElapsedTime(0);
    // Trigger refresh of call history
    setRefreshTrigger(prev => prev + 1);
    console.log('📞 ENHANCED LOGGING: Call end state reset completed');
  };
  
  return (
    <div className="flex-1 space-y-4 p-8 md:p-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Calls</h2>
          <p className="text-muted-foreground">
            Manage and analyze your sales calls with AI-powered insights
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Desktop Connection Status */}
          <div className={cn(
            "flex items-center gap-2 text-sm px-3 py-1 rounded-full border",
            desktopConnected 
              ? "text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800" 
              : "text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800"
          )}>
            <div className={cn(
              "w-2 h-2 rounded-full",
              desktopConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
            )}></div>
            Desktop {desktopConnected ? 'Connected' : 'Disconnected'}
          </div>
          
          {/* Call Status Badge */}
          {actualCallActive && (
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                {isDesktopCallActiveFromAnalyzer ? 'Desktop Call' : 
                 isDesktopCallInitiated ? 'Desktop Initiating' : 'Live Call'} - {formatTime(elapsedTime)}
              </div>
            </Badge>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        <Card className="flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Headphones className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Call Session</h2>
              {(isDesktopCallInitiated || isDesktopCallActiveFromAnalyzer) && (
                <Badge variant="secondary" className="text-xs">
                  {isDesktopCallActiveFromAnalyzer ? 'Desktop Active' : 'Desktop Initiated'}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setIsMuted(!isMuted)}
                className={cn(isMuted && "text-red-500")}
              >
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button 
                variant="outline" 
                size="icon"
              >
                <Volume2 className="h-4 w-4" />
              </Button>
              <Button 
                variant={actualCallActive ? "destructive" : "default"}
                onClick={handleCallToggle}
                className="gap-2"
                disabled={isDesktopCallInitiated || isDesktopCallActiveFromAnalyzer} // Disable if desktop is controlling the call
              >
                <Phone className="h-4 w-4" />
                {actualCallActive ? "End Call" : "Start Call"}
              </Button>
            </div>
          </div>
          
          <CardContent className="flex-grow p-4">
            {actualCallActive ? (
              <div>
                <div className="mb-4 text-sm text-muted-foreground">
                  {isDesktopCallActiveFromAnalyzer ? (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      CallAnalyzer is actively managing desktop call
                    </div>
                  ) : isDesktopCallInitiated ? (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      Desktop call initiated - CallAnalyzer is starting up
                    </div>
                  ) : (
                    'CallAnalyzer is active for manual call'
                  )}
                </div>
                <CallAnalyzer 
                  onCallEnd={handleCallEnd}
                  onDesktopCallStateChange={handleDesktopCallStateChange}
                  isDesktopInitiatedCall={isDesktopCallInitiated}
                />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <Headphones className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No active call</h3>
                <p className="text-muted-foreground max-w-md mb-6">
                  Start a call to receive real-time AI guidance, transcription, and behavioral analysis.
                  {desktopConnected && (
                    <span className="block mt-2 text-sm text-green-600 dark:text-green-400">
                      Desktop app is connected - calls can be started from either interface.
                    </span>
                  )}
                </p>
                <div className="flex flex-col gap-3">
                  <Button 
                    onClick={handleCallToggle} 
                    className="gap-2"
                  >
                    <Phone className="h-4 w-4" />
                    Start Call
                  </Button>
                  {!desktopConnected && (
                    <p className="text-xs text-muted-foreground">
                      For Zoom integration, ensure the desktop app is running
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Call History Section */}
        <CallHistoryDetailed refreshTrigger={refreshTrigger} />
      </div>
    </div>
  );
}