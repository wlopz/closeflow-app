import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Separate in-memory stores for bidirectional communication
let webAppToDesktopMessages: any[] = []; // Messages from web app TO desktop app
let desktopToWebAppMessages: any[] = []; // Messages from desktop app TO web app
let webAppCallActive = false;
let lastDesktopPing = 0;

// Handle messages from desktop app
function handleDesktopMessage(message: any) {
  console.log('📱 ENHANCED LOGGING: Received from desktop:', message);
  console.log('📱 ENHANCED LOGGING: Message type:', message.type);
  console.log('📱 ENHANCED LOGGING: Current timestamp:', Date.now());
  console.log('📱 ENHANCED LOGGING: Current desktopToWebAppMessages array length BEFORE processing:', desktopToWebAppMessages.length);
  
  switch (message.type) {
    case 'start-call-analysis':
      console.log('🎯 ENHANCED LOGGING: Desktop requested call analysis start');
      console.log('🎯 ENHANCED LOGGING: Device settings received:', message.deviceSettings);
      console.log('🎯 ENHANCED LOGGING: Message timestamp:', message.timestamp);
      
      // Store the message for web app to pick up with a unique ID
      const startMessage = {
        id: uuidv4(), // Add unique ID for message acknowledgment
        type: 'desktop-call-started',
        deviceSettings: message.deviceSettings,
        timestamp: message.timestamp
      };
      
      console.log('🎯 ENHANCED LOGGING: About to push message to desktopToWebAppMessages array');
      console.log('🎯 ENHANCED LOGGING: Message to be stored:', startMessage);
      
      desktopToWebAppMessages.push(startMessage);
      
      console.log('🎯 ENHANCED LOGGING: Message pushed successfully');
      console.log('🎯 ENHANCED LOGGING: desktopToWebAppMessages array length AFTER push:', desktopToWebAppMessages.length);
      console.log('🎯 ENHANCED LOGGING: Current desktopToWebAppMessages array contents:', desktopToWebAppMessages);
      
      return { success: true, message: 'Call analysis request received' };

    case 'stop-call-analysis':
      console.log('🛑 ENHANCED LOGGING: Desktop requested call analysis stop');
      console.log('🛑 ENHANCED LOGGING: Message timestamp:', message.timestamp);
      
      webAppCallActive = false;
      
      // Store the message for web app to pick up with a unique ID
      const stopMessage = {
        id: uuidv4(), // Add unique ID for message acknowledgment
        type: 'desktop-call-stopped',
        timestamp: message.timestamp
      };
      
      console.log('🛑 ENHANCED LOGGING: About to push stop message to desktopToWebAppMessages array');
      desktopToWebAppMessages.push(stopMessage);
      console.log('🛑 ENHANCED LOGGING: Stop message pushed, array length now:', desktopToWebAppMessages.length);
      
      return { success: true, message: 'Call analysis stopped' };

    case 'ping':
      console.log('🏓 ENHANCED LOGGING: Received ping from desktop');
      lastDesktopPing = Date.now();
      console.log('🏓 ENHANCED LOGGING: Updated lastDesktopPing to:', lastDesktopPing);
      return { success: true, message: 'pong' };

    default:
      console.log('❓ ENHANCED LOGGING: Unknown message type from desktop:', message.type);
      console.log('❓ ENHANCED LOGGING: Full unknown message:', message);
      return { success: false, message: 'Unknown message type' };
  }
}

