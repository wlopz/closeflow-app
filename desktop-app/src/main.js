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
    
    // Initialize system audio capture
    const captureInitialized = await this.systemAudioCapture.initialize(this.selectedSystemAudioSource, this.mainWindow);
    if (!captureInitialized) {
      throw new Error('Failed to initialize system audio capture');
    }

    // Start system audio capture
    const captureStarted = await this.systemAudioCapture.startCapture();
    if (!captureStarted) {
      throw new Error('Failed to start system audio capture');
    }

    // NEW: Send start command to web app via HTTP POST with mimeType
    console.log('🚀 ENHANCED LOGGING: Sending desktop-request-start-call to web app');
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
    
    this.systemAudioCapture.stopCapture();
    throw error;
  }
}