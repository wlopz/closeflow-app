// Update handleControlMessage to extract and use mimeType
handleControlMessage(message) {
  console.log('📨 ENHANCED LOGGING: Received control message:', message.name, message.data);

  switch (message.name) {
    case 'start-transcription':
      console.log('🔗 ENHANCED LOGGING: Web app requested transcription start');
      
      this.deepgramApiKey = message.data.deepgramApiKey;
      const mimeType = message.data.mimeType; // NEW: Extract MIME type
      this.transcriptionActive = true;
      
      console.log('🔑 ENHANCED LOGGING: Stored deepgramApiKey:', !!this.deepgramApiKey);
      console.log('🎤 ENHANCED LOGGING: Received MIME type:', mimeType);
      console.log('🔑 ENHANCED LOGGING: Transcription active:', this.transcriptionActive);
      
      // Always start connection when transcription is requested
      if (this.transcriptionActive) {
        console.log('🔑 ENHANCED LOGGING: Starting Deepgram connection with MIME type');
        this.startDeepgramConnection(mimeType); // NEW: Pass MIME type
      } else {
        console.error('❌ ENHANCED LOGGING: Transcription not active, cannot start Deepgram connection');
      }
      break;
      
    case 'stop-transcription':
      console.log('🛑 ENHANCED LOGGING: Web app requested transcription stop');
      this.transcriptionActive = false;
      this.stopDeepgramConnection();
      break;
      
    default:
      console.log('❓ ENHANCED LOGGING: Unknown control message:', message.name);
      console.log('❓ ENHANCED LOGGING: Full unknown message:', message);
  }
}

