# CloseFlow - AI-Powered Sales Assistant

Where sales flow with soul and structure. Real-time AI guidance that helps you close deals with authenticity.

## Overview

CloseFlow is a comprehensive sales assistance platform that combines a Next.js web application with a native macOS desktop app to provide real-time AI-powered coaching during sales calls. The system captures audio from Zoom meetings, transcribes conversations in real-time, and provides intelligent coaching insights to help sales professionals improve their performance.

## Architecture

### System Components

1. **Web Application** (Next.js + Supabase)
   - Real-time call analysis dashboard
   - AI coaching insights display
   - Call history and analytics
   - User authentication and profiles
   - WebSocket server for audio processing

2. **Desktop Application** (Electron + macOS)
   - Zoom meeting detection
   - System audio capture
   - Native macOS integration
   - Direct communication with web app

3. **AI Services**
   - OpenAI Whisper for speech-to-text
   - OpenAI GPT-4 for conversation analysis
   - Deepgram for real-time transcription

## Features

- **Real-time Call Analysis**: Live transcription and AI coaching during sales calls
- **Zoom Integration**: Automatic detection of Zoom meetings and system audio capture
- **AI Coaching**: Intelligent insights for objection handling, buying signals, and next steps
- **Call History**: Complete records with transcripts, insights, and behavioral analysis
- **Practice Mode**: AI-simulated scenarios for skill improvement
- **Team Analytics**: Performance tracking and improvement metrics
- **Native macOS App**: Seamless integration with system audio and Zoom

## Prerequisites

### System Requirements
- **macOS**: 10.14 or later (for desktop app)
- **Node.js**: 16 or later
- **Zoom**: Desktop application installed and running
- **Internet Connection**: Required for AI services

### Required Accounts & API Keys
- **Supabase**: Database and authentication
- **OpenAI**: GPT-4 API access for conversation analysis
- **Deepgram**: Real-time transcription service

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd closeflow-app
```

### 2. Web Application Setup

#### Install Dependencies
```bash
npm install
```

#### Environment Configuration
1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Configure your `.env` file with the following variables:
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key_here

   # Deepgram Configuration
   NEXT_PUBLIC_DEEPGRAM_API_KEY=your_deepgram_api_key_here
   ```

#### Database Setup
1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the database migration:
   ```bash
   # The migration file is located at: supabase/migrations/20250612205759_cool_surf.sql
   # Apply this migration in your Supabase dashboard or using the Supabase CLI
   ```

### 3. Desktop Application Setup

#### Navigate to Desktop App Directory
```bash
cd desktop-app
```

#### Install Desktop Dependencies
```bash
npm install
```

#### Grant macOS Permissions
The desktop app requires several macOS permissions:
- **Microphone Access**: For audio level monitoring
- **Screen Recording**: For detecting Zoom meetings and capturing system audio
- **Accessibility**: For AppleScript automation

These permissions will be requested automatically when the app first runs.

## Running the Application

### Complete Setup Process

1. **Start the Web Application**
   ```bash
   # From the project root
   npm run dev
   ```
   The web app will be available at `http://localhost:3000`

2. **Start the Desktop Application**
   ```bash
   # From the desktop-app directory
   cd desktop-app
   npm run dev
   ```

3. **Join a Zoom Meeting**
   - Start or join a Zoom meeting on the same machine
   - The desktop app will automatically detect the active meeting

4. **Begin Call Analysis**
   - In the desktop app, select your audio devices
   - Choose a system audio source (screen or Zoom window)
   - Click "Start Analysis" when ready
   - Monitor real-time insights in the web app at `http://localhost:3000/dashboard/calls`

### Development Workflow

#### Web Application Development
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

#### Desktop Application Development
```bash
# Start in development mode
npm run dev

# Test desktop capturer functionality
npm run test-capturer

# Build for distribution
npm run build:mac
```

## Usage Guide

### Starting a Call Analysis Session

1. **Preparation**
   - Ensure both web and desktop apps are running
   - Join a Zoom meeting
   - Verify desktop app shows "Zoom Meeting Detected"

2. **Device Configuration**
   - Select your microphone from the input device dropdown
   - Select your speakers from the output device dropdown
   - Choose a system audio source (preferably a "Screen" source for better stability)

3. **Begin Analysis**
   - Click "Start Analysis" in the desktop app
   - Wait for confirmation that the web app is connected
   - Monitor real-time transcription and AI insights in the web browser

4. **During the Call**
   - View live transcription in the web app
   - Receive AI coaching insights for objections, opportunities, and buying signals
   - Audio levels are monitored in the desktop app

5. **End Analysis**
   - Click "Stop Analysis" in the desktop app
   - Complete the call feedback form in the web app
   - Review behavioral analysis and insights

### Web Application Features

#### Dashboard
- Overview of call metrics and performance
- Recent call history
- Performance analytics and trends

#### Live Call Interface
- Real-time transcription display
- AI coaching insights panel
- Speaker identification and conversation flow
- Insight categorization (objections, opportunities, buying signals, etc.)

#### Call History
- Complete call records with transcripts
- AI insights and behavioral analysis
- Call outcome tracking and notes
- Performance metrics and close probability

#### Analytics
- Close rate tracking
- Call duration analysis
- AI coaching effectiveness
- Behavioral pattern recognition

### Desktop Application Features

#### Zoom Detection
- Automatic detection of active Zoom meetings
- Real-time status updates
- Meeting window identification

#### Audio Management
- Input/output device selection
- Real-time audio level monitoring
- System audio source selection with prioritization
- Audio quality indicators

