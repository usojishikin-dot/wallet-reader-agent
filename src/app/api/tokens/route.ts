import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)"
];

const TOKENS = {
  USDC: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
  DAI: { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
  WETH: { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18 },
  PEPE: { address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933", decimals: 18 }
};

export async function POST(request: Request) {
  try {
    const { address } = await request.json();

    if (!address || !ethers.isAddress(address)) {
      return NextResponse.json({ error: 'Invalid Ethereum address format' }, { status: 400 });
    }

    const rpcUrl = process.env.ALCHEMY_RPC_URL;
    if (!rpcUrl) {
       return NextResponse.json({ error: 'Server configuration error: RPC URL missing' }, { status: 500 });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
    
    const balances: Record<string, string> = {};

    // Fetch all token balances concurrently
    await Promise.all(Object.entries(TOKENS).map(async ([symbol, token]) => {
      try {
        const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
        const balanceWei = await contract.balanceOf(address);
        const balanceFormatted = ethers.formatUnits(balanceWei, token.decimals);
        
        const parts = balanceFormatted.split('.');
        const whole = BigInt(parts[0]).toLocaleString('en-US'); // Safe for massive meme coin balances
        const decimal = parts[1] ? parts[1].substring(0, 4) : ''; // Keep up to 4 decimal places
        
        if (decimal.length > 0 && parseFloat(`0.${decimal}`) > 0) {
            balances[symbol] = `${whole}.${decimal}`;
        } else {
            balances[symbol] = whole;
        }
      } catch (err) {
        balances[symbol] = "0";
      }
    }));

    return NextResponse.json({
      success: true,
      data: { balances }
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to process request for tokens. Please check the address.' }, { status: 500 });
  }
}
