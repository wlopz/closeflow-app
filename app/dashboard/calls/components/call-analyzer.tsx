// Update handleDesktopMessage to extract and use mimeType
const handleDesktopMessage = async (message: any) => {
  console.log('📨 ENHANCED LOGGING: Processing desktop message:', message);
  
  switch (message.type) {
    case 'desktop-call-started':
      console.log('🎯 ENHANCED LOGGING: Desktop call started message received');
      console.log('🎤 ENHANCED LOGGING: Device settings:', message.deviceSettings);
      console.log('🎤 ENHANCED LOGGING: MIME type from desktop:', message.deviceSettings?.mimeType);
      console.log('🔑 ENHANCED LOGGING: Deepgram API key available:', !!message.deepgramApiKey);
      
      if (!live) {
        console.log('🎯 ENHANCED LOGGING: Starting live analysis from desktop message');
        
        // Store the device settings and API key for use in connectWithRetry
        window.desktopDeviceSettings = message.deviceSettings;
        window.desktopDeepgramApiKey = message.deepgramApiKey;
        
        await startLive(true);
      }
      break;
      
    case 'desktop-call-stopped':
      console.log('🛑 ENHANCED LOGGING: Desktop call stopped message received');
      if (live) {
        console.log('🛑 ENHANCED LOGGING: Stopping live analysis from desktop message');
        stopLive();
      }
      break;
      
    default:
      console.log('❓ ENHANCED LOGGING: Unknown desktop message type:', message.type);
  }
};

// Update connectWithRetry to use the stored device settings and API key
async function connectWithRetry() {
  console.log('🔗 ENHANCED LOGGING: Starting connectWithRetry function with Ably');
  console.log('🔗 ENHANCED LOGGING: Current state:', { live, connecting });
  
  const ablyApiKey = process.env.NEXT_PUBLIC_ABLY_API_KEY;
  const deepgramApiKey = window.desktopDeepgramApiKey || process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
  const deviceSettings = window.desktopDeviceSettings || {};
  
  console.log('🔑 ENHANCED LOGGING: Ably API key check - Present:', !!ablyApiKey);
  console.log('🔑 ENHANCED LOGGING: Deepgram API key check - Present:', !!deepgramApiKey);
  console.log('🎤 ENHANCED LOGGING: Device settings available:', !!deviceSettings);
  console.log('🎤 ENHANCED LOGGING: MIME type from device settings:', deviceSettings.mimeType);
  
  if (!ablyApiKey) {
    console.log('❌ ENHANCED LOGGING: No Ably API key found');
    toast({
      variant: 'destructive',
      title: 'Configuration Error',
      description: 'Ably API key is not configured.'
    });
    return;
  }

  if (!deepgramApiKey) {
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
            
            if (deepgramResult.channel.alternatives[0].words && deepgramResult.channel.alternatives[0].words.length > 0) {
              const speakers = new Set(deepgramResult.channel.alternatives[0].words.map(w => w.speaker).filter(s => s !== undefined));
              console.log('📝 ENHANCED LOGGING: Detected speakers:', Array.from(speakers));
            }
            
            handleTranscript(transcript, isFinal, deepgramResult.channel.alternatives[0].words?.[0]?.speaker);
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

    // NEW: Send start transcription command via Ably with Deepgram API key and mimeType from web app
    console.log('🔗 ENHANCED LOGGING: Sending start-transcription command via Ably...');
    console.log('🔑 ENHANCED LOGGING: Deepgram API key being sent from web app:', !!deepgramApiKey);
    console.log('🎤 ENHANCED LOGGING: MIME type being sent to desktop:', deviceSettings.mimeType);
    
    await controlChannel.current.publish('start-transcription', {
      deepgramApiKey: deepgramApiKey, // Web app provides the API key
      mimeType: deviceSettings.mimeType, // NEW: Include the MIME type from desktop
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