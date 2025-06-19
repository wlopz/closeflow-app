const { desktopCapturer } = require('electron');
const WebSocket = require('ws');

class SystemAudioCapture {
  constructor() {
    this.mediaRecorder = null;
    this.audioStream = null;
    this.websocketConnection = null;
    this.isCapturing = false;
    this.selectedSourceId = null;
  }

  async initialize(sourceId) {
    console.log('🎤 Initializing system audio capture for source:', sourceId);
    this.selectedSourceId = sourceId;

    try {
      // Connect to local WebSocket server
      this.websocketConnection = new WebSocket('ws://localhost:8080');
      
      this.websocketConnection.on('open', () => {
        console.log('✅ Connected to local WebSocket server');
      });

      this.websocketConnection.on('error', (error) => {
        console.error('❌ WebSocket connection error:', error);
      });

      this.websocketConnection.on('close', () => {
        console.log('🔗 WebSocket connection closed');
        this.websocketConnection = null;
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize audio capture:', error);
      return false;
    }
  }

  async startCapture() {
    if (this.isCapturing) {
      console.log('⚠️ Audio capture already active');
      return false;
    }

    if (!this.selectedSourceId) {
      console.error('❌ No audio source selected');
      return false;
    }

    try {
      console.log('🎤 Starting system audio capture...');

      // Get the audio stream from the selected source
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: this.selectedSourceId
          }
        },
        video: false
      });

      this.audioStream = stream;

      // Create MediaRecorder to capture audio data
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 16000
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.websocketConnection && this.websocketConnection.readyState === WebSocket.OPEN) {
          // Send audio data to WebSocket server
          this.websocketConnection.send(event.data);
        }
      };

      this.mediaRecorder.onerror = (error) => {
        console.error('❌ MediaRecorder error:', error);
      };

      this.mediaRecorder.onstop = () => {
        console.log('🛑 MediaRecorder stopped');
        this.cleanup();
      };

      // Start recording
      this.mediaRecorder.start(250); // Send data every 250ms
      this.isCapturing = true;

      // Notify WebSocket server that audio capture started
      if (this.websocketConnection && this.websocketConnection.readyState === WebSocket.OPEN) {
        this.websocketConnection.send(JSON.stringify({
          type: 'start-audio-capture'
        }));
      }

      console.log('✅ System audio capture started successfully');
      return true;

    } catch (error) {
      console.error('❌ Failed to start system audio capture:', error);
      this.cleanup();
      return false;
    }
  }

  stopCapture() {
    console.log('🛑 Stopping system audio capture...');

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    // Notify WebSocket server that audio capture stopped
    if (this.websocketConnection && this.websocketConnection.readyState === WebSocket.OPEN) {
      this.websocketConnection.send(JSON.stringify({
        type: 'stop-audio-capture'
      }));
    }

    this.cleanup();
    console.log('✅ System audio capture stopped');
  }

  cleanup() {
    this.isCapturing = false;

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    if (this.mediaRecorder) {
      this.mediaRecorder = null;
    }
  }

  destroy() {
    this.stopCapture();
    
    if (this.websocketConnection) {
      this.websocketConnection.close();
      this.websocketConnection = null;
    }
  }
}

module.exports = SystemAudioCapture;