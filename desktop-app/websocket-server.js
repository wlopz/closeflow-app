const WebSocket = require('ws');
const { spawn } = require('child_process');

class AudioWebSocketServer {
  constructor() {
    this.server = null;
    this.webAppConnection = null;
    this.desktopConnection = null;
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
      const clientType = req.url?.includes('web-app') ? 'web-app' : 'desktop';
      console.log(`📱 ${clientType} connected to WebSocket server`);

      if (clientType === 'web-app') {
        this.webAppConnection = ws;
        this.setupWebAppConnection(ws);
      } else {
        this.desktopConnection = ws;
        this.setupDesktopConnection(ws);
      }

      ws.on('close', () => {
        console.log(`📱 ${clientType} disconnected from WebSocket server`);
        if (clientType === 'web-app') {
          this.webAppConnection = null;
        } else {
          this.desktopConnection = null;
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
        if (data instanceof Buffer) {
          // This is audio data from desktop app
          if (this.deepgramConnection && this.deepgramConnection.readyState === WebSocket.OPEN) {
            this.deepgramConnection.send(data);
          }
        } else {
          // This is a control message
          const message = JSON.parse(data);
          console.log('📨 Received message from desktop:', message.type);

          switch (message.type) {
            case 'start-audio-capture':
              this.isRecording = true;
              console.log('🎤 Started receiving audio from desktop');
              break;
            case 'stop-audio-capture':
              this.isRecording = false;
              console.log('🛑 Stopped receiving audio from desktop');
              this.stopDeepgramConnection();
              break;
          }
        }
      } catch (error) {
        console.error('❌ Error handling desktop message:', error);
      }
    });
  }

  startDeepgramConnection() {
    if (!this.deepgramApiKey) {
      console.error('❌ No Deepgram API key provided');
      return;
    }

    console.log('🔗 Connecting to Deepgram...');

    const dgUrl = new URL('wss://api.deepgram.com/v1/listen');
    dgUrl.searchParams.set('model', 'nova-2');
    dgUrl.searchParams.set('language', 'en-US');
    dgUrl.searchParams.set('interim_results', 'true');
    dgUrl.searchParams.set('punctuate', 'true');
    dgUrl.searchParams.set('smart_format', 'true');
    dgUrl.searchParams.set('diarize', 'true');
    dgUrl.searchParams.set('utterances', 'true');
    dgUrl.searchParams.set('endpointing', '1000');

    this.deepgramConnection = new WebSocket(dgUrl.toString(), ['token', this.deepgramApiKey]);

    this.deepgramConnection.on('open', () => {
      console.log('✅ Connected to Deepgram');
      
      // Notify web app that Deepgram is ready
      if (this.webAppConnection) {
        this.webAppConnection.send(JSON.stringify({
          type: 'deepgram-connected'
        }));
      }
    });

    this.deepgramConnection.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        
        // Forward Deepgram results to web app
        if (this.webAppConnection && this.webAppConnection.readyState === WebSocket.OPEN) {
          this.webAppConnection.send(JSON.stringify({
            type: 'deepgram-result',
            data: message
          }));
        }
      } catch (error) {
        console.error('❌ Error parsing Deepgram message:', error);
      }
    });

    this.deepgramConnection.on('error', (error) => {
      console.error('❌ Deepgram connection error:', error);
      
      // Notify web app of error
      if (this.webAppConnection) {
        this.webAppConnection.send(JSON.stringify({
          type: 'deepgram-error',
          error: error.message
        }));
      }
    });

    this.deepgramConnection.on('close', () => {
      console.log('🔗 Deepgram connection closed');
      this.deepgramConnection = null;
      
      // Notify web app
      if (this.webAppConnection) {
        this.webAppConnection.send(JSON.stringify({
          type: 'deepgram-disconnected'
        }));
      }
    });
  }

  stopDeepgramConnection() {
    if (this.deepgramConnection) {
      console.log('🛑 Closing Deepgram connection');
      this.deepgramConnection.close();
      this.deepgramConnection = null;
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