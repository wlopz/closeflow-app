import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface TranscriptRequest {
  transcript: string;
  speakerId: number;
}

export async function POST(request: Request) {
  try {
    const { transcript, speakerId }: TranscriptRequest = await request.json();

    console.log('🔍 AI INSIGHTS: Received analysis request:', { transcript, speakerId });
    console.log('🔍 AI INSIGHTS: Transcript length:', transcript.length);

    // Validate API key exists
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ AI INSIGHTS: OpenAI API key not found in environment variables');
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const systemPrompt = `You are an expert sales coach with 20+ years of experience helping top performers close deals. You're analyzing a live sales conversation to provide real-time coaching.

Your role is to:
1. IDENTIFY OPPORTUNITIES: Spot moments where the salesperson can improve their approach
2. HANDLE OBJECTIONS: When customers raise concerns, provide specific response strategies
3. RECOGNIZE BUYING SIGNALS: Alert when customers show interest or readiness to move forward
4. STRATEGIC GUIDANCE: Suggest next steps, questions to ask, or techniques to use
5. EMOTIONAL INTELLIGENCE: Read between the lines for customer sentiment and motivation

ANALYSIS FRAMEWORK:
- If CUSTOMER is speaking: Analyze their words for objections, concerns, buying signals, pain points, or decision-making indicators
- If SALESPERSON is speaking: Evaluate their technique, identify missed opportunities, suggest improvements

RESPONSE GUIDELINES:
- Be specific and actionable (not generic advice)
- Provide exact phrases or questions to use when helpful
- Focus on immediate next steps
- Keep responses under 100 words for quick reading
- Provide coaching value for ANY meaningful conversation segment

COACHING CATEGORIES:
🚨 OBJECTION: Customer raised a concern that needs addressing
💡 OPPORTUNITY: Salesperson can improve their approach or ask better questions
🎯 BUYING SIGNAL: Customer showed interest or readiness to advance
⚠️ WARNING: Salesperson is making a mistake or missing something important
✅ GOOD MOVE: Acknowledge effective techniques (sparingly)
🔄 NEXT STEP: Suggest what to do next in the conversation

Format your response as: [CATEGORY] Brief, actionable coaching advice.`;

    const userPrompt = `Speaker ${speakerId === 0 ? 'SALESPERSON' : 'CUSTOMER'}: "${transcript}"

Analyze this statement and provide specific sales coaching. Consider:
- What is the speaker revealing about their needs, concerns, or mindset?
- If it's the salesperson, how can they improve their approach?
- If it's the customer, what's the best way to respond to what they just said?
- Are there any objections, buying signals, or opportunities present?

Provide tactical coaching advice that can be immediately applied.`;

    console.log('🤖 AI INSIGHTS: Sending request to OpenAI...');

    try {
      const oaRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'User-Agent': 'SalesCoach/1.0',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 200,
        }),
      });

      console.log('📊 AI INSIGHTS: OpenAI response status:', oaRes.status);

      if (!oaRes.ok) {
        const errText = await oaRes.text();
        console.error(`❌ AI INSIGHTS: OpenAI API error: ${oaRes.status} - ${errText}`);
        
        // Handle specific error cases
        if (oaRes.status === 401) {
          return NextResponse.json(
            { error: 'Invalid OpenAI API key' },
            { status: 500 }
          );
        } else if (oaRes.status === 429) {
          return NextResponse.json(
            { error: 'OpenAI API rate limit exceeded' },
            { status: 429 }
          );
        } else {
          return NextResponse.json(
            { error: `OpenAI API error: ${oaRes.status}` },
            { status: 500 }
          );
        }
      }

      const oaJson = await oaRes.json();
      const analysis = oaJson.choices[0].message.content as string;

      console.log('✅ AI INSIGHTS: OpenAI analysis received:', analysis);
      console.log('✅ AI INSIGHTS: Analysis length:', analysis.length);

      // CRITICAL FIX: Relaxed filtering - only filter out truly empty responses
      if (analysis && analysis.trim() && analysis.trim().length > 5) {
        console.log('✅ AI INSIGHTS: Analysis passed validation, returning to client');
        return NextResponse.json({ analysis: analysis.trim() });
      } else {
        console.log('⚠️ AI INSIGHTS: Analysis too short or empty, returning empty response');
        console.log('⚠️ AI INSIGHTS: Raw analysis:', JSON.stringify(analysis));
        return NextResponse.json({ analysis: '' });
      }

    } catch (fetchError: any) {
      console.error('❌ AI INSIGHTS: OpenAI API fetch error:', {
        name: fetchError.name,
        message: fetchError.message,
        cause: fetchError.cause,
        stack: fetchError.stack
      });
      
      // Handle specific fetch errors
      if (fetchError.name === 'AbortError') {
        console.error('❌ AI INSIGHTS: OpenAI API request timeout');
        return NextResponse.json(
          { error: 'Request timeout - please try again' },
          { status: 408 }
        );
      }
      
      // Check for network/connection issues
      if (fetchError.cause?.code === 'UND_ERR_SOCKET' || 
          fetchError.message.includes('fetch failed')) {
        return NextResponse.json(
          { error: 'Network connectivity issue - unable to reach OpenAI API. Please check your network configuration and try again.' },
          { status: 503 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to connect to OpenAI API' },
        { status: 503 }
      );
    }

  } catch (err: any) {
    console.error('❌ AI INSIGHTS: Analyze API error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to analyze transcript' },
      { status: 500 }
    );
  }
}