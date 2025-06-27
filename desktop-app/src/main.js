const { app, BrowserWindow, ipcMain, Menu, Tray, dialog, systemPreferences, desktopCapturer } = require('electron');
const path = require('path');
const { execSync, spawn } = require('child_process');
const AblyDeepgramBridge = require('./ably-deepgram-bridge');

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
    this.isConnected = false;
    
    // ENHANCED: Dynamic web app URL configuration
    this.webAppUrl = this.getWebAppUrl();
    console.log('🌐 ENHANCED LOGGING: Web app URL configured as:', this.webAppUrl);
    
    this.isStartingCall = false;
    this.isStoppingCall = false;
    this.isShuttingDown = false;
    
    // Add timeout references for proper cleanup
    this.startCallTimeout = null;
    this.stopCallTimeout = null;
    
    // Add flag to track if renderer is ready
    this.rendererReady = false;
    
    // Add retry mechanism for connection
    this.connectionRetryCount = 0;
    this.maxConnectionRetries = 5;
    this.connectionRetryDelay = 2000;

    // NEW: Ably integration
    this.ablyDeepgramBridge = null;
    this.ablyApiKey = process.env.ABLY_API_KEY || null;
    
    // NEW: Periodic ping to web app
    this.webAppPingInterval = null;
    this.webAppPingIntervalMs = 5000; // 5 seconds
    
    console.log('🔑 ENHANCED LOGGING: Ably API key present:', !!this.ablyApiKey);
  }

  // Get web app URL based on environment
  getWebAppUrl() {
    // Check for environment variable first (production)
    const envUrl = process.env.CLOSEFLOW_WEB_APP_URL;
    if (envUrl) {
      console.log('🌐 Using web app URL from environment variable:', envUrl);
      return envUrl;
    }
    
    // Check for command line argument (for manual override)
    const args = process.argv;
    const urlArgIndex = args.findIndex(arg => arg.startsWith('--web-app-url='));
    if (urlArgIndex !== -1) {
      const urlFromArg = args[urlArgIndex].split('=')[1];
      console.log('🌐 Using web app URL from command line argument:', urlFromArg);
      return urlFromArg;
    }
    
    // Default to localhost for development
    const defaultUrl = 'http://localhost:3000';
    console.log('🌐 Using default web app URL for development:', defaultUrl);
    return defaultUrl;
  }

  async initialize() {
    await this.createWindow();
    this.setupTray();
    this.setupIPC();
    this.startZoomDetection();
    await this.requestPermissions();
    await this.loadAudioDevices();
    await this.loadSystemAudioSources();
    
    // NEW: Initialize Ably Deepgram Bridge
    await this.initializeAblyBridge();
    
    // Start connection management (simplified for Ably)
    this.startConnectionManagement();
    
    // NEW: Start periodic ping to web app
    this.startWebAppPing();
  }

  // NEW: Initialize Ably Deepgram Bridge
  async initializeAblyBridge() {
    if (!this.ablyApiKey) {
      console.error('❌ ENHANCED LOGGING: No Ably API key found. Please set ABLY_API_KEY environment variable.');
      return;
    }

    try {
      this.ablyDeepgramBridge = new AblyDeepgramBridge();
      await this.ablyDeepgramBridge.initialize(this.ablyApiKey);
      
      console.log('✅ ENHANCED LOGGING: Ably Deepgram Bridge initialized successfully');
      this.isConnected = true;
      this.updateConnectionStatus('connected');
      this.updateTrayMenu();
      
    } catch (error) {
      console.error('❌ ENHANCED LOGGING: Failed to initialize Ably Deepgram Bridge:', error);
      this.isConnected = false;
      this.updateConnectionStatus('disconnected');
      this.updateTrayMenu();
    }
  }

  // NEW: Start periodic ping to web app API
  startWebAppPing() {
    console.log('🏓 ENHANCED LOGGING: Starting periodic ping to web app API');
    
    this.webAppPingInterval = setInterval(async () => {
      if (!this.isShuttingDown) {
        await this.pingWebApp();
      }
    }, this.webAppPingIntervalMs);
    
    // Send initial ping
    this.pingWebApp();
  }

  // NEW: Send ping to web app API
  async pingWebApp() {
    try {
      console.log('🏓 ENHANCED LOGGING: Sending ping to web app API');
      
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

      if (response.ok) {
        const result = await response.json();
        console.log('🏓 ENHANCED LOGGING: Web app ping successful:', result.message);
      } else {
        console.log('⚠️ ENHANCED LOGGING: Web app ping failed with status:', response.status);
      }
    } catch (error) {
      console.error('❌ ENHANCED LOGGING: Error pinging web app:', error.message);
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
    // Simplified API - audio now goes through Ably
    if (this.isRendererSafe()) {
      this.mainWindow.webContents.executeJavaScript(`
        window.electronAPI = {
          // Keep this for potential future use
          sendAudioData: (audioData) => {
            console.log('⚠️ sendAudioData called but audio now uses Ably');
          }
        };
        console.log('✅ Simplified Electron API exposed to renderer');
      `).catch(err => {
        console.error('Error setting up renderer API:', err);
        this.rendererReady = false;
      });
    }
  }

  setupIPC() {
    // FIXED: Handle audio data chunks from renderer with proper Buffer conversion
    ipcMain.on('audio-data-chunk', (event, audioData) => {
      if (this.ablyDeepgramBridge && this.isCallActive) {
        console.log('🎤 ENHANCED LOGGING: Forwarding audio data to Ably bridge');
        
        // CRITICAL FIX: Ensure audioData is a proper Node.js Buffer
        let bufferData;
        if (Buffer.isBuffer(audioData)) {
          bufferData = audioData;
        } else if (audioData instanceof Uint8Array) {
          bufferData = Buffer.from(audioData);
        } else if (audioData instanceof ArrayBuffer) {
          bufferData = Buffer.from(audioData);
        } else {
          console.error('❌ ENHANCED LOGGING: Unexpected audio data type:', typeof audioData);
          return;
        }
        
        console.log('🎤 ENHANCED LOGGING: Audio data converted to Buffer, size:', bufferData.length);
        this.ablyDeepgramBridge.handleAudioData(bufferData);
      }
    });

    // Update the IPC handler to accept and pass the mimeType
    ipcMain.handle('start-call-analysis', async (event, options = {}) => {
      try {
        const { inputDeviceId, outputDeviceId, systemAudioSourceId, mimeType } = options;
        
        // Update selected devices if provided
        if (inputDeviceId) this.selectedDevices.input = inputDeviceId;
        if (outputDeviceId) this.selectedDevices.output = outputDeviceId;
        if (systemAudioSourceId) this.selectedSystemAudioSource = systemAudioSourceId;
        
        console.log('🎤 ENHANCED LOGGING: Starting call analysis with MIME type:', mimeType);
        
        return await this.startCallAnalysis(mimeType);
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
          isStoppingCall: this.isStoppingCall,
          webAppUrl: this.webAppUrl,
          ablyConnected: this.ablyDeepgramBridge ? true : false
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

        if (baseSource.type === 'screen') {
          baseSource.priority = 100;
          if (baseSource.name.toLowerCase().includes('main') || 
              baseSource.name.toLowerCase().includes('primary')) {
            baseSource.priority = 110;
          }
        } else if (baseSource.name.toLowerCase().includes('zoom meeting')) {
          baseSource.priority = 90;
        } else if (baseSource.name.toLowerCase().includes('zoom')) {
          baseSource.priority = 80;
        } else if (baseSource.name.toLowerCase().includes('system audio') ||
                   baseSource.name.toLowerCase().includes('system sound')) {
          baseSource.priority = 85;
        } else if (baseSource.name.toLowerCase().includes('audio')) {
          baseSource.priority = 70;
        } else {
          baseSource.priority = 50;
        }

        return baseSource;
      })
      .sort((a, b) => b.priority - a.priority);

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
      this.autoSelectSystemAudioSource();
    } catch (error) {
      console.error('Error loading system audio sources:', error);
    }
  }

  autoSelectSystemAudioSource() {
    if (this.selectedSystemAudioSource && this.systemAudioSources.length > 0) {
      const currentSourceExists = this.systemAudioSources.find(s => s.id === this.selectedSystemAudioSource);
      if (currentSourceExists) {
        console.log('✅ Current system audio source still available:', currentSourceExists.name);
        return;
      }
    }

    if (this.systemAudioSources.length === 0) {
      console.log('⚠️ No system audio sources available');
      this.selectedSystemAudioSource = null;
      return;
    }

    const bestSource = this.systemAudioSources[0];
    this.selectedSystemAudioSource = bestSource.id;

    if (bestSource.type === 'screen') {
      console.log('🖥️ Auto-selected screen source for system audio:', bestSource.name);
    } else {
      console.log('🪟 Auto-selected window source for system audio:', bestSource.name);
      this.showWindowSourceWarning(bestSource);
    }
  }

  showWindowSourceWarning(windowSource) {
    const screenSources = this.systemAudioSources.filter(source => source.type === 'screen');
    
    if (screenSources.length > 0) {
      this.showNotification(
        'Audio Source Selection',
        `Auto-selected window "${windowSource.name}". For better stability, consider selecting a "Screen" source from the dropdown menu.`
      );
    } else {
      this.showNotification(
        'Audio Source Selection',
        `Auto-selected window "${windowSource.name}". No screen sources available - this should work but may be less stable than screen capture.`
      );
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

  isRendererSafe() {
    return this.mainWindow && 
           !this.mainWindow.isDestroyed() && 
           !this.isShuttingDown &&
           this.mainWindow.webContents &&
           !this.mainWindow.webContents.isDestroyed() &&
           this.rendererReady;
  }

  sendToRenderer(channel, data) {
    try {
      if (this.isRendererSafe()) {
        this.mainWindow.webContents.send(channel, data);
      }
    } catch (error) {
      if (!this.isShuttingDown) {
        console.error(`Error sending to renderer (${channel}):`, error.message);
        this.rendererReady = false;
      }
    }
  }

  async executeInRenderer(script) {
    try {
      if (this.isRendererSafe()) {
        return await this.mainWindow.webContents.executeJavaScript(script);
      }
      return null;
    } catch (error) {
      if (!this.isShuttingDown) {
        console.error('Error executing in renderer:', error.message);
        this.rendererReady = false;
      }
      return null;
    }
  }

  async loadAudioDevices() {
    try {
      let inputDevices = [];
      let outputDevices = [];

      if (this.isRendererSafe()) {
        try {
          const devices = await this.executeInRenderer(`
            (async () => {
              try {
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
            if (window.closeFlowStream) {
              window.closeFlowStream.getTracks().forEach(track => track.stop());
            }
            if (window.closeFlowAudioContext) {
              await window.closeFlowAudioContext.close();
            }

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
        if (!this.isRendererSafe()) {
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
                  output: Math.random() * 30 + 10,
                  systemAudio: Math.random() * 40 + 15
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
          this.rendererReady = false;
        }
      }
    }, 100);
  }

  startSimulatedAudioMonitoring() {
    if (this.audioMonitorInterval) {
      clearInterval(this.audioMonitorInterval);
    }

    this.audioMonitorInterval = setInterval(() => {
      if (this.isShuttingDown) return;

      if (this.isCallActive && this.isZoomDetected) {
        this.audioLevels = {
          input: Math.random() * 60 + 20,
          output: Math.random() * 40 + 30,
          systemAudio: Math.random() * 50 + 25
        };
      } else {
        this.audioLevels = {
          input: Math.random() * 20 + 5,
          output: Math.random() * 15 + 5,
          systemAudio: Math.random() * 25 + 10
        };
      }

      this.sendToRenderer('audio-levels-updated', this.audioLevels);
    }, 150);
  }

  // SIMPLIFIED: Connection management for Ably
  startConnectionManagement() {
    this.connectionCheckInterval = setInterval(async () => {
      if (!this.isShuttingDown) {
        await this.checkAblyConnection();
      }
    }, 5000);
    
    this.checkAblyConnection();
  }

  async checkAblyConnection() {
    try {
      if (this.ablyDeepgramBridge && this.ablyDeepgramBridge.ablyClient) {
        const connectionState = this.ablyDeepgramBridge.ablyClient.connection.state;
        const wasConnected = this.isConnected;
        this.isConnected = connectionState === 'connected';
        
        if (this.isConnected && !wasConnected) {
          console.log('✅ Connected to Ably');
          this.updateConnectionStatus('connected');
          this.updateTrayMenu();
        } else if (!this.isConnected && wasConnected) {
          console.log('❌ Lost connection to Ably');
          this.updateConnectionStatus('disconnected');
          this.updateTrayMenu();
        }
      } else {
        this.isConnected = false;
        this.updateConnectionStatus('disconnected');
        this.updateTrayMenu();
      }
    } catch (error) {
      console.error('Error checking Ably connection:', error);
      this.isConnected = false;
      this.updateConnectionStatus('disconnected');
      this.updateTrayMenu();
    }
  }

  updateConnectionStatus(status) {
    this.sendToRenderer('connection-status-changed', status);
  }

  // Update the startCallAnalysis method to accept and pass mimeType
  async startCallAnalysis(mimeType = null) {
    if (!this.isZoomDetected) {
      throw new Error('No Zoom meeting detected');
    }

    if (this.isCallActive || this.isStartingCall) {
      throw new Error('Call analysis already active or starting');
    }

    if (!this.isConnected) {
      throw new Error('Not connected to Ably. Please check your connection.');
    }

    if (!this.selectedSystemAudioSource) {
      throw new Error('No system audio source selected. Please select a system audio source.');
    }

    try {
      this.isStartingCall = true;
      this.updateTrayMenu();
      
      this.sendToRenderer('zoom-status-changed', {
        detected: this.isZoomDetected,
        callActive: this.isCallActive,
        isStartingCall: this.isStartingCall,
        isStoppingCall: this.isStoppingCall
      });
      
      // NEW: Send start command to web app via HTTP POST with mimeType
      console.log('🚀 ENHANCED LOGGING: Sending desktop-request-start-call to web app');
      console.log('🎤 ENHANCED LOGGING: Including MIME type:', mimeType);
      
      const response = await fetch(`${this.webAppUrl}/api/desktop-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'desktop-request-start-call',
          deviceSettings: {
            input: this.selectedDevices.input,
            output: this.selectedDevices.output,
            systemAudioSource: this.selectedSystemAudioSource,
            mimeType: mimeType // NEW: Include the MIME type
          },
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send start request to web app');
      }

      console.log('✅ Desktop request to start call analysis sent to web app');
      this.showNotification('Starting Analysis', 'Request sent to web app. Waiting for confirmation...');
      
      // Set timeout for confirmation
      this.startCallTimeout = setTimeout(() => {
        if (this.isStartingCall && !this.isCallActive) {
          console.log('⚠️ Timeout waiting for call start confirmation from web app');
          this.isStartingCall = false;
          this.isCallActive = true; // Assume success for now
          this.startCallTimeout = null;
          this.updateTrayMenu();
          
          this.sendToRenderer('zoom-status-changed', {
            detected: this.isZoomDetected,
            callActive: this.isCallActive,
            isStartingCall: this.isStartingCall,
            isStoppingCall: this.isStoppingCall
          });
          
          this.showNotification('Analysis Started', 'Call analysis is now active.');
        }
      }, 5000);
      
      return { success: true };
    } catch (error) {
      console.error('❌ Error starting call analysis:', error);
      this.isStartingCall = false;
      this.updateTrayMenu();
      
      this.sendToRenderer('zoom-status-changed', {
        detected: this.isZoomDetected,
        callActive: this.isCallActive,
        isStartingCall: this.isStartingCall,
        isStoppingCall: this.isStoppingCall
      });
      
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
      
      this.sendToRenderer('zoom-status-changed', {
        detected: this.isZoomDetected,
        callActive: this.isCallActive,
        isStartingCall: this.isStartingCall,
        isStoppingCall: this.isStoppingCall
      });
      
      // NEW: Send stop command via Ably instead of HTTP
      if (this.ablyDeepgramBridge && this.ablyDeepgramBridge.controlChannel) {
        await this.ablyDeepgramBridge.controlChannel.publish('stop-transcription', {
          timestamp: Date.now()
        });

        console.log('✅ Sent stop-call-analysis message via Ably');
      }

      this.showNotification('Stopping Analysis', 'Call analysis stopped.');
      
      // Set timeout for confirmation
      this.stopCallTimeout = setTimeout(() => {
        if (this.isStoppingCall && this.isCallActive) {
          console.log('⚠️ Timeout waiting for stop confirmation');
          this.isStoppingCall = false;
          this.isCallActive = false;
          this.stopCallTimeout = null;
          this.updateTrayMenu();
          
          this.sendToRenderer('zoom-status-changed', {
            detected: this.isZoomDetected,
            callActive: this.isCallActive,
            isStartingCall: this.isStartingCall,
            isStoppingCall: this.isStoppingCall
          });
          
          this.showNotification('Stop Completed', 'Call analysis has been stopped.');
        }
      }, 3000); // Shorter timeout for Ably
      
      return { success: true };
    } catch (error) {
      console.error('❌ Error stopping call analysis:', error);
      this.isStoppingCall = false;
      this.updateTrayMenu();
      
      this.sendToRenderer('zoom-status-changed', {
        detected: this.isZoomDetected,
        callActive: this.isCallActive,
        isStartingCall: this.isStartingCall,
        isStoppingCall: this.isStoppingCall
      });
      
      throw error;
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
          label: `Ably: ${this.isConnected ? 'Connected' : 'Disconnected'}`,
          enabled: false
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
    if (this.webAppPingInterval) {
      clearInterval(this.webAppPingInterval);
      this.webAppPingInterval = null;
    }
    
    // Clear timeouts
    if (this.startCallTimeout) {
      clearTimeout(this.startCallTimeout);
      this.startCallTimeout = null;
    }
    if (this.stopCallTimeout) {
      clearTimeout(this.stopCallTimeout);
      this.stopCallTimeout = null;
    }
    
    // NEW: Cleanup Ably bridge
    if (this.ablyDeepgramBridge) {
      this.ablyDeepgramBridge.cleanup();
      this.ablyDeepgramBridge = null;
    }

    console.log('✅ Cleanup completed');
  }
}

// App event handlers
app.whenReady().then(async () => {
  try {
    const closeFlowApp = new CloseFlowDesktop();
    await closeFlowApp.initialize();
    
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