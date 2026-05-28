import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

const TRANSFER_EVENT_SIGNATURE = "event Transfer(address indexed from, address indexed to, uint256 amount)";
const ERC20_DECIMALS_ABI = ["function decimals() view returns (uint8)"];

export async function POST(request: Request) {
  try {
    const { hashes } = await request.json();

    if (!hashes || !Array.isArray(hashes)) {
      return NextResponse.json({ error: 'Array of transaction hashes is required' }, { status: 400 });
    }

    const rpcUrl = process.env.ALCHEMY_RPC_URL;
    if (!rpcUrl) {
      return NextResponse.json({ error: 'Server configuration error: RPC URL missing' }, { status: 500 });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
    const iface = new ethers.Interface([TRANSFER_EVENT_SIGNATURE]);

    // Limit to top 5 hashes
    const hashesToProcess = hashes.slice(0, 5);
    const decodedLogs: any[] = [];
    const decimalsCache: Record<string, { decimals: number, symbol: string }> = {};

    // Fetch receipts concurrently
    const receipts = await Promise.all(
      hashesToProcess.map(hash => provider.getTransactionReceipt(hash).catch(err => {
        console.warn(`Failed to fetch receipt for ${hash}`, err);
        return null;
      }))
    );

    for (const receipt of receipts) {
      if (!receipt || !receipt.logs) continue;

      for (const log of receipt.logs) {
        try {
          const parsedLog = iface.parseLog({ topics: [...log.topics], data: log.data });
          
          if (parsedLog && parsedLog.name === 'Transfer') {
            const tokenAddress = log.address;
            let decimals = 18; // Default fallback for generic ERC-20
            let symbol = "ERC20"; // Default fallback symbol
            
            // Dynamically query the token contract for its exact decimals and symbol
            try {
              if (decimalsCache[tokenAddress] !== undefined) {
                decimals = decimalsCache[tokenAddress].decimals;
                symbol = decimalsCache[tokenAddress].symbol;
              } else {
                const contract = new ethers.Contract(tokenAddress, [
                  "function decimals() view returns (uint8)",
                  "function symbol() view returns (string)"
                ], provider);
                
                // Fetch both concurrently for speed
                const [dec, sym] = await Promise.all([
                  contract.decimals().catch(() => 18),
                  contract.symbol().catch(() => "ERC20")
                ]);
                
                decimals = Number(dec);
                symbol = sym;
                decimalsCache[tokenAddress] = { decimals, symbol };
              }
            } catch (err) {
              // Safely ignore and stick to defaults
            }

            const rawAmount = parsedLog.args[2];
            const formattedAmount = ethers.formatUnits(rawAmount, decimals);

            decodedLogs.push({
              transactionHash: receipt.hash,
              from: parsedLog.args[0],
              to: parsedLog.args[1],
              amountRaw: formattedAmount,
              contractAddress: tokenAddress,
              decimals: Number(decimals),
              symbol: symbol
            });
          }
        } catch (e) {
          // Safely ignore non-Transfer events
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        decodedLogs
      },
    });
  } catch (error: any) {
    console.error("Error decoding logs:", error);
    return NextResponse.json({ error: 'Failed to decode transaction logs.' }, { status: 500 });
  }
}
