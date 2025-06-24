# CloseFlow Desktop App

A native macOS desktop application that integrates with the CloseFlow web app to provide seamless Zoom meeting detection and call analysis.

## Features

- **Zoom Meeting Detection**: Automatically detects when you're in an active Zoom meeting
- **Audio Device Management**: Select and monitor input/output devices with live level indicators
- **One-Click Call Analysis**: Start call analysis directly from the desktop app
- **Web App Integration**: Communicates with your web app via WebSocket for seamless data flow
- **System Tray Integration**: Runs in background with quick access from menu bar
- **Native macOS Experience**: Beautiful glassmorphism UI that feels native to macOS
- **Environment-Aware**: Automatically configures for development or production environments

## Prerequisites

- macOS 10.14 or later
- Node.js 16 or later
- CloseFlow web app running (localhost for development, or deployed URL for production)

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

This automatically sets the web app URL to `http://localhost:3000` and starts the desktop app in development mode.

### Environment Configuration

The desktop app automatically configures the web app URL based on the environment:

#### Development (Default)
- **URL**: `http://localhost:3000`
- **Usage**: `npm run dev`
- **Environment Variable**: Automatically set by the dev script

#### Production
- **URL**: Set via `CLOSEFLOW_WEB_APP_URL` environment variable
- **Usage**: Set the environment variable before building or running
- **Example**: 
  ```bash
  export CLOSEFLOW_WEB_APP_URL=https://your-netlify-app.netlify.app
  npm start
  ```

#### Manual Override
You can also override the URL using a command line argument:
```bash
electron . --web-app-url=https://custom-domain.com
```

### Build for distribution:

#### Development Build
```bash
npm run build:mac
```

#### Production Build
```bash
export CLOSEFLOW_WEB_APP_URL=https://your-netlify-app.netlify.app
npm run build:production
```

This will create a DMG file in the `dist` folder with the production web app URL embedded.

## Usage

1. **Start the desktop app**
2. **Ensure your CloseFlow web app is running** 
   - Development: `http://localhost:3000`
   - Production: Your deployed Netlify URL
3. **Join a Zoom meeting** - the app will automatically detect it
4. **Select your audio devices** from the dropdown menus
5. **Click "Start Analysis"** when ready to begin call analysis
6. **Monitor the web app** for real-time transcription and AI insights
7. **Click "Stop Analysis"** when the call is complete

## Environment Variables

### `CLOSEFLOW_WEB_APP_URL`
- **Purpose**: Sets the URL of the CloseFlow web application
- **Development**: Automatically set to `http://localhost:3000` by the dev script
- **Production**: Must be set to your deployed web app URL
- **Example**: `https://your-closeflow-app.netlify.app`

### Setting Environment Variables

#### For Development
The `npm run dev` script automatically sets the correct URL:
```bash
npm run dev  # Automatically uses http://localhost:3000
```

#### For Production Builds
Set the environment variable before building:
```bash
# macOS/Linux
export CLOSEFLOW_WEB_APP_URL=https://your-netlify-app.netlify.app
npm run build:production

# Windows
set CLOSEFLOW_WEB_APP_URL=https://your-netlify-app.netlify.app
npm run build:production
```

#### For Production Runtime
If you're distributing the app and want users to configure their own URL:
```bash
export CLOSEFLOW_WEB_APP_URL=https://your-netlify-app.netlify.app
./CloseFlow.app/Contents/MacOS/CloseFlow
```

## Architecture

### Main Process (`src/main.js`)
- Handles Zoom detection using AppleScript and process monitoring
- Manages audio device enumeration and monitoring
- Establishes WebSocket connection to web app
- Handles system tray and window management
- **NEW**: Dynamic web app URL configuration based on environment

### Renderer Process (`src/renderer/`)
- Beautiful native UI with glassmorphism design
- Real-time status updates and audio level visualization
- User interaction handling and device selection
- Notification system for user feedback

### Web App Integration
- WebSocket communication on port 8080 (always localhost for the internal server)
- HTTP communication with web app at configured URL
- Real-time synchronization of call status
- Automatic triggering of web app call analysis
- Bidirectional messaging for insights and status updates

## Configuration Examples

### Development Setup
```bash
# Terminal 1: Start web app
cd /path/to/closeflow-web-app
npm run dev  # Runs on http://localhost:3000

# Terminal 2: Start desktop app
cd /path/to/closeflow-web-app/desktop-app
npm run dev  # Automatically connects to http://localhost:3000
```

### Production Setup
```bash
# Set your deployed web app URL
export CLOSEFLOW_WEB_APP_URL=https://my-closeflow-app.netlify.app

# Start the desktop app
npm start

# Or build for distribution
npm run build:production
```

### Netlify Deployment Integration
When deploying to Netlify, you can set the environment variable in your build settings:
- **Variable Name**: `CLOSEFLOW_WEB_APP_URL`
- **Value**: `https://your-app-name.netlify.app`

## Troubleshooting

### Connection Issues
- **Development**: Ensure the web app is running on `http://localhost:3000`
- **Production**: Verify the `CLOSEFLOW_WEB_APP_URL` environment variable is set correctly
- Check the desktop app logs for the configured web app URL
- Verify the web app is accessible from your browser at the configured URL

### Environment Variable Issues
- Check that the environment variable is set: `echo $CLOSEFLOW_WEB_APP_URL`
- Restart the desktop app after changing environment variables
- For production builds, ensure the variable is set during the build process

### URL Configuration Debug
The desktop app logs the configured web app URL on startup:
```
🌐 ENHANCED LOGGING: Web app URL configured as: https://your-app.netlify.app
```

Check the console output to verify the correct URL is being used.

## Security

The app includes proper entitlements for macOS security:
- Microphone access for audio monitoring
- Network access for WebSocket and HTTP communication with web app
- AppleScript automation for Zoom detection

All permissions are declared in `entitlements.mac.plist` and will be properly signed when building for distribution.

## Future Enhancements

- Windows support
- Multiple meeting platform support (Teams, Google Meet, etc.)
- Advanced audio processing and noise cancellation
- Custom hotkeys and shortcuts
- Meeting recording integration
- Team collaboration features
- Automatic web app URL discovery

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Verify all prerequisites are met
3. Check the console logs for error messages and URL configuration
4. Ensure the web app WebSocket endpoint is properly configured
5. Verify environment variables are set correctly for your deployment scenario