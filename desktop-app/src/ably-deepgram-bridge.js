const Ably = require('ably');
const WebSocket = require('ws');

class AblyDeepgramBridge {
  constructor() {
    console.log('🚀 ENHANCED LOGGING: AblyDeepgramBridge constructor called');
    console.log('🚀 ENHANCED LOGGING: Process PID:', process.pid);
    console.log('🚀 ENHANCED LOGGING: Current time:', new Date().toISOString());
    
    this.ablyClient = null;
    this.controlChannel = null;
    this.audioChannel = null;
    this.resultsChannel = null;
    this.deepgramConnection = null;
    this.deepgramApiKey = null;
    this.isRecording = false;
    this.transcriptionActive = false;
    
    // Enhanced audio buffering system
    this.audioBuffer = [];
    this.deepgramReady = false;
    this.maxBufferSize = 50;
    this.bufferTimeoutMs = 30000;
    this.bufferStartTime = null;
    
    // Add reconnection mechanism
    this.deepgramReconnectAttempts = 0;
    this.maxDeepgramReconnects = 5;
    this.deepgramReconnectDelay = 2000;
    this.deepgramReconnectTimer = null;
    
    // Add heartbeat mechanism
    this.deepgramHeartbeatInterval = null;
    this.deepgramHeartbeatIntervalMs = 5000;
    
    // Audio format validation
    this.audioFormatValidated = false;
    this.receivedChunkCount = 0;
  }

  async initialize(ablyApiKey) {
    console.log('🔗 ENHANCED LOGGING: Initializing Ably connection');
    console.log('🔗 ENHANCED LOGGING: API key present:', !!ablyApiKey);
    
    if (!ablyApiKey) {
      throw new Error('Ably API key is required');
    }

    try {
      // Initialize Ably client
      this.ablyClient = new Ably.Realtime({
        key: ablyApiKey,
        clientId: `desktop-${Date.now()}`,
        log: { level: 1 } // Enable debug logging
      });

      // Wait for connection
      await new Promise((resolve, reject) => {
        this.ablyClient.connection.on('connected', () => {
          console.log('✅ ENHANCED LOGGING: Connected to Ably');
          resolve();
        });

        this.ablyClient.connection.on('failed', (error) => {
          console.error('❌ ENHANCED LOGGING: Ably connection failed:', error);
          reject(error);
        });

        // Timeout after 10 seconds
        setTimeout(() => reject(new Error('Ably connection timeout')), 10000);
      });

      // Set up channels
      this.setupChannels();
      
      console.log('✅ ENHANCED LOGGING: Ably Deepgram Bridge initialized successfully');
      return true;

    } catch (error) {
      console.error('❌ ENHANCED LOGGING: Failed to initialize Ably:', error);
      throw error;
    }
  }

  setupChannels() {
    console.log('📡 ENHANCED LOGGING: Setting up Ably channels');

    // Control channel - receives commands from web app
    this.controlChannel = this.ablyClient.channels.get('closeflow:desktop-control');
    this.controlChannel.subscribe((message) => {
      this.handleControlMessage(message);
    });

    // Audio channel - publishes audio data to web app
    this.audioChannel = this.ablyClient.channels.get('closeflow:audio-stream');

    // Results channel - publishes Deepgram results to web app
    this.resultsChannel = this.ablyClient.channels.get('closeflow:deepgram-results');

    console.log('✅ ENHANCED LOGGING: Ably channels set up successfully');
  }

