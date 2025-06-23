// Minimal test application to isolate desktopCapturer issues
const { app, BrowserWindow, desktopCapturer, ipcMain } = require('electron');
const path = require('path');

class DesktopCapturerTest {
  constructor() {
    this.mainWindow = null;
  }

  async createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 600,
      height: 400,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true
      },
      title: 'Desktop Capturer Test'
    });

    // Load a simple HTML page
    this.mainWindow.loadFile('test-desktop-capturer.html');

    this.mainWindow.webContents.openDevTools();
  }

  async testDesktopCapturer() {
    console.log('🔍 Testing desktopCapturer...');
    
    try {
      const sources = await desktopCapturer.getSources({
        types: ['window', 'screen'],
        fetchWindowIcons: false
      });

      console.log('✅ desktopCapturer.getSources() successful');
      console.log('📊 Found sources:', sources.length);
      
      sources.forEach((source, index) => {
        console.log(`${index + 1}. ${source.name} (${source.id})`);
      });

      // Find Zoom meeting window
      const zoomSource = sources.find(source => 
        source.name.toLowerCase().includes('zoom meeting') ||
        source.name.toLowerCase().includes('zoom.us')
      );

      if (zoomSource) {
        console.log('🎯 Found Zoom source:', zoomSource.name, zoomSource.id);
        await this.testGetUserMedia(zoomSource.id);
      } else {
        console.log('⚠️ No Zoom meeting window found, testing with first window source');
        const windowSource = sources.find(source => source.id.startsWith('window:'));
        if (windowSource) {
          await this.testGetUserMedia(windowSource.id);
        }
      }

    } catch (error) {
      console.error('❌ desktopCapturer test failed:', error);
    }
  }

  async testGetUserMedia(sourceId) {
    console.log('🎤 Testing getUserMedia with source:', sourceId);

    const result = await this.mainWindow.webContents.executeJavaScript(`
      (async () => {
        try {
          console.log('🎤 Testing getUserMedia in renderer...');
          
          // FIXED: Use the supported getUserMedia API format
          const constraints = {
            audio: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: '${sourceId}'
            },
            video: false
          };
          
          console.log('🎤 Using constraints:', constraints);
          
          const stream = await navigator.mediaDevices.getUserMedia(constraints);

          console.log('✅ getUserMedia successful!');
          console.log('Stream:', stream);
          console.log('Audio tracks:', stream.getAudioTracks().length);
          
          // Test MediaRecorder
          const mediaRecorder = new MediaRecorder(stream);
          console.log('✅ MediaRecorder created successfully');
          
          // Clean up
          stream.getTracks().forEach(track => track.stop());
          
          return { success: true, audioTracks: stream.getAudioTracks().length };
        } catch (error) {
          console.error('❌ getUserMedia test failed:', error);
          return { 
            success: false, 
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack
            }
          };
        }
      })()
    `);

    if (result.success) {
      console.log('✅ getUserMedia test successful! Audio tracks:', result.audioTracks);
    } else {
      console.error('❌ getUserMedia test failed:', result.error);
    }
  }
}

// App event handlers
app.whenReady().then(async () => {
  const test = new DesktopCapturerTest();
  await test.createWindow();
  
  // Wait a bit for window to load, then run tests
  setTimeout(() => {
    test.testDesktopCapturer();
  }, 2000);
});

app.on('window-all-closed', () => {
  app.quit();
});