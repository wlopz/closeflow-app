const { desktopCapturer } = require('electron');
const WebSocket = require('ws');

class SystemAudioCapture {
  constructor() {
    this.websocketConnection = null;
    this.isCapturing = false;
    this.selectedSourceId = null;
    this.mainWindow = null;
  }

  async initialize(sourceId, mainWindow) {
    console.log('🎤 Initializing system audio capture for source:', sourceId);
    this.selectedSourceId = sourceId;
    this.mainWindow = mainWindow;

    try {
      // Connect to local WebSocket server
      this.websocketConnection = new WebSocket('ws://localhost:8080/desktop');
      
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

    if (!this.mainWindow) {
      console.error('❌ No main window reference');
      return false;
    }

    try {
      console.log('🎤 Starting system audio capture...');

      // Use the renderer process to capture audio since it has access to browser APIs
      const success = await this.mainWindow.webContents.executeJavaScript(`
        (async () => {
          try {
            console.log('🎤 Starting audio capture in renderer process');
            
            // Clean up any existing streams
            if (window.closeFlowSystemStream) {
              window.closeFlowSystemStream.getTracks().forEach(track => track.stop());
              window.closeFlowSystemStream = null;
            }

            // Get the audio stream from the selected source using desktopCapturer
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: '${this.selectedSourceId}'
                }
              },
              video: false
            });

            window.closeFlowSystemStream = stream;

            // Create MediaRecorder to capture audio data
            const mediaRecorder = new MediaRecorder(stream, {
              mimeType: 'audio/webm;codecs=opus',
              audioBitsPerSecond: 16000
            });

            window.closeFlowMediaRecorder = mediaRecorder;

            // Set up data handling
            mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                // Send audio data via IPC to main process
                window.electronAPI?.sendAudioData?.(event.data);
              }
            };

            mediaRecorder.onerror = (error) => {
              console.error('❌ MediaRecorder error:', error);
            };

            mediaRecorder.onstop = () => {
              console.log('🛑 MediaRecorder stopped');
            };

            // Start recording
            mediaRecorder.start(250); // Send data every 250ms

            console.log('✅ System audio capture started successfully');
            return true;

          } catch (error) {
            console.error('❌ Failed to start system audio capture:', error);
            return false;
          }
        })()
      `);

      if (success) {
        this.isCapturing = true;

        // Notify WebSocket server that audio capture started
        if (this.websocketConnection && this.websocketConnection.readyState === WebSocket.OPEN) {
          this.websocketConnection.send(JSON.stringify({
            type: 'start-audio-capture'
          }));
        }

        console.log('✅ System audio capture started successfully');
        return true;
      } else {
        throw new Error('Failed to start audio capture in renderer process');
      }

    } catch (error) {
      console.error('❌ Failed to start system audio capture:', error);
      this.cleanup();
      return false;
    }
  }

  stopCapture() {
    console.log('🛑 Stopping system audio capture...');

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      // Stop recording in renderer process
      this.mainWindow.webContents.executeJavaScript(`
        (() => {
          try {
            if (window.closeFlowMediaRecorder && window.closeFlowMediaRecorder.state !== 'inactive') {
              window.closeFlowMediaRecorder.stop();
            }
            
            if (window.closeFlowSystemStream) {
              window.closeFlowSystemStream.getTracks().forEach(track => track.stop());
              window.closeFlowSystemStream = null;
            }
            
            window.closeFlowMediaRecorder = null;
            console.log('✅ Audio capture stopped in renderer');
          } catch (error) {
            console.error('Error stopping audio capture:', error);
          }
        })()
      `);
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

  // Handle audio data from renderer process
  handleAudioData(audioData) {
    if (this.websocketConnection && this.websocketConnection.readyState === WebSocket.OPEN) {
      this.websocketConnection.send(audioData);
    }
  }

  cleanup() {
    this.isCapturing = false;
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