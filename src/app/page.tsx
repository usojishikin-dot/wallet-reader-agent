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
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const handleCopySummary = () => {
    if (aiSummary) {
      navigator.clipboard.writeText(aiSummary);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    }
  };

  const generateAiSummary = async (transactionsToSummarize: any[]) => {
    if (!transactionsToSummarize || transactionsToSummarize.length === 0) {
      setAiSummary("This wallet has absolutely no recent on-chain activity. It is a completely dormant or brand new address with zero transaction history.");
      return;
    }
    
    setLoadingSummary(true);
    setAiSummary(null);
    try {
      const res = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: transactionsToSummarize.slice(0, 10) })
      });
      if (res.ok) {
        const data = await res.json();
        setAiSummary(data.data.summary);
      } else {
        const errData = await res.json();
        setAiSummary(`ERROR: ${errData.error || 'Failed to generate summary'}`);
      }
    } catch (err) {
      setAiSummary("ERROR: Network error or AI service unavailable");
      console.error(err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedAddress = address.trim();
    
    // Validate Ethereum address format (0x followed by 40 hex characters)
    const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(trimmedAddress);
    if (!isValidAddress) {
      setError("Hmm, that doesn't look right. Please enter a valid Ethereum address (starting with 0x).");
      setResult(null);
      setAiSummary(null);
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
      healthScore: 0,
    });
    setAiSummary(null);

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
        txData.error = "The blockchain node is currently busy or rate-limiting requests. We couldn't fetch the latest transactions.";
      } else {
        txData.error = "Failed to load transaction history due to a network connection timeout.";
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

        // Fetch AI Summary in background
        generateAiSummary(txData.data.recentTransactions || []);
      } else {
        // Even if there's no data block, trigger the empty state summary
        generateAiSummary([]);
      }

      // Calculate Wallet Health Score
      let healthScore = 0;
      if (txData.data?.recentTransactions) {
        const txs = txData.data.recentTransactions;
        const totalSent = txData.data.transactionCount || 0;
        
        // 1. Transaction Diversity (Max 40 points)
        const uniqueToAddresses = new Set(txs.filter((t: any) => t.to).map((t: any) => t.to.toLowerCase())).size;
        const diversityScore = Math.min(uniqueToAddresses * 10, 40);

        // 2. Token Diversity (Max 30 points)
        const uniqueTokens = new Set(txs.map((t: any) => t.asset)).size;
        const tokenScore = Math.min(uniqueTokens * 10, 30);

        // 3. Activity Level (Max 30 points)
        let activityScore = 5;
        if (totalSent > 100) activityScore = 30;
        else if (totalSent > 50) activityScore = 20;
        else if (totalSent > 10) activityScore = 10;

        healthScore = diversityScore + tokenScore + activityScore;
      }

      setResult({
        ...ethData.data,
        usdcBalance: usdcData.data.balance,
        transactions: txData.data?.recentTransactions || [],
        transactionCount: txData.data?.transactionCount || 0,
        txError: txData.error,
        decodedLogs,
        logsError,
        healthScore,
      });
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message.includes('aborted')) {
        setError("Connection timed out. The blockchain node took too long to respond. Please try again.");
      } else {
        setError("Unable to connect to the blockchain network. Please verify your connection and try again.");
      }
      setResult(null);
      setAiSummary(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-slate-950 font-sans">
      {/* Global Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[30%] -left-[10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.15)_0%,rgba(0,0,0,0)_50%)]" />
      </div>

      {/* Header */}
      <header className="relative z-20 w-full border-b border-slate-800/50 bg-slate-950/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/50 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">Wallet <span className="text-indigo-400">Reader</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://github.com/usojishikin-dot/wallet-reader-agent" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-200 transition-colors p-2 -mr-2 min-w-[44px] min-h-[44px] flex items-center justify-center">
              <svg fill="currentColor" viewBox="0 0 24 24" className="w-6 h-6"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"></path></svg>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col">
        
        {/* Dynamic Hero Search Section */}
        <div className={`transition-all duration-700 ease-in-out w-full max-w-3xl mx-auto ${result ? 'mb-12 mt-4' : 'flex-grow flex flex-col justify-center pb-20'}`}>
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 tracking-tight mb-4">
              Decode Any Wallet
            </h2>
            <p className="text-base sm:text-lg text-slate-400 max-w-xl mx-auto px-2">
              Drop in an Ethereum address to instantly analyze its balances, tokens, and AI-driven behavior patterns.
            </p>
          </div>

          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative w-full">
          
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
                  className="w-full bg-slate-950/50 border border-slate-700 text-slate-100 text-base sm:text-lg rounded-2xl px-4 sm:px-5 py-3 sm:py-4 outline-none transition-all duration-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 group-hover:border-slate-600"
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
        </div>

        {/* Results Section */}
        {result && (
          <div className="mt-12 p-4 sm:p-6 md:p-8 bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-30 w-full">
            <h3 className="text-lg sm:text-xl font-semibold text-slate-200 mb-6 sm:mb-8 flex items-center gap-3">
                {loading ? (
                  <div className="w-4 h-4 rounded-full border-2 border-slate-600 border-t-indigo-500 animate-spin" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
                {loading ? "Analyzing..." : "Wallet Analysis Complete"}
              </h3>
              
              {/* Full Width Horizontal Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
                
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
                  <p className="text-sm text-slate-300 font-mono truncate" title={result.address}>{result.address}</p>
                </div>
                
                {/* Wallet Health Score */}
                <div 
                  tabIndex={0}
                  className="p-4 bg-slate-900/80 rounded-xl border border-slate-800/50 transition-colors duration-300 flex flex-col justify-center cursor-help relative group focus:outline-none focus:ring-1 focus:ring-slate-500"
                >
                  {/* Custom Tooltip */}
                  <div className="absolute bottom-full right-0 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 mb-3 w-[85vw] max-w-[260px] sm:w-64 p-3 bg-slate-800 text-slate-200 text-xs rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-300 pointer-events-none z-50 border border-slate-700">
                    <p className="font-semibold mb-1.5 text-slate-100">Score Breakdown:</p>
                    <ul className="list-disc pl-4 space-y-1 text-slate-300">
                      <li>Transaction diversity (40%)</li>
                      <li>Token diversity (30%)</li>
                      <li>Total network activity (30%)</li>
                    </ul>
                    <div className="mt-2 pt-2 border-t border-slate-700">
                      <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-rose-400"></span> &lt; 30 (Low Health)</div>
                      <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> 30 - 70 (Moderate)</div>
                      <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> &gt; 70 (High Health)</div>
                    </div>
                    {/* Tooltip Arrow */}
                    <div className="absolute -bottom-1.5 right-6 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 w-3 h-3 bg-slate-800 border-b border-r border-slate-700 rotate-45"></div>
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1 border-b border-dashed border-slate-600 pb-0.5">
                      <p className="text-xs text-slate-500 uppercase tracking-wider">Health Score</p>
                      <div className="relative flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-slate-400 opacity-80 group-hover:opacity-100 group-focus:opacity-100 transition-opacity relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="absolute inset-0 bg-slate-400/20 rounded-full animate-ping opacity-75"></div>
                      </div>
                    </div>
                    <span className={`text-xs font-bold shrink-0 whitespace-nowrap ${
                      result.healthScore > 70 ? 'text-emerald-400' : 
                      result.healthScore >= 30 ? 'text-amber-400' : 'text-rose-400'
                    }`}>
                      {loading ? '-' : `${result.healthScore}/100`}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mt-1 relative">
                    <div 
                      className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.5)] ${
                        result.healthScore > 70 ? 'bg-emerald-400 shadow-emerald-400/50' : 
                        result.healthScore >= 30 ? 'bg-amber-400 shadow-amber-400/50' : 'bg-rose-400 shadow-rose-400/50'
                      }`}
                      style={{ width: loading ? '0%' : `${result.healthScore}%` }}
                    />
                  </div>
                </div>
                
              </div>

              {/* AI Summary Section */}
              {(loadingSummary || aiSummary) && (
                <div className="mt-6 p-6 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent rounded-2xl border border-indigo-500/20 relative overflow-hidden shadow-[0_0_30px_-15px_rgba(99,102,241,0.3)]">
                  <div className="absolute top-0 right-0 p-4 opacity-5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4 relative z-10">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                      </svg>
                      <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-widest">AI Wallet Insights</h3>
                    </div>
                    
                    <div className="flex items-center gap-2 self-end sm:self-auto w-full sm:w-auto mt-2 sm:mt-0">
                      {aiSummary && !aiSummary.startsWith('ERROR:') && !loadingSummary && (
                        <button 
                          onClick={handleCopySummary}
                          className="flex-1 sm:flex-none justify-center text-sm sm:text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 px-4 sm:px-3 py-3 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-xl sm:rounded-lg flex items-center gap-1.5 transition-colors border border-indigo-500/30 font-medium"
                        >
                          {copiedSummary ? (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                              Copied!
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-3.5 sm:w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                              Copy
                            </>
                          )}
                        </button>
                      )}
                      <button 
                        onClick={() => generateAiSummary(result?.transactions || [])}
                        disabled={loadingSummary}
                        className="flex-1 sm:flex-none justify-center text-sm sm:text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 px-4 sm:px-3 py-3 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-xl sm:rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-indigo-500/30 font-medium"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 ${loadingSummary ? 'animate-spin' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                        </svg>
                        Regenerate
                      </button>
                    </div>
                  </div>

                  {loadingSummary ? (
                    <div className="space-y-3 animate-pulse relative z-10 pt-2">
                      <div className="h-4 bg-indigo-500/20 rounded w-full"></div>
                      <div className="h-4 bg-indigo-500/20 rounded w-5/6"></div>
                      <div className="h-4 bg-indigo-500/20 rounded w-2/3"></div>
                    </div>
                  ) : (
                    <div className="relative z-10 p-4 sm:p-5 bg-slate-900/40 rounded-xl border border-indigo-500/10 backdrop-blur-sm">
                      <p className={`text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap font-medium ${aiSummary?.startsWith('ERROR:') ? 'text-rose-400' : 'text-slate-200'}`}>
                        {aiSummary}
                      </p>
                    </div>
                  )}
                </div>
              )}

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
                        <div key={`${tx.hash}-${idx}`} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 gap-3 sm:gap-0 bg-slate-900/60 rounded-xl border border-slate-800/50 hover:bg-slate-800/50 transition-colors">
                          <div className="flex items-center gap-3 w-full sm:w-auto">
                            <div className={`flex items-center justify-center shrink-0 w-8 h-8 rounded-full border ${themeColor}`}>
                              {iconSvg}
                            </div>
                            <div className="flex flex-col items-start gap-1">
                              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border ${themeColor}`}>
                                {actionLabel}
                              </span>
                              <a href={`https://etherscan.io/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm text-indigo-400/80 hover:text-indigo-300 transition-colors truncate max-w-[120px] sm:max-w-[200px] block py-1">
                                {tx.hash}
                              </a>
                            </div>
                          </div>
                          <div className="text-left sm:text-right shrink-0 ml-11 sm:ml-0 mt-1 sm:mt-0">
                            <p className="text-[13px] sm:text-sm font-bold text-slate-200 truncate max-w-[200px] sm:max-w-[150px]">{tx.value} {tx.asset}</p>
                            <p className="text-xs text-slate-500 mt-0.5">Block {tx.blockNumber}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 bg-slate-900/40 rounded-xl border border-dashed border-slate-800/50 text-center flex flex-col items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 12H4M8 16l-4-4 4-4" /></svg>
                    <p className="text-slate-400 text-sm font-medium">This wallet has no recorded transaction history.</p>
                    <p className="text-slate-500 text-xs mt-1 italic">The address is completely dormant.</p>
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

      {/* Footer */}
      <footer className="relative z-20 border-t border-slate-800/50 bg-slate-950/80 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center">
          <p className="text-sm text-slate-500">© 2026 Wallet Reader. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
