import { NextRequest } from 'next/server';

// Simple in-memory store for desktop messages
let desktopMessages: any[] = [];
let webAppCallActive = false;
let lastDesktopPing = 0;

// Handle messages from desktop app
function handleDesktopMessage(message: any) {
  console.log('📱 Received from desktop:', message);
  
  switch (message.type) {
    case 'start-call-analysis':
      console.log('🎯 Desktop requested call analysis start');
      
      // Store the message for web app to pick up
      desktopMessages.push({
        type: 'desktop-call-started',
        deviceSettings: message.deviceSettings,
        timestamp: message.timestamp
      });
      
      return { success: true, message: 'Call analysis request received' };

    case 'stop-call-analysis':
      console.log('🛑 Desktop requested call analysis stop');
      webAppCallActive = false;
      
      // Store the message for web app to pick up
      desktopMessages.push({
        type: 'desktop-call-stopped',
        timestamp: message.timestamp
      });
      
      return { success: true, message: 'Call analysis stopped' };

    case 'ping':
      lastDesktopPing = Date.now();
      return { success: true, message: 'pong' };

    default:
      console.log('❓ Unknown message type from desktop:', message.type);
      return { success: false, message: 'Unknown message type' };
  }
}

// HTTP endpoints for communication
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  switch (action) {
    case 'status':
      const isDesktopConnected = (Date.now() - lastDesktopPing) < 10000; // 10 seconds timeout
      return Response.json({
        connected: isDesktopConnected,
        activeConnections: isDesktopConnected ? 1 : 0,
        serverRunning: true,
        callActive: webAppCallActive,
        pendingMessages: desktopMessages.length,
        lastPing: lastDesktopPing
      });

    case 'get-messages':
      // Return pending messages and clear them
      const messages = [...desktopMessages];
      desktopMessages = [];
      return Response.json({ messages });

    case 'trigger-start':
      // Trigger call start from web app
      webAppCallActive = true;
      desktopMessages.push({
        type: 'web-call-started',
        timestamp: Date.now()
      });
      return Response.json({ success: true, message: 'Start signal sent to desktop' });

    case 'trigger-stop':
      // Trigger call stop from web app
      webAppCallActive = false;
      desktopMessages.push({
        type: 'web-call-stopped',
        timestamp: Date.now()
      });
      return Response.json({ success: true, message: 'Stop signal sent to desktop' });

    default:
      return Response.json({ 
        error: 'Invalid action',
        availableActions: ['status', 'get-messages', 'trigger-start', 'trigger-stop']
      });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('📨 Received POST request:', body);

    switch (body.type) {
      case 'start-call-analysis':
      case 'stop-call-analysis':
      case 'ping':
        // Handle desktop messages
        const result = handleDesktopMessage(body);
        return Response.json(result);

      case 'web-app-call-started-confirmation':
        console.log('✅ Web app confirmed call analysis started');
        webAppCallActive = true;
        // Store confirmation for desktop to pick up
        desktopMessages.push({
          type: 'web-app-call-started-confirmation',
          timestamp: Date.now()
        });
        return Response.json({ success: true });

      case 'web-app-call-stopped-confirmation':
        console.log('✅ Web app confirmed call analysis stopped');
        webAppCallActive = false;
        // Store confirmation for desktop to pick up
        desktopMessages.push({
          type: 'web-app-call-stopped-confirmation',
          timestamp: Date.now()
        });
        return Response.json({ success: true });

      case 'insight-generated':
        // Store insight for desktop to pick up
        desktopMessages.push({
          type: 'insight-generated',
          content: body.content,
          insightType: body.insightType,
          timestamp: Date.now()
        });
        return Response.json({ success: true });

      case 'call-status-update':
        // Store status update for desktop to pick up
        desktopMessages.push({
          type: 'call-status-update',
          status: body.status,
          callId: body.callId,
          timestamp: Date.now()
        });
        return Response.json({ success: true });

      default:
        return Response.json({ error: 'Unknown message type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error handling POST request:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}