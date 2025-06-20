const { desktopCapturer } = require('electron');
const WebSocket = require('ws');

class SystemAudioCapture {
  constructor() {
    this.websocketConnection = null;
    this.isCapturing = false;
    this.selectedSourceId = null;
    this.mainWindow = null;
    this.debugMode = false;
  }

  async initialize(sourceId, mainWindow) {
    console.log('🎤 Initializing system audio capture for source:', sourceId);
    this.selectedSourceId = sourceId;
    this.mainWindow = mainWindow;

    try {
      // Connect to local WebSocket server from main process
      this.websocketConnection = new WebSocket('ws://localhost:8080/desktop');
      
      this.websocketConnection.on('open', () => {
        console.log('✅ Main process connected to local WebSocket server');
      });

      this.websocketConnection.on('error', (error) => {
        console.error('❌ Main process WebSocket connection error:', error);
      });

      this.websocketConnection.on('close', () => {
        console.log('🔗 Main process WebSocket connection closed');
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

    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.error('❌ No main window reference or window destroyed');
      return false;
    }

    try {
      console.log('🎤 Starting system audio capture...');

      // Test desktopCapturer.getSources() independently
      const testSources = await this.testDesktopCapturer();
      if (!testSources) {
        throw new Error('Failed to get desktop sources');
      }

      // NEW APPROACH: Use renderer process to connect directly to WebSocket
      // This bypasses the problematic IPC audio transfer
      const success = await this.mainWindow.webContents.executeJavaScript(`
        (async () => {
          try {
            console.log('🎤 Starting DIRECT WebSocket audio capture in renderer process');
            console.log('🔍 Selected source ID:', '${this.selectedSourceId}');
            
            // Clean up any existing streams and connections
            if (window.closeFlowSystemStream) {
              console.log('🧹 Cleaning up existing stream');
              window.closeFlowSystemStream.getTracks().forEach(track => track.stop());
              window.closeFlowSystemStream = null;
            }

            if (window.closeFlowMediaRecorder) {
              console.log('🧹 Cleaning up existing media recorder');
              if (window.closeFlowMediaRecorder.state !== 'inactive') {
                window.closeFlowMediaRecorder.stop();
              }
              window.closeFlowMediaRecorder = null;
            }

            if (window.closeFlowWebSocket) {
              console.log('🧹 Cleaning up existing WebSocket');
              window.closeFlowWebSocket.close();
              window.closeFlowWebSocket = null;
            }

            // CRITICAL: Connect directly to WebSocket from renderer
            console.log('🔗 Connecting renderer directly to WebSocket server...');
            const ws = new WebSocket('ws://localhost:8080/desktop-renderer');
            window.closeFlowWebSocket = ws;

            // Wait for WebSocket connection
            await new Promise((resolve, reject) => {
              ws.onopen = () => {
                console.log('✅ Renderer connected directly to WebSocket server');
                resolve();
              };
              ws.onerror = (error) => {
                console.error('❌ Renderer WebSocket connection failed:', error);
                reject(error);
              };
              // Timeout after 5 seconds
              setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
            });

            console.log('🎤 Getting audio stream from source:', '${this.selectedSourceId}');
            
            // Get the audio stream from the selected source
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: '${this.selectedSourceId}'
                }
              },
              video: false
            });

            console.log('✅ Audio stream obtained successfully');
            window.closeFlowSystemStream = stream;

            // Create MediaRecorder to capture audio data
            const mediaRecorder = new MediaRecorder(stream, {
              mimeType: 'audio/webm;codecs=opus',
              audioBitsPerSecond: 16000
            });

            window.closeFlowMediaRecorder = mediaRecorder;

            // DIRECT WebSocket TRANSFER - NO IPC!
            mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
                console.log('🎤 Sending audio data directly via WebSocket, size:', event.data.size);
                // Send binary data directly to WebSocket - NO IPC INVOLVED
                ws.send(event.data);
              }
            };

            mediaRecorder.onerror = (error) => {
              console.error('❌ MediaRecorder error:', error);
            };

            mediaRecorder.onstop = () => {
              console.log('🛑 MediaRecorder stopped');
            };

            mediaRecorder.onstart = () => {
              console.log('▶️ MediaRecorder started');
            };

            // Start recording with optimized timing
            console.log('🎤 Starting MediaRecorder...');
            mediaRecorder.start(1000); // 1-second chunks

            console.log('✅ DIRECT WebSocket audio capture started successfully');
            return true;

          } catch (error) {
            console.error('❌ Failed to start direct WebSocket audio capture:', error);
            return false;
          }
        })()
      `);

      if (success) {
        this.isCapturing = true;

        // Notify main process WebSocket that audio capture started
        if (this.websocketConnection && this.websocketConnection.readyState === WebSocket.OPEN) {
          this.websocketConnection.send(JSON.stringify({
            type: 'start-audio-capture'
          }));
        }

        console.log('✅ System audio capture started successfully with DIRECT WebSocket');
        return true;
      } else {
        throw new Error('Failed to start direct WebSocket audio capture in renderer process');
      }

    } catch (error) {
      console.error('❌ Failed to start system audio capture:', error);
      this.cleanup();
      return false;
    }
  }

  // Test desktopCapturer independently
  async testDesktopCapturer() {
    try {
      console.log('🔍 Testing desktopCapturer.getSources()...');
      const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        fetchWindowIcons: false
      });

      console.log('✅ desktopCapturer.getSources() successful');
      console.log('📊 Found', sources.length, 'sources');
      
      // Find our selected source
      const selectedSource = sources.find(source => source.id === this.selectedSourceId);
      if (selectedSource) {
        console.log('✅ Selected source found:', {
          id: selectedSource.id,
          name: selectedSource.name,
          display_id: selectedSource.display_id
        });
      } else {
        console.warn('⚠️ Selected source not found in current sources list');
      }

      return true;
    } catch (error) {
      console.error('❌ desktopCapturer.getSources() failed:', error);
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
              console.log('🛑 Stopping MediaRecorder...');
              window.closeFlowMediaRecorder.stop();
            }
            
            if (window.closeFlowSystemStream) {
              console.log('🛑 Stopping audio tracks...');
              window.closeFlowSystemStream.getTracks().forEach(track => {
                track.stop();
              });
              window.closeFlowSystemStream = null;
            }

            if (window.closeFlowWebSocket) {
              console.log('🛑 Closing renderer WebSocket...');
              window.closeFlowWebSocket.close();
              window.closeFlowWebSocket = null;
            }
            
            window.closeFlowMediaRecorder = null;
            console.log('✅ Audio capture stopped in renderer');
          } catch (error) {
            console.error('Error stopping audio capture:', error);
          }
        })()
      `).catch(err => {
        // Ignore errors during shutdown
        console.log('Note: Error stopping audio capture (likely during shutdown):', err.message);
      });
    }

    // Notify main process WebSocket that audio capture stopped
    if (this.websocketConnection && this.websocketConnection.readyState === WebSocket.OPEN) {
      this.websocketConnection.send(JSON.stringify({
        type: 'stop-audio-capture'
      }));
    }

    this.cleanup();
    console.log('✅ System audio capture stopped');
  }

  // This method is no longer needed since we're using direct WebSocket
  handleAudioData(audioData) {
    // This method is now obsolete - audio goes directly via WebSocket from renderer
    console.log('⚠️ handleAudioData called but audio now goes directly via WebSocket');
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