import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-context";
import { UserProvider } from "@/components/providers/user";
import { Toaster } from "@/components/ui/sonner";
import Navbar from "@/components/custom-ui/navbar";
import { wagmiConfig } from "@/lib/client/config";
import { WagmiProvider } from "wagmi";
import { AppReactQueryProvider } from "@/components/providers/query-client";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MCPay",
  description: "MCPay - Build and Monetize MCP Servers with x402",
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <WagmiProvider config={wagmiConfig}>
            <AppReactQueryProvider>
              <UserProvider>
                <Navbar />
                {children}
                <Toaster />
              </UserProvider>
            </AppReactQueryProvider>
          </WagmiProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
