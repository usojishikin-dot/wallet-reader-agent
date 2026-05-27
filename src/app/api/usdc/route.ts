import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

const USDC_CONTRACT_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)"
];

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
       console.error("ALCHEMY_RPC_URL environment variable is not set.");
       return NextResponse.json({ error: 'Server configuration error: RPC URL missing' }, { status: 500 });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
    const contract = new ethers.Contract(USDC_CONTRACT_ADDRESS, ERC20_ABI, provider);
    
    const balanceWei = await contract.balanceOf(address);
    // USDC uses 6 decimals
    const balanceUsdc = ethers.formatUnits(balanceWei, 6);
    
    const parts = balanceUsdc.split('.');
    const whole = parts[0];
    const decimal = (parts[1] || '').padEnd(6, '0');
    const exactBalance = `${whole}.${decimal}`;

    return NextResponse.json({
      success: true,
      data: {
        address,
        balance: exactBalance
      },
    });
  } catch (error: any) {
    console.error("Error fetching USDC balance:", error);
    return NextResponse.json({ error: 'Failed to process request for USDC. Please check the address.' }, { status: 500 });
  }
}