// HTTP endpoints for communication
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  console.log('🌐 ENHANCED LOGGING: GET request received');
  console.log('🌐 ENHANCED LOGGING: Action parameter:', action);
  console.log('🌐 ENHANCED LOGGING: Request URL:', request.url);
  console.log('🌐 ENHANCED LOGGING: Current time:', new Date().toISOString());

  switch (action) {
    case 'status':
      const isDesktopConnected = (Date.now() - lastDesktopPing) < 10000; // 10 seconds timeout
      const statusResponse = {
        connected: isDesktopConnected,
        activeConnections: isDesktopConnected ? 1 : 0,
        serverRunning: true,
        callActive: webAppCallActive,
        pendingMessages: webAppToDesktopMessages.length, // Desktop checks this queue
        pendingWebAppMessages: desktopToWebAppMessages.length, // Web app checks this queue
        lastPing: lastDesktopPing
      };
      
      console.log('📊 ENHANCED LOGGING: Status request - returning status:', statusResponse);
      console.log('📊 ENHANCED LOGGING: Desktop connected calculation:', {
        currentTime: Date.now(),
        lastPing: lastDesktopPing,
        timeDiff: Date.now() - lastDesktopPing,
        threshold: 10000,
        isConnected: isDesktopConnected
      });
      console.log('📊 ENHANCED LOGGING: Current webAppToDesktopMessages array:', webAppToDesktopMessages);
      console.log('📊 ENHANCED LOGGING: Current desktopToWebAppMessages array:', desktopToWebAppMessages);
      
      return Response.json(statusResponse);

    case 'get-messages-for-webapp':
      console.log('📨 ENHANCED LOGGING: Get messages for web app request received');
      console.log('📨 ENHANCED LOGGING: Current desktopToWebAppMessages array length:', desktopToWebAppMessages.length);
      
      // Return pending messages from desktop to web app WITHOUT clearing them
      // They will be cleared when explicitly acknowledged
      const webAppMessages = [...desktopToWebAppMessages];
      console.log('📨 ENHANCED LOGGING: Messages to return to web app:', webAppMessages);
      
      const webAppMessagesResponse = { messages: webAppMessages };
      console.log('📨 ENHANCED LOGGING: Returning response to web app:', webAppMessagesResponse);
      
      return Response.json(webAppMessagesResponse);

    case 'get-messages-for-desktop':
      console.log('📨 ENHANCED LOGGING: Get messages for desktop request received');
      console.log('📨 ENHANCED LOGGING: Current webAppToDesktopMessages array length:', webAppToDesktopMessages.length);
      console.log('📨 ENHANCED LOGGING: Messages to return to desktop:', webAppToDesktopMessages);
      
      // Return pending messages from web app to desktop and clear them
      const desktopMessages = [...webAppToDesktopMessages];
      console.log('📨 ENHANCED LOGGING: Created copy of messages for desktop:', desktopMessages);
      
      webAppToDesktopMessages = [];
      console.log('📨 ENHANCED LOGGING: Cleared webAppToDesktopMessages array, new length:', webAppToDesktopMessages.length);
      
      const desktopMessagesResponse = { messages: desktopMessages };
      console.log('📨 ENHANCED LOGGING: Returning response to desktop:', desktopMessagesResponse);
      
      return Response.json(desktopMessagesResponse);

    case 'trigger-start':
      console.log('🚀 ENHANCED LOGGING: Trigger start request from web app');
      // Trigger call start from web app
      webAppCallActive = true;
      webAppToDesktopMessages.push({
        type: 'web-call-started',
        timestamp: Date.now()
      });
      console.log('🚀 ENHANCED LOGGING: Added web-call-started message, array length:', webAppToDesktopMessages.length);
      return Response.json({ success: true, message: 'Start signal sent to desktop' });

    case 'trigger-stop':
      console.log('🛑 ENHANCED LOGGING: Trigger stop request from web app');
      // Trigger call stop from web app
      webAppCallActive = false;
      webAppToDesktopMessages.push({
        type: 'web-call-stopped',
        timestamp: Date.now()
      });
      console.log('🛑 ENHANCED LOGGING: Added web-call-stopped message, array length:', webAppToDesktopMessages.length);
      return Response.json({ success: true, message: 'Stop signal sent to desktop' });

    default:
      console.log('❓ ENHANCED LOGGING: Invalid GET action:', action);
      return Response.json({ 
        error: 'Invalid action',
        availableActions: ['status', 'get-messages-for-webapp', 'get-messages-for-desktop', 'trigger-start', 'trigger-stop']
      });
  }
}

