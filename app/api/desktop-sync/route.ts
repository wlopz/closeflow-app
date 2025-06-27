// Update the desktop-request-start-call handler to include mimeType
case 'desktop-request-start-call':
  console.log('🚀 ENHANCED LOGGING: Desktop requested call start via HTTP');
  console.log('🚀 ENHANCED LOGGING: Device settings:', body.deviceSettings);
  console.log('🎤 ENHANCED LOGGING: MIME type from desktop:', body.deviceSettings?.mimeType);
  
  // Get the Deepgram API key from environment
  const deepgramApiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;
  console.log('🔑 ENHANCED LOGGING: Deepgram API key available:', !!deepgramApiKey);
  
  if (!deepgramApiKey) {
    console.error('❌ ENHANCED LOGGING: No Deepgram API key found in web app environment');
    return Response.json({ error: 'Deepgram API key not configured' }, { status: 500 });
  }

  // Store the start request message for web app to pick up
  const startRequestMessage = {
    id: uuidv4(),
    type: 'desktop-call-started',
    deviceSettings: body.deviceSettings, // This now includes mimeType
    deepgramApiKey: deepgramApiKey, // Include the API key
    timestamp: body.timestamp
  };
  
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

  console.log('✅ ENHANCED LOGGING: Desktop start request processed successfully');
  return Response.json({ success: true, message: 'Start request received and will be processed by web app' });