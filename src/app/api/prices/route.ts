import { NextResponse } from 'next/server';

export const revalidate = 60; // Cache responses for 60 seconds

export async function GET() {
  try {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,usd-coin,dai,weth,pepe&vs_currencies=usd';
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch prices from CoinGecko' }, { status: response.status });
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Error fetching prices:', error);
    return NextResponse.json({ error: 'Internal server error while fetching prices' }, { status: 500 });
  }
}
