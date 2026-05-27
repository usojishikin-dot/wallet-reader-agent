import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

export async function POST(request: Request) {
  try {
    const { address } = await request.json();

    if (!address) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    // Validate Ethereum address
    if (!ethers.isAddress(address)) {
      return NextResponse.json({ error: 'Invalid Ethereum address format' }, { status: 400 });
    }

    const rpcUrl = process.env.ALCHEMY_RPC_URL;
    if (!rpcUrl) {
       console.error("ALCHEMY_RPC_URL environment variable is not set.");
       return NextResponse.json({ error: 'Server configuration error: RPC URL missing' }, { status: 500 });
    }

    // Fetch the balance using ethers.js
    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
    const balanceWei = await provider.getBalance(address);
    const balanceEth = ethers.formatEther(balanceWei);
    
    const parts = balanceEth.split('.');
    const whole = parts[0];
    const decimal = (parts[1] || '').padEnd(18, '0');
    const exactBalance = `${whole}.${decimal}`;

    return NextResponse.json({
      success: true,
      data: {
        address,
        balance: exactBalance,
        network: 'Ethereum',
        status: 'Active',
      },
    });
  } catch (error: any) {
    console.error("Error fetching balance:", error);
    return NextResponse.json({ error: 'Failed to process request. Please check the address.' }, { status: 500 });
  }
}
