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
    
    // Track received chunk count
    this.receivedChunkCount = 0;
    
    // Add callback for Deepgram connection status
    this.onDeepgramConnected = null;
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

  // Set callback for Deepgram connection status
  setDeepgramConnectedCallback(callback) {
    this.onDeepgramConnected = callback;
    console.log('✅ ENHANCED LOGGING: Set Deepgram connection callback');
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

  // Updated handleControlMessage to extract and use mimeType
  handleControlMessage(message) {
    console.log('📨 ENHANCED LOGGING: Received control message:', message.name, message.data);

    switch (message.name) {
      case 'start-transcription':
        console.log('🔗 ENHANCED LOGGING: Web app requested transcription start');
        
        this.deepgramApiKey = message.data.deepgramApiKey;
        const mimeType = message.data.mimeType; // Extract MIME type
        this.transcriptionActive = true;
        
        console.log('🔑 ENHANCED LOGGING: Stored deepgramApiKey:', !!this.deepgramApiKey);
        console.log('🎤 ENHANCED LOGGING: Received MIME type:', mimeType);
        console.log('🔑 ENHANCED LOGGING: Transcription active:', this.transcriptionActive);
        
        // Start connection when transcription is requested
        if (this.transcriptionActive && this.deepgramApiKey) {
          console.log('🔑 ENHANCED LOGGING: Starting Deepgram connection with MIME type');
          this.startDeepgramConnection(mimeType); // Pass MIME type
        } else {
          console.error('❌ ENHANCED LOGGING: Cannot start Deepgram - missing requirements');
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
    // Track received chunks
    this.receivedChunkCount++;
    
    // Skip logging for every chunk to reduce noise
    if (this.receivedChunkCount % 20 === 0) {
      console.log('🎤 ENHANCED LOGGING: Received audio data from desktop');
      console.log('🎤 ENHANCED LOGGING: Audio data size:', audioData.length);
      console.log('🎤 ENHANCED LOGGING: Audio data type:', typeof audioData);
      console.log('🎤 ENHANCED LOGGING: Is Buffer:', Buffer.isBuffer(audioData));
      console.log('🎤 ENHANCED LOGGING: Deepgram connection exists:', !!this.deepgramConnection);
      console.log('🎤 ENHANCED LOGGING: Deepgram ready flag:', this.deepgramReady);
      console.log('🎤 ENHANCED LOGGING: Transcription active flag:', this.transcriptionActive);
      console.log('🎤 ENHANCED LOGGING: Total chunks received:', this.receivedChunkCount);
    }

    // Skip empty or very small audio chunks (likely silence)
    if (!audioData || audioData.length < 10) {
      if (this.receivedChunkCount % 20 === 0) {
        console.log('⚠️ ENHANCED LOGGING: Skipping empty or very small audio chunk');
      }
      return;
    }

    // Only send audio if transcription is active AND Deepgram is ready
    if (this.transcriptionActive && this.deepgramReady && this.deepgramConnection && this.deepgramConnection.readyState === WebSocket.OPEN) {
      // Deepgram is ready, send immediately
      if (this.receivedChunkCount % 20 === 0) {
        console.log('🎤 ENHANCED LOGGING: Deepgram ready - forwarding audio data immediately');
      }
      
      try {
        this.deepgramConnection.send(audioData);
        
        if (this.receivedChunkCount % 20 === 0) {
          console.log('🎤 ENHANCED LOGGING: Audio data sent to Deepgram successfully');
        }
      } catch (error) {
        console.error('❌ ENHANCED LOGGING: Error sending audio to Deepgram:', error);
        this.deepgramReady = false;
        this.bufferAudioData(audioData);
        this.scheduleDeepgramReconnect();
      }
    } else {
      // Deepgram not ready or transcription not active, buffer the audio data
      if (this.transcriptionActive) {
        this.bufferAudioData(audioData);
      } else {
        if (this.receivedChunkCount % 20 === 0) {
          console.log('⚠️ ENHANCED LOGGING: Transcription not active, discarding audio data');
        }
      }
    }
  }

  bufferAudioData(audioData) {
    if (this.receivedChunkCount % 20 === 0) {
      console.log('📦 ENHANCED LOGGING: Deepgram not ready - buffering audio data');
      console.log('📦 ENHANCED LOGGING: Current buffer size:', this.audioBuffer.length);
    }
    
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
    
    if (this.receivedChunkCount % 20 === 0) {
      console.log('📦 ENHANCED LOGGING: Audio data buffered, new buffer size:', this.audioBuffer.length);
    }
    
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

  // Updated startDeepgramConnection to accept and use mimeType
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
    
    // Parse MIME type to determine encoding and container
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
    
    // Add detailed logging around WebSocket creation and state
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
      
      // Call the callback if provided
      if (this.onDeepgramConnected && typeof this.onDeepgramConnected === 'function') {
        console.log('🔔 ENHANCED LOGGING: Calling Deepgram connected callback');
        this.onDeepgramConnected();
      }
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        
        // Only log occasionally to reduce noise
        if (this.receivedChunkCount % 20 === 0) {
          console.log('📨 ENHANCED LOGGING: Received message from Deepgram');
          console.log('📨 ENHANCED LOGGING: Parsed Deepgram message type:', message.type);
        }
        
        if (message.type === 'Results') {
          // Only log when there's actual transcript content
          if (message.channel?.alternatives?.[0]?.transcript) {
            const alternative = message.channel.alternatives[0];
            console.log('📝 ENHANCED LOGGING: Transcript:', alternative.transcript);
            console.log('📝 ENHANCED LOGGING: Is final:', message.is_final);
            
            // Try to get speaker from words array
            const words = alternative.words;
            if (words && words.length > 0) {
              const speakerCounts = new Map();
              words.forEach((word) => {
                if (word.speaker !== undefined) {
                  speakerCounts.set(word.speaker, (speakerCounts.get(word.speaker) || 0) + 1);
                }
              });
              
              if (speakerCounts.size > 0) {
                let maxCount = 0;
                let dominantSpeaker = undefined;
                for (const [speaker, count] of speakerCounts.entries()) {
                  if (count > maxCount) {
                    maxCount = count;
                    dominantSpeaker = speaker;
                  }
                }
                console.log('📝 ENHANCED LOGGING: Detected speakers:', Array.from(speakerCounts.keys()));
                console.log('📝 ENHANCED LOGGING: Dominant speaker:', dominantSpeaker);
              }
            }
          }
        }
        
        // Forward Deepgram results to web app via Ably
        if (this.resultsChannel) {
          this.resultsChannel.publish('deepgram-result', {
            data: message,
            timestamp: Date.now()
          });
          
          // Only log occasionally to reduce noise
          if (this.receivedChunkCount % 20 === 0) {
            console.log('📨 ENHANCED LOGGING: Forwarded Deepgram message to web app via Ably');
          }
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
    
    // Add timeout to detect if no events fire
    setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        console.log('⚠️ ENHANCED LOGGING: WebSocket still connecting after 5 seconds, readyState:', ws.readyState);
      } else if (ws.readyState === WebSocket.CLOSED) {
        console.log('⚠️ ENHANCED LOGGING: WebSocket closed within 5 seconds without firing events, readyState:', ws.readyState);
      }
    }, 5000);
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