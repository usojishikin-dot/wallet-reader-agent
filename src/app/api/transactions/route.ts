import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

export async function POST(request: Request) {
  try {
    const { address } = await request.json();

    if (!address) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    if (!ethers.isAddress(address)) {
      return NextResponse.json({ error: 'Invalid Ethereum address format' }, { status: 400 });
    }

    const rpcUrl = process.env.ALCHEMY_RPC_URL;
    if (!rpcUrl) {
      return NextResponse.json({ error: 'Server configuration error: RPC URL missing' }, { status: 500 });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });

    // Get the exact number of sent transactions
    const txCount = await provider.getTransactionCount(address);
    
    // Use Alchemy's Asset Transfers API to get true historical transactions without manual block scanning
    const fetchTransfers = async (direction: 'from' | 'to') => {
      const payload = {
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getAssetTransfers",
        params: [
          {
            fromBlock: "0x0",
            toBlock: "latest",
            [direction === 'from' ? 'fromAddress' : 'toAddress']: address,
            category: ["external", "erc20"],
            withMetadata: true,
            excludeZeroValue: false,
            maxCount: "0x14", // get up to 20 to ensure we have enough when merging
            order: "desc"     // newest first
          }
        ]
      };

      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      return data?.result?.transfers || [];
    };

    // Fetch incoming and outgoing transactions simultaneously
    const [outTxs, inTxs] = await Promise.all([
      fetchTransfers('from'),
      fetchTransfers('to')
    ]);

    // Format them to match our frontend
    const allTxs = [...outTxs, ...inTxs].map((tx: any) => ({
      hash: tx.hash,
      from: tx.from,
      to: tx.to || 'Contract Creation',
      value: tx.value 
        ? tx.value.toLocaleString('en-US', { maximumFractionDigits: 18 })
        : "0",
      asset: tx.asset || 'ETH',
      blockNumber: parseInt(tx.blockNum, 16),
      timestamp: tx.metadata.blockTimestamp,
      type: tx.from.toLowerCase() === address.toLowerCase() ? 'OUT' : 'IN'
    }));

    // Sort by block number descending and grab the top 10 absolute newest transactions
    allTxs.sort((a, b) => b.blockNumber - a.blockNumber);
    const recentTxs = allTxs.slice(0, 10);

    return NextResponse.json({
      success: true,
      data: {
        address,
        transactionCount: txCount,
        recentTransactions: recentTxs,
        scannedBlocks: 'Alchemy API'
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to process transactions request. Please check the address.' }, { status: 500 });
  }
}
