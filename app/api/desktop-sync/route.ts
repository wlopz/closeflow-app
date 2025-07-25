import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

const DESKTOP_SYNC_STATE_ID = '00000000-0000-0000-0000-000000000001'; // Singleton ID for desktop_sync_state

// Create Supabase client with service role key for server-side operations
function createServiceRoleClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false, // Important for server-side clients
        autoRefreshToken: false,
      },
    }
  );
}

// Handle messages from desktop app
async function handleDesktopMessage(message: any) {
  console.log('📱 ENHANCED LOGGING: Received from desktop:', message);
  console.log('📱 ENHANCED LOGGING: Message type:', message.type);
  console.log('📱 ENHANCED LOGGING: Current timestamp:', Date.now());
  
  const supabase = createServiceRoleClient();
  
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
      
      // Store message in Supabase queue
      const { error: startMsgError } = await supabase.from('desktop_messages_queue').insert({
        id: startMessage.id,
        message_type: startMessage.type,
        sender: 'desktop',
        recipient: 'webapp',
        content: startMessage
      });

      if (startMsgError) {
        console.error('❌ ENHANCED LOGGING: Error storing desktop-call-started message:', startMsgError);
      } else {
        console.log('🎯 ENHANCED LOGGING: Desktop-call-started message stored in DB:', startMessage.id);
      }

      // Update last_desktop_ping in desktop_sync_state
      const { error: pingError } = await supabase
        .from('desktop_sync_state')
        .update({ last_desktop_ping: new Date().toISOString() })
        .eq('id', DESKTOP_SYNC_STATE_ID);

      if (pingError) {
        console.error('❌ ENHANCED LOGGING: Error updating last_desktop_ping:', pingError);
      }

      return { success: true, message: 'Call analysis request received' };

    case 'stop-call-analysis':
      console.log('🛑 ENHANCED LOGGING: Desktop requested call analysis stop');
      console.log('🛑 ENHANCED LOGGING: Message timestamp:', message.timestamp);
      
      // Store the message for web app to pick up with a unique ID
      const stopMessage = {
        id: uuidv4(), // Add unique ID for message acknowledgment
        type: 'desktop-call-stopped',
        timestamp: message.timestamp
      };
      
      // Store message in Supabase queue
      const { error: stopMsgError } = await supabase.from('desktop_messages_queue').insert({
        id: stopMessage.id,
        message_type: stopMessage.type,
        sender: 'desktop',
        recipient: 'webapp',
        content: stopMessage
      });

      if (stopMsgError) {
        console.error('❌ ENHANCED LOGGING: Error storing desktop-call-stopped message:', stopMsgError);
      } else {
        console.log('🛑 ENHANCED LOGGING: Desktop-call-stopped message stored in DB:', stopMessage.id);
      }

      // Update last_desktop_ping and set web_app_call_active to false
      const { error: stopStateError } = await supabase
        .from('desktop_sync_state')
        .update({ 
          last_desktop_ping: new Date().toISOString(), 
          web_app_call_active: false 
        })
        .eq('id', DESKTOP_SYNC_STATE_ID);

      if (stopStateError) {
        console.error('❌ ENHANCED LOGGING: Error updating last_desktop_ping and web_app_call_active:', stopStateError);
      }
      
      return { success: true, message: 'Call analysis stopped' };

    case 'ping':
      console.log('🏓 ENHANCED LOGGING: Received ping from desktop');
      
      const { error: pingUpdateError } = await supabase
        .from('desktop_sync_state')
        .update({ last_desktop_ping: new Date().toISOString() })
        .eq('id', DESKTOP_SYNC_STATE_ID);

      if (pingUpdateError) {
        console.error('❌ ENHANCED LOGGING: Error updating last_desktop_ping:', pingUpdateError);
      }
      
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

  try {
    const supabase = createServiceRoleClient();

    switch (action) {
      case 'status':
        const { data: syncState, error: syncStateError } = await supabase
          .from('desktop_sync_state')
          .select('*')
          .eq('id', DESKTOP_SYNC_STATE_ID)
          .single();
          
        if (syncStateError || !syncState) {
          console.error('❌ ENHANCED LOGGING: Error fetching desktop_sync_state:', syncStateError);
          return Response.json({ error: 'Failed to retrieve sync state' }, { status: 500 });
        }

        const lastPingTimestamp = new Date(syncState.last_desktop_ping).getTime();
        const isDesktopConnected = (Date.now() - lastPingTimestamp) < 10000; // 10 seconds timeout

        const { count: webAppToDesktopCount, error: webAppToDesktopError } = await supabase
          .from('desktop_messages_queue')
          .select('*', { count: 'exact', head: true })
          .eq('sender', 'webapp')
          .eq('recipient', 'desktop');
          
        const { count: desktopToWebAppCount, error: desktopToWebAppError } = await supabase
          .from('desktop_messages_queue')
          .select('*', { count: 'exact', head: true })
          .eq('sender', 'desktop')
          .eq('recipient', 'webapp');

        // CRITICAL FIX: Only consider call active if desktop is connected AND web_app_call_active is true
        const effectiveCallActive = isDesktopConnected && syncState.web_app_call_active;

        // ADDITIONAL FIX: If desktop is not connected but web_app_call_active is true, reset it
        if (!isDesktopConnected && syncState.web_app_call_active) {
          console.log('🔧 ENHANCED LOGGING: Desktop disconnected but call marked active - resetting state');
          await supabase
            .from('desktop_sync_state')
            .update({ web_app_call_active: false })
            .eq('id', DESKTOP_SYNC_STATE_ID);
        }

        const statusResponse = {
          connected: isDesktopConnected,
          activeConnections: isDesktopConnected ? 1 : 0,
          serverRunning: true,
          callActive: effectiveCallActive, // This is the key fix
          pendingMessages: webAppToDesktopCount || 0, // Desktop checks this queue
          pendingWebAppMessages: desktopToWebAppCount || 0, // Web app checks this queue
          lastPing: lastPingTimestamp
        };
        
        console.log('📊 ENHANCED LOGGING: Status request - returning status:', statusResponse);
        console.log('📊 ENHANCED LOGGING: Desktop connected calculation:', {
          currentTime: Date.now(),
          lastPing: lastPingTimestamp,
          timeDiff: Date.now() - lastPingTimestamp,
          threshold: 10000,
          isConnected: isDesktopConnected,
          dbCallActive: syncState.web_app_call_active,
          effectiveCallActive: effectiveCallActive
        });
        
        return Response.json(statusResponse);

      case 'get-messages-for-webapp':
        console.log('📨 ENHANCED LOGGING: Get messages for web app request received');
        
        // CRITICAL FIX: Return full message objects including id for acknowledgment
        const { data: webAppMessages, error: webAppMessagesError } = await supabase
          .from('desktop_messages_queue')
          .select('*') // Changed from select('content') to select('*')
          .eq('sender', 'desktop')
          .eq('recipient', 'webapp')
          .order('created_at', { ascending: true });

        if (webAppMessagesError) {
          console.error('❌ ENHANCED LOGGING: Error fetching messages for web app:', webAppMessagesError);
          return Response.json({ error: 'Failed to retrieve messages' }, { status: 500 });
        }

        // ADD THIS LOG: Inspect the full webAppMessages array before returning
        console.log('🔍 DEBUG: Raw webAppMessages from DB (before return):', webAppMessages);
        
        const webAppMessagesResponse = { messages: webAppMessages || [] };
        console.log('📨 ENHANCED LOGGING: Returning response to web app:', webAppMessagesResponse);
        
        return Response.json(webAppMessagesResponse);

      case 'get-messages-for-desktop':
        console.log('📨 ENHANCED LOGGING: Get messages for desktop request received');
        
        const { data: desktopMessages, error: desktopMessagesError } = await supabase
          .from('desktop_messages_queue')
          .select('content')
          .eq('sender', 'webapp')
          .eq('recipient', 'desktop')
          .order('created_at', { ascending: true });

        if (desktopMessagesError) {
          console.error('❌ ENHANCED LOGGING: Error fetching messages for desktop:', desktopMessagesError);
          return Response.json({ error: 'Failed to retrieve messages' }, { status: 500 });
        }

        const formattedDesktopMessages = desktopMessages.map(msg => msg.content);
        console.log('📨 ENHANCED LOGGING: Messages to return to desktop:', formattedDesktopMessages);
        
        // Clear messages after fetching for desktop (desktop doesn't send ACK for these)
        const { error: deleteError } = await supabase
          .from('desktop_messages_queue')
          .delete()
          .eq('sender', 'webapp')
          .eq('recipient', 'desktop');
          
        if (deleteError) {
          console.error('❌ ENHANCED LOGGING: Error clearing messages for desktop:', deleteError);
        } else {
          console.log('📨 ENHANCED LOGGING: Cleared webAppToDesktopMessages from DB');
        }
        
        const desktopMessagesResponse = { messages: formattedDesktopMessages };
        console.log('📨 ENHANCED LOGGING: Returning response to desktop:', desktopMessagesResponse);
        
        return Response.json(desktopMessagesResponse);

      case 'trigger-start':
        console.log('🚀 ENHANCED LOGGING: Trigger start request from web app');
        
        // Update web_app_call_active state
        const { error: startStateError } = await supabase
          .from('desktop_sync_state')
          .update({ web_app_call_active: true })
          .eq('id', DESKTOP_SYNC_STATE_ID);
          
        if (startStateError) {
          console.error('❌ ENHANCED LOGGING: Error updating web_app_call_active:', startStateError);
          return Response.json({ error: 'Failed to update call state' }, { status: 500 });
        }
        
        console.log('🚀 ENHANCED LOGGING: web_app_call_active set to true in DB');

        // Add message to queue for desktop
        const webCallStartedMessage = {
          type: 'web-call-started',
          timestamp: Date.now()
        };
        
        const { error: startMsgError } = await supabase.from('desktop_messages_queue').insert({
          message_type: webCallStartedMessage.type,
          sender: 'webapp',
          recipient: 'desktop',
          content: webCallStartedMessage
        });
        
        if (startMsgError) {
          console.error('❌ ENHANCED LOGGING: Error adding web-call-started message:', startMsgError);
          return Response.json({ error: 'Failed to send start signal' }, { status: 500 });
        }
        
        console.log('🚀 ENHANCED LOGGING: Added web-call-started message to DB');
        return Response.json({ success: true, message: 'Start signal sent to desktop' });

      case 'trigger-stop':
        console.log('🛑 ENHANCED LOGGING: Trigger stop request from web app');
        
        // Update web_app_call_active state
        const { error: stopStateError } = await supabase
          .from('desktop_sync_state')
          .update({ web_app_call_active: false })
          .eq('id', DESKTOP_SYNC_STATE_ID);
          
        if (stopStateError) {
          console.error('❌ ENHANCED LOGGING: Error updating web_app_call_active:', stopStateError);
          return Response.json({ error: 'Failed to update call state' }, { status: 500 });
        }
        
        console.log('🛑 ENHANCED LOGGING: web_app_call_active set to false in DB');

        // Add message to queue for desktop
        const webCallStoppedMessage = {
          type: 'web-call-stopped',
          timestamp: Date.now()
        };
        
        const { error: stopMsgError } = await supabase.from('desktop_messages_queue').insert({
          message_type: webCallStoppedMessage.type,
          sender: 'webapp',
          recipient: 'desktop',
          content: webCallStoppedMessage
        });
        
        if (stopMsgError) {
          console.error('❌ ENHANCED LOGGING: Error adding web-call-stopped message:', stopMsgError);
          return Response.json({ error: 'Failed to send stop signal' }, { status: 500 });
        }
        
        console.log('🛑 ENHANCED LOGGING: Added web-call-stopped message to DB');
        return Response.json({ success: true, message: 'Stop signal sent to desktop' });

      case 'reset-call-state':
        console.log('🔧 ENHANCED LOGGING: Manual reset call state request');
        
        // Force reset the call state
        const { error: resetError } = await supabase
          .from('desktop_sync_state')
          .update({ web_app_call_active: false })
          .eq('id', DESKTOP_SYNC_STATE_ID);
          
        if (resetError) {
          console.error('❌ ENHANCED LOGGING: Error resetting call state:', resetError);
          return Response.json({ error: 'Failed to reset call state' }, { status: 500 });
        }
        
        // Clear any pending messages
        const { error: clearError } = await supabase
          .from('desktop_messages_queue')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all messages
          
        if (clearError) {
          console.error('❌ ENHANCED LOGGING: Error clearing message queue:', clearError);
        }
        
        console.log('🔧 ENHANCED LOGGING: Call state reset and message queue cleared');
        return Response.json({ success: true, message: 'Call state reset successfully' });

      default:
        console.log('❓ ENHANCED LOGGING: Invalid GET action:', action);
        return Response.json({ 
          error: 'Invalid action',
          availableActions: ['status', 'get-messages-for-webapp', 'get-messages-for-desktop', 'trigger-start', 'trigger-stop', 'reset-call-state']
        });
    }
  } catch (error) {
    console.error('❌ ENHANCED LOGGING: Error in GET handler:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // CRITICAL FIX: Add immediate logging to confirm endpoint is being hit
  console.log('🚨 CRITICAL DEBUG: POST endpoint hit at /api/desktop-sync');
  console.log('🚨 CRITICAL DEBUG: Request method:', request.method);
  console.log('🚨 CRITICAL DEBUG: Request URL:', request.url);
  console.log('🚨 CRITICAL DEBUG: Current timestamp:', new Date().toISOString());
  
  console.log('📮 ENHANCED LOGGING: POST request received');
  console.log('📮 ENHANCED LOGGING: Request URL:', request.url);
  console.log('📮 ENHANCED LOGGING: Request headers:', Object.fromEntries(request.headers.entries()));
  
  try {
    const body = await request.json();
    console.log('🚨 CRITICAL DEBUG: POST body parsed successfully');
    console.log('🚨 CRITICAL DEBUG: Request body type:', body.type);
    console.log('🚨 CRITICAL DEBUG: Full request body:', JSON.stringify(body, null, 2));
    
    console.log('📮 ENHANCED LOGGING: POST request body parsed successfully');
    console.log('📮 ENHANCED LOGGING: Request body:', body);
    console.log('📮 ENHANCED LOGGING: Message type:', body.type);

    const supabase = createServiceRoleClient();

    switch (body.type) {
      case 'start-call-analysis':
      case 'stop-call-analysis':
      case 'ping':
        console.log('📮 ENHANCED LOGGING: Handling desktop message via POST');
        // Handle desktop messages
        const result = await handleDesktopMessage(body);
        console.log('📮 ENHANCED LOGGING: Desktop message handled, result:', result);
        return Response.json(result);

      // NEW CASE: Handle desktop-request-start-call
      case 'desktop-request-start-call':
        console.log('🚨 CRITICAL DEBUG: Processing desktop-request-start-call');
        console.log('🚀 ENHANCED LOGGING: Desktop requested call start via HTTP');
        console.log('🚀 ENHANCED LOGGING: Device settings:', body.deviceSettings);
        console.log('🎤 ENHANCED LOGGING: MIME type from desktop:', body.deviceSettings?.mimeType);
        
        // Get the Deepgram API key from environment
        const deepgramApiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
        console.log('🔑 ENHANCED LOGGING: Deepgram API key available:', !!deepgramApiKey);
        console.log('🔑 ENHANCED LOGGING: Deepgram API key value:', deepgramApiKey ? `${deepgramApiKey.substring(0, 8)}...` : 'NOT SET');
        
        if (!deepgramApiKey) {
          console.error('❌ ENHANCED LOGGING: No Deepgram API key found in web app environment');
          return Response.json({ error: 'Deepgram API key not configured' }, { status: 500 });
        }

        // Validate Deepgram API key format - MODIFIED: Removed hardcoded key check
        if (deepgramApiKey.length < 32) {
          console.error('❌ ENHANCED LOGGING: Invalid Deepgram API key detected (too short)');
          return Response.json({ 
            error: 'Invalid Deepgram API key. Please set a valid API key from your Deepgram console.',
            hint: 'Visit https://console.deepgram.com/ to get your API key'
          }, { status: 500 });
        }

        // Store the start request message for web app to pick up
        const startRequestMessage = {
          id: uuidv4(),
          type: 'desktop-call-started',
          deviceSettings: body.deviceSettings, // This now includes mimeType
          deepgramApiKey: deepgramApiKey, // Include the API key
          timestamp: body.timestamp
        };
        
        console.log('🚨 CRITICAL DEBUG: About to store message in database:', startRequestMessage);
        
        const { error: startRequestError } = await supabase.from('desktop_messages_queue').insert({
          id: startRequestMessage.id,
          message_type: startRequestMessage.type,
          sender: 'desktop',
          recipient: 'webapp',
          content: startRequestMessage
        });

        if (startRequestError) {
          console.error('❌ ENHANCED LOGGING: Error storing desktop start request:', startRequestError);
          return Response.json({ error: 'Failed to store start request' }, { status: 500 });
        }

        console.log('🚨 CRITICAL DEBUG: Message stored successfully in database');

        // Update desktop ping and call state
        const { error: startPingError } = await supabase
          .from('desktop_sync_state')
          .update({ 
            last_desktop_ping: new Date().toISOString(),
            web_app_call_active: true 
          })
          .eq('id', DESKTOP_SYNC_STATE_ID);

        if (startPingError) {
          console.error('❌ ENHANCED LOGGING: Error updating desktop sync state:', startPingError);
        }

        console.log('✅ ENHANCED LOGGING: Desktop request to start call analysis sent to web app');
        console.log('🚨 CRITICAL DEBUG: Returning success response to desktop');
        return Response.json({ success: true, message: 'Start request received and will be processed by web app' });

      case 'message-ack':
        // New endpoint to acknowledge message processing
        console.log('✅ ENHANCED LOGGING: Message acknowledgment received');
        console.log('✅ ENHANCED LOGGING: Message ID to acknowledge:', body.messageId);
        
        if (!body.messageId) {
          console.log('❌ ENHANCED LOGGING: No message ID provided for acknowledgment');
          return Response.json({ error: 'No message ID provided' }, { status: 400 });
        }
        
        // Remove the acknowledged message from the queue
        const { error: deleteError } = await supabase
          .from('desktop_messages_queue')
          .delete()
          .eq('id', body.messageId);

        if (deleteError) {
          console.error('❌ ENHANCED LOGGING: Error deleting acknowledged message from DB:', deleteError);
          return Response.json({ error: 'Failed to acknowledge message' }, { status: 500 });
        }

        console.log('✅ ENHANCED LOGGING: Message removed from DB queue:', body.messageId);
        
        return Response.json({ success: true, message: 'Message acknowledged and removed from queue' });

      case 'web-app-call-started-confirmation':
        console.log('✅ ENHANCED LOGGING: Web app confirmed call analysis started');
        console.log('✅ ENHANCED LOGGING: Confirmation timestamp:', body.timestamp || Date.now());
        
        // Update web_app_call_active state in DB
        const { error: startStateError } = await supabase
          .from('desktop_sync_state')
          .update({ web_app_call_active: true })
          .eq('id', DESKTOP_SYNC_STATE_ID);
          
        if (startStateError) {
          console.error('❌ ENHANCED LOGGING: Error updating web_app_call_active:', startStateError);
        } else {
          console.log('✅ ENHANCED LOGGING: web_app_call_active set to true in DB');
        }

        // Store confirmation for desktop to pick up
        const startConfirmation = {
          type: 'web-app-call-started-confirmation',
          timestamp: Date.now()
        };
        
        const { error: startConfirmError } = await supabase.from('desktop_messages_queue').insert({
          message_type: startConfirmation.type,
          sender: 'webapp',
          recipient: 'desktop',
          content: startConfirmation
        });
        
        if (startConfirmError) {
          console.error('❌ ENHANCED LOGGING: Error adding start confirmation to DB:', startConfirmError);
        } else {
          console.log('✅ ENHANCED LOGGING: Start confirmation added to DB');
        }
        
        return Response.json({ success: true });

      case 'web-app-call-stopped-confirmation':
        console.log('✅ ENHANCED LOGGING: Web app confirmed call analysis stopped');
        console.log('✅ ENHANCED LOGGING: Stop confirmation timestamp:', body.timestamp || Date.now());
        
        // Update web_app_call_active state in DB
        const { error: stopStateError } = await supabase
          .from('desktop_sync_state')
          .update({ web_app_call_active: false })
          .eq('id', DESKTOP_SYNC_STATE_ID);
          
        if (stopStateError) {
          console.error('❌ ENHANCED LOGGING: Error updating web_app_call_active:', stopStateError);
        } else {
          console.log('✅ ENHANCED LOGGING: web_app_call_active set to false in DB');
        }

        // Store confirmation for desktop to pick up
        const stopConfirmation = {
          type: 'web-app-call-stopped-confirmation',
          timestamp: Date.now()
        };
        
        const { error: stopConfirmError } = await supabase.from('desktop_messages_queue').insert({
          message_type: stopConfirmation.type,
          sender: 'webapp',
          recipient: 'desktop',
          content: stopConfirmation
        });
        
        if (stopConfirmError) {
          console.error('❌ ENHANCED LOGGING: Error adding stop confirmation to DB:', stopConfirmError);
        } else {
          console.log('✅ ENHANCED LOGGING: Stop confirmation added to DB');
        }
        
        return Response.json({ success: true });

      case 'insight-generated':
        console.log('🧠 ENHANCED LOGGING: Insight generated by web app');
        console.log('🧠 ENHANCED LOGGING: Insight content:', body.content);
        console.log('🧠 ENHANCED LOGGING: Insight type:', body.insightType);
        
        // Store insight for desktop to pick up
        const insightMessage = {
          type: 'insight-generated',
          content: body.content,
          insightType: body.insightType,
          timestamp: Date.now()
        };
        
        const { error: insightError } = await supabase.from('desktop_messages_queue').insert({
          message_type: insightMessage.type,
          sender: 'webapp',
          recipient: 'desktop',
          content: insightMessage
        });
        
        if (insightError) {
          console.error('❌ ENHANCED LOGGING: Error adding insight to DB:', insightError);
        } else {
          console.log('🧠 ENHANCED LOGGING: Insight added to DB');
        }
        
        return Response.json({ success: true });

      case 'call-status-update':
        console.log('📞 ENHANCED LOGGING: Call status update received');
        console.log('📞 ENHANCED LOGGING: Status:', body.status);
        console.log('📞 ENHANCED LOGGING: Call ID:', body.callId);
        
        // Store status update for desktop to pick up
        const statusUpdateMessage = {
          type: 'call-status-update',
          status: body.status,
          callId: body.callId,
          timestamp: Date.now()
        };
        
        const { error: statusError } = await supabase.from('desktop_messages_queue').insert({
          message_type: statusUpdateMessage.type,
          sender: 'webapp',
          recipient: 'desktop',
          content: statusUpdateMessage
        });
        
        if (statusError) {
          console.error('❌ ENHANCED LOGGING: Error adding status update to DB:', statusError);
        } else {
          console.log('📞 ENHANCED LOGGING: Status update added to DB');
        }
        
        return Response.json({ success: true });

      default:
        console.log('❓ ENHANCED LOGGING: Unknown POST message type:', body.type);
        console.log('❓ ENHANCED LOGGING: Full POST body:', body);
        console.log('🚨 CRITICAL DEBUG: Unhandled message type in POST endpoint');
        return Response.json({ error: 'Unknown message type' }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ ENHANCED LOGGING: Error handling POST request:', error);
    console.error('🚨 CRITICAL DEBUG: POST endpoint error details:', error);

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