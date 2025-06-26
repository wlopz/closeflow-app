const { desktopCapturer } = require('electron');
const { ipcRenderer } = require('electron');

class SystemAudioCapture {
  constructor() {
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
      console.log('✅ System audio capture initialized (Ably mode)');
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

      // Enhanced renderer-based audio capture that sends data via IPC
      const success = await this.mainWindow.webContents.executeJavaScript(`
        (async () => {
          try {
            console.log('🎤 ENHANCED LOGGING: Starting audio capture in renderer process');
            console.log('🔍 ENHANCED LOGGING: Selected source ID:', '${this.selectedSourceId}');
            
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

            console.log('⏱️ ENHANCED LOGGING: Adding initialization delay...');
            await new Promise(resolve => setTimeout(resolve, 100));

            console.log('🎤 ENHANCED LOGGING: About to call getUserMedia with source:', '${this.selectedSourceId}');
            
            // Enhanced constraints with better audio settings
            const constraints = {
              audio: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: '${this.selectedSourceId}',
                sampleRate: 48000,
                channelCount: 1,
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                latency: 0.01,
                volume: 1.0
              },
              video: false
            };
            
            console.log('🎤 ENHANCED LOGGING: getUserMedia constraints:', constraints);
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);

            console.log('✅ ENHANCED LOGGING: getUserMedia completed successfully');
            console.log('📊 ENHANCED LOGGING: Stream details:', {
              id: stream.id,
              active: stream.active,
              audioTracks: stream.getAudioTracks().length
            });
            
            window.closeFlowSystemStream = stream;

            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length === 0) {
              throw new Error('No audio tracks found in stream');
            }
            
            console.log('🎵 ENHANCED LOGGING: Audio track details:', audioTracks.map(track => ({
              id: track.id,
              label: track.label,
              enabled: track.enabled,
              readyState: track.readyState,
              settings: track.getSettings()
            })));

            // Try multiple MIME types for better compatibility
            console.log('🎬 ENHANCED LOGGING: Creating MediaRecorder with enhanced MIME type selection...');
            
            const mimeTypes = [
              'audio/webm;codecs=opus',
              'audio/webm',
              'audio/ogg;codecs=opus',
              'audio/mp4;codecs=mp4a.40.2',
              'audio/mpeg'
            ];
            
            let selectedMimeType = '';
            let mediaRecorder = null;
            
            for (const mimeType of mimeTypes) {
              if (MediaRecorder.isTypeSupported(mimeType)) {
                console.log('✅ ENHANCED LOGGING: Attempting MIME type:', mimeType);
                try {
                  mediaRecorder = new MediaRecorder(stream, { mimeType });
                  selectedMimeType = mimeType;
                  console.log('✅ ENHANCED LOGGING: Successfully created MediaRecorder with:', mimeType);
                  break;
                } catch (error) {
                  console.log('⚠️ ENHANCED LOGGING: Failed to create MediaRecorder with', mimeType, ':', error.message);
                  continue;
                }
              } else {
                console.log('❌ ENHANCED LOGGING: MIME type not supported:', mimeType);
              }
            }
            
            if (!mediaRecorder) {
              console.log('🔧 ENHANCED LOGGING: Using default MediaRecorder (no MIME type specified)');
              mediaRecorder = new MediaRecorder(stream);
              selectedMimeType = mediaRecorder.mimeType || 'unknown';
            }
            
            console.log('✅ ENHANCED LOGGING: MediaRecorder created successfully');
            console.log('📊 ENHANCED LOGGING: MediaRecorder mimeType:', mediaRecorder.mimeType);

            window.closeFlowMediaRecorder = mediaRecorder;
            window.closeFlowActualMimeType = mediaRecorder.mimeType;

            // NEW: Send audio data via IPC instead of WebSocket
            mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                console.log('🎤 ENHANCED LOGGING: Sending audio data via IPC');
                console.log('🎤 ENHANCED LOGGING: Audio chunk size:', event.data.size);
                
                // Convert Blob to ArrayBuffer and send via IPC
                event.data.arrayBuffer().then(arrayBuffer => {
                  const { ipcRenderer } = require('electron');
                  ipcRenderer.send('audio-data-chunk', Buffer.from(arrayBuffer));
                  console.log('🎤 ENHANCED LOGGING: Audio data sent via IPC successfully');
                }).catch(error => {
                  console.error('❌ ENHANCED LOGGING: Error converting audio data:', error);
                });
              }
            };

            mediaRecorder.onerror = (error) => {
              console.error('❌ ENHANCED LOGGING: MediaRecorder error:', error);
            };

            mediaRecorder.onstop = () => {
              console.log('🛑 ENHANCED LOGGING: MediaRecorder stopped');
            };

            mediaRecorder.onstart = () => {
              console.log('▶️ ENHANCED LOGGING: MediaRecorder started successfully');
            };

            console.log('🎤 ENHANCED LOGGING: About to start MediaRecorder...');
            mediaRecorder.start(500); // 500ms chunks
            
            console.log('✅ ENHANCED LOGGING: Audio capture started successfully with IPC');
            return true;

          } catch (error) {
            console.error('❌ ENHANCED LOGGING: Failed to start audio capture:', error);
            return false;
          }
        })()
      `);

      if (success) {
        this.isCapturing = true;
        console.log('✅ System audio capture started successfully with IPC');
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
            
            window.closeFlowMediaRecorder = null;
            window.closeFlowActualMimeType = null;
            console.log('✅ Audio capture cleanup completed in renderer');
            
          } catch (error) {
            console.error('❌ Error during renderer cleanup:', error);
          }
        })()
      `).catch(err => {
        console.log('Note: Error stopping audio capture (likely during shutdown):', err.message);
      });
    }

    this.cleanup();
    console.log('✅ System audio capture stopped');
  }

  cleanup() {
    this.isCapturing = false;
  }

  destroy() {
    this.stopCapture();
  }
}

module.exports = SystemAudioCapture;