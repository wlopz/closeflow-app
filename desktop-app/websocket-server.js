const WebSocket = require('ws');
const { spawn } = require('child_process');

class AudioWebSocketServer {
  constructor() {
    this.server = null;
    this.webAppConnection = null;
    this.desktopConnection = null;
    this.desktopRendererConnection = null; // NEW: Direct renderer connection
    this.deepgramConnection = null;
    this.audioStream = null;
    this.isRecording = false;
    this.port = 8080;
    this.deepgramApiKey = null;
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
        // NEW: Handle direct renderer connections
        this.desktopRendererConnection = ws;
        this.setupDesktopRendererConnection(ws);
      }

      ws.on('close', () => {
        console.log(`📱 ${clientType} disconnected from WebSocket server`);
        if (clientType === 'web-app') {
          this.webAppConnection = null;
        } else if (clientType === 'desktop') {
          this.desktopConnection = null;
        } else if (clientType === 'desktop-renderer') {
          this.desktopRendererConnection = null;
        }
        this.cleanup();
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
        console.log('📨 Received message from web app:', message.type);

        switch (message.type) {
          case 'start-transcription':
            this.deepgramApiKey = message.deepgramApiKey;
            this.startDeepgramConnection();
            break;
          case 'stop-transcription':
            this.stopDeepgramConnection();
            break;
          default:
            console.log('❓ Unknown message type from web app:', message.type);
        }
      } catch (error) {
        console.error('❌ Error parsing web app message:', error);
      }
    });
  }

  setupDesktopConnection(ws) {
    ws.on('message', (data) => {
      try {
        // This is for control messages from main process
        const message = JSON.parse(data);
        console.log('📨 Received message from desktop main process:', message.type);

        switch (message.type) {
          case 'start-audio-capture':
            this.isRecording = true;
            console.log('🎤 Desktop main process notified audio capture started');
            break;
          case 'stop-audio-capture':
            this.isRecording = false;
            console.log('🛑 Desktop main process notified audio capture stopped');
            this.stopDeepgramConnection();
            break;
        }
      } catch (error) {
        console.error('❌ Error handling desktop main process message:', error);
      }
    });
  }

  // NEW: Handle direct renderer connections
  setupDesktopRendererConnection(ws) {
    ws.on('message', (data) => {
      try {
        if (data instanceof Buffer) {
          // This is audio data from desktop renderer - DIRECT TRANSFER
          console.log('🎤 ENHANCED LOGGING: Received audio data directly from renderer');
          console.log('🎤 ENHANCED LOGGING: Audio data size:', data.length);
          console.log('🎤 ENHANCED LOGGING: Audio data type:', typeof data);
          console.log('🎤 ENHANCED LOGGING: Is Buffer:', Buffer.isBuffer(data));
          console.log('🎤 ENHANCED LOGGING: First 20 bytes:', data.slice(0, 20));
          console.log('🎤 ENHANCED LOGGING: Deepgram connection exists:', !!this.deepgramConnection);
          console.log('🎤 ENHANCED LOGGING: Deepgram connection ready state:', this.deepgramConnection?.readyState);
          
          if (this.deepgramConnection && this.deepgramConnection.readyState === WebSocket.OPEN) {
            console.log('🎤 ENHANCED LOGGING: Forwarding audio data to Deepgram');
            // Forward directly to Deepgram
            this.deepgramConnection.send(data);
            console.log('🎤 ENHANCED LOGGING: Audio data sent to Deepgram successfully');
          } else {
            console.log('⚠️ ENHANCED LOGGING: Cannot forward audio - Deepgram connection not ready');
            console.log('⚠️ ENHANCED LOGGING: Connection state:', this.deepgramConnection?.readyState);
          }
        } else {
          // This might be a control message
          const message = JSON.parse(data);
          console.log('📨 Received message from desktop renderer:', message.type);
        }
      } catch (error) {
        console.error('❌ Error handling desktop renderer message:', error);
      }
    });
  }

  startDeepgramConnection() {
    if (!this.deepgramApiKey) {
      console.error('❌ No Deepgram API key provided');
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
    // CRITICAL FIX: Increase endpointing from 1000ms to 10000ms (10 seconds)
    dgUrl.searchParams.set('endpointing', '10000');

    console.log('🔗 ENHANCED LOGGING: Deepgram URL:', dgUrl.toString());
    console.log('🔗 ENHANCED LOGGING: Endpointing set to 10 seconds for better stability');

    this.deepgramConnection = new WebSocket(dgUrl.toString(), ['token', this.deepgramApiKey]);

    this.deepgramConnection.on('open', () => {
      console.log('✅ ENHANCED LOGGING: Connected to Deepgram successfully');
      console.log('✅ ENHANCED LOGGING: Deepgram connection ready state:', this.deepgramConnection.readyState);
      
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
        console.log('📨 ENHANCED LOGGING: Full Deepgram message:', JSON.stringify(message, null, 2));
        
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
          console.log('📊 ENHANCED LOGGING: Metadata:', JSON.stringify(message, null, 2));
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
      this.deepgramConnection.close();
      this.deepgramConnection = null;
      console.log('🛑 ENHANCED LOGGING: Deepgram connection closed and nullified');
    }
  }

  cleanup() {
    this.stopDeepgramConnection();
    this.isRecording = false;
  }

  stop() {
    console.log('🛑 Stopping Audio WebSocket Server');
    this.cleanup();
    
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