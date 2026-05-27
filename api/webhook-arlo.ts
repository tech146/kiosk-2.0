import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Get greeting based on time of day
 */
function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  
  if (hour < 12) {
    return "Good morning! Welcome to Scarborough Business Centre. Please tap the screen to check in.";
  } else if (hour < 18) {
    return "Good afternoon! Welcome to Scarborough Business Centre. Please tap the screen to check in.";
  } else {
    return "Good evening! Welcome to Scarborough Business Centre. Please tap the screen to check in.";
  }
}

/**
 * Main webhook handler for Arlo person detection
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    try {
      const { event, properties } = req.body;

      console.log('📹 Arlo webhook received:', { event, properties });

      // Check for person detection event
      if (event === 'person' || properties?.detectionType === 'person') {
        const greeting = getTimeBasedGreeting();
        console.log('👤 Person detected! Greeting:', greeting);

        return res.status(200).json({
          success: true,
          message: 'Person detected',
          greeting,
          timestamp: new Date().toISOString(),
        });
      }

      // Other event types - acknowledge
      return res.status(200).json({
        success: true,
        message: 'Event received',
        eventType: event,
      });
    } catch (error) {
      console.error('❌ Webhook error:', error);
      return res.status(500).json({ error: 'Processing failed' });
    }
  } else if (req.method === 'GET') {
    // Health check
    return res.status(200).json({ 
      status: 'ok', 
      service: 'arlo-webhook',
      timestamp: new Date().toISOString()
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
