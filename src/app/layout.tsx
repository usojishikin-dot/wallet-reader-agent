import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WalletReader | Advanced Crypto Analytics",
  description: "Decode any Ethereum wallet instantly. Uncover AI-powered behavior patterns, real-time balances, token concentration risk, and Degen Scores.",
  keywords: ["Crypto", "Wallet Analytics", "Ethereum", "Web3", "Portfolio Tracker", "AI Blockchain Analysis"],
  openGraph: {
    title: "WalletReader | Advanced Crypto Analytics",
    description: "Decode any Ethereum wallet instantly. Uncover AI-powered behavior patterns, real-time balances, token concentration risk, and Degen Scores.",
    url: "https://walletreader.app",
    siteName: "WalletReader",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WalletReader | Advanced Crypto Analytics",
    description: "Decode any Ethereum wallet instantly. Uncover AI-powered behavior patterns, real-time balances, and Degen Scores.",
  },
  icons: {
    icon: "/icon.svg",
  },
};

import { ThemeProvider } from "@/components/ThemeProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50 font-sans selection:bg-indigo-500/30 selection:text-indigo-900 dark:selection:text-white transition-colors duration-500">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