// Update startDeepgramConnection to accept and use mimeType
startDeepgramConnection(mimeType = null) {
  if (!this.deepgramApiKey) {
    console.error('❌ ENHANCED LOGGING: No Deepgram API key provided');
    return;
  }

  if (!this.transcriptionActive) {
    console.log('⚠️ ENHANCED LOGGING: Transcription not active, not starting Deepgram connection');
    return;
  }
  
  // Clear any existing connection
  if (this.deepgramConnection) {
    try {
      this.deepgramConnection.close();
    } catch (e) {
      // Ignore errors during cleanup
    }
    this.deepgramConnection = null;
  }

  console.log('🔗 ENHANCED LOGGING: Connecting to Deepgram...');
  console.log('🎤 ENHANCED LOGGING: Using MIME type:', mimeType);

  const dgUrl = new URL('wss://api.deepgram.com/v1/listen');
  dgUrl.searchParams.set('model', 'nova-2');
  dgUrl.searchParams.set('language', 'en-US');
  dgUrl.searchParams.set('interim_results', 'true');
  dgUrl.searchParams.set('punctuate', 'true');
  dgUrl.searchParams.set('smart_format', 'true');
  dgUrl.searchParams.set('sample_rate', '48000');
  dgUrl.searchParams.set('channels', '1');
  
  // NEW: Parse MIME type to determine encoding and container
  let encoding = 'opus';
  let container = 'webm';
  
  if (mimeType) {
    console.log('🎤 ENHANCED LOGGING: Parsing MIME type:', mimeType);
    
    // Parse MIME type like "audio/webm;codecs=opus"
    const [mediaType, codecsParam] = mimeType.split(';');
    
    if (mediaType) {
      const [, containerType] = mediaType.split('/');
      if (containerType) {
        container = containerType;
        console.log('🎤 ENHANCED LOGGING: Extracted container:', container);
      }
    }
    
    if (codecsParam) {
      const codecsMatch = codecsParam.match(/codecs=([^,\s]+)/);
      if (codecsMatch && codecsMatch[1]) {
        encoding = codecsMatch[1];
        console.log('🎤 ENHANCED LOGGING: Extracted encoding:', encoding);
      }
    }
  }
  
  dgUrl.searchParams.set('encoding', encoding);
  dgUrl.searchParams.set('container', container);
  
  console.log('🔗 ENHANCED LOGGING: Deepgram connection URL:', dgUrl.toString());
  console.log('🎤 ENHANCED LOGGING: Final audio format - encoding:', encoding, 'container:', container);

  const ws = new WebSocket(dgUrl.toString(), ['token', this.deepgramApiKey]);
  
  // NEW: Add detailed logging around WebSocket creation and state
  console.log('🔗 ENHANCED LOGGING: WebSocket created, initial readyState:', ws.readyState);
  console.log('🔗 ENHANCED LOGGING: WebSocket.CONNECTING =', WebSocket.CONNECTING);
  console.log('🔗 ENHANCED LOGGING: WebSocket.OPEN =', WebSocket.OPEN);
  console.log('🔗 ENHANCED LOGGING: WebSocket.CLOSING =', WebSocket.CLOSING);
  console.log('🔗 ENHANCED LOGGING: WebSocket.CLOSED =', WebSocket.CLOSED);

  ws.on('open', () => {
    console.log('✅ ENHANCED LOGGING: WebSocket open event fired');
    console.log('✅ ENHANCED LOGGING: WebSocket readyState on open:', ws.readyState);
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.log('⚠️ ENHANCED LOGGING: WebSocket connection invalid during open callback');
      return;
    }

    console.log('✅ ENHANCED LOGGING: Connected to Deepgram successfully');
    
    this.deepgramConnection = ws;
    this.deepgramReady = true;
    this.deepgramReconnectAttempts = 0;
    
    this.sendBufferedAudio();
    this.startDeepgramHeartbeat();
    
    // Notify web app via Ably that Deepgram is ready
    if (this.resultsChannel) {
      this.resultsChannel.publish('deepgram-connected', {
        timestamp: Date.now()
      });
      console.log('✅ ENHANCED LOGGING: Notified web app via Ably that Deepgram is connected');
    }
  });

  ws.on('message', (data) => {
    try {
      console.log('📨 ENHANCED LOGGING: Received message from Deepgram');
      
      const message = JSON.parse(data);
      console.log('📨 ENHANCED LOGGING: Parsed Deepgram message type:', message.type);
      
      if (message.type === 'Results') {
        console.log('📝 ENHANCED LOGGING: Deepgram Results message received');
        
        if (message.channel?.alternatives?.[0]) {
          const alternative = message.channel.alternatives[0];
          console.log('📝 ENHANCED LOGGING: Transcript:', alternative.transcript);
          console.log('📝 ENHANCED LOGGING: Is final:', message.is_final);
          
          if (alternative.words && alternative.words.length > 0) {
            const speakers = new Set(alternative.words.map(w => w.speaker).filter(s => s !== undefined));
            console.log('📝 ENHANCED LOGGING: Detected speakers:', Array.from(speakers));
          }
        }
      }
      
      // Forward Deepgram results to web app via Ably
      if (this.resultsChannel) {
        this.resultsChannel.publish('deepgram-result', {
          data: message,
          timestamp: Date.now()
        });
        console.log('📨 ENHANCED LOGGING: Forwarded Deepgram message to web app via Ably');
      }
    } catch (error) {
      console.error('❌ ENHANCED LOGGING: Error parsing Deepgram message:', error);
    }
  });

  ws.on('error', (error) => {
    console.error('❌ ENHANCED LOGGING: Deepgram WebSocket error event fired');
    console.error('❌ ENHANCED LOGGING: Error details:', error);
    console.error('❌ ENHANCED LOGGING: WebSocket readyState on error:', ws.readyState);
    
    this.deepgramReady = false;
    this.stopDeepgramHeartbeat();
    
    if (this.deepgramConnection === ws) {
      this.deepgramConnection = null;
    }
    
    if (this.transcriptionActive) {
      this.scheduleDeepgramReconnect();
    }
    
    // Notify web app of error via Ably
    if (this.resultsChannel) {
      this.resultsChannel.publish('deepgram-error', {
        error: error.message,
        timestamp: Date.now()
      });
    }
  });

  ws.on('close', (code, reason) => {
    console.log('🔗 ENHANCED LOGGING: Deepgram WebSocket close event fired');
    console.log('🔗 ENHANCED LOGGING: Close code:', code);
    console.log('🔗 ENHANCED LOGGING: Close reason:', reason?.toString());
    console.log('🔗 ENHANCED LOGGING: WebSocket readyState on close:', ws.readyState);
    
    this.deepgramReady = false;
    this.stopDeepgramHeartbeat();
    
    if (this.deepgramConnection === ws) {
      this.deepgramConnection = null;
    }
    
    if (this.transcriptionActive) {
      this.scheduleDeepgramReconnect();
    }
    
    // Notify web app via Ably
    if (this.resultsChannel) {
      this.resultsChannel.publish('deepgram-disconnected', {
        closeCode: code,
        closeReason: reason?.toString(),
        timestamp: Date.now()
      });
    }
  });
  
  // NEW: Add timeout to detect if no events fire
  setTimeout(() => {
    if (ws.readyState === WebSocket.CONNECTING) {
      console.log('⚠️ ENHANCED LOGGING: WebSocket still connecting after 5 seconds, readyState:', ws.readyState);
    } else if (ws.readyState === WebSocket.CLOSED) {
      console.log('⚠️ ENHANCED LOGGING: WebSocket closed within 5 seconds without firing events, readyState:', ws.readyState);
    }
  }, 5000);
}