#### System Integration
- Native macOS notifications
- System tray integration
- Background operation
- Automatic startup options

## Troubleshooting

### Common Issues

#### Desktop App Issues

**Zoom Detection Not Working**
- Ensure Screen Recording permission is granted in System Preferences > Security & Privacy
- Verify Zoom is in an active meeting (not just running)
- Check that Zoom window titles contain "Zoom Meeting" or "zoom.us"

**Audio Devices Not Showing**
- Check microphone permissions in System Preferences
- Restart the desktop app if devices were connected after launch
- Verify audio devices are properly connected to the system

**System Audio Capture Issues**
- Prefer "Screen" sources over "Window" sources for better stability
- Ensure the selected audio source is active and producing sound
- Try different system audio sources if capture fails
- Check that Zoom is actively playing audio

**WebSocket Connection Issues**
- Ensure the web app is running on `http://localhost:3000`
- Check that port 8080 is not blocked by firewall
- Restart both desktop and web apps if connection fails

#### Web Application Issues

**Transcription Not Appearing**
- Verify Deepgram API key is correctly configured
- Check browser console for WebSocket connection errors
- Ensure desktop app is successfully capturing audio

**AI Insights Not Generating**
- Verify OpenAI API key is correctly configured
- Check that transcription is working first
- Ensure conversation segments are long enough (minimum 30 characters)

**Database Connection Issues**
- Verify Supabase URL and API keys are correct
- Check Supabase project status and quotas
- Ensure database migrations have been applied

### Performance Optimization

#### For Better Audio Capture
- Use "Screen" sources instead of "Window" sources when possible
- Ensure stable internet connection for real-time processing
- Close unnecessary applications to reduce system load
- Use wired audio devices when possible for better quality

#### For Better AI Performance
- Speak clearly and at moderate pace
- Minimize background noise
- Ensure good microphone quality
- Allow conversation segments to complete before expecting insights

### Debug Mode

#### Desktop App Debug
```bash
# Run with additional logging
npm run dev

# Test desktop capturer in isolation
npm run test-capturer
```

#### Web App Debug
- Open browser developer tools
- Check Network tab for WebSocket connections
- Monitor Console for error messages
- Verify API responses in Network tab

## Development

### Project Structure

```
closeflow-app/
├── app/                          # Next.js app directory
│   ├── api/                      # API routes
│   ├── auth/                     # Authentication pages
│   ├── dashboard/                # Dashboard pages
│   └── globals.css               # Global styles
├── components/                   # React components
│   ├── ui/                       # shadcn/ui components
│   └── dashboard/                # Dashboard-specific components
├── lib/                          # Utility libraries
│   └── supabase/                 # Supabase client and utilities
├── desktop-app/                  # Electron desktop application
│   ├── src/                      # Desktop app source code
│   ├── assets/                   # Desktop app assets
│   └── package.json              # Desktop app dependencies
├── supabase/                     # Database migrations
└── README.md                     # This file
```

### Key Technologies

- **Frontend**: Next.js 14, React 18, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API routes, Supabase
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **Desktop**: Electron, Node.js
- **AI Services**: OpenAI GPT-4, Deepgram
- **Real-time**: WebSockets, Supabase Realtime

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with both web and desktop apps
5. Submit a pull request

### Testing

#### Manual Testing Checklist

**Desktop App**
- [ ] Zoom meeting detection works
- [ ] Audio device selection functions
- [ ] System audio capture works
- [ ] WebSocket connection to web app succeeds
- [ ] Call start/stop triggers work correctly

**Web App**
- [ ] User authentication works
- [ ] Dashboard displays correctly
- [ ] Live call interface receives transcription
- [ ] AI insights generate and display
- [ ] Call history saves and displays
- [ ] Behavioral analysis calculates correctly

**Integration Testing**
- [ ] Desktop app triggers web app call analysis
- [ ] Real-time transcription flows from desktop to web
- [ ] AI insights generate based on transcription
- [ ] Call completion triggers feedback modal
- [ ] Data persists correctly in database

## Deployment

### Web Application Deployment

The web application is configured for deployment on Netlify:

```bash
# Build the application
npm run build

# Deploy to Netlify (configured in netlify.toml)
```

### Desktop Application Distribution

```bash
# Build for macOS distribution
cd desktop-app
npm run build:mac

# Creates a DMG file in the dist/ folder
```

## Security Considerations

- All API keys should be kept secure and not committed to version control
- Audio data is processed in real-time and not permanently stored
- User authentication is handled by Supabase with proper security measures
- Desktop app requires explicit user permissions for audio and screen access
- WebSocket connections use local-only communication for security

## Support

### Getting Help

1. Check this README for common issues and solutions
2. Review the troubleshooting section above
3. Check the browser console and desktop app logs for error messages
4. Ensure all prerequisites are met and properly configured

### Reporting Issues

When reporting issues, please include:

- Operating system version (macOS version)
- Node.js version
- Electron version (for desktop app issues)
- Browser version (for web app issues)
- Steps to reproduce the issue
- Error messages from console logs
- Whether the issue occurs with both web and desktop apps running

### System Requirements for Bug Reports

For testing and bug reproduction, ensure you have:
1. The web application running at `http://localhost:3000`
2. The desktop application running and connected
3. An active Zoom meeting for audio capture testing
4. All required permissions granted on macOS

## License

This project is proprietary software. All rights reserved.

## Changelog

### Version 1.0.0
- Initial release with web and desktop applications
- Real-time call analysis and AI coaching
- Zoom integration and system audio capture
- Complete call history and analytics
- Behavioral analysis and feedback system