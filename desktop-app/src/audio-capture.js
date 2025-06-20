const { desktopCapturer } = require('electron');
const WebSocket = require('ws');

class SystemAudioCapture {
  constructor() {
    this.websocketConnection = null;
    this.isCapturing = false;
    this.selectedSourceId = null;
    this.mainWindow = null;
    this.debugMode = true; // Enable debug mode for testing
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

    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.error('❌ No main window reference or window destroyed');
      return false;
    }

    try {
      console.log('🎤 Starting system audio capture...');

      // STEP 1: Test desktopCapturer.getSources() independently
      const testSources = await this.testDesktopCapturer();
      if (!testSources) {
        throw new Error('Failed to get desktop sources');
      }

      // STEP 2: Use the renderer process to capture audio with isolated testing
      const success = await this.mainWindow.webContents.executeJavaScript(`
        (async () => {
          try {
            console.log('🎤 Starting ISOLATED audio capture test in renderer process');
            console.log('🔍 Selected source ID:', '${this.selectedSourceId}');
            
            // Clean up any existing streams first
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
            
            // ISOLATED TEST: Only getUserMedia, no MediaRecorder yet
            let stream;
            try {
              const startTime = performance.now();
              stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                  mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: '${this.selectedSourceId}'
                  }
                },
                video: false
              });
              const endTime = performance.now();
              console.log('✅ getUserMedia successful! Time taken:', (endTime - startTime), 'ms');
              console.log('✅ Stream details:', {
                id: stream.id,
                active: stream.active,
                audioTracks: stream.getAudioTracks().length,
                videoTracks: stream.getVideoTracks().length
              });
              
              // Log audio track details
              stream.getAudioTracks().forEach((track, index) => {
                console.log('🎵 Audio track', index, ':', {
                  id: track.id,
                  kind: track.kind,
                  label: track.label,
                  enabled: track.enabled,
                  muted: track.muted,
                  readyState: track.readyState,
                  settings: track.getSettings()
                });
              });
              
            } catch (getUserMediaError) {
              console.error('❌ getUserMedia failed:', getUserMediaError);
              console.error('❌ Error name:', getUserMediaError.name);
              console.error('❌ Error message:', getUserMediaError.message);
              console.error('❌ Error stack:', getUserMediaError.stack);
              console.error('❌ Error toString:', getUserMediaError.toString());
              throw getUserMediaError;
            }

            window.closeFlowSystemStream = stream;

            // STEP 3: Test MediaRecorder creation (but don't start it yet)
            let mediaRecorder;
            try {
              console.log('🎤 Creating MediaRecorder...');
              mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 16000
              });
              console.log('✅ MediaRecorder created successfully');
              console.log('✅ MediaRecorder state:', mediaRecorder.state);
              console.log('✅ MediaRecorder mimeType:', mediaRecorder.mimeType);
            } catch (mediaRecorderError) {
              console.error('❌ MediaRecorder creation failed:', mediaRecorderError);
              throw mediaRecorderError;
            }

            window.closeFlowMediaRecorder = mediaRecorder;

            // Set up event handlers (but don't start recording yet)
            mediaRecorder.ondataavailable = (event) => {
              console.log('🎤 MediaRecorder data available, size:', event.data.size);
              
              // TEMPORARILY DISABLED: Comment out the IPC sending to isolate audio capture from IPC
              // This helps us determine if the issue is with getUserMedia/MediaRecorder or with IPC
              if (${this.debugMode}) {
                console.log('🔍 DEBUG MODE: Not sending data via IPC to isolate the issue');
                console.log('🔍 Data blob type:', event.data.type);
                console.log('🔍 Data blob size:', event.data.size);
              }
              
              // if (event.data.size > 0 && window.electronAPI?.sendAudioData) {
              //   window.electronAPI.sendAudioData(event.data);
              // }
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

            // STEP 4: Test starting MediaRecorder (this is where the issue might occur)
            if (${this.debugMode}) {
              console.log('🎤 DEBUG MODE: Starting MediaRecorder for 2 seconds only...');
              try {
                mediaRecorder.start(250); // Send data every 250ms
                console.log('✅ MediaRecorder started successfully');
                
                // Stop after 2 seconds to test the full cycle
                setTimeout(() => {
                  if (mediaRecorder.state === 'recording') {
                    console.log('🛑 DEBUG MODE: Stopping MediaRecorder after 2 seconds');
                    mediaRecorder.stop();
                  }
                }, 2000);
                
              } catch (startError) {
                console.error('❌ MediaRecorder start failed:', startError);
                throw startError;
              }
            }

            console.log('✅ System audio capture test completed successfully');
            return true;

          } catch (error) {
            console.error('❌ Failed to start system audio capture:', error);
            console.error('❌ Error details:', {
              name: error.name,
              message: error.message,
              stack: error.stack,
              toString: error.toString()
            });
            return false;
          }
        })()
      `);

      if (success) {
        this.isCapturing = true;

        // Notify WebSocket server that audio capture started (but no actual data will be sent in debug mode)
        if (this.websocketConnection && this.websocketConnection.readyState === WebSocket.OPEN) {
          this.websocketConnection.send(JSON.stringify({
            type: 'start-audio-capture',
            debugMode: this.debugMode
          }));
        }

        console.log('✅ System audio capture test started successfully');
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

  // New method to test desktopCapturer independently
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
        console.log('Available sources:', sources.map(s => ({ id: s.id, name: s.name })));
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
                console.log('🛑 Stopping track:', track.id, track.label);
                track.stop();
              });
              window.closeFlowSystemStream = null;
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

    // Notify WebSocket server that audio capture stopped
    if (this.websocketConnection && this.websocketConnection.readyState === WebSocket.OPEN) {
      this.websocketConnection.send(JSON.stringify({
        type: 'stop-audio-capture'
      }));
    }

    this.cleanup();
    console.log('✅ System audio capture stopped');
  }

  // Handle audio data from renderer process (disabled in debug mode)
  handleAudioData(audioData) {
    if (this.debugMode) {
      console.log('🔍 DEBUG MODE: Received audio data but not forwarding to WebSocket');
      return;
    }

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

  // Method to disable debug mode and enable full functionality
  disableDebugMode() {
    console.log('🔧 Disabling debug mode - enabling full audio capture');
    this.debugMode = false;
  }

  // Method to enable debug mode
  enableDebugMode() {
    console.log('🔧 Enabling debug mode - audio capture will be isolated');
    this.debugMode = true;
  }
}

module.exports = SystemAudioCapture;