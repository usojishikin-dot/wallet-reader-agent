"use client";

import { useState } from "react";

export default function Home() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      setResult(data.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-indigo-500/30 flex flex-col items-center justify-center p-4 sm:p-8 font-sans">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.15)_0%,rgba(0,0,0,0)_50%)]" />
      </div>

      <main className="relative z-10 w-full max-w-xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
            Wallet Reader
          </h1>
          <p className="text-lg text-slate-400 max-w-md mx-auto">
            Enter your wallet address to unlock detailed insights and analytics instantly.
          </p>
        </div>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="address" className="block text-sm font-medium text-slate-300 ml-1">
                Wallet Address
              </label>
              <div className="relative group">
                <input
                  id="address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-slate-950/50 border border-slate-700 text-slate-100 text-lg rounded-2xl px-5 py-4 outline-none transition-all duration-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 group-hover:border-slate-600"
                  required
                />
                <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 blur transition-opacity duration-500 group-focus-within:opacity-20" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !address}
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
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <p className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            </div>
          )}

          {result && (
            <div className="mt-8 p-6 bg-slate-950/50 border border-slate-800 rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3 className="text-lg font-medium text-slate-200 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Wallet Analysis Complete
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800/50">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Status</p>
                  <p className="text-emerald-400 font-medium">{result.status}</p>
                </div>
                <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800/50">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Network</p>
                  <p className="text-slate-200 font-medium">{result.network}</p>
                </div>
                <div className="col-span-2 p-4 bg-slate-900/80 rounded-xl border border-slate-800/50">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Balance</p>
                  <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
                    {result.balance} <span className="text-lg text-emerald-400/70 font-medium">ETH</span>
                  </p>
                </div>
                <div className="col-span-2 p-4 bg-slate-900/80 rounded-xl border border-slate-800/50">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Address</p>
                  <p className="text-sm text-slate-300 font-mono break-all">{result.address}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
