'use client';

const { ipcRenderer, shell } = require('electron');

class DesktopRenderer {
    constructor() {
        this.isCallActive = false;
        this.zoomDetected = false;
        this.audioDevices = { input: [], output: [] };
        this.systemAudioSources = [];
        this.selectedDevices = { input: null, output: null };
        this.selectedSystemAudioSource = null;
        this.connectionStatus = 'connecting';
        this.isStartingCall = false;
        this.isStoppingCall = false;
        
        // Audio debug properties
        this.audioPlaybackEnabled = false;
        this.audioChunks = [];
        this.mediaRecorder = null;
        this.audioPlayer = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadInitialData();
    }

    initializeElements() {
        // Status elements
        this.connectionStatus = document.getElementById('connectionStatus');
        this.zoomStatus = document.getElementById('zoomStatus');
        this.zoomStatusTitle = document.getElementById('zoomStatusTitle');
        this.zoomStatusDescription = document.getElementById('zoomStatusDescription');
        
        // Device elements
        this.inputDevice = document.getElementById('inputDevice');
        this.outputDevice = document.getElementById('outputDevice');
        this.systemAudioDevice = document.getElementById('systemAudioDevice');
        this.inputLevel = document.getElementById('inputLevel');
        this.outputLevel = document.getElementById('outputLevel');
        this.systemAudioLevel = document.getElementById('systemAudioLevel');
        this.inputLevelText = document.getElementById('inputLevelText');
        this.outputLevelText = document.getElementById('outputLevelText');
        this.systemAudioLevelText = document.getElementById('systemAudioLevelText');
        
        // Control elements
        this.startAnalysisBtn = document.getElementById('startAnalysisBtn');
        this.stopAnalysisBtn = document.getElementById('stopAnalysisBtn');
        this.analysisStatus = document.getElementById('analysisStatus');
        
        // Action elements
        this.openWebAppBtn = document.getElementById('openWebAppBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        
        // Debug elements
        this.toggleAudioPlaybackBtn = document.getElementById('toggleAudioPlayback');
        this.audioDebugStatus = document.getElementById('audioDebugStatus');
        this.debugAudioPlayer = document.getElementById('debugAudioPlayer');
        
        // Notifications container
        this.notifications = document.getElementById('notifications');
    }

    setupEventListeners() {
        // IPC listeners
        ipcRenderer.on('zoom-status-changed', (event, data) => {
            this.updateZoomStatus(data.detected, data.callActive, data.isStartingCall, data.isStoppingCall);
        });

        ipcRenderer.on('audio-levels-updated', (event, levels) => {
            this.updateAudioLevels(levels);
        });

        ipcRenderer.on('show-notification', (event, notification) => {
            this.showNotification(notification.title, notification.body);
        });

        ipcRenderer.on('connection-status-changed', (event, status) => {
            this.updateConnectionStatus(status);
        });

        // Button listeners
        this.startAnalysisBtn.addEventListener('click', () => {
            this.startCallAnalysis();
        });

        this.stopAnalysisBtn.addEventListener('click', () => {
            this.stopCallAnalysis();
        });

        this.openWebAppBtn.addEventListener('click', () => {
            shell.openExternal('http://localhost:3000/dashboard/calls');
        });

        this.settingsBtn.addEventListener('click', () => {
            this.showSettings();
        });

        // Debug audio playback toggle
        this.toggleAudioPlaybackBtn.addEventListener('click', () => {
            this.toggleAudioPlayback();
        });

        // Device selection listeners
        this.inputDevice.addEventListener('change', (e) => {
            if (e.target.value) {
                this.selectInputDevice(e.target.value);
            }
        });

        this.outputDevice.addEventListener('change', (e) => {
            if (e.target.value) {
                this.selectOutputDevice(e.target.value);
            }
        });

        this.systemAudioDevice.addEventListener('change', (e) => {
            if (e.target.value) {
                this.selectSystemAudioSource(e.target.value);
            }
        });
    }

    toggleAudioPlayback() {
        this.audioPlaybackEnabled = !this.audioPlaybackEnabled;
        
        if (this.audioPlaybackEnabled) {
            this.toggleAudioPlaybackBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6"/>
                </svg>
                Disable Audio Playback
            `;
            this.audioDebugStatus.textContent = 'Audio playback enabled - you should hear captured audio';
            this.debugAudioPlayer.style.display = 'block';
            this.showNotification('Audio Debug', 'Audio playback enabled. You should now hear the captured system audio.', 'info');
        } else {
            this.toggleAudioPlaybackBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                </svg>
                Enable Audio Playback
            `;
            this.audioDebugStatus.textContent = 'Audio playback disabled';
            this.debugAudioPlayer.style.display = 'none';
            
            // CRITICAL FIX: Properly stop and clear audio playback
            this.debugAudioPlayer.pause();
            this.debugAudioPlayer.src = '';
            
            this.showNotification('Audio Debug', 'Audio playback disabled.', 'info');
        }
    }

    async loadInitialData() {
        try {
            // Load audio devices
            this.audioDevices = await ipcRenderer.invoke('get-audio-devices');
            this.populateDeviceSelects();
            
            // Load system audio sources
            this.systemAudioSources = await ipcRenderer.invoke('get-desktop-audio-sources');
            this.populateSystemAudioSources();
            
            // Get current status
            const status = await ipcRenderer.invoke('get-status');
            this.updateZoomStatus(status.zoomDetected, status.callActive, status.isStartingCall, status.isStoppingCall);
            this.selectedDevices = status.selectedDevices;
            this.selectedSystemAudioSource = status.selectedSystemAudioSource;
            
            // Update connection status
            this.updateConnectionStatus(status.webAppConnected ? 'connected' : 'disconnected');
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.updateConnectionStatus('disconnected');
            this.showNotification('Error', 'Failed to load initial data', 'error');
        }
    }

    populateDeviceSelects() {
        // Populate input devices
        this.inputDevice.innerHTML = '';
        if (this.audioDevices.input && this.audioDevices.input.length > 0) {
            this.audioDevices.input.forEach(device => {
                const option = document.createElement('option');
                option.value = device.id;
                option.textContent = device.name;
                if (device.id === this.selectedDevices.input) {
                    option.selected = true;
                }
                this.inputDevice.appendChild(option);
            });
        } else {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No input devices found';
            this.inputDevice.appendChild(option);
        }

        // Populate output devices
        this.outputDevice.innerHTML = '';
        if (this.audioDevices.output && this.audioDevices.output.length > 0) {
            this.audioDevices.output.forEach(device => {
                const option = document.createElement('option');
                option.value = device.id;
                option.textContent = device.name;
                if (device.id === this.selectedDevices.output) {
                    option.selected = true;
                }
                this.outputDevice.appendChild(option);
            });
        } else {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No output devices found';
            this.outputDevice.appendChild(option);
        }
    }

    populateSystemAudioSources() {
        this.systemAudioDevice.innerHTML = '';
        
        if (this.systemAudioSources && this.systemAudioSources.length > 0) {
            this.systemAudioSources.forEach(source => {
                const option = document.createElement('option');
                option.value = source.id;
                option.textContent = `${source.name} (${source.type})`;
                if (source.id === this.selectedSystemAudioSource) {
                    option.selected = true;
                }
                this.systemAudioDevice.appendChild(option);
            });
            
            // Auto-select first source if none selected
            if (!this.selectedSystemAudioSource && this.systemAudioSources.length > 0) {
                this.selectedSystemAudioSource = this.systemAudioSources[0].id;
                this.systemAudioDevice.value = this.selectedSystemAudioSource;
            }
        } else {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No system audio sources found';
            this.systemAudioDevice.appendChild(option);
        }
    }

    updateConnectionStatus(status) {
        this.connectionStatus.className = `status-indicator ${status}`;
        const statusText = this.connectionStatus.querySelector('span');
        
        switch (status) {
            case 'connected':
                statusText.textContent = 'Connected to Web App';
                break;
            case 'disconnected':
                statusText.textContent = 'Disconnected';
                break;
            default:
                statusText.textContent = 'Connecting...';
        }
        
        // Update button states based on connection
        this.updateButtonStates();
    }

    updateZoomStatus(detected, callActive, isStartingCall = false, isStoppingCall = false) {
        this.zoomDetected = detected;
        this.isCallActive = callActive;
        this.isStartingCall = isStartingCall;
        this.isStoppingCall = isStoppingCall;
        
        if (detected) {
            this.zoomStatus.className = 'status-card active';
            this.zoomStatusTitle.textContent = 'Zoom Meeting Detected';
            this.zoomStatusDescription.textContent = 'Ready to start call analysis';
        } else {
            this.zoomStatus.className = 'status-card inactive';
            this.zoomStatusTitle.textContent = 'No Zoom Meeting';
            this.zoomStatusDescription.textContent = 'Join a Zoom meeting to start analysis';
        }

        this.updateButtonStates();
        this.updateAnalysisStatus();
    }

    updateButtonStates() {
        const isConnected = this.connectionStatus.classList.contains('connected');
        
        // Start button: enabled if zoom detected, not in call, connected, and not currently starting
        this.startAnalysisBtn.disabled = !this.zoomDetected || this.isCallActive || !isConnected || this.isStartingCall;
        
        // Stop button: enabled if in call and not currently stopping
        this.stopAnalysisBtn.disabled = !this.isCallActive || this.isStoppingCall;
        
        // Update button text based on state
        if (this.isStartingCall) {
            this.startAnalysisBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                </svg>
                Starting...
            `;
        } else if (!this.isCallActive) {
            this.startAnalysisBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5,3 19,12 5,21"/>
                </svg>
                Start Analysis
            `;
        }
        
        if (this.isStoppingCall) {
            this.stopAnalysisBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6l4 2"/>
                </svg>
                Stopping...
            `;
        } else if (!this.isCallActive) {
            this.stopAnalysisBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="6" y="6" width="12" height="12"/>
                </svg>
                Stop Analysis
            `;
        }
    }

    updateAnalysisStatus() {
        if (this.isCallActive) {
            this.analysisStatus.className = 'analysis-status active';
            this.analysisStatus.querySelector('p').textContent = 'Call analysis is active - check web app for real-time insights';
        } else if (this.isStartingCall) {
            this.analysisStatus.className = 'analysis-status';
            this.analysisStatus.querySelector('p').textContent = 'Starting call analysis - waiting for web app confirmation...';
        } else if (this.isStoppingCall) {
            this.analysisStatus.className = 'analysis-status';
            this.analysisStatus.querySelector('p').textContent = 'Stopping call analysis - waiting for web app confirmation...';
        } else if (this.zoomDetected) {
            this.analysisStatus.className = 'analysis-status';
            this.analysisStatus.querySelector('p').textContent = 'Ready to start call analysis';
        } else {
            this.analysisStatus.className = 'analysis-status';
            this.analysisStatus.querySelector('p').textContent = 'Join a Zoom meeting to enable call analysis';
        }
    }

    updateAudioLevels(levels) {
        // Update input level
        if (this.inputLevel && this.inputLevelText) {
            this.inputLevel.style.width = `${Math.min(levels.input, 100)}%`;
            this.inputLevelText.textContent = `${Math.round(levels.input)}%`;
        }
        
        // Update output level
        if (this.outputLevel && this.outputLevelText) {
            this.outputLevel.style.width = `${Math.min(levels.output, 100)}%`;
            this.outputLevelText.textContent = `${Math.round(levels.output)}%`;
        }

        // Update system audio level
        if (this.systemAudioLevel && this.systemAudioLevelText) {
            this.systemAudioLevel.style.width = `${Math.min(levels.systemAudio || 0, 100)}%`;
            this.systemAudioLevelText.textContent = `${Math.round(levels.systemAudio || 0)}%`;
        }
    }

    async selectInputDevice(deviceId) {
        try {
            await ipcRenderer.invoke('select-input-device', deviceId);
            this.selectedDevices.input = deviceId;
            this.showNotification('Input Device Changed', `Selected: ${this.getDeviceName('input', deviceId)}`, 'success');
        } catch (error) {
            console.error('Error selecting input device:', error);
            this.showNotification('Error', 'Failed to change input device', 'error');
        }
    }

    async selectOutputDevice(deviceId) {
        try {
            await ipcRenderer.invoke('select-output-device', deviceId);
            this.selectedDevices.output = deviceId;
            
            const deviceName = this.getDeviceName('output', deviceId);
            
            // Show success notification
            this.showNotification('Output Device Changed', `Selected: ${deviceName}`, 'success');
            
            // Show important system audio routing notification
            this.showSystemAudioRoutingNotification(deviceName);
            
        } catch (error) {
            console.error('Error selecting output device:', error);
            this.showNotification('Error', 'Failed to change output device', 'error');
        }
    }

    showSystemAudioRoutingNotification(deviceName) {
        // Create a special notification for system audio routing guidance
        const notification = document.createElement('div');
        notification.className = 'notification info system-audio-notification';
        notification.innerHTML = `
            <div class="notification-header">
                <h4>🔊 System Audio Routing</h4>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="notification-content">
                <p><strong>Important:</strong> To ensure Zoom audio from other participants is captured correctly when using "Screen 1" as your system audio source, please also set <strong>${deviceName}</strong> as your default audio output in macOS System Settings.</p>
                <div class="notification-steps">
                    <p><strong>Quick Steps:</strong></p>
                    <ol>
                        <li>Open System Settings → Sound</li>
                        <li>Set Output to: <strong>${deviceName}</strong></li>
                        <li>This ensures system audio capture includes all Zoom participants</li>
                    </ol>
                </div>
                <div class="notification-actions">
                    <button onclick="this.openSystemSettings()" class="notification-btn">Open System Settings</button>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" class="notification-btn secondary">Got it</button>
                </div>
            </div>
        `;

        // Add click handler for opening system settings
        const openSettingsBtn = notification.querySelector('.notification-btn');
        if (openSettingsBtn) {
            openSettingsBtn.addEventListener('click', () => {
                // Open macOS Sound settings
                shell.openExternal('x-apple.systempreferences:com.apple.preference.sound');
            });
        }

        this.notifications.appendChild(notification);

        // Auto-remove after 15 seconds (longer than normal due to importance)
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 15000);
    }

