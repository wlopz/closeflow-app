const Ably = require('ably');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const os = require('os');

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
    
    // Audio verification
    this.audioVerificationEnabled = true;
    this.audioVerificationSampleCount = 0;
    this.maxAudioVerificationSamples = 10;
    this.audioVerificationPath = path.join(os.tmpdir(), 'deepgram-audio-verification');
    this.audioVerificationBuffer = [];
    this.audioVerificationBufferSize = 100 * 1024; // 100 KB
    
    // Create verification directory if it doesn't exist
    if (this.audioVerificationEnabled) {
      try {
        if (!fs.existsSync(this.audioVerificationPath)) {
          fs.mkdirSync(this.audioVerificationPath, { recursive: true });
        }
        console.log('✅ ENHANCED LOGGING: Audio verification directory created at:', this.audioVerificationPath);
      } catch (error) {
        console.error('❌ ENHANCED LOGGING: Failed to create audio verification directory:', error);
        this.audioVerificationEnabled = false;
      }
    }
    
    // Track audio characteristics
    this.audioCharacteristics = {
      sampleRate: 48000,
      channelCount: 1,
      encoding: 'opus',
      container: 'webm'
    };
    
    // Track Deepgram message statistics
    this.messageStats = {
      totalReceived: 0,
      byType: {},
      lastMessageTime: null,
      hasReceivedResults: false
    };
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

  // Updated handleControlMessage to extract and use mimeType, sampleRate, and channelCount
  handleControlMessage(message) {
    console.log('📨 ENHANCED LOGGING: Received control message:', message.name, message.data);

    switch (message.name) {
      case 'start-transcription':
        console.log('🔗 ENHANCED LOGGING: Web app requested transcription start');
        
        this.deepgramApiKey = message.data.deepgramApiKey;
        const mimeType = message.data.mimeType; // Extract MIME type
        const sampleRate = message.data.sampleRate || 48000; // Extract sample rate or use default
        const channelCount = message.data.channelCount || 1; // Extract channel count or use default
        this.transcriptionActive = true;
        
        // Store audio characteristics
        this.audioCharacteristics = {
          sampleRate: sampleRate,
          channelCount: channelCount,
          encoding: 'opus', // Default, will be updated based on mimeType
          container: 'webm' // Default, will be updated based on mimeType
        };
        
        console.log('🔑 ENHANCED LOGGING: Stored deepgramApiKey:', !!this.deepgramApiKey);
        console.log('🎤 ENHANCED LOGGING: Received MIME type:', mimeType);
        console.log('🎤 ENHANCED LOGGING: Received sample rate:', sampleRate);
        console.log('🎤 ENHANCED LOGGING: Received channel count:', channelCount);
        console.log('🔑 ENHANCED LOGGING: Transcription active:', this.transcriptionActive);
        
        // Start connection when transcription is requested
        if (this.transcriptionActive && this.deepgramApiKey) {
          console.log('🔑 ENHANCED LOGGING: Starting Deepgram connection with audio parameters');
          this.startDeepgramConnection(mimeType, sampleRate, channelCount);
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

    // Save audio sample for verification if enabled
    this.saveAudioSampleForVerification(audioData);

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

  // New method to save audio samples for verification
  saveAudioSampleForVerification(audioData) {
    if (!this.audioVerificationEnabled) return;
    
    try {
      // Add to verification buffer
      this.audioVerificationBuffer.push(audioData);
      
      // Calculate current buffer size
      const currentBufferSize = this.audioVerificationBuffer.reduce((size, chunk) => size + chunk.length, 0);
      
      // Check if buffer is large enough or if we've reached a certain number of chunks
      if (currentBufferSize >= this.audioVerificationBufferSize || this.audioVerificationBuffer.length >= 20) {
        // Only save a limited number of samples
        if (this.audioVerificationSampleCount >= this.maxAudioVerificationSamples) {
          // Clear buffer but don't save
          this.audioVerificationBuffer = [];
          return;
        }
        
        const timestamp = Date.now();
        const filePath = path.join(this.audioVerificationPath, `audio-sample-${timestamp}.webm`);
        
        // Concatenate all buffered chunks
        const combinedBuffer = Buffer.concat(this.audioVerificationBuffer);
        
        // Write to file
        fs.writeFileSync(filePath, combinedBuffer);
        this.audioVerificationSampleCount++;
        
        console.log('💾 ENHANCED LOGGING: Saved audio sample for verification:', filePath);
        console.log('💾 ENHANCED LOGGING: Sample size:', combinedBuffer.length, 'bytes');
        
        // Clear the buffer
        this.audioVerificationBuffer = [];
        
        // If we've reached the max samples, log the verification instructions
        if (this.audioVerificationSampleCount >= this.maxAudioVerificationSamples) {
          console.log('🔍 AUDIO VERIFICATION INSTRUCTIONS:');
          console.log(`1. Audio samples saved to: ${this.audioVerificationPath}`);
          console.log('2. To verify audio content, use a media player that supports WebM audio (e.g., VLC)');
          console.log('3. Check if speech is audible in the samples');
          console.log('4. If no speech is audible, check microphone settings and audio routing');
        }
      }
    } catch (error) {
      console.error('❌ ENHANCED LOGGING: Error saving audio sample:', error);
      // Disable verification if there's an error
      this.audioVerificationEnabled = false;
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

  // Updated startDeepgramConnection to accept and use mimeType, sampleRate, and channelCount
  startDeepgramConnection(mimeType = null, sampleRate = null, channelCount = null) {
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
    console.log('🎤 ENHANCED LOGGING: Using sample rate:', sampleRate || this.audioCharacteristics.sampleRate);
    console.log('🎤 ENHANCED LOGGING: Using channel count:', channelCount || this.audioCharacteristics.channelCount);

    // CRITICAL FIX: Add diarize=true parameter for speaker separation
    const dgUrl = new URL('wss://api.deepgram.com/v1/listen');
    
    // Add essential parameters including speaker diarization
    dgUrl.searchParams.set('model', 'nova-2');
    dgUrl.searchParams.set('language', 'en-US');
    dgUrl.searchParams.set('interim_results', 'true');
    dgUrl.searchParams.set('punctuate', 'true');
    dgUrl.searchParams.set('smart_format', 'true');
    dgUrl.searchParams.set('diarize', 'true'); // CRITICAL: Enable speaker diarization
    
    console.log('🎯 ENHANCED LOGGING: CRITICAL FIX - Speaker diarization enabled with diarize=true');
    console.log('🔗 ENHANCED LOGGING: Deepgram connection URL:', dgUrl.toString());
    
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

      console.log('✅ ENHANCED LOGGING: Connected to Deepgram successfully with speaker diarization enabled');
      
      this.deepgramConnection = ws;
      this.deepgramReady = true;
      this.deepgramReconnectAttempts = 0;
      
      // Reset message statistics
      this.messageStats = {
        totalReceived: 0,
        byType: {},
        lastMessageTime: Date.now(),
        hasReceivedResults: false
      };
      
      this.sendBufferedAudio();
      this.startDeepgramHeartbeat();
      
      // Notify web app via Ably that Deepgram is ready
      if (this.resultsChannel) {
        this.resultsChannel.publish('deepgram-connected', {
          timestamp: Date.now(),
          diarizationEnabled: true // Indicate that speaker diarization is active
        });
        console.log('✅ ENHANCED LOGGING: Notified web app via Ably that Deepgram is connected with diarization');
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
        
        // Update message statistics
        this.messageStats.totalReceived++;
        this.messageStats.lastMessageTime = Date.now();
        
        if (!this.messageStats.byType[message.type]) {
          this.messageStats.byType[message.type] = 0;
        }
        this.messageStats.byType[message.type]++;
        
        // ENHANCED: Log ALL messages from Deepgram, not just Results
        console.log('📨 ENHANCED LOGGING: Received message from Deepgram, type:', message.type);
        console.log('📨 ENHANCED LOGGING: Full message content:', JSON.stringify(message, null, 2));
        
        // Log message statistics periodically
        if (this.messageStats.totalReceived % 10 === 0) {
          console.log('📊 ENHANCED LOGGING: Deepgram message statistics:');
          console.log('  - Total messages received:', this.messageStats.totalReceived);
          console.log('  - Message types:', this.messageStats.byType);
          console.log('  - Time since first message:', Date.now() - this.messageStats.lastMessageTime, 'ms');
          console.log('  - Has received Results:', this.messageStats.hasReceivedResults);
        }
        
        if (message.type === 'Results') {
          // Mark that we've received Results
          this.messageStats.hasReceivedResults = true;
          
          // Only log when there's actual transcript content
          if (message.channel?.alternatives?.[0]?.transcript) {
            const alternative = message.channel.alternatives[0];
            console.log('📝 ENHANCED LOGGING: Transcript:', alternative.transcript);
            console.log('📝 ENHANCED LOGGING: Is final:', message.is_final);
            
            // CRITICAL: Log speaker diarization information
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
                console.log('🎯 ENHANCED LOGGING: SPEAKER DIARIZATION RESULTS:');
                console.log('🎯 ENHANCED LOGGING: Detected speakers:', Array.from(speakerCounts.keys()));
                console.log('🎯 ENHANCED LOGGING: Speaker word counts:', Object.fromEntries(speakerCounts));
                console.log('🎯 ENHANCED LOGGING: Dominant speaker for this segment:', dominantSpeaker);
              } else {
                console.log('⚠️ ENHANCED LOGGING: No speaker information found in words array');
              }
            } else {
              console.log('⚠️ ENHANCED LOGGING: No words array found in Deepgram response');
            }
          }
        } else if (message.type === 'Metadata') {
          console.log('📋 ENHANCED LOGGING: Received Metadata from Deepgram:', message);
        } else if (message.type === 'UtteranceEnd') {
          console.log('🔚 ENHANCED LOGGING: Received UtteranceEnd from Deepgram:', message);
        } else if (message.type === 'Error') {
          console.error('❌ ENHANCED LOGGING: Received Error from Deepgram:', message);
          
          // Forward error to web app
          if (this.resultsChannel) {
            this.resultsChannel.publish('deepgram-error', {
              error: message.error || 'Unknown Deepgram error',
              details: message,
              timestamp: Date.now()
            });
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
        console.error('❌ ENHANCED LOGGING: Raw message data:', data.toString().substring(0, 200) + '...');
        
        // Forward error to web app
        if (this.resultsChannel) {
          this.resultsChannel.publish('deepgram-error', {
            error: 'Failed to parse Deepgram message',
            details: error.message,
            rawData: data.toString().substring(0, 200) + '...',
            timestamp: Date.now()
          });
        }
      }
    });

    ws.on('error', (error) => {
      console.error('❌ ENHANCED LOGGING: Deepgram WebSocket error event fired');
      console.error('❌ ENHANCED LOGGING: Error details:', error);
      console.error('❌ ENHANCED LOGGING: WebSocket readyState on error:', ws.readyState);
      
      // ENHANCED: More detailed error reporting
      const errorDetails = {
        message: error.message,
        code: error.code,
        type: error.type,
        target: error.target ? {
          url: error.target.url,
          readyState: error.target.readyState,
          protocol: error.target.protocol
        } : 'unknown'
      };
      
      console.error('❌ ENHANCED LOGGING: Detailed error information:', errorDetails);
      
      this.deepgramReady = false;
      this.stopDeepgramHeartbeat();
      
      if (this.deepgramConnection === ws) {
        this.deepgramConnection = null;
      }
      
      if (this.transcriptionActive) {
        this.scheduleDeepgramReconnect();
      }
      
      // Notify web app of error via Ably with enhanced details
      if (this.resultsChannel) {
        this.resultsChannel.publish('deepgram-error', {
          error: error.message,
          details: errorDetails,
          timestamp: Date.now()
        });
        console.log('❌ ENHANCED LOGGING: Published detailed error to Ably');
      }
    });

    ws.on('close', (code, reason) => {
      console.log('🔗 ENHANCED LOGGING: Deepgram WebSocket close event fired');
      console.log('🔗 ENHANCED LOGGING: Close code:', code);
      console.log('🔗 ENHANCED LOGGING: Close reason:', reason?.toString());
      console.log('🔗 ENHANCED LOGGING: WebSocket readyState on close:', ws.readyState);
      
      // ENHANCED: Provide more context about close codes
      let closeDescription = 'Unknown close reason';
      switch (code) {
        case 1000:
          closeDescription = 'Normal closure';
          break;
        case 1001:
          closeDescription = 'Going away';
          break;
        case 1002:
          closeDescription = 'Protocol error';
          break;
        case 1003:
          closeDescription = 'Unsupported data';
          break;
        case 1005:
          closeDescription = 'No status received';
          break;
        case 1006:
          closeDescription = 'Abnormal closure';
          break;
        case 1007:
          closeDescription = 'Invalid frame payload data';
          break;
        case 1008:
          closeDescription = 'Policy violation';
          break;
        case 1009:
          closeDescription = 'Message too big';
          break;
        case 1010:
          closeDescription = 'Mandatory extension';
          break;
        case 1011:
          closeDescription = 'Internal server error';
          break;
        case 1012:
          closeDescription = 'Service restart';
          break;
        case 1013:
          closeDescription = 'Try again later';
          break;
        case 1014:
          closeDescription = 'Bad gateway';
          break;
        case 1015:
          closeDescription = 'TLS handshake';
          break;
      }
      
      console.log('🔗 ENHANCED LOGGING: Close description:', closeDescription);
      
      this.deepgramReady = false;
      this.stopDeepgramHeartbeat();
      
      if (this.deepgramConnection === ws) {
        this.deepgramConnection = null;
      }
      
      if (this.transcriptionActive) {
        this.scheduleDeepgramReconnect();
      }
      
      // Notify web app via Ably with enhanced details
      if (this.resultsChannel) {
        this.resultsChannel.publish('deepgram-disconnected', {
          closeCode: code,
          closeReason: reason?.toString(),
          closeDescription: closeDescription,
          timestamp: Date.now()
        });
      }
    });
    
    // Add timeout to detect if no events fire
    setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        console.log('⚠️ ENHANCED LOGGING: WebSocket still connecting after 5 seconds, readyState:', ws.readyState);
        
        // Notify web app of connection issue
        if (this.resultsChannel) {
          this.resultsChannel.publish('deepgram-error', {
            error: 'Connection timeout',
            details: 'WebSocket still in CONNECTING state after 5 seconds',
            timestamp: Date.now()
          });
        }
      } else if (ws.readyState === WebSocket.CLOSED) {
        console.log('⚠️ ENHANCED LOGGING: WebSocket closed within 5 seconds without firing events, readyState:', ws.readyState);
        
        // Notify web app of connection issue
        if (this.resultsChannel) {
          this.resultsChannel.publish('deepgram-error', {
            error: 'Connection closed prematurely',
            details: 'WebSocket closed within 5 seconds without firing events',
            timestamp: Date.now()
          });
        }
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

    // Clear audio verification buffer
    this.audioVerificationBuffer = [];

    // Close Ably connection
    if (this.ablyClient) {
      this.ablyClient.close();
      this.ablyClient = null;
    }
  }
}

module.exports = AblyDeepgramBridge;