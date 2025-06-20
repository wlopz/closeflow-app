const { app, BrowserWindow, ipcMain, Menu, Tray, dialog, systemPreferences, desktopCapturer } = require('electron');
const path = require('path');
const { execSync, spawn } = require('child_process');
const SystemAudioCapture = require('./audio-capture');

class CloseFlowDesktop {
  constructor() {
    this.mainWindow = null;
    this.tray = null;
    this.trayMenu = null;
    this.isZoomDetected = false;
    this.isCallActive = false;
    this.zoomCheckInterval = null;
    this.audioDevices = { input: [], output: [] };
    this.systemAudioSources = [];
    this.selectedDevices = { input: null, output: null };
    this.selectedSystemAudioSource = null;
    this.audioLevels = { input: 0, output: 0, systemAudio: 0 };
    this.audioMonitorInterval = null;
    this.connectionCheckInterval = null;
    this.messagePollingInterval = null;
    this.isConnected = false;
    this.webAppUrl = 'http://localhost:3000';
    this.pingInterval = null;
    this.isStartingCall = false;
    this.isStoppingCall = false;
    this.systemAudioCapture = new SystemAudioCapture();
    this.websocketServer = null;
    this.isShuttingDown = false;
    
    // Add timeout references for proper cleanup
    this.startCallTimeout = null;
    this.stopCallTimeout = null;
    
    // Add flag to track if renderer is ready
    this.rendererReady = false;
  }

  async initialize() {
    await this.createWindow();
    this.setupTray();
    this.setupIPC();
    this.startZoomDetection();
    await this.requestPermissions();
    await this.loadAudioDevices();
    await this.loadSystemAudioSources();
    
    // Start WebSocket server
    this.startWebSocketServer();
    
    // Start connection management
    this.startConnectionManagement();
  }

  startWebSocketServer() {
    try {
      // Start the WebSocket server as a child process
      const serverPath = path.join(__dirname, '../websocket-server.js');
      this.websocketServer = spawn('node', [serverPath], {
        stdio: 'inherit'
      });

      this.websocketServer.on('error', (error) => {
        console.error('❌ WebSocket server error:', error);
      });

      this.websocketServer.on('exit', (code) => {
        console.log(`📡 WebSocket server exited with code ${code}`);
        this.websocketServer = null;
      });

      console.log('✅ WebSocket server started');
    } catch (error) {
      console.error('❌ Failed to start WebSocket server:', error);
    }
  }

