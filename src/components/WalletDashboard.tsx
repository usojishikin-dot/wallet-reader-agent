"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import WalletResultView from "./WalletResultView";

export default function WalletDashboard({ initialAddress }: { initialAddress?: string }) {
  const router = useRouter();
  
  // App Mode
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  
  // Wallet 1 State (Primary)
  const [address1, setAddress1] = useState(initialAddress || "");
  const [wallet1Data, setWallet1Data] = useState<any>({
    result: null,
    loading: false,
    error: "",
    aiSummary: null,
    loadingSummary: false
  });

  // Wallet 2 State (Comparison)
  const [address2, setAddress2] = useState("");
  const [wallet2Data, setWallet2Data] = useState<any>({
    result: null,
    loading: false,
    error: "",
    aiSummary: null,
    loadingSummary: false
  });

  useEffect(() => {
    if (initialAddress) {
      const decodedAddress = decodeURIComponent(initialAddress);
      setAddress1(decodedAddress);
      performAnalysis(decodedAddress, 1);
    } else {
      resetWallet(1);
      resetWallet(2);
      setAddress1("");
      setAddress2("");
    }
  }, [initialAddress]);

  const resetWallet = (walletIndex: number) => {
    const defaultState = { result: null, loading: false, error: "", aiSummary: null, loadingSummary: false };
    if (walletIndex === 1) setWallet1Data(defaultState);
    else setWallet2Data(defaultState);
  };
  
  const updateWalletData = (walletIndex: number, updates: any) => {
    if (walletIndex === 1) setWallet1Data((prev: any) => ({ ...prev, ...updates }));
    else setWallet2Data((prev: any) => ({ ...prev, ...updates }));
  };

  const generateAiSummary = async (transactionsToSummarize: any[], walletIndex: number) => {
    if (!transactionsToSummarize || transactionsToSummarize.length === 0) {
      updateWalletData(walletIndex, { aiSummary: "This wallet has absolutely no recent on-chain activity. It is a completely dormant or brand new address with zero transaction history." });
      return;
    }
    
    updateWalletData(walletIndex, { loadingSummary: true, aiSummary: null });
    try {
      const res = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: transactionsToSummarize.slice(0, 10) })
      });
      if (res.ok) {
        const data = await res.json();
        updateWalletData(walletIndex, { aiSummary: data.data.summary });
      } else {
        const errData = await res.json();
        updateWalletData(walletIndex, { aiSummary: `ERROR: ${errData.error || 'Failed to generate summary'}` });
      }
    } catch (err) {
      updateWalletData(walletIndex, { aiSummary: "ERROR: Network error or AI service unavailable" });
    } finally {
      updateWalletData(walletIndex, { loadingSummary: false });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const addr1 = address1.trim();
    const addr2 = address2.trim();
    
    const isValid1 = /^0x[a-fA-F0-9]{40}$/.test(addr1);
    
    if (!isValid1) {
      updateWalletData(1, { error: "Please enter a valid Ethereum address.", result: null, aiSummary: null });
      return;
    }

    if (isComparisonMode) {
      const isValid2 = /^0x[a-fA-F0-9]{40}$/.test(addr2);
      if (!isValid2) {
        updateWalletData(2, { error: "Please enter a valid Ethereum address.", result: null, aiSummary: null });
        return;
      }
      // Trigger both in place instead of routing
      performAnalysis(addr1, 1);
      performAnalysis(addr2, 2);
    } else {
      // Use router for single mode to maintain URL
      router.push(`/wallet/${encodeURIComponent(addr1)}`);
    }
  };

  const performAnalysis = async (targetAddress: string, walletIndex: number) => {
    const trimmedAddress = targetAddress.trim();
    const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(trimmedAddress);
    
    if (!isValidAddress) {
      updateWalletData(walletIndex, { error: "Please enter a valid Ethereum address.", result: null, aiSummary: null });
      return;
    }

    updateWalletData(walletIndex, {
      loading: true,
      error: "",
      aiSummary: null,
      result: {
        status: "Fetching...", network: "Ethereum", balance: "0.00", usdcBalance: "0.00", daiBalance: "0.00",
        wethBalance: "0.00", pepeBalance: "0.00", transactions: [], transactionCount: 0, txError: "",
        decodedLogs: [], logsError: "", address: trimmedAddress, healthScore: 0, concentratedRiskToken: null,
      }
    });

    try {
      const fetchWithTimeout = (url: string, options: any) => {
        return fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
      };

      const [ethRes, tokensRes, txRes] = await Promise.all([
        fetchWithTimeout("/api/balance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: trimmedAddress }) }).catch(() => null),
        fetchWithTimeout("/api/tokens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: trimmedAddress }) }).catch(() => null),
        fetchWithTimeout("/api/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: trimmedAddress }) }).catch(() => null)
      ]);

      let ethData = { data: { balance: "Error", network: "Ethereum", status: "Failed" } };
      if (ethRes && ethRes.ok) ethData = await ethRes.json();

      let tokenData = { data: { balances: { USDC: "Error", DAI: "Error", WETH: "Error", PEPE: "Error" } } };
      if (tokensRes && tokensRes.ok) tokenData = await tokensRes.json();

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
        generateAiSummary(txData.data.recentTransactions || [], walletIndex);
      } else {
        generateAiSummary([], walletIndex);
      }

      let healthScore = 0;
      if (txData.data?.recentTransactions) {
        const txs = txData.data.recentTransactions;
        const totalSent = txData.data.transactionCount || 0;
        
        const uniqueToAddresses = new Set(txs.filter((t: any) => t.to).map((t: any) => t.to.toLowerCase())).size;
        const diversityScore = Math.min(uniqueToAddresses * 10, 40);

        const uniqueTokens = new Set(txs.map((t: any) => t.asset)).size;
        const tokenScore = Math.min(uniqueTokens * 10, 30);

        let activityScore = 5;
        if (totalSent > 100) activityScore = 30;
        else if (totalSent > 50) activityScore = 20;
        else if (totalSent > 10) activityScore = 10;

        healthScore = diversityScore + tokenScore + activityScore;
      }

      const rawEth = parseFloat(ethData.data?.balance?.replace(/,/g, '') || "0");
      const rawUsdc = parseFloat(tokenData.data?.balances?.USDC?.replace(/,/g, '') || "0");
      const rawDai = parseFloat(tokenData.data?.balances?.DAI?.replace(/,/g, '') || "0");
      const rawWeth = parseFloat(tokenData.data?.balances?.WETH?.replace(/,/g, '') || "0");
      const rawPepe = parseFloat(tokenData.data?.balances?.PEPE?.replace(/,/g, '') || "0");

      const mockTotalVal = (rawEth * 3000) + (rawWeth * 3000) + rawUsdc + rawDai + (rawPepe * 0.00001);
      
      let concentratedRiskToken = null;
      if (mockTotalVal > 0) {
        if ((rawEth * 3000) / mockTotalVal > 0.5) concentratedRiskToken = 'ETH';
        else if ((rawWeth * 3000) / mockTotalVal > 0.5) concentratedRiskToken = 'WETH';
        else if (rawUsdc / mockTotalVal > 0.5) concentratedRiskToken = 'USDC';
        else if (rawDai / mockTotalVal > 0.5) concentratedRiskToken = 'DAI';
        else if ((rawPepe * 0.00001) / mockTotalVal > 0.5) concentratedRiskToken = 'PEPE';
      }

      if (concentratedRiskToken) {
        healthScore = Math.max(0, healthScore - 20);
      }

      updateWalletData(walletIndex, {
        result: {
          ...ethData.data,
          usdcBalance: tokenData.data.balances.USDC || "0",
          daiBalance: tokenData.data.balances.DAI || "0",
          wethBalance: tokenData.data.balances.WETH || "0",
          pepeBalance: tokenData.data.balances.PEPE || "0",
          transactions: txData.data?.recentTransactions || [],
          transactionCount: txData.data?.transactionCount || 0,
          txError: txData.error,
          decodedLogs,
          logsError,
          healthScore,
          concentratedRiskToken,
        }
      });
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message.includes('aborted')) {
        updateWalletData(walletIndex, { error: "Connection timed out. The blockchain node took too long to respond." });
      } else {
        updateWalletData(walletIndex, { error: "Unable to connect to the blockchain network." });
      }
      updateWalletData(walletIndex, { result: null, aiSummary: null });
    } finally {
      updateWalletData(walletIndex, { loading: false });
    }
  };

  const isAnyLoading = wallet1Data.loading || wallet2Data.loading;
  const showResults = wallet1Data.result || wallet2Data.result;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans transition-colors duration-500">
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[30%] -left-[10%] w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.15)_0%,rgba(0,0,0,0)_50%)]" />
      </div>

      <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[60] transition-all duration-500 ${isAnyLoading ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-8 scale-95 pointer-events-none'}`}>
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-indigo-500/30 shadow-[0_10px_40px_-10px_rgba(99,102,241,0.5)] rounded-full px-5 py-2.5 flex items-center gap-3">
          <div className="relative flex items-center justify-center w-5 h-5">
            <div className="absolute inset-0 border-2 border-indigo-500/20 rounded-full"></div>
            <div className="absolute inset-0 border-2 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 tracking-wide">
            Scanning Blockchain...
          </span>
        </div>
      </div>

      <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-slate-200/80 dark:border-slate-800/50 bg-white/50 dark:bg-slate-950/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setIsComparisonMode(false); router.push('/'); }}>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/50 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 dark:text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Wallet <span className="text-indigo-400">Reader</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-grow w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pb-10 pt-28 flex flex-col">
        
        <div className={`transition-all duration-700 ease-in-out w-full mx-auto ${showResults ? 'mb-12 mt-4 max-w-4xl' : 'flex-grow flex flex-col justify-center pb-20 max-w-3xl'}`}>
          <div className="text-center mb-8">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 dark:from-indigo-400 dark:via-purple-400 dark:to-indigo-400 tracking-tight mb-4">
              Decode Any Wallet
            </h2>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto px-2 mb-8">
              Drop in an Ethereum address to instantly analyze its balances, tokens, and AI-driven behavior patterns.
            </p>

            <div className="flex items-center justify-center gap-4 mb-8">
              <button 
                type="button"
                onClick={() => {
                  setIsComparisonMode(false);
                  if (wallet2Data.result) resetWallet(2);
                }}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${!isComparisonMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'}`}
              >
                Single Wallet
              </button>
              <button 
                type="button"
                onClick={() => setIsComparisonMode(true)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${isComparisonMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'}`}
              >
                Compare Wallets
              </button>
            </div>
          </div>

          <div className="bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl dark:shadow-2xl relative w-full">
            {isAnyLoading && (
               <div className="absolute inset-0 bg-white/30 dark:bg-slate-900/10 backdrop-blur-[2px] rounded-3xl z-20 pointer-events-none transition-all duration-300" />
            )}

            <form onSubmit={handleSubmit} className="space-y-6 relative z-30">
              <div className={`grid grid-cols-1 ${isComparisonMode ? 'sm:grid-cols-2 gap-4' : 'gap-2'}`}>
                <div className="space-y-2">
                  <label htmlFor="address1" className="block text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">
                    {isComparisonMode ? "Wallet 1 Address" : "Wallet Address"}
                  </label>
                  <div className="relative group">
                    <input
                      id="address1"
                      type="text"
                      value={address1}
                      onChange={(e) => {
                        setAddress1(e.target.value);
                        if (wallet1Data.error) updateWalletData(1, { error: "" });
                      }}
                      placeholder="0x..."
                      className="w-full bg-slate-100/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-base sm:text-lg rounded-2xl px-4 sm:px-5 py-3 sm:py-4 outline-none transition-all duration-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 group-hover:border-slate-300 dark:group-hover:border-slate-600"
                    />
                    <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 blur transition-opacity duration-500 group-focus-within:opacity-20" />
                  </div>
                  {wallet1Data.error && (
                    <div className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs sm:text-sm animate-in fade-in duration-300 flex items-start gap-2 relative z-30">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <p>{wallet1Data.error}</p>
                    </div>
                  )}
                </div>

                {isComparisonMode && (
                  <div className="space-y-2">
                    <label htmlFor="address2" className="block text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">
                      Wallet 2 Address
                    </label>
                    <div className="relative group">
                      <input
                        id="address2"
                        type="text"
                        value={address2}
                        onChange={(e) => {
                          setAddress2(e.target.value);
                          if (wallet2Data.error) updateWalletData(2, { error: "" });
                        }}
                        placeholder="0x..."
                        className="w-full bg-slate-100/50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-base sm:text-lg rounded-2xl px-4 sm:px-5 py-3 sm:py-4 outline-none transition-all duration-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 group-hover:border-slate-300 dark:group-hover:border-slate-600"
                      />
                      <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 blur transition-opacity duration-500 group-focus-within:opacity-20" />
                    </div>
                    {wallet2Data.error && (
                      <div className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs sm:text-sm animate-in fade-in duration-300 flex items-start gap-2 relative z-30">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <p>{wallet2Data.error}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isAnyLoading || !address1.trim() || (isComparisonMode && !address2.trim())}
                className="w-full relative overflow-hidden group bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-semibold text-lg rounded-2xl px-5 py-4 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isAnyLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white dark:text-slate-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    isComparisonMode ? "Compare Wallets" : "Analyze Wallet"
                  )}
                </span>
                <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-indigo-100 to-purple-100 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              </button>
            </form>
          </div>
        </div>

        {/* Results Grid */}
        {showResults && (
          <div className={`mt-8 grid grid-cols-1 ${isComparisonMode ? 'xl:grid-cols-2' : ''} gap-8 w-full`}>
            {(wallet1Data.result || wallet1Data.loading) && (
              <WalletResultView 
                result={wallet1Data.result} 
                loading={wallet1Data.loading} 
                aiSummary={wallet1Data.aiSummary}
                loadingSummary={wallet1Data.loadingSummary}
                onGenerateSummary={(txs) => generateAiSummary(txs, 1)}
              />
            )}
            
            {isComparisonMode && (wallet2Data.result || wallet2Data.loading) && (
              <WalletResultView 
                result={wallet2Data.result} 
                loading={wallet2Data.loading} 
                aiSummary={wallet2Data.aiSummary}
                loadingSummary={wallet2Data.loadingSummary}
                onGenerateSummary={(txs) => generateAiSummary(txs, 2)}
              />
            )}
          </div>
        )}
      </main>

      <footer className="relative z-20 border-t border-slate-200 dark:border-slate-800/50 bg-white/80 dark:bg-slate-950/80 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center">
          <p className="text-sm text-slate-500">© 2026 Wallet Reader. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
