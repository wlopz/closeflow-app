// Update the startCallAnalysis function to retrieve and pass the mimeType
async startCallAnalysis() {
  if (this.isStartingCall) return;
  
  try {
    this.isStartingCall = true;
    this.updateButtonStates();
    this.updateAnalysisStatus();

    // NEW: Get the actual MIME type from the MediaRecorder
    let actualMimeType = null;
    if (this.isRendererSafe()) {
      try {
        actualMimeType = await this.mainWindow.webContents.executeJavaScript(`
          (() => {
            return window.closeFlowActualMimeType || null;
          })()
        `);
        console.log('🎤 ENHANCED LOGGING: Retrieved actual MIME type from renderer:', actualMimeType);
      } catch (error) {
        console.log('⚠️ ENHANCED LOGGING: Could not retrieve MIME type from renderer:', error.message);
      }
    }

    const result = await ipcRenderer.invoke('start-call-analysis', {
      inputDeviceId: this.selectedDevices.input,
      outputDeviceId: this.selectedDevices.output,
      systemAudioSourceId: this.selectedSystemAudioSource,
      mimeType: actualMimeType // NEW: Pass the actual MIME type
    });
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to start call analysis');
    }
    
    if (this.audioPlaybackEnabled) {
      this.setupAudioDebug();
    }
    
  } catch (error) {
    console.error('Error starting call analysis:', error);
    this.showNotification('Error', error.message || 'Failed to start call analysis', 'error');
    this.isStartingCall = false;
    this.updateButtonStates();
    this.updateAnalysisStatus();
  }
}