    async selectSystemAudioSource(sourceId) {
        try {
            await ipcRenderer.invoke('select-system-audio-source', sourceId);
            this.selectedSystemAudioSource = sourceId;
            this.showNotification('System Audio Source Changed', `Selected: ${this.getSystemAudioSourceName(sourceId)}`, 'success');
        } catch (error) {
            console.error('Error selecting system audio source:', error);
            this.showNotification('Error', 'Failed to change system audio source', 'error');
        }
    }

    getDeviceName(type, deviceId) {
        const device = this.audioDevices[type]?.find(d => d.id === deviceId);
        return device ? device.name : 'Unknown Device';
    }

    getSystemAudioSourceName(sourceId) {
        const source = this.systemAudioSources?.find(s => s.id === sourceId);
        return source ? `${source.name} (${source.type})` : 'Unknown Source';
    }

    async startCallAnalysis() {
        if (this.isStartingCall) return;
        
        try {
            this.isStartingCall = true;
            this.updateButtonStates();
            this.updateAnalysisStatus();

            const result = await ipcRenderer.invoke('start-call-analysis', {
                inputDeviceId: this.selectedDevices.input,
                outputDeviceId: this.selectedDevices.output,
                systemAudioSourceId: this.selectedSystemAudioSource
            });
            
            if (!result.success) {
                throw new Error(result.message || 'Failed to start call analysis');
            }
            
            // Note: We don't set isCallActive here - we wait for the main process to confirm
            // via the zoom-status-changed event when it receives web app confirmation
            
            // Set up audio debug if enabled
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

    async stopCallAnalysis() {
        if (this.isStoppingCall) return;
        
        try {
            this.isStoppingCall = true;
            this.updateButtonStates();
            this.updateAnalysisStatus();

            const result = await ipcRenderer.invoke('stop-call-analysis');
            
            if (!result.success) {
                throw new Error(result.message || 'Failed to stop call analysis');
            }
            
            // Note: We don't set isCallActive here - we wait for the main process to confirm
            // via the zoom-status-changed event when it receives web app confirmation
            
            // Clean up audio debug
            this.cleanupAudioDebug();
            
        } catch (error) {
            console.error('Error stopping call analysis:', error);
            this.showNotification('Error', error.message || 'Failed to stop call analysis', 'error');
            this.isStoppingCall = false;
            this.updateButtonStates();
            this.updateAnalysisStatus();
        }
    }

    setupAudioDebug() {
        console.log('🎧 Setting up audio debug playback');
        
        // Reset audio chunks array
        this.audioChunks = [];
        
        // Set up WebSocket for audio data
        if (window.closeFlowWebSocket) {
            // Add event listener for audio data
            const originalSend = window.closeFlowWebSocket.send;
            window.closeFlowWebSocket.send = (data) => {
                // Call the original send method
                originalSend.call(window.closeFlowWebSocket, data);
                
                // If it's binary data (audio) and playback is enabled, process it
                if (data instanceof Blob && this.audioPlaybackEnabled) {
                    this.processAudioChunk(data);
                }
            };
            
            console.log('🎧 Audio debug setup complete - WebSocket send method overridden');
        } else {
            console.log('⚠️ Cannot set up audio debug - WebSocket not found');
        }
    }
    
    processAudioChunk(chunk) {
        // Add the chunk to our array
        this.audioChunks.push(chunk);
        
        // Keep only the last 10 chunks to avoid memory issues
        if (this.audioChunks.length > 10) {
            this.audioChunks.shift();
        }
        
        // Create a new blob from all chunks
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
        
        // Create a URL for the blob
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Set the audio player source
        this.debugAudioPlayer.src = audioUrl;
        
        // CRITICAL FIX: Explicitly call play() to ensure audio playback starts
        this.debugAudioPlayer.play().catch(error => {
            console.log('🎧 Audio play failed (this is normal for some chunks):', error.message);
        });
        
        // Clean up old URLs to avoid memory leaks
        setTimeout(() => {
            URL.revokeObjectURL(audioUrl);
        }, 5000);
    }
    
    cleanupAudioDebug() {
        console.log('🧹 Cleaning up audio debug');
        
        // Reset audio chunks
        this.audioChunks = [];
        
        // Reset audio player
        if (this.debugAudioPlayer) {
            this.debugAudioPlayer.pause();
            this.debugAudioPlayer.src = '';
        }
        
        // Reset WebSocket send method if it was overridden
        if (window.closeFlowWebSocket && window.closeFlowWebSocket._originalSend) {
            window.closeFlowWebSocket.send = window.closeFlowWebSocket._originalSend;
            delete window.closeFlowWebSocket._originalSend;
        }
    }

    showNotification(title, message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <h4>${title}</h4>
            <p>${message}</p>
        `;

        this.notifications.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);

        // Remove on click
        notification.addEventListener('click', () => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        });
    }

    showSettings() {
        this.showNotification('Settings', 'Settings panel coming soon!', 'info');
    }
}

// Initialize the renderer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DesktopRenderer();
});