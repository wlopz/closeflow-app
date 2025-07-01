import Ably from 'ably';

// Initialize Ably client for web app
const ablyApiKey = process.env.NEXT_PUBLIC_ABLY_API_KEY;

if (!ablyApiKey) {
  console.warn('⚠️ ABLY_API_KEY not found in environment variables');
}

export const ablyClient = ablyApiKey ? new Ably.Realtime({
  key: ablyApiKey,
  clientId: `webapp-${Date.now()}`,
  // log: { level: 1 }
}) : null;

// Export channels for use in components
export const getAblyChannels = () => {
  if (!ablyClient) {
    console.warn('⚠️ Ably client not initialized');
    return null;
  }

  return {
    controlChannel: ablyClient.channels.get('closeflow:desktop-control'),
    resultsChannel: ablyClient.channels.get('closeflow:deepgram-results')
  };
};

// Helper function to check if Ably is available
export const isAblyAvailable = () => {
  return ablyClient !== null;
};