  handleControlMessage(message) {
    console.log('📨 ENHANCED LOGGING: Received control message:', message.name, message.data);

    switch (message.name) {
      case 'start-transcription':
        console.log('🔗 ENHANCED LOGGING: Web app requested transcription start');
        
        this.deepgramApiKey = message.data.deepgramApiKey;
        this.transcriptionActive = true;
        
        console.log('🔑 ENHANCED LOGGING: Stored deepgramApiKey:', !!this.deepgramApiKey);
        console.log('🔑 ENHANCED LOGGING: Transcription active:', this.transcriptionActive);
        
        if (this.deepgramApiKey) {
          console.log('🔑 ENHANCED LOGGING: Deepgram API key received, starting connection');
          this.startDeepgramConnection();
        } else {
          console.error('❌ ENHANCED LOGGING: No Deepgram API key provided in start-transcription message');
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

  // Handle audio data from desktop app
  handleAudioData(audioData) {
    console.log('🎤 ENHANCED LOGGING: Received audio data from desktop');
    console.log('🎤 ENHANCED LOGGING: Audio data size:', audioData.length);
    console.log('🎤 ENHANCED LOGGING: Audio data type:', typeof audioData);
    console.log('🎤 ENHANCED LOGGING: Is Buffer:', Buffer.isBuffer(audioData));
    console.log('🎤 ENHANCED LOGGING: Deepgram connection exists:', !!this.deepgramConnection);
    console.log('🎤 ENHANCED LOGGING: Deepgram ready flag:', this.deepgramReady);
    console.log('🎤 ENHANCED LOGGING: Transcription active flag:', this.transcriptionActive);

    // Validate audio format on first few chunks
    this.validateAudioFormat(audioData);

    if (this.deepgramReady && this.deepgramConnection && this.deepgramConnection.readyState === WebSocket.OPEN) {
      // Deepgram is ready, send immediately
      console.log('🎤 ENHANCED LOGGING: Deepgram ready - forwarding audio data immediately');
      try {
        this.deepgramConnection.send(audioData);
        console.log('🎤 ENHANCED LOGGING: Audio data sent to Deepgram successfully');
      } catch (error) {
        console.error('❌ ENHANCED LOGGING: Error sending audio to Deepgram:', error);
        this.deepgramReady = false;
        this.bufferAudioData(audioData);
        this.scheduleDeepgramReconnect();
      }
    } else {
      // Deepgram not ready, buffer the audio data
      this.bufferAudioData(audioData);
    }
  }

  validateAudioFormat(audioData) {
    this.receivedChunkCount++;
    
    if (!this.audioFormatValidated && this.receivedChunkCount <= 5) {
      console.log('🔍 ENHANCED LOGGING: Validating audio format (chunk', this.receivedChunkCount, ')');
      
      // FIXED: Ensure we're working with a Buffer and use proper comparison
      let buffer;
      if (Buffer.isBuffer(audioData)) {
        buffer = audioData;
      } else {
        buffer = Buffer.from(audioData);
      }
      
      // Check for WebM container signature
      const webmSignature = Buffer.from([0x1A, 0x45, 0xDF, 0xA3]);
      if (buffer.length >= 4 && buffer.subarray(0, 4).equals(webmSignature)) {
        console.log('✅ ENHANCED LOGGING: Valid WebM container detected');
        this.audioFormatValidated = true;
      } else if (this.receivedChunkCount === 1) {
        console.log('🔍 ENHANCED LOGGING: First chunk header:', buffer.slice(0, Math.min(32, buffer.length)));
        console.log('🔍 ENHANCED LOGGING: Expected WebM signature:', webmSignature);
      }
      
      if (this.receivedChunkCount === 5 && !this.audioFormatValidated) {
        console.log('⚠️ ENHANCED LOGGING: Audio format validation failed after 5 chunks');
        console.log('⚠️ ENHANCED LOGGING: This may cause Deepgram connection issues');
      }
    }
  }

  bufferAudioData(audioData) {
    console.log('📦 ENHANCED LOGGING: Deepgram not ready - buffering audio data');
    console.log('📦 ENHANCED LOGGING: Current buffer size:', this.audioBuffer.length);
    
    // Initialize buffer start time if this is the first chunk
    if (this.audioBuffer.length === 0) {
      this.bufferStartTime = Date.now();
      console.log('📦 ENHANCED LOGGING: Started audio buffering at:', new Date(this.bufferStartTime).toISOString());
    }
    
    // Check buffer size limit
    if (this.audioBuffer.length >= this.maxBufferSize) {
      console.log('⚠️ ENHANCED LOGGING: Audio buffer full, removing oldest chunk');
      this.audioBuffer.shift();
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
    
    // If transcription is active but Deepgram is not connected, try to reconnect
    if (this.transcriptionActive && (!this.deepgramConnection || this.deepgramConnection.readyState !== WebSocket.OPEN)) {
      this.scheduleDeepgramReconnect();
    }
  }

  clearAudioBuffer() {
    console.log('🧹 ENHANCED LOGGING: Clearing audio buffer');
    console.log('🧹 ENHANCED LOGGING: Discarding', this.audioBuffer.length, 'buffered audio chunks');
    this.audioBuffer = [];
    this.bufferStartTime = null;
  }

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
    this.clearAudioBuffer();
  }

  scheduleDeepgramReconnect() {
    if (this.deepgramReconnectTimer || !this.transcriptionActive) {
      return;
    }
    
    if (this.deepgramReconnectAttempts >= this.maxDeepgramReconnects) {
      console.log('⚠️ ENHANCED LOGGING: Maximum Deepgram reconnection attempts reached');
      this.deepgramReconnectAttempts = 0;
      return;
    }
    
    this.deepgramReconnectAttempts++;
    const delay = this.deepgramReconnectDelay * Math.pow(1.5, this.deepgramReconnectAttempts - 1);
    
    console.log(`🔄 ENHANCED LOGGING: Scheduling Deepgram reconnection in ${delay}ms (attempt ${this.deepgramReconnectAttempts}/${this.maxDeepgramReconnects})`);
    
    this.deepgramReconnectTimer = setTimeout(() => {
      console.log(`🔄 ENHANCED LOGGING: Executing Deepgram reconnection attempt ${this.deepgramReconnectAttempts}`);
      this.deepgramReconnectTimer = null;
      
      if (this.transcriptionActive && this.deepgramApiKey) {
        this.startDeepgramConnection();
      } else {
        console.log('⚠️ ENHANCED LOGGING: Skipping reconnection - transcription inactive or no API key');
      }
    }, delay);
  }

  startDeepgramHeartbeat() {
    this.stopDeepgramHeartbeat();
    
    console.log('💓 ENHANCED LOGGING: Starting Deepgram heartbeat');
    
    this.deepgramHeartbeatInterval = setInterval(() => {
      if (this.deepgramConnection && this.deepgramConnection.readyState === WebSocket.OPEN) {
        try {
          this.deepgramConnection.send(JSON.stringify({ 
            type: "KeepAlive", 
            timestamp: Date.now() 
          }));
          console.log('💓 ENHANCED LOGGING: Sent Deepgram heartbeat');
        } catch (error) {
          console.error('❌ ENHANCED LOGGING: Error sending Deepgram heartbeat:', error);
          this.deepgramReady = false;
          this.scheduleDeepgramReconnect();
        }
      } else {
        console.log('⚠️ ENHANCED LOGGING: Skipping heartbeat - Deepgram connection not ready');
      }
    }, this.deepgramHeartbeatIntervalMs);
  }
  
  stopDeepgramHeartbeat() {
    if (this.deepgramHeartbeatInterval) {
      clearInterval(this.deepgramHeartbeatInterval);
      this.deepgramHeartbeatInterval = null;
      console.log('💓 ENHANCED LOGGING: Stopped Deepgram heartbeat');
    }
  }

  startDeepgramConnection() {
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

    const dgUrl = new URL('wss://api.deepgram.com/v1/listen');
    dgUrl.searchParams.set('model', 'nova-2');
    dgUrl.searchParams.set('language', 'en-US');
    dgUrl.searchParams.set('interim_results', 'true');
    dgUrl.searchParams.set('punctuate', 'true');
    dgUrl.searchParams.set('smart_format', 'true');
    dgUrl.searchParams.set('encoding', 'opus');
    dgUrl.searchParams.set('sample_rate', '48000');
    dgUrl.searchParams.set('channels', '1');
    dgUrl.searchParams.set('container', 'webm');
    
    console.log('🔗 ENHANCED LOGGING: Deepgram connection URL:', dgUrl.toString());

    const ws = new WebSocket(dgUrl.toString(), ['token', this.deepgramApiKey]);

    ws.on('open', () => {
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
      console.error('❌ ENHANCED LOGGING: Deepgram connection error:', error);
      
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
      console.log('🔗 ENHANCED LOGGING: Deepgram connection closed');
      console.log('🔗 ENHANCED LOGGING: Close code:', code);
      console.log('🔗 ENHANCED LOGGING: Close reason:', reason?.toString());
      
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
  }

  stopDeepgramConnection() {
    // Clear any reconnection timer
    if (this.deepgramReconnectTimer) {
      clearTimeout(this.deepgramReconnectTimer);
      this.deepgramReconnectTimer = null;
    }
    
    this.stopDeepgramHeartbeat();
    
    if (this.deepgramConnection) {
      console.log('🛑 ENHANCED LOGGING: Closing Deepgram connection');
      
      this.deepgramReady = false;
      this.clearAudioBuffer();
      
      this.deepgramConnection.close();
      this.deepgramConnection = null;
      console.log('🛑 ENHANCED LOGGING: Deepgram connection closed and nullified');
    }
  }

  cleanup() {
    console.log('🧹 ENHANCED LOGGING: Cleaning up Ably Deepgram Bridge');
    
    this.transcriptionActive = false;
    this.stopDeepgramConnection();
    this.clearAudioBuffer();
    this.isRecording = false;
    
    // Clear any reconnection timer
    if (this.deepgramReconnectTimer) {
      clearTimeout(this.deepgramReconnectTimer);
      this.deepgramReconnectTimer = null;
    }

    // Close Ably connection
    if (this.ablyClient) {
      this.ablyClient.close();
      this.ablyClient = null;
    }
  }
}

module.exports = AblyDeepgramBridge;