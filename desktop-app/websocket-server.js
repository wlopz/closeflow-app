const WebSocket = require('ws');
const { spawn } = require('child_process');

class AudioWebSocketServer {
  constructor() {
    this.server = null;
    this.webAppConnection = null;
    this.desktopConnection = null;
    this.desktopRendererConnection = null;
    this.deepgramConnection = null;
    this.audioStream = null;
    this.isRecording = false;
    this.port = 8080;
    this.deepgramApiKey = null;
    
    // Enhanced audio buffering system
    this.audioBuffer = [];
    this.deepgramReady = false;
    this.maxBufferSize = 50;
    this.bufferTimeoutMs = 30000;
    this.bufferStartTime = null;
    
    // CRITICAL: Add flag to track if transcription should be active
    this.transcriptionActive = false;
  }

  start() {
    console.log('🚀 Starting Audio WebSocket Server on port', this.port);
    
    this.server = new WebSocket.Server({ 
      port: this.port,
      perMessageDeflate: false
    });

    this.server.on('connection', (ws, req) => {
      const clientType = this.getClientType(req.url);
      console.log(`📱 ${clientType} connected to WebSocket server`);

      if (clientType === 'web-app') {
        this.webAppConnection = ws;
        this.setupWebAppConnection(ws);
      } else if (clientType === 'desktop') {
        this.desktopConnection = ws;
        this.setupDesktopConnection(ws);
      } else if (clientType === 'desktop-renderer') {
        this.desktopRendererConnection = ws;
        this.setupDesktopRendererConnection(ws);
      }

      ws.on('close', () => {
        console.log(`📱 ${clientType} disconnected from WebSocket server`);
        
        // CRITICAL FIX: Only clear connection references, don't stop Deepgram
        if (clientType === 'web-app') {
          this.webAppConnection = null;
          console.log('🔗 ENHANCED LOGGING: Web app disconnected - connection reference cleared');
        } else if (clientType === 'desktop') {
          this.desktopConnection = null;
          console.log('🔗 ENHANCED LOGGING: Desktop main process disconnected - connection reference cleared');
        } else if (clientType === 'desktop-renderer') {
          this.desktopRendererConnection = null;
          console.log('🔗 ENHANCED LOGGING: Desktop renderer disconnected - connection reference cleared');
        }
        
        // CRITICAL: Only call limited cleanup, preserve Deepgram connection
        this.limitedCleanup();
      });

      ws.on('error', (error) => {
        console.error(`❌ WebSocket error for ${clientType}:`, error);
      });
    });

    this.server.on('error', (error) => {
      console.error('❌ WebSocket server error:', error);
    });

    console.log('✅ Audio WebSocket Server started successfully');
  }

  getClientType(url) {
    if (url?.includes('web-app')) return 'web-app';
    if (url?.includes('desktop-renderer')) return 'desktop-renderer';
    return 'desktop';
  }

