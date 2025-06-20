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

      // Enhanced renderer-based audio capture with simplified MediaRecorder options
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

            // ENHANCEMENT: Add small delay before getUserMedia to prevent race conditions
            console.log('⏱️ Adding initialization delay...');
            await new Promise(resolve => setTimeout(resolve, 100));

            console.log('🎤 About to call getUserMedia with source:', '${this.selectedSourceId}');
            console.log('🎤 getUserMedia constraints:', {
              audio: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: '${this.selectedSourceId}'
                }
              },
              video: false
            });
            
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

            console.log('✅ getUserMedia completed successfully');
            console.log('📊 Stream details:', {
              id: stream.id,
              active: stream.active,
              audioTracks: stream.getAudioTracks().length
            });
            
            window.closeFlowSystemStream = stream;

            // Verify audio tracks
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length === 0) {
              throw new Error('No audio tracks found in stream');
            }
            
            console.log('🎵 Audio track details:', audioTracks.map(track => ({
              id: track.id,
              label: track.label,
              enabled: track.enabled,
              readyState: track.readyState
            })));

            // CRITICAL FIX: Create MediaRecorder with NO specific options to avoid compatibility issues
            console.log('🎬 Creating MediaRecorder with default options...');
            console.log('🔧 Using browser default settings for maximum compatibility');
            
            // Let the browser choose the best format automatically
            const mediaRecorder = new MediaRecorder(stream);
            
            console.log('✅ MediaRecorder created successfully with default options');
            console.log('📊 MediaRecorder mimeType:', mediaRecorder.mimeType);

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

            // CRITICAL: Start recording with optimized timing and add extra logging
            console.log('🎤 About to start MediaRecorder...');
            console.log('📊 MediaRecorder state before start:', mediaRecorder.state);
            
            mediaRecorder.start(1000); // 1-second chunks for better performance
            
            console.log('📊 MediaRecorder state after start:', mediaRecorder.state);
            console.log('✅ DIRECT WebSocket audio capture started successfully');
            return true;

          } catch (error) {
            console.error('❌ Failed to start direct WebSocket audio capture:', error);
            console.error('❌ Error details:', {
              name: error.name,
              message: error.message,
              stack: error.stack
            });
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

        console.log('✅ System audio capture started successfully with DIRECT WebSocket and default MediaRecorder options');
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

  stopCapture() {
    console.log('🛑 Stopping system audio capture...');

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      // Stop recording in renderer process with enhanced error handling
      this.mainWindow.webContents.executeJavaScript(`
        (() => {
          try {
            console.log('🛑 Starting cleanup in renderer...');
            
            if (window.closeFlowMediaRecorder && window.closeFlowMediaRecorder.state !== 'inactive') {
              console.log('🛑 Stopping MediaRecorder...');
              window.closeFlowMediaRecorder.stop();
            }
            
            if (window.closeFlowSystemStream) {
              console.log('🛑 Stopping audio tracks...');
              window.closeFlowSystemStream.getTracks().forEach(track => {
                console.log('🛑 Stopping track:', track.id, track.label);
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
            console.log('✅ Audio capture cleanup completed in renderer');
            
          } catch (error) {
            console.error('❌ Error during renderer cleanup:', error);
          }
        })()
      `).catch(err => {
        // Ignore errors during shutdown - renderer might be gone
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