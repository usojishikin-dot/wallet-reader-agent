"use client";

import { useState } from "react";

const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "demo";

const KNOWN_ADDRESSES: Record<string, string> = {
  "0x7a250d5630b4cf539739df2c5dacb4c659f2488d": "DEX Swap", // Uniswap V2 Router
  "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": "DEX Swap", // Uniswap V3 Router
  "0xe592427a0aece92de3edee1f18e0157c05861564": "DEX Swap", // Uniswap V3 Router
  "0xdef1c0ded9bec7f1a1670819833240f027b25eff": "DEX Swap", // 0x Exchange Proxy
  "0x1111111254fb6c44bac0bed2854e76f90643097d": "DEX Swap", // 1inch Router
  "0xdac17f958d2ee523a2206206994597c13d831ec7": "USDT Contract", // Tether
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC Contract", // USDC
};

export default function Home() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedAddress = address.trim();
    if (!trimmedAddress) {
      setError("Please enter a valid wallet address.");
      return;
    }

    setLoading(true);
    setError("");
    // Show "0.00" while loading as requested
    setResult({
      status: "Fetching...",
      network: "Ethereum",
      balance: "0.00",
      usdcBalance: "0.00",
      transactions: [],
      transactionCount: 0,
      txError: "",
      decodedLogs: [],
      logsError: "",
      address: trimmedAddress,
    });

    try {
      // Add a 15-second timeout to prevent the page from loading forever
      const fetchWithTimeout = (url: string, options: any) => {
        return fetch(url, {
          ...options,
          signal: AbortSignal.timeout(30000)
        });
      };

      const [ethRes, usdcRes, txRes] = await Promise.all([
        fetchWithTimeout("/api/balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: trimmedAddress }),
        }).catch(() => null),
        fetchWithTimeout("/api/usdc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: trimmedAddress }),
        }).catch(() => null),
        fetchWithTimeout("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: trimmedAddress }),
        }).catch(() => null)
      ]);

      let ethData = { data: { balance: "Error", network: "Ethereum", status: "Failed" } };
      if (ethRes && ethRes.ok) {
        ethData = await ethRes.json();
      }

      let usdcData = { data: { balance: "Error" } };
      if (usdcRes && usdcRes.ok) {
        usdcData = await usdcRes.json();
      }

      let txData = { data: { recentTransactions: [], transactionCount: 0 }, error: "" };
      if (txRes && txRes.ok) {
        txData = await txRes.json();
      } else if (txRes) {
        const errJson = await txRes.json();
        txData.error = errJson.error || "Failed to load transactions";
      } else {
        txData.error = "Network error while fetching transactions";
      }

      let decodedLogs: any[] = [];
      let logsError = "";
      if (txData.data?.recentTransactions?.length > 0) {
        try {
          // Extract the top 5 transaction hashes to decode
          const hashes = txData.data.recentTransactions.slice(0, 5).map((t: any) => t.hash);
          const logsRes = await fetchWithTimeout("/api/logs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hashes }),
          });
          
          if (logsRes && logsRes.ok) {
            const logsJson = await logsRes.json();
            decodedLogs = logsJson.data?.decodedLogs || [];
          } else if (logsRes) {
            logsError = "Failed to fetch decoded logs";
          }
        } catch (err) {
          logsError = "Network error while decoding logs";
        }
      }

      setResult({
        ...ethData.data,
        usdcBalance: usdcData.data.balance,
        transactions: txData.data?.recentTransactions || [],
        transactionCount: txData.data?.transactionCount || 0,
        txError: txData.error,
        decodedLogs,
        logsError,
      });
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message.includes('aborted')) {
        setError("Connection timed out. Your RPC node may be rate-limiting or blocking requests.");
      } else {
        setError(err.message);
      }
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-indigo-500/30 flex flex-col items-center justify-center p-4 sm:p-8 font-sans">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.15)_0%,rgba(0,0,0,0)_50%)]" />
      </div>

      <main className="relative z-10 w-full max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
            Wallet Reader
          </h1>
          <p className="text-lg text-slate-400 max-w-md mx-auto">
            Enter your wallet address to unlock detailed insights and analytics instantly.
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative max-w-2xl mx-auto">
          
          {loading && (
             <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[2px] rounded-3xl z-20 pointer-events-none transition-all duration-300" />
          )}

          <form onSubmit={handleSubmit} className="space-y-6 relative z-30">
            <div className="space-y-2">
              <label htmlFor="address" className="block text-sm font-medium text-slate-300 ml-1">
                Wallet Address
              </label>
              <div className="relative group">
                <input
                  id="address"
                  type="text"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="0x..."
                  className="w-full bg-slate-950/50 border border-slate-700 text-slate-100 text-lg rounded-2xl px-5 py-4 outline-none transition-all duration-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 group-hover:border-slate-600"
                />
                <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 blur transition-opacity duration-500 group-focus-within:opacity-20" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !address.trim()}
              className="w-full relative overflow-hidden group bg-slate-100 hover:bg-white text-slate-900 font-semibold text-lg rounded-2xl px-5 py-4 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-slate-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  "Analyze Wallet"
                )}
              </span>
              <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-indigo-100 to-purple-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </button>
          </form>

          {error && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm animate-in fade-in slide-in-from-top-2 duration-300 relative z-30">
              <p className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            </div>
          )}
        </div>

        {/* Results Section */}
        {result && (
          <div className="mt-12 p-8 bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-30 w-full">
            <h3 className="text-xl font-semibold text-slate-200 mb-8 flex items-center gap-3">
                {loading ? (
                  <div className="w-4 h-4 rounded-full border-2 border-slate-600 border-t-indigo-500 animate-spin" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
                {loading ? "Analyzing..." : "Wallet Analysis Complete"}
              </h3>
              
              {/* Full Width Horizontal Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                
                {/* Status */}
                <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800/50 transition-colors duration-300 flex flex-col justify-center">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Status</p>
                  <p className={`font-medium text-lg ${loading ? 'text-slate-400' : 'text-emerald-400'}`}>{result.status}</p>
                </div>
                
                {/* Network */}
                <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800/50 transition-colors duration-300 flex flex-col justify-center">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Network</p>
                  <p className="text-slate-200 font-medium text-lg">{result.network}</p>
                </div>
                
                {/* ETH Balance */}
                <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800/50 transition-colors duration-300 flex flex-col justify-center overflow-hidden">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">ETH Balance</p>
                  <div className="flex items-baseline gap-1 overflow-hidden">
                    <p className={`text-xl font-bold truncate ${loading ? 'text-slate-500' : 'text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400'}`} title={result.balance}>
                      {result.balance}
                    </p>
                    <span className={`text-xs font-medium ${loading ? 'text-slate-600' : 'text-emerald-400/70'} shrink-0`}>
                      ETH
                    </span>
                  </div>
                </div>

                {/* USDC Balance */}
                <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800/50 transition-colors duration-300 flex flex-col justify-center overflow-hidden">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">USDC Balance</p>
                  <div className="flex items-baseline gap-1 overflow-hidden">
                    <p className={`text-xl font-bold truncate ${loading ? 'text-slate-500' : 'text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400'}`} title={result.usdcBalance}>
                      {result.usdcBalance}
                    </p>
                    <span className={`text-xs font-medium ${loading ? 'text-slate-600' : 'text-blue-400/70'} shrink-0`}>
                      USDC
                    </span>
                  </div>
                </div>

                {/* Address */}
                <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800/50 transition-colors duration-300 flex flex-col justify-center">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Address</p>
                  <p className="text-sm text-slate-300 font-mono break-all" title={result.address}>{result.address}</p>
                </div>
                
              </div>

              {/* Transactions Section */}
              <div className="mt-6 pt-6 border-t border-slate-800/50">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Recent Transactions</h4>
                  <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded-md">
                    {loading ? "..." : `Total Sent: ${result.transactionCount}`}
                  </span>
                </div>
                
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 bg-slate-800/40 animate-pulse rounded-xl" />
                    ))}
                  </div>
                ) : result.txError ? (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400/80 text-sm text-center">
                    {result.txError}
                  </div>
                ) : result.transactions && result.transactions.length > 0 ? (
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                    {result.transactions.map((tx: any, idx: number) => {
                      const knownToLabel = tx.to ? KNOWN_ADDRESSES[tx.to.toLowerCase()] : null;
                      const actionLabel = knownToLabel || (tx.type === 'IN' ? 'Received' : 'Sent');
                      
                      let iconSvg;
                      let themeColor;
                      
                      if (actionLabel === 'DEX Swap') {
                        themeColor = 'text-purple-400 bg-purple-500/10 border-purple-500/20';
                        iconSvg = <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>;
                      } else if (actionLabel.includes('Contract')) {
                        themeColor = 'text-teal-400 bg-teal-500/10 border-teal-500/20';
                        iconSvg = <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
                      } else if (tx.type === 'IN') {
                        themeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                        iconSvg = <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>;
                      } else {
                        themeColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
                        iconSvg = <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>;
                      }

                      return (
                        <div key={`${tx.hash}-${idx}`} className="flex items-center justify-between p-3 bg-slate-900/60 rounded-xl border border-slate-800/50 hover:bg-slate-800/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`flex items-center justify-center shrink-0 w-8 h-8 rounded-full border ${themeColor}`}>
                              {iconSvg}
                            </div>
                            <div className="flex flex-col items-start gap-1">
                              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border ${themeColor}`}>
                                {actionLabel}
                              </span>
                              <a href={`https://etherscan.io/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400/80 hover:text-indigo-300 transition-colors truncate w-24 sm:w-32 block">
                                {tx.hash}
                              </a>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-slate-200">{tx.value} {tx.asset}</p>
                            <p className="text-xs text-slate-500">Block {tx.blockNumber}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800/50 border-dashed">
                    <p className="text-slate-400 text-sm">No transactions</p>
                    <p className="text-slate-500 text-xs mt-1">(powered by Alchemy Indexer)</p>
                  </div>
                )}
              </div>

              {/* Decoded Logs Section */}
              <div className="mt-8 pt-8 border-t border-slate-800/50">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-sm font-medium text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                    Decoded Transfer Logs
                  </h4>
                  <span className="text-xs text-slate-500">ethers.Interface</span>
                </div>
                
                {loading ? (
                  <div className="space-y-4">
                    <div className="h-24 bg-slate-800/40 animate-pulse rounded-2xl" />
                    <div className="h-24 bg-slate-800/40 animate-pulse rounded-2xl" />
                  </div>
                ) : result.logsError ? (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400/80 text-sm text-center">
                    {result.logsError}
                  </div>
                ) : result.decodedLogs && result.decodedLogs.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {result.decodedLogs.map((log: any, idx: number) => {
                      const isSent = log.from.toLowerCase() === result.address.toLowerCase();
                      const isReceived = log.to.toLowerCase() === result.address.toLowerCase();
                      const label = isSent ? 'Sent' : (isReceived ? 'Received' : 'Transferred');
                      const labelColor = isSent ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' : (isReceived ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-slate-400 bg-slate-500/10 border-slate-500/20');
                      
                      const numAmount = parseFloat(log.amountRaw);
                      let displayAmount = log.amountRaw;
                      if (!isNaN(numAmount)) {
                        displayAmount = numAmount.toLocaleString('en-US', { maximumFractionDigits: 18 });
                      }

                      return (
                        <div key={idx} className="p-5 bg-slate-900/80 rounded-2xl border border-slate-700/50 hover:border-indigo-500/50 transition-colors duration-300 group">
                          <div className="flex items-center justify-between mb-4">
                            <span className={`text-xs font-semibold px-2 py-1 rounded-md border ${labelColor}`}>
                              {label}
                            </span>
                            <a href={`https://etherscan.io/tx/${log.transactionHash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400/70 hover:text-indigo-300 transition-colors">
                              {log.transactionHash.substring(0, 10)}...
                            </a>
                          </div>
                          <div className="space-y-2 mb-4">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-500 uppercase">From</span>
                              <span className="text-xs text-slate-300 font-mono truncate" title={log.from}>
                                {KNOWN_ADDRESSES[log.from.toLowerCase()] || log.from}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-500 uppercase">To</span>
                              <span className="text-xs text-slate-300 font-mono truncate" title={log.to}>
                                {KNOWN_ADDRESSES[log.to.toLowerCase()] || log.to}
                              </span>
                            </div>
                          </div>
                          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                            <span className="text-xs text-slate-500 uppercase">Amount</span>
                            <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 truncate max-w-[150px]" title={log.amountRaw}>
                              {displayAmount}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800/50 border-dashed">
                    <p className="text-slate-400 text-sm">No ERC-20 Transfer logs found in recent transactions</p>
                    <p className="text-slate-500 text-xs mt-1">Raw logs returned no matching event signatures</p>
                  </div>
                )}
              </div>
          </div>
        )}
      </main>
    </div>
  );
}
