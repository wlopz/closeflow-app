# CloseFlow Desktop App

A native macOS desktop application that integrates with the CloseFlow web app to provide seamless Zoom meeting detection and call analysis.

## Features

- **Zoom Meeting Detection**: Automatically detects when you're in an active Zoom meeting
- **Audio Device Management**: Select and monitor input/output devices with live level indicators
- **One-Click Call Analysis**: Start call analysis directly from the desktop app
- **Web App Integration**: Communicates with your web app via WebSocket for seamless data flow
- **System Tray Integration**: Runs in background with quick access from menu bar
- **Native macOS Experience**: Beautiful glassmorphism UI that feels native to macOS

## Prerequisites

- macOS 10.14 or later
- Node.js 16 or later
- CloseFlow web app running on `http://localhost:3000`

## Installation

1. **Clone or download the desktop app folder**
2. **Install dependencies:**
   ```bash
   cd desktop-app
   npm install
   ```

3. **Grant necessary permissions:**
   - Microphone access (for audio monitoring)
   - Screen recording permission (for Zoom detection)
   - Accessibility permissions (for AppleScript automation)

## Development

### Run in development mode:
```bash
npm run dev
```

### Build for distribution:
```bash
npm run build:mac
```

This will create a DMG file in the `dist` folder.

## Usage

1. **Start the desktop app**
2. **Ensure your CloseFlow web app is running** at `http://localhost:3000`
3. **Join a Zoom meeting** - the app will automatically detect it
4. **Select your audio devices** from the dropdown menus
5. **Click "Start Analysis"** when ready to begin call analysis
6. **Monitor the web app** for real-time transcription and AI insights
7. **Click "Stop Analysis"** when the call is complete

## Architecture

### Main Process (`src/main.js`)
- Handles Zoom detection using AppleScript and process monitoring
- Manages audio device enumeration and monitoring
- Establishes WebSocket connection to web app
- Handles system tray and window management

### Renderer Process (`src/renderer/`)
- Beautiful native UI with glassmorphism design
- Real-time status updates and audio level visualization
- User interaction handling and device selection
- Notification system for user feedback

### Web App Integration
- WebSocket communication on port 8080
- Real-time synchronization of call status
- Automatic triggering of web app call analysis
- Bidirectional messaging for insights and status updates

## WebSocket API

### Messages from Desktop to Web App:
```javascript
{
  type: 'start-call-analysis',
  deviceSettings: { input: 'device-id', output: 'device-id' },
  timestamp: Date.now()
}

{
  type: 'stop-call-analysis',
  timestamp: Date.now()
}
```

### Messages from Web App to Desktop:
```javascript
{
  type: 'insight-generated',
  content: 'AI coaching insight',
  insightType: 'opportunity',
  timestamp: Date.now()
}

{
  type: 'call-status-update',
  status: 'started|ended',
  callId: 'uuid',
  timestamp: Date.now()
}
```

## Permissions

The app requires several macOS permissions to function properly:

- **Microphone**: For audio level monitoring
- **Screen Recording**: For detecting Zoom meeting windows
- **Accessibility**: For AppleScript automation

These permissions will be requested automatically when the app first runs.

## Troubleshooting

### Zoom Detection Not Working
- Ensure Screen Recording permission is granted
- Check that Zoom is actually in a meeting (not just running)
- Verify Zoom window titles contain "Zoom Meeting" or "zoom.us"

### Audio Devices Not Showing
- Check microphone permissions
- Restart the app if devices were connected after launch
- Verify audio devices are properly connected to the system

### WebSocket Connection Issues
- Ensure the CloseFlow web app is running on `http://localhost:3000`
- Check that port 8080 is not blocked by firewall
- Restart both the desktop app and web app if connection fails

### Build Issues
- Ensure all dependencies are installed: `npm install`
- Check that you have the latest version of Electron
- Verify macOS version compatibility

## Security

The app includes proper entitlements for macOS security:
- Microphone access for audio monitoring
- Network access for WebSocket communication
- AppleScript automation for Zoom detection

All permissions are declared in `entitlements.mac.plist` and will be properly signed when building for distribution.

## Future Enhancements

- Windows support
- Multiple meeting platform support (Teams, Google Meet, etc.)
- Advanced audio processing and noise cancellation
- Custom hotkeys and shortcuts
- Meeting recording integration
- Team collaboration features

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Verify all prerequisites are met
3. Check the console logs for error messages
4. Ensure the web app WebSocket endpoint is properly configured