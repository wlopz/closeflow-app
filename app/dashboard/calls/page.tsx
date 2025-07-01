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
  RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CallAnalyzer } from './components/call-analyzer';
import { CallHistoryDetailed } from '@/components/dashboard/call-history-detailed';
import { useToast } from '@/hooks/use-toast';

export default function CallsPage() {
  const [isCallActive, setIsCallActive] = useState(false);
  const [desktopCallActive, setDesktopCallActive] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [desktopConnected, setDesktopConnected] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const { toast } = useToast();
  
  // Check Deepgram API key and show warning if invalid
  const deepgramApiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
  const isValidDeepgramKey = deepgramApiKey && 
    deepgramApiKey.length >= 32 && 
    deepgramApiKey !== 'e4ebb862736fd42b930265d00775eb9dbfdf869c';

  console.log('🔑 Deepgram API Key from CallsPage:', deepgramApiKey);
  console.log('🔑 Deepgram API Key Valid:', isValidDeepgramKey);

  // SIMPLIFIED: Derived state for actual call activity
  const actualCallActive = isCallActive || desktopCallActive;
  
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

  // Check desktop connection status via API
  useEffect(() => {
    const checkDesktopStatus = async () => {
      try {
        console.log('📊 ENHANCED LOGGING: CallsPage checking desktop status via API');
        
        const response = await fetch('/api/desktop-sync?action=status');
        const data = await response.json();
        
        console.log('📊 ENHANCED LOGGING: Desktop status response:', data);
        console.log('📊 ENHANCED LOGGING: Connected:', data.connected);
        console.log('📊 ENHANCED LOGGING: Call Active:', data.callActive);
        
        setDesktopConnected(data.connected);
        
        // Update desktop call state based on backend state
        setDesktopCallActive(data.callActive);
        
      } catch (error) {
        console.error('❌ ENHANCED LOGGING: Error checking desktop status from CallsPage:', error);
        setDesktopConnected(false);
        setDesktopCallActive(false);
      }
    };

    checkDesktopStatus();
    const interval = setInterval(checkDesktopStatus, 3000); // Check every 3 seconds
    return () => clearInterval(interval);
  }, []);

  // Manual reset function for stuck call states
  const handleResetCallState = async () => {
    setIsResetting(true);
    try {
      console.log('🔧 ENHANCED LOGGING: Manual reset call state requested');
      
      const response = await fetch('/api/desktop-sync?action=reset-call-state');
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: 'Call State Reset',
          description: 'Successfully reset call state and cleared message queue.',
        });
        
        // Reset local state
        setIsCallActive(false);
        setDesktopCallActive(false);
        setElapsedTime(0);
        
        // Trigger refresh
        setRefreshTrigger(prev => prev + 1);
      } else {
        throw new Error(data.message || 'Failed to reset call state');
      }
    } catch (error) {
      console.error('❌ ENHANCED LOGGING: Error resetting call state:', error);
      toast({
        variant: 'destructive',
        title: 'Reset Failed',
        description: 'Failed to reset call state. Please try again.',
      });
    } finally {
      setIsResetting(false);
    }
  };
  
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

  const handleCallEnd = () => {
    console.log('📞 ENHANCED LOGGING: handleCallEnd called');
    setIsCallActive(false);
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
          {/* Deepgram API Key Warning */}
          {!isValidDeepgramKey && (
            <div className="flex items-center gap-2 text-sm px-3 py-1 rounded-full border border-orange-200 bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-400">
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              Invalid Deepgram API Key
            </div>
          )}
          
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
          
          {/* Reset Button for stuck states */}
          {(actualCallActive && !desktopConnected) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetCallState}
              disabled={isResetting}
              className="gap-2"
            >
              <RefreshCw className={cn("h-4 w-4", isResetting && "animate-spin")} />
              {isResetting ? 'Resetting...' : 'Reset State'}
            </Button>
          )}
          
          {/* Call Status Badge */}
          {actualCallActive && (
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                {desktopCallActive ? 'Desktop Call' : 'Live Call'} - {formatTime(elapsedTime)}
              </div>
            </Badge>
          )}
        </div>
      </div>
      
      {/* Deepgram API Key Warning Card */}
      {!isValidDeepgramKey && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center mt-0.5">
                <span className="text-white text-xs font-bold">!</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-orange-800 dark:text-orange-200 mb-1">
                  Deepgram API Key Required
                </h3>
                <p className="text-sm text-orange-700 dark:text-orange-300 mb-3">
                  Speech-to-text functionality requires a valid Deepgram API key. The current key appears to be a placeholder or invalid.
                </p>
                <div className="text-xs text-orange-600 dark:text-orange-400">
                  <p className="mb-1"><strong>To fix this:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Visit <a href="https://console.deepgram.com/" target="_blank" rel="noopener noreferrer" className="underline">https://console.deepgram.com/</a></li>
                    <li>Create an account or sign in</li>
                    <li>Generate a new API key</li>
                    <li>Update your <code className="bg-orange-100 dark:bg-orange-800 px-1 rounded">NEXT_PUBLIC_DEEPGRAM_API_KEY</code> environment variable</li>
                    <li>Restart the development server</li>
                  </ol>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="grid grid-cols-1 gap-6">
        <Card className="flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Headphones className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Call Session</h2>
              {desktopCallActive && (
                <Badge variant="secondary" className="text-xs">
                  Desktop Active
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
                disabled={desktopCallActive} // Disable if desktop is controlling the call
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
                  {desktopCallActive ? (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      Desktop call is active - CallAnalyzer is processing audio
                      {!isValidDeepgramKey && (
                        <span className="text-orange-600 dark:text-orange-400 ml-2">
                          (⚠️ Deepgram API key required for transcription)
                        </span>
                      )}
                    </div>
                  ) : (
                    'CallAnalyzer is active for manual call'
                  )}
                </div>
                <CallAnalyzer 
                  onCallEnd={handleCallEnd}
                  desktopCallActive={desktopCallActive}
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
                      For Zoom integration, ensure the desktop app is running and connected
                    </p>
                  )}
                  {!isValidDeepgramKey && (
                    <p className="text-xs text-orange-600 dark:text-orange-400">
                      Configure Deepgram API key for speech-to-text functionality
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