import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "kAIRON | Quant Simulation Terminal (XAUUSD & Forex)",
  description: "High-speed market simulation and strategy backtesting terminal for Pivot Order Blocks with dynamic ATR/RR targets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090c10] text-[#f0f6fc] antialiased">
        {children}
      </body>
    </html>
  );
}