  setupWebAppConnection(ws) {
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log('📨 ENHANCED LOGGING: Received message from web app:', message.type);

        switch (message.type) {
          case 'start-transcription':
            console.log('🔗 ENHANCED LOGGING: Web app requested transcription start');
            this.deepgramApiKey = message.deepgramApiKey;
            this.transcriptionActive = true; // CRITICAL: Set transcription as active
            this.startDeepgramConnection();
            break;
          case 'stop-transcription':
            console.log('🛑 ENHANCED LOGGING: Web app requested transcription stop');
            this.transcriptionActive = false; // CRITICAL: Set transcription as inactive
            this.stopDeepgramConnection();
            break;
          default:
            console.log('❓ ENHANCED LOGGING: Unknown message type from web app:', message.type);
        }
      } catch (error) {
        console.error('❌ ENHANCED LOGGING: Error parsing web app message:', error);
      }
    });
  }

  setupDesktopConnection(ws) {
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log('📨 ENHANCED LOGGING: Received message from desktop main process:', message.type);

        switch (message.type) {
          case 'start-audio-capture':
            this.isRecording = true;
            console.log('🎤 ENHANCED LOGGING: Desktop main process notified audio capture started');
            break;
          case 'stop-audio-capture':
            this.isRecording = false;
            console.log('🛑 ENHANCED LOGGING: Desktop main process notified audio capture stopped');
            // NOTE: Don't stop Deepgram here - only when web app explicitly requests it
            break;
        }
      } catch (error) {
        console.error('❌ ENHANCED LOGGING: Error handling desktop main process message:', error);
      }
    });
  }

  setupDesktopRendererConnection(ws) {
    ws.on('message', (data) => {
      try {
        if (data instanceof Buffer) {
          console.log('🎤 ENHANCED LOGGING: Received audio data directly from renderer');
          console.log('🎤 ENHANCED LOGGING: Audio data size:', data.length);
          console.log('🎤 ENHANCED LOGGING: Audio data type:', typeof data);
          console.log('🎤 ENHANCED LOGGING: Is Buffer:', Buffer.isBuffer(data));
          console.log('🎤 ENHANCED LOGGING: First 20 bytes:', data.slice(0, 20));
          console.log('🎤 ENHANCED LOGGING: Deepgram connection exists:', !!this.deepgramConnection);
          console.log('🎤 ENHANCED LOGGING: Deepgram connection ready state:', this.deepgramConnection?.readyState);
          console.log('🎤 ENHANCED LOGGING: Deepgram ready flag:', this.deepgramReady);
          console.log('🎤 ENHANCED LOGGING: Transcription active flag:', this.transcriptionActive);
          
          // CRITICAL: Only process audio if transcription is active
          if (this.transcriptionActive) {
            this.handleAudioData(data);
          } else {
            console.log('⚠️ ENHANCED LOGGING: Transcription not active, ignoring audio data');
          }
        } else {
          const message = JSON.parse(data);
          console.log('📨 ENHANCED LOGGING: Received control message from desktop renderer:', message.type);
        }
      } catch (error) {
        console.error('❌ ENHANCED LOGGING: Error handling desktop renderer message:', error);
      }
    });
  }

  // Enhanced audio data handling with buffering
  handleAudioData(audioData) {
    if (this.deepgramReady && this.deepgramConnection && this.deepgramConnection.readyState === WebSocket.OPEN) {
      // Deepgram is ready, send immediately
      console.log('🎤 ENHANCED LOGGING: Deepgram ready - forwarding audio data immediately');
      this.deepgramConnection.send(audioData);
      console.log('🎤 ENHANCED LOGGING: Audio data sent to Deepgram successfully');
    } else {
      // Deepgram not ready, buffer the audio data
      console.log('📦 ENHANCED LOGGING: Deepgram not ready - buffering audio data');
      console.log('📦 ENHANCED LOGGING: Current buffer size:', this.audioBuffer.length);
      console.log('📦 ENHANCED LOGGING: Max buffer size:', this.maxBufferSize);
      
      // Initialize buffer start time if this is the first chunk
      if (this.audioBuffer.length === 0) {
        this.bufferStartTime = Date.now();
        console.log('📦 ENHANCED LOGGING: Started audio buffering at:', new Date(this.bufferStartTime).toISOString());
      }
      
      // Check buffer size limit
      if (this.audioBuffer.length >= this.maxBufferSize) {
        console.log('⚠️ ENHANCED LOGGING: Audio buffer full, removing oldest chunk');
        this.audioBuffer.shift(); // Remove oldest chunk
      }
      
      // Check buffer timeout
      const bufferAge = Date.now() - (this.bufferStartTime || Date.now());
      if (bufferAge > this.bufferTimeoutMs) {
        console.log('⚠️ ENHANCED LOGGING: Audio buffer timeout reached, clearing old data');
        this.clearAudioBuffer();
        this.bufferStartTime = Date.now();
      }
      
      // Add new audio data to buffer
      this.audioBuffer.push({
        data: audioData,
        timestamp: Date.now()
      });
      
      console.log('📦 ENHANCED LOGGING: Audio data buffered, new buffer size:', this.audioBuffer.length);
      console.log('📦 ENHANCED LOGGING: Buffer age:', bufferAge, 'ms');
    }
  }

  // Clear audio buffer
  clearAudioBuffer() {
    console.log('🧹 ENHANCED LOGGING: Clearing audio buffer');
    console.log('🧹 ENHANCED LOGGING: Discarding', this.audioBuffer.length, 'buffered audio chunks');
    this.audioBuffer = [];
    this.bufferStartTime = null;
  }

  // Send buffered audio to Deepgram
  sendBufferedAudio() {
    if (this.audioBuffer.length === 0) {
      console.log('📦 ENHANCED LOGGING: No buffered audio to send');
      return;
    }
    
    console.log('📦 ENHANCED LOGGING: Sending', this.audioBuffer.length, 'buffered audio chunks to Deepgram');
    
    let sentCount = 0;
    const bufferAge = Date.now() - (this.bufferStartTime || Date.now());
    
    console.log('📦 ENHANCED LOGGING: Buffer age:', bufferAge, 'ms');
    
    // Check if buffered data is still fresh enough
    if (bufferAge > this.bufferTimeoutMs) {
      console.log('⚠️ ENHANCED LOGGING: Buffered audio too old, discarding');
      this.clearAudioBuffer();
      return;
    }
    
    // Send all buffered audio chunks
    for (const bufferedChunk of this.audioBuffer) {
      if (this.deepgramConnection && this.deepgramConnection.readyState === WebSocket.OPEN) {
        try {
          this.deepgramConnection.send(bufferedChunk.data);
          sentCount++;
        } catch (error) {
          console.error('❌ ENHANCED LOGGING: Error sending buffered audio chunk:', error);
          break;
        }
      } else {
        console.log('⚠️ ENHANCED LOGGING: Deepgram connection lost while sending buffered audio');
        break;
      }
    }
    
    console.log('📦 ENHANCED LOGGING: Successfully sent', sentCount, 'buffered audio chunks');
    
    // Clear the buffer after sending
    this.clearAudioBuffer();
  }

  startDeepgramConnection() {
    if (!this.deepgramApiKey) {
      console.error('❌ ENHANCED LOGGING: No Deepgram API key provided');
      return;
    }

    // CRITICAL: Don't start if transcription is not active
    if (!this.transcriptionActive) {
      console.log('⚠️ ENHANCED LOGGING: Transcription not active, not starting Deepgram connection');
      return;
    }

    console.log('🔗 ENHANCED LOGGING: Connecting to Deepgram...');
    console.log('🔗 ENHANCED LOGGING: API key present:', !!this.deepgramApiKey);

    const dgUrl = new URL('wss://api.deepgram.com/v1/listen');
    dgUrl.searchParams.set('model', 'nova-2');
    dgUrl.searchParams.set('language', 'en-US');
    dgUrl.searchParams.set('interim_results', 'true');
    dgUrl.searchParams.set('punctuate', 'true');
    dgUrl.searchParams.set('smart_format', 'true');
    dgUrl.searchParams.set('diarize', 'true');
    dgUrl.searchParams.set('utterances', 'true');
    dgUrl.searchParams.set('endpointing', '10000');

    console.log('🔗 ENHANCED LOGGING: Deepgram URL:', dgUrl.toString());
    console.log('🔗 ENHANCED LOGGING: Endpointing set to 10 seconds for better stability');

    this.deepgramConnection = new WebSocket(dgUrl.toString(), ['token', this.deepgramApiKey]);

    this.deepgramConnection.on('open', () => {
      console.log('✅ ENHANCED LOGGING: Connected to Deepgram successfully');
      console.log('✅ ENHANCED LOGGING: Deepgram connection ready state:', this.deepgramConnection.readyState);
      
      // CRITICAL: Set Deepgram ready flag and send buffered audio
      this.deepgramReady = true;
      console.log('✅ ENHANCED LOGGING: Deepgram ready flag set to true');
      
      // Send any buffered audio data
      this.sendBufferedAudio();
      
      // Notify web app that Deepgram is ready
      if (this.webAppConnection) {
        this.webAppConnection.send(JSON.stringify({
          type: 'deepgram-connected'
        }));
        console.log('✅ ENHANCED LOGGING: Notified web app that Deepgram is connected');
      }
    });

    this.deepgramConnection.on('message', (data) => {
      try {
        console.log('📨 ENHANCED LOGGING: Received message from Deepgram');
        console.log('📨 ENHANCED LOGGING: Raw Deepgram data length:', data.length);
        
        const message = JSON.parse(data);
        console.log('📨 ENHANCED LOGGING: Parsed Deepgram message type:', message.type);
        
        // Enhanced logging for different message types
        if (message.type === 'Results') {
          console.log('📝 ENHANCED LOGGING: Deepgram Results message received');
          console.log('📝 ENHANCED LOGGING: Channel data exists:', !!message.channel);
          console.log('📝 ENHANCED LOGGING: Alternatives exist:', !!message.channel?.alternatives);
          console.log('📝 ENHANCED LOGGING: Alternatives length:', message.channel?.alternatives?.length || 0);
          
          if (message.channel?.alternatives?.[0]) {
            const alternative = message.channel.alternatives[0];
            console.log('📝 ENHANCED LOGGING: Transcript:', alternative.transcript);
            console.log('📝 ENHANCED LOGGING: Confidence:', alternative.confidence);
            console.log('📝 ENHANCED LOGGING: Is final:', message.is_final);
            console.log('📝 ENHANCED LOGGING: Words count:', alternative.words?.length || 0);
          }
        } else if (message.type === 'Metadata') {
          console.log('📊 ENHANCED LOGGING: Deepgram Metadata message received');
        } else if (message.type === 'UtteranceEnd') {
          console.log('🔚 ENHANCED LOGGING: Deepgram UtteranceEnd message received');
          console.log('🔚 ENHANCED LOGGING: Last word end:', message.last_word_end);
        } else {
          console.log('❓ ENHANCED LOGGING: Unknown Deepgram message type:', message.type);
        }
        
        // Forward Deepgram results to web app
        if (this.webAppConnection && this.webAppConnection.readyState === WebSocket.OPEN) {
          this.webAppConnection.send(JSON.stringify({
            type: 'deepgram-result',
            data: message
          }));
          console.log('📨 ENHANCED LOGGING: Forwarded Deepgram message to web app');
        } else {
          console.log('⚠️ ENHANCED LOGGING: Cannot forward to web app - connection not ready');
        }
      } catch (error) {
        console.error('❌ ENHANCED LOGGING: Error parsing Deepgram message:', error);
        console.error('❌ ENHANCED LOGGING: Raw data that failed to parse:', data.toString());
      }
    });

    this.deepgramConnection.on('error', (error) => {
      console.error('❌ ENHANCED LOGGING: Deepgram connection error:', error);
      console.error('❌ ENHANCED LOGGING: Error name:', error.name);
      console.error('❌ ENHANCED LOGGING: Error message:', error.message);
      console.error('❌ ENHANCED LOGGING: Error code:', error.code);
      
      // CRITICAL: Reset Deepgram ready flag on error
      this.deepgramReady = false;
      console.log('❌ ENHANCED LOGGING: Deepgram ready flag set to false due to error');
      
      // Clear buffer on error as the connection is no longer valid
      this.clearAudioBuffer();
      
      // Notify web app of error
      if (this.webAppConnection) {
        this.webAppConnection.send(JSON.stringify({
          type: 'deepgram-error',
          error: error.message
        }));
      }
    });

    this.deepgramConnection.on('close', (code, reason) => {
      console.log('🔗 ENHANCED LOGGING: Deepgram connection closed');
      console.log('🔗 ENHANCED LOGGING: Close code:', code);
      console.log('🔗 ENHANCED LOGGING: Close reason:', reason?.toString());
      
      // CRITICAL: Reset Deepgram ready flag on close
      this.deepgramReady = false;
      console.log('🔗 ENHANCED LOGGING: Deepgram ready flag set to false due to connection close');
      
      // Clear buffer on close as the connection is no longer valid
      this.clearAudioBuffer();
      
      // Log common close codes for debugging
      switch (code) {
        case 1000:
          console.log('ℹ️ ENHANCED LOGGING: Normal closure');
          break;
        case 1001:
          console.log('ℹ️ ENHANCED LOGGING: Going away');
          break;
        case 1002:
          console.log('⚠️ ENHANCED LOGGING: Protocol error');
          break;
        case 1003:
          console.log('⚠️ ENHANCED LOGGING: Unsupported data');
          break;
        case 1006:
          console.log('⚠️ ENHANCED LOGGING: Abnormal closure (no close frame)');
          break;
        case 1008:
          console.log('⚠️ ENHANCED LOGGING: Policy violation (possibly invalid audio format)');
          break;
        case 1011:
          console.log('⚠️ ENHANCED LOGGING: Internal server error');
          break;
        default:
          console.log('❓ ENHANCED LOGGING: Unknown close code:', code);
      }
      
      this.deepgramConnection = null;
      
      // Notify web app
      if (this.webAppConnection) {
        this.webAppConnection.send(JSON.stringify({
          type: 'deepgram-disconnected',
          closeCode: code,
          closeReason: reason?.toString()
        }));
      }
    });
  }

  stopDeepgramConnection() {
    if (this.deepgramConnection) {
      console.log('🛑 ENHANCED LOGGING: Closing Deepgram connection');
      console.log('🛑 ENHANCED LOGGING: Current connection state:', this.deepgramConnection.readyState);
      
      // CRITICAL: Reset Deepgram ready flag before closing
      this.deepgramReady = false;
      console.log('🛑 ENHANCED LOGGING: Deepgram ready flag set to false');
      
      // Clear any buffered audio
      this.clearAudioBuffer();
      
      this.deepgramConnection.close();
      this.deepgramConnection = null;
      console.log('🛑 ENHANCED LOGGING: Deepgram connection closed and nullified');
    }
  }

  // CRITICAL FIX: New limited cleanup that doesn't stop Deepgram
  limitedCleanup() {
    console.log('🧹 ENHANCED LOGGING: Limited cleanup - preserving Deepgram connection');
    
    // Only clear audio buffer and reset recording state
    // DO NOT stop Deepgram connection unless explicitly requested
    this.clearAudioBuffer();
    
    // Only reset recording state if no connections remain
    if (!this.desktopConnection && !this.desktopRendererConnection) {
      console.log('🧹 ENHANCED LOGGING: No desktop connections remain, resetting recording state');
      this.isRecording = false;
    }
    
    console.log('🧹 ENHANCED LOGGING: Limited cleanup completed - Deepgram connection preserved');
  }

  // CRITICAL FIX: Full cleanup only for server shutdown
  fullCleanup() {
    console.log('🧹 ENHANCED LOGGING: Full cleanup - stopping all connections');
    this.transcriptionActive = false;
    this.stopDeepgramConnection();
    this.clearAudioBuffer();
    this.isRecording = false;
  }

  stop() {
    console.log('🛑 ENHANCED LOGGING: Stopping Audio WebSocket Server');
    this.fullCleanup(); // Use full cleanup for server shutdown
    
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

// Create and start the server
const audioServer = new AudioWebSocketServer();
audioServer.start();

// Handle process termination
process.on('SIGINT', () => {
  console.log('📡 Received SIGINT, shutting down gracefully');
  audioServer.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('📡 Received SIGTERM, shutting down gracefully');
  audioServer.stop();
  process.exit(0);
});

module.exports = AudioWebSocketServer;