import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ error: 'Server configuration error: Gemini API key missing' }, { status: 500 });
    }

    const { transactions } = await request.json();

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: 'No transactions provided' }, { status: 400 });
    }

    // Format transactions into a clean readable string
    const txContext = transactions.map((tx: any, idx: number) => {
      const action = tx.type === 'IN' ? 'Received' : 'Sent';
      return `${idx + 1}. ${action} ${tx.value} ${tx.asset} (Hash: ${tx.hash}, Block: ${tx.blockNumber})`;
    }).join('\n');

    const prompt = `System Prompt: You are a sharp, elite crypto wallet analyst.

Analyze these recent transactions:
${txContext}

Provide a punchy, highly condensed executive summary of this wallet's behavior. 
Focus on:
1. The primary narrative (what are they doing?).
2. The main assets moving.
3. A quick risk or behavior classification (e.g., "Holding Wallet", "Active DEX Trader", "Bot", "Airdrop Farmer").

Keep it under 3 short paragraphs. Be direct, factual, and aggressive with your brevity.
IMPORTANT: Do NOT use any Markdown formatting in your response. Do not use asterisks (*) for bolding or bullet points. Use plain text only, with standard numbering or simple dashes (-).`;

    // Fetch from Gemini 2.5 Flash
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2000,
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", errorText);
      return NextResponse.json({ error: 'Failed to generate summary from AI provider' }, { status: 502 });
    }

    const data = await response.json();
    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!summary) {
      return NextResponse.json({ error: 'AI provider returned an empty response' }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      data: {
        summary: summary.trim()
      }
    });

  } catch (error: any) {
    console.error("Error in AI summary route:", error);
    return NextResponse.json({ error: 'Internal server error while generating summary' }, { status: 500 });
  }
}