export async function POST(request: NextRequest) {
  console.log('📮 ENHANCED LOGGING: POST request received');
  console.log('📮 ENHANCED LOGGING: Request URL:', request.url);
  console.log('📮 ENHANCED LOGGING: Request headers:', Object.fromEntries(request.headers.entries()));
  
  try {
    const body = await request.json();
    console.log('📮 ENHANCED LOGGING: POST request body parsed successfully');
    console.log('📮 ENHANCED LOGGING: Request body:', body);
    console.log('📮 ENHANCED LOGGING: Message type:', body.type);

    switch (body.type) {
      case 'start-call-analysis':
      case 'stop-call-analysis':
      case 'ping':
        console.log('📮 ENHANCED LOGGING: Handling desktop message via POST');
        // Handle desktop messages
        const result = handleDesktopMessage(body);
        console.log('📮 ENHANCED LOGGING: Desktop message handled, result:', result);
        return Response.json(result);

      case 'message-ack':
        // New endpoint to acknowledge message processing
        console.log('✅ ENHANCED LOGGING: Message acknowledgment received');
        console.log('✅ ENHANCED LOGGING: Message ID to acknowledge:', body.messageId);
        
        if (!body.messageId) {
          console.log('❌ ENHANCED LOGGING: No message ID provided for acknowledgment');
          return Response.json({ error: 'No message ID provided' }, { status: 400 });
        }
        
        console.log('✅ ENHANCED LOGGING: Current desktopToWebAppMessages length before removal:', desktopToWebAppMessages.length);
        
        // Remove the acknowledged message from the queue
        desktopToWebAppMessages = desktopToWebAppMessages.filter(msg => msg.id !== body.messageId);
        
        console.log('✅ ENHANCED LOGGING: Message removed from queue');
        console.log('✅ ENHANCED LOGGING: Current desktopToWebAppMessages length after removal:', desktopToWebAppMessages.length);
        
        return Response.json({ success: true, message: 'Message acknowledged and removed from queue' });

      case 'web-app-call-started-confirmation':
        console.log('✅ ENHANCED LOGGING: Web app confirmed call analysis started');
        console.log('✅ ENHANCED LOGGING: Confirmation timestamp:', body.timestamp || Date.now());
        
        webAppCallActive = true;
        // Store confirmation for desktop to pick up
        const startConfirmation = {
          type: 'web-app-call-started-confirmation',
          timestamp: Date.now()
        };
        
        console.log('✅ ENHANCED LOGGING: Adding start confirmation to webAppToDesktopMessages array');
        webAppToDesktopMessages.push(startConfirmation);
        console.log('✅ ENHANCED LOGGING: Start confirmation added, array length:', webAppToDesktopMessages.length);
        console.log('✅ ENHANCED LOGGING: Current webAppToDesktopMessages array:', webAppToDesktopMessages);
        
        return Response.json({ success: true });

      case 'web-app-call-stopped-confirmation':
        console.log('✅ ENHANCED LOGGING: Web app confirmed call analysis stopped');
        console.log('✅ ENHANCED LOGGING: Stop confirmation timestamp:', body.timestamp || Date.now());
        
        webAppCallActive = false;
        // Store confirmation for desktop to pick up
        const stopConfirmation = {
          type: 'web-app-call-stopped-confirmation',
          timestamp: Date.now()
        };
        
        console.log('✅ ENHANCED LOGGING: Adding stop confirmation to webAppToDesktopMessages array');
        webAppToDesktopMessages.push(stopConfirmation);
        console.log('✅ ENHANCED LOGGING: Stop confirmation added, array length:', webAppToDesktopMessages.length);
        console.log('✅ ENHANCED LOGGING: Current webAppToDesktopMessages array:', webAppToDesktopMessages);
        
        return Response.json({ success: true });

      case 'insight-generated':
        console.log('🧠 ENHANCED LOGGING: Insight generated by web app');
        console.log('🧠 ENHANCED LOGGING: Insight content:', body.content);
        console.log('🧠 ENHANCED LOGGING: Insight type:', body.insightType);
        
        // Store insight for desktop to pick up
        webAppToDesktopMessages.push({
          type: 'insight-generated',
          content: body.content,
          insightType: body.insightType,
          timestamp: Date.now()
        });
        console.log('🧠 ENHANCED LOGGING: Insight added to webAppToDesktopMessages, array length:', webAppToDesktopMessages.length);
        return Response.json({ success: true });

      case 'call-status-update':
        console.log('📞 ENHANCED LOGGING: Call status update received');
        console.log('📞 ENHANCED LOGGING: Status:', body.status);
        console.log('📞 ENHANCED LOGGING: Call ID:', body.callId);
        
        // Store status update for desktop to pick up
        webAppToDesktopMessages.push({
          type: 'call-status-update',
          status: body.status,
          callId: body.callId,
          timestamp: Date.now()
        });
        console.log('📞 ENHANCED LOGGING: Status update added to webAppToDesktopMessages, array length:', webAppToDesktopMessages.length);
        return Response.json({ success: true });

      default:
        console.log('❓ ENHANCED LOGGING: Unknown POST message type:', body.type);
        console.log('❓ ENHANCED LOGGING: Full POST body:', body);
        return Response.json({ error: 'Unknown message type' }, { status: 400 });
    }
  } catch (error) {
  console.error('❌ ENHANCED LOGGING: Error handling POST request:', error);

  if (error instanceof Error) {
    console.error('❌ ENHANCED LOGGING: Error name:', error.name);
    console.error('❌ ENHANCED LOGGING: Error message:', error.message);
    console.error('❌ ENHANCED LOGGING: Error stack:', error.stack);
  } else {
    console.error('❌ ENHANCED LOGGING: Unknown error type:', JSON.stringify(error));
  }

  return Response.json({ error: 'Internal server error' }, { status: 500 });
}
}