  async createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 400,
      height: 700,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true
      },
      titleBarStyle: 'default',
      resizable: true,
      movable: true,
      show: false,
      frame: true,
      minimizable: true,
      maximizable: false
    });

    this.mainWindow.loadFile('src/renderer/index.html');

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      this.rendererReady = true;
      this.setupRendererAPI();
    });

    this.mainWindow.on('close', (event) => {
      if (!app.isQuiting) {
        event.preventDefault();
        this.mainWindow.hide();
      }
    });

    this.mainWindow.on('closed', () => {
      this.isShuttingDown = true;
      this.rendererReady = false;
      this.cleanup();
    });

    // Handle renderer process crashes
    this.mainWindow.webContents.on('render-process-gone', () => {
      console.log('🔄 Renderer process gone, marking as not ready');
      this.rendererReady = false;
    });

    this.mainWindow.webContents.on('did-finish-load', () => {
      console.log('✅ Renderer finished loading, marking as ready');
      this.rendererReady = true;
    });
  }

  setupRendererAPI() {
    // Wait for renderer to be ready, then expose API
    if (this.isRendererSafe()) {
      this.mainWindow.webContents.executeJavaScript(`
        window.electronAPI = {
          sendAudioData: (audioData) => {
            // OPTIMIZATION: Send ArrayBuffer directly instead of converting to array
            if (audioData instanceof Blob) {
              audioData.arrayBuffer().then(buffer => {
                const { ipcRenderer } = require('electron');
                // Send ArrayBuffer directly - more efficient than array conversion
                ipcRenderer.send('audio-data', buffer);
              }).catch(err => {
                console.error('Error converting audio data:', err);
              });
            }
          }
        };
        console.log('✅ Electron API exposed to renderer');
      `).catch(err => {
        console.error('Error setting up renderer API:', err);
        this.rendererReady = false;
      });
    }
  }

  setupTray() {
    try {
      const iconPath = path.join(__dirname, '../assets/tray-icon.png');
      const fs = require('fs');
      
      if (!fs.existsSync(iconPath)) {
        console.log('Tray icon not found, skipping tray setup');
        return;
      }

      this.tray = new Tray(iconPath);
      this.updateTrayMenu();
      this.tray.setToolTip('CloseFlow Desktop');
      
      this.tray.on('click', () => {
        this.mainWindow.isVisible() ? this.mainWindow.hide() : this.mainWindow.show();
      });
    } catch (error) {
      console.log('Tray setup failed:', error.message);
    }
  }

  updateTrayMenu() {
    if (!this.tray) return;

    try {
      const menuTemplate = [
        {
          label: 'Show CloseFlow',
          click: () => {
            this.mainWindow.show();
            this.mainWindow.focus();
          }
        },
        {
          label: this.isCallActive ? 'Call Analysis Active' : 'Start Call Analysis',
          enabled: this.isZoomDetected && !this.isCallActive && this.isConnected && !this.isStartingCall,
          click: () => this.startCallAnalysis()
        },
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => {
            app.isQuiting = true;
            app.quit();
          }
        }
      ];

      this.trayMenu = Menu.buildFromTemplate(menuTemplate);
      this.tray.setContextMenu(this.trayMenu);
    } catch (error) {
      console.log('Error updating tray menu:', error.message);
    }
  }

  setupIPC() {
    // OPTIMIZATION: Handle audio data as ArrayBuffer instead of array
    ipcMain.on('audio-data', (event, audioBuffer) => {
      try {
        if (this.systemAudioCapture && audioBuffer instanceof ArrayBuffer) {
          // Convert ArrayBuffer to Node.js Buffer more efficiently
          const nodeBuffer = Buffer.from(audioBuffer);
          this.systemAudioCapture.handleAudioData(nodeBuffer);
        }
      } catch (error) {
        console.error('Error handling audio data:', error);
      }
    });

    ipcMain.handle('start-call-analysis', async (event, options = {}) => {
      try {
        const { inputDeviceId, outputDeviceId, systemAudioSourceId } = options;
        
        // Update selected devices if provided
        if (inputDeviceId) this.selectedDevices.input = inputDeviceId;
        if (outputDeviceId) this.selectedDevices.output = outputDeviceId;
        if (systemAudioSourceId) this.selectedSystemAudioSource = systemAudioSourceId;
        
        return await this.startCallAnalysis();
      } catch (error) {
        console.error('Error in start-call-analysis handler:', error);
        throw error;
      }
    });

    ipcMain.handle('stop-call-analysis', async () => {
      try {
        return await this.stopCallAnalysis();
      } catch (error) {
        console.error('Error in stop-call-analysis handler:', error);
        throw error;
      }
    });

    ipcMain.handle('select-input-device', async (event, deviceId) => {
      try {
        this.selectedDevices.input = deviceId;
        await this.setupRealAudioMonitoring();
        return true;
      } catch (error) {
        console.error('Error in select-input-device handler:', error);
        throw error;
      }
    });

    ipcMain.handle('select-output-device', async (event, deviceId) => {
      try {
        this.selectedDevices.output = deviceId;
        return true;
      } catch (error) {
        console.error('Error in select-output-device handler:', error);
        throw error;
      }
    });

    ipcMain.handle('select-system-audio-source', async (event, sourceId) => {
      try {
        this.selectedSystemAudioSource = sourceId;
        console.log('Selected system audio source:', sourceId);
        return true;
      } catch (error) {
        console.error('Error in select-system-audio-source handler:', error);
        throw error;
      }
    });

    ipcMain.handle('get-audio-devices', async () => {
      try {
        await this.loadAudioDevices();
        return this.audioDevices;
      } catch (error) {
        console.error('Error in get-audio-devices handler:', error);
        throw error;
      }
    });

    ipcMain.handle('get-desktop-audio-sources', async () => {
      try {
        console.log('🔍 Fetching desktop audio sources...');
        
        const sources = await desktopCapturer.getSources({
          types: ['window', 'screen'],
          fetchWindowIcons: false
        });

        // Enhanced filtering and prioritization for system audio sources
        const audioSources = this.prioritizeSystemAudioSources(sources);

        console.log('📊 Found audio sources:', audioSources.length);
        audioSources.forEach(source => {
          console.log(`  - ${source.type}: ${source.name} (${source.id}) [Priority: ${source.priority}]`);
        });

        this.systemAudioSources = audioSources;
        return audioSources;
      } catch (error) {
        console.error('Error getting desktop audio sources:', error);
        return [];
      }
    });

    ipcMain.handle('get-status', () => {
      try {
        return {
          zoomDetected: this.isZoomDetected,
          callActive: this.isCallActive,
          selectedDevices: this.selectedDevices,
          selectedSystemAudioSource: this.selectedSystemAudioSource,
          audioLevels: this.audioLevels,
          webAppConnected: this.isConnected,
          isStartingCall: this.isStartingCall,
          isStoppingCall: this.isStoppingCall
        };
      } catch (error) {
        console.error('Error in get-status handler:', error);
        throw error;
      }
    });
  }

  // Enhanced system audio source prioritization
  prioritizeSystemAudioSources(sources) {
    const audioSources = sources
      .filter(source => {
        // Include screen sources and specific application windows
        return source.id.startsWith('screen:') || 
               source.name.toLowerCase().includes('zoom') ||
               source.name.toLowerCase().includes('audio') ||
               source.name.toLowerCase().includes('system') ||
               source.id.startsWith('window:');
      })
      .map(source => {
        const baseSource = {
          id: source.id,
          name: source.name,
          type: source.id.startsWith('screen:') ? 'screen' : 'window',
          priority: 0
        };

        // Assign priority scores (higher = better)
        if (baseSource.type === 'screen') {
          baseSource.priority = 100; // Highest priority for screen sources
          if (baseSource.name.toLowerCase().includes('main') || 
              baseSource.name.toLowerCase().includes('primary')) {
            baseSource.priority = 110; // Even higher for main/primary screens
          }
        } else if (baseSource.name.toLowerCase().includes('zoom meeting')) {
          baseSource.priority = 90; // High priority for Zoom meeting windows
        } else if (baseSource.name.toLowerCase().includes('zoom')) {
          baseSource.priority = 80; // Medium-high priority for other Zoom windows
        } else if (baseSource.name.toLowerCase().includes('system audio') ||
                   baseSource.name.toLowerCase().includes('system sound')) {
          baseSource.priority = 85; // High priority for system audio sources
        } else if (baseSource.name.toLowerCase().includes('audio')) {
          baseSource.priority = 70; // Medium priority for audio-related windows
        } else {
          baseSource.priority = 50; // Lower priority for other windows
        }

        return baseSource;
      })
      .sort((a, b) => b.priority - a.priority); // Sort by priority (highest first)

    return audioSources;
  }

  async requestPermissions() {
    try {
      const micStatus = await systemPreferences.askForMediaAccess('microphone');
      console.log('Microphone permission:', micStatus);

      const screenStatus = systemPreferences.getMediaAccessStatus('screen');
      console.log('Screen recording permission:', screenStatus);
      
      if (screenStatus !== 'granted') {
        dialog.showMessageBox(this.mainWindow, {
          type: 'info',
          title: 'Screen Recording Permission Required',
          message: 'CloseFlow needs screen recording permission to detect Zoom meetings and capture system audio. Please grant permission in System Preferences > Security & Privacy > Screen Recording.',
          buttons: ['OK']
        });
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  }

  async loadSystemAudioSources() {
    try {
      this.systemAudioSources = await this.getDesktopAudioSources();
      
      // Enhanced auto-selection logic
      this.autoSelectSystemAudioSource();
    } catch (error) {
      console.error('Error loading system audio sources:', error);
    }
  }

  // Enhanced auto-selection method
  autoSelectSystemAudioSource() {
    if (this.selectedSystemAudioSource && this.systemAudioSources.length > 0) {
      // Check if currently selected source is still available
      const currentSourceExists = this.systemAudioSources.find(s => s.id === this.selectedSystemAudioSource);
      if (currentSourceExists) {
        console.log('✅ Current system audio source still available:', currentSourceExists.name);
        return; // Keep current selection
      }
    }

    if (this.systemAudioSources.length === 0) {
      console.log('⚠️ No system audio sources available');
      this.selectedSystemAudioSource = null;
      return;
    }

    // Find the best source based on priority
    const bestSource = this.systemAudioSources[0]; // Already sorted by priority
    this.selectedSystemAudioSource = bestSource.id;

    if (bestSource.type === 'screen') {
      console.log('🖥️ Auto-selected screen source for system audio:', bestSource.name);
      console.log('✅ Screen sources are generally more compatible for system audio capture');
    } else {
      console.log('🪟 Auto-selected window source for system audio (no screen source found):', bestSource.name);
      console.log('⚠️ Window sources may be less stable - consider using a screen source if available');
    }
  }

  async getDesktopAudioSources() {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        fetchWindowIcons: false
      });

      return this.prioritizeSystemAudioSources(sources);
    } catch (error) {
      console.error('Error getting desktop audio sources:', error);
      return [];
    }
  }

  startZoomDetection() {
    this.zoomCheckInterval = setInterval(() => {
      if (!this.isShuttingDown) {
        this.checkZoomStatus();
      }
    }, 3000);
  }

  checkZoomStatus() {
    try {
      let isZoomRunning = false;
      let isInMeeting = false;

      try {
        const zoomProcesses = execSync('ps aux | grep -i zoom | grep -v grep', { encoding: 'utf8' });
        isZoomRunning = zoomProcesses.includes('zoom.us') || zoomProcesses.includes('ZoomOpener') || zoomProcesses.includes('Zoom');
        
        console.log('Zoom running:', isZoomRunning);
        
        if (isZoomRunning) {
          const script = `
            tell application "System Events"
              try
                set zoomWindows to {}
                repeat with proc in (every application process whose name contains "zoom")
                  try
                    set windowNames to name of every window of proc
                    repeat with windowName in windowNames
                      if windowName contains "Zoom Meeting" or windowName contains "zoom.us" or windowName contains "Meeting" then
                        return true
                      end if
                    end repeat
                  end try
                end repeat
                return false
              on error
                return false
              end try
            end tell
          `;
          
          const result = execSync(`osascript -e '${script}'`, { encoding: 'utf8', timeout: 5000 }).trim();
          isInMeeting = result === 'true';
          
          console.log('In meeting:', isInMeeting);
        }
      } catch (error) {
        console.log('Error checking Zoom status:', error.message);
        isInMeeting = false;
      }

      const wasDetected = this.isZoomDetected;
      this.isZoomDetected = isInMeeting;

      this.updateTrayMenu();

      // Safely send to renderer
      this.sendToRenderer('zoom-status-changed', {
        detected: this.isZoomDetected,
        callActive: this.isCallActive,
        isStartingCall: this.isStartingCall,
        isStoppingCall: this.isStoppingCall
      });

      if (this.isZoomDetected && !wasDetected) {
        this.showNotification('Zoom Meeting Detected', 'Ready to start call analysis');
      }

    } catch (error) {
      console.error('Error in checkZoomStatus:', error);
      this.isZoomDetected = false;
    }
  }

  // Check if renderer is safe to interact with
  isRendererSafe() {
    return this.mainWindow && 
           !this.mainWindow.isDestroyed() && 
           !this.isShuttingDown &&
           this.mainWindow.webContents &&
           !this.mainWindow.webContents.isDestroyed() &&
           this.rendererReady;
  }

  // Enhanced safe method to send messages to renderer
  sendToRenderer(channel, data) {
    try {
      if (this.isRendererSafe()) {
        this.mainWindow.webContents.send(channel, data);
      }
    } catch (error) {
      // Silently ignore renderer communication errors during shutdown
      if (!this.isShuttingDown) {
        console.error(`Error sending to renderer (${channel}):`, error.message);
        this.rendererReady = false; // Mark renderer as not ready on error
      }
    }
  }

  // Enhanced safe method to execute JavaScript in renderer
  async executeInRenderer(script) {
    try {
      if (this.isRendererSafe()) {
        return await this.mainWindow.webContents.executeJavaScript(script);
      }
      return null;
    } catch (error) {
      if (!this.isShuttingDown) {
        console.error('Error executing in renderer:', error.message);
        this.rendererReady = false; // Mark renderer as not ready on error
      }
      return null;
    }
  }

  async loadAudioDevices() {
    try {
      let inputDevices = [];
      let outputDevices = [];

      // Get real audio devices using navigator.mediaDevices
      if (this.isRendererSafe()) {
        try {
          const devices = await this.executeInRenderer(`
            (async () => {
              try {
                // Request permission first
                await navigator.mediaDevices.getUserMedia({ audio: true });
                
                const devices = await navigator.mediaDevices.enumerateDevices();
                return {
                  input: devices.filter(d => d.kind === 'audioinput').map(d => ({
                    id: d.deviceId,
                    name: d.label || 'Microphone ' + d.deviceId.slice(0, 8)
                  })),
                  output: devices.filter(d => d.kind === 'audiooutput').map(d => ({
                    id: d.deviceId,
                    name: d.label || 'Speaker ' + d.deviceId.slice(0, 8)
                  }))
                };
              } catch (error) {
                console.error('Error getting devices:', error);
                return { input: [], output: [] };
              }
            })()
          `);
          
          if (devices) {
            inputDevices = devices.input;
            outputDevices = devices.output;
            console.log('Real audio devices loaded:', { inputDevices, outputDevices });
          }
        } catch (error) {
          console.log('Could not get devices via webContents:', error.message);
        }
      }

      // Fallback if no devices found
      if (inputDevices.length === 0) {
        inputDevices = [{ id: 'default-input', name: 'Built-in Microphone' }];
      }

      if (outputDevices.length === 0) {
        outputDevices = [{ id: 'default-output', name: 'Built-in Speakers' }];
      }

      this.audioDevices = { input: inputDevices, output: outputDevices };

      if (!this.selectedDevices.input && inputDevices.length > 0) {
        this.selectedDevices.input = inputDevices[0].id;
      }
      if (!this.selectedDevices.output && outputDevices.length > 0) {
        this.selectedDevices.output = outputDevices[0].id;
      }

      // Start audio monitoring after devices are loaded
      await this.setupRealAudioMonitoring();

    } catch (error) {
      console.error('Error loading audio devices:', error);
      this.audioDevices = {
        input: [{ id: 'default-input', name: 'Built-in Microphone' }],
        output: [{ id: 'default-output', name: 'Built-in Speakers' }]
      };
    }
  }

  async setupRealAudioMonitoring() {
    try {
      // Stop existing monitoring
      if (this.audioMonitorInterval) {
        clearInterval(this.audioMonitorInterval);
        this.audioMonitorInterval = null;
      }

      if (!this.isRendererSafe()) {
        console.log('⚠️ Renderer not safe, falling back to simulated audio monitoring');
        this.startSimulatedAudioMonitoring();
        return;
      }

      const success = await this.executeInRenderer(`
        (async () => {
          try {
            // Clean up existing monitoring
            if (window.closeFlowStream) {
              window.closeFlowStream.getTracks().forEach(track => track.stop());
            }
            if (window.closeFlowAudioContext) {
              await window.closeFlowAudioContext.close();
            }

            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ 
              audio: { 
                deviceId: '${this.selectedDevices.input}',
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
              } 
            });
            
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = audioContext.createAnalyser();
            const microphone = audioContext.createMediaStreamSource(stream);
            
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;
            microphone.connect(analyser);
            
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            
            // Store references globally for cleanup
            window.closeFlowAudioContext = audioContext;
            window.closeFlowAnalyser = analyser;
            window.closeFlowStream = stream;
            window.closeFlowDataArray = dataArray;
            
            console.log('Real audio monitoring setup complete');
            return true;
          } catch (error) {
            console.error('Audio monitoring setup failed:', error);
            return false;
          }
        })()
      `);

      if (success) {
        console.log('✅ Real audio monitoring started');
        this.startAudioLevelMonitoring();
      } else {
        console.log('⚠️ Falling back to simulated audio monitoring');
        this.startSimulatedAudioMonitoring();
      }
    } catch (error) {
      console.error('Error setting up real audio monitoring:', error);
      this.startSimulatedAudioMonitoring();
    }
  }

  startAudioLevelMonitoring() {
    if (this.audioMonitorInterval) {
      clearInterval(this.audioMonitorInterval);
    }

    this.audioMonitorInterval = setInterval(async () => {
      if (this.isShuttingDown) return;

      try {
        // Only try to get levels if renderer is safe
        if (!this.isRendererSafe()) {
          // Fall back to simulation if renderer becomes unavailable
          this.audioLevels = {
            input: Math.random() * 40 + 10,
            output: Math.random() * 30 + 10,
            systemAudio: Math.random() * 40 + 15
          };
          this.sendToRenderer('audio-levels-updated', this.audioLevels);
          return;
        }

        const levels = await this.executeInRenderer(`
          (() => {
            try {
              if (window.closeFlowAnalyser && window.closeFlowDataArray) {
                window.closeFlowAnalyser.getByteFrequencyData(window.closeFlowDataArray);
                const average = window.closeFlowDataArray.reduce((a, b) => a + b) / window.closeFlowDataArray.length;
                const level = Math.min((average / 255) * 100, 100);
                return {
                  input: level,
                  output: Math.random() * 30 + 10, // Simulated output for now
                  systemAudio: Math.random() * 40 + 15 // Simulated system audio for now
                };
              }
              return null;
            } catch (error) {
              console.error('Error getting audio levels:', error);
              return null;
            }
          })()
        `);

        if (levels) {
          this.audioLevels = levels;
        } else {
          // Fallback to simulation if real monitoring fails
          this.audioLevels = {
            input: Math.random() * 40 + 10,
            output: Math.random() * 30 + 10,
            systemAudio: Math.random() * 40 + 15
          };
        }

        this.sendToRenderer('audio-levels-updated', this.audioLevels);
      } catch (error) {
        if (!this.isShuttingDown) {
          console.error('Error in audio level monitoring:', error);
          // Mark renderer as not ready and fall back to simulation
          this.rendererReady = false;
        }
      }
    }, 100); // Update every 100ms for smooth animation
  }

  startSimulatedAudioMonitoring() {
    if (this.audioMonitorInterval) {
      clearInterval(this.audioMonitorInterval);
    }

    this.audioMonitorInterval = setInterval(() => {
      if (this.isShuttingDown) return;

      // More realistic simulation based on whether we're in a call
      if (this.isCallActive && this.isZoomDetected) {
        // Simulate active conversation levels
        this.audioLevels = {
          input: Math.random() * 60 + 20, // 20-80%
          output: Math.random() * 40 + 30,  // 30-70%
          systemAudio: Math.random() * 50 + 25  // 25-75%
        };
      } else {
        // Simulate ambient/idle levels
        this.audioLevels = {
          input: Math.random() * 20 + 5,  // 5-25%
          output: Math.random() * 15 + 5,  // 5-20%
          systemAudio: Math.random() * 25 + 10  // 10-35%
        };
      }

      this.sendToRenderer('audio-levels-updated', this.audioLevels);
    }, 150);
  }

  startConnectionManagement() {
    // Start ping to maintain connection
    this.startPing();
    
    // Check connection status
    this.connectionCheckInterval = setInterval(async () => {
      if (!this.isShuttingDown) {
        await this.checkWebAppConnection();
      }
    }, 3000);
    
    // Start polling for messages from web app
    this.startMessagePolling();
    
    // Initial check
    this.checkWebAppConnection();
  }

  startPing() {
    this.pingInterval = setInterval(async () => {
      if (this.isConnected && !this.isShuttingDown) {
        try {
          await this.sendPing();
        } catch (error) {
          console.log('❌ Ping failed:', error.message);
          this.isConnected = false;
          this.updateConnectionStatus('disconnected');
          this.updateTrayMenu();
        }
      }
    }, 5000); // Ping every 5 seconds
  }

  startMessagePolling() {
    this.messagePollingInterval = setInterval(async () => {
      if (this.isConnected && !this.isShuttingDown) {
        try {
          await this.pollWebAppMessages();
        } catch (error) {
          console.error('Error polling messages:', error);
        }
      }
    }, 1000); // Poll every 1 second for fast response
  }

  async pollWebAppMessages() {
    try {
      const response = await fetch(`${this.webAppUrl}/api/desktop-sync?action=get-messages`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.messages && data.messages.length > 0) {
          for (const message of data.messages) {
            this.handleWebAppMessage(message);
          }
        }
      }
    } catch (error) {
      // Silently fail - connection check will handle disconnection
    }
  }

  handleWebAppMessage(message) {
    console.log('📨 Received message from web app:', message);
    
    switch (message.type) {
      case 'web-app-call-started-confirmation':
        console.log('✅ Web app confirmed call analysis started');
        // Clear the start timeout since we got confirmation
        if (this.startCallTimeout) {
          clearTimeout(this.startCallTimeout);
          this.startCallTimeout = null;
        }
        
        // CRITICAL: Only now set isCallActive to true
        this.isCallActive = true;
        this.isStartingCall = false;
        this.updateTrayMenu();
        
        this.sendToRenderer('zoom-status-changed', {
          detected: this.isZoomDetected,
          callActive: this.isCallActive,
          isStartingCall: this.isStartingCall,
          isStoppingCall: this.isStoppingCall
        });
        
        this.showNotification('Analysis Started', 'Call analysis is now active. Check the web app for real-time insights.');
        break;
        
      case 'web-app-call-stopped-confirmation':
        console.log('✅ Web app confirmed call analysis stopped');
        // Clear the stop timeout since we got confirmation
        if (this.stopCallTimeout) {
          clearTimeout(this.stopCallTimeout);
          this.stopCallTimeout = null;
        }
        
        // CRITICAL: Only now set isCallActive to false
        this.isCallActive = false;
        this.isStoppingCall = false;
        this.updateTrayMenu();
        
        this.sendToRenderer('zoom-status-changed', {
          detected: this.isZoomDetected,
          callActive: this.isCallActive,
          isStartingCall: this.isStartingCall,
          isStoppingCall: this.isStoppingCall
        });
        
        this.showNotification('Analysis Stopped', 'Call analysis has been stopped. Check the web app for the complete analysis.');
        break;
        
      case 'insight-generated':
        // Handle insights from web app
        this.showNotification('New Insight', message.content || 'AI generated a new insight');
        break;
        
      case 'call-status-update':
        // Handle call status updates
        console.log('📞 Call status update:', message.status);
        break;
        
      default:
        console.log('❓ Unknown message type from web app:', message.type);
    }
  }

  async sendPing() {
    const response = await fetch(`${this.webAppUrl}/api/desktop-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'ping',
        timestamp: Date.now()
      })
    });

    if (!response.ok) {
      throw new Error(`Ping failed: ${response.status}`);
    }
  }

  async checkWebAppConnection() {
    try {
      const response = await fetch(`${this.webAppUrl}/api/desktop-sync?action=status`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const data = await response.json();
        const wasConnected = this.isConnected;
        this.isConnected = true;
        
        if (!wasConnected) {
          console.log('✅ Connected to CloseFlow web app');
          this.updateConnectionStatus('connected');
          this.updateTrayMenu();
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      const wasConnected = this.isConnected;
      this.isConnected = false;
      
      if (wasConnected) {
        console.log('❌ Lost connection to web app:', error.message);
        this.updateConnectionStatus('disconnected');
        this.updateTrayMenu();
      }
    }
  }

  updateConnectionStatus(status) {
    this.sendToRenderer('connection-status-changed', status);
  }

  async startCallAnalysis() {
    if (!this.isZoomDetected) {
      throw new Error('No Zoom meeting detected');
    }

    if (this.isCallActive || this.isStartingCall) {
      throw new Error('Call analysis already active or starting');
    }

    if (!this.isConnected) {
      throw new Error('Not connected to web app. Please ensure the web app is running.');
    }

    if (!this.selectedSystemAudioSource) {
      throw new Error('No system audio source selected. Please select a system audio source.');
    }

    try {
      this.isStartingCall = true;
      this.updateTrayMenu();
      
      // Update renderer with new state
      this.sendToRenderer('zoom-status-changed', {
        detected: this.isZoomDetected,
        callActive: this.isCallActive,
        isStartingCall: this.isStartingCall,
        isStoppingCall: this.isStoppingCall
      });
      
      // Initialize system audio capture with main window reference
      const captureInitialized = await this.systemAudioCapture.initialize(this.selectedSystemAudioSource, this.mainWindow);
      if (!captureInitialized) {
        throw new Error('Failed to initialize system audio capture');
      }

      // Start system audio capture
      const captureStarted = await this.systemAudioCapture.startCapture();
      if (!captureStarted) {
        throw new Error('Failed to start system audio capture');
      }

      // Send message to web app via HTTP
      const response = await fetch(`${this.webAppUrl}/api/desktop-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'start-call-analysis',
          deviceSettings: {
            input: this.selectedDevices.input,
            output: this.selectedDevices.output,
            systemAudioSource: this.selectedSystemAudioSource
          },
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to start call analysis: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        // CRITICAL: Do NOT set isCallActive here - wait for web app confirmation
        console.log('✅ Call analysis request sent to web app');
        this.showNotification('Starting Analysis', 'Waiting for web app to establish connection...');
        
        // Set a timeout in case we don't get confirmation
        this.startCallTimeout = setTimeout(() => {
          if (this.isStartingCall && !this.isCallActive) {
            console.log('⚠️ Timeout waiting for web app confirmation');
            this.isStartingCall = false;
            this.startCallTimeout = null;
            this.updateTrayMenu();
            
            // Update renderer
            this.sendToRenderer('zoom-status-changed', {
              detected: this.isZoomDetected,
              callActive: this.isCallActive,
              isStartingCall: this.isStartingCall,
              isStoppingCall: this.isStoppingCall
            });
            
            this.showNotification('Start Failed', 'Web app did not confirm call start. Please try again.');
            
            // Stop system audio capture on timeout
            this.systemAudioCapture.stopCapture();
          }
        }, 15000); // 15 second timeout
        
        return { success: true };
      } else {
        throw new Error(result.message || 'Failed to start call analysis');
      }
    } catch (error) {
      console.error('❌ Error starting call analysis:', error);
      this.isStartingCall = false;
      this.updateTrayMenu();
      
      // Update renderer
      this.sendToRenderer('zoom-status-changed', {
        detected: this.isZoomDetected,
        callActive: this.isCallActive,
        isStartingCall: this.isStartingCall,
        isStoppingCall: this.isStoppingCall
      });
      
      // Stop system audio capture on error
      this.systemAudioCapture.stopCapture();
      
      throw error;
    }
  }

  async stopCallAnalysis() {
    if (!this.isCallActive || this.isStoppingCall) {
      throw new Error('Call analysis not active or already stopping');
    }

    try {
      this.isStoppingCall = true;
      this.updateTrayMenu();
      
      // Update renderer with new state
      this.sendToRenderer('zoom-status-changed', {
        detected: this.isZoomDetected,
        callActive: this.isCallActive,
        isStartingCall: this.isStartingCall,
        isStoppingCall: this.isStoppingCall
      });
      
      // Stop system audio capture
      this.systemAudioCapture.stopCapture();
      
      // Send message to web app via HTTP
      const response = await fetch(`${this.webAppUrl}/api/desktop-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'stop-call-analysis',
          timestamp: Date.now()
        })
      });

      if (response.ok) {
        console.log('✅ Sent stop-call-analysis message to web app');
      } else {
        console.warn('⚠️ Failed to notify web app of call stop');
      }

      // CRITICAL: Do NOT set isCallActive here - wait for web app confirmation
      this.showNotification('Stopping Analysis', 'Waiting for web app to confirm...');
      
      // Set a timeout in case we don't get confirmation
      this.stopCallTimeout = setTimeout(() => {
        if (this.isStoppingCall && this.isCallActive) {
          console.log('⚠️ Timeout waiting for web app stop confirmation');
          this.isStoppingCall = false;
          this.isCallActive = false;
          this.stopCallTimeout = null;
          this.updateTrayMenu();
          
          // Update renderer
          this.sendToRenderer('zoom-status-changed', {
            detected: this.isZoomDetected,
            callActive: this.isCallActive,
            isStartingCall: this.isStartingCall,
            isStoppingCall: this.isStoppingCall
          });
          
          this.showNotification('Stop Completed', 'Call analysis has been stopped.');
        }
      }, 10000); // 10 second timeout
      
      return { success: true };
    } catch (error) {
      console.error('❌ Error stopping call analysis:', error);
      this.isStoppingCall = false;
      this.updateTrayMenu();
      
      // Update renderer
      this.sendToRenderer('zoom-status-changed', {
        detected: this.isZoomDetected,
        callActive: this.isCallActive,
        isStartingCall: this.isStartingCall,
        isStoppingCall: this.isStoppingCall
      });
      
      throw error;
    }
  }

  showNotification(title, body) {
    this.sendToRenderer('show-notification', { title, body });
  }

  cleanup() {
    console.log('🧹 Cleaning up CloseFlow Desktop...');
    this.isShuttingDown = true;
    this.rendererReady = false;

    // Clear all intervals
    if (this.zoomCheckInterval) {
      clearInterval(this.zoomCheckInterval);
      this.zoomCheckInterval = null;
    }
    if (this.audioMonitorInterval) {
      clearInterval(this.audioMonitorInterval);
      this.audioMonitorInterval = null;
    }
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
    if (this.messagePollingInterval) {
      clearInterval(this.messagePollingInterval);
      this.messagePollingInterval = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    // Clear timeouts to prevent render frame errors
    if (this.startCallTimeout) {
      clearTimeout(this.startCallTimeout);
      this.startCallTimeout = null;
    }
    if (this.stopCallTimeout) {
      clearTimeout(this.stopCallTimeout);
      this.stopCallTimeout = null;
    }
    
    // Stop system audio capture
    if (this.systemAudioCapture) {
      this.systemAudioCapture.destroy();
    }
    
    // Stop WebSocket server
    if (this.websocketServer) {
      this.websocketServer.kill();
      this.websocketServer = null;
    }

    console.log('✅ Cleanup completed');
  }
}

// App event handlers
app.whenReady().then(async () => {
  try {
    const closeFlowApp = new CloseFlowDesktop();
    await closeFlowApp.initialize();
    
    // Store reference for cleanup
    app.closeFlowApp = closeFlowApp;
  } catch (error) {
    console.error('Failed to initialize CloseFlow app:', error);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const closeFlowApp = new CloseFlowDesktop();
    closeFlowApp.initialize().catch(console.error);
  }
});

app.on('before-quit', () => {
  app.isQuiting = true;
  if (app.closeFlowApp) {
    app.closeFlowApp.cleanup();
  }
});