import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { FirebaseClientProvider } from "@/firebase/client-provider"
import { TopBar } from "@/components/layout/top-bar"

export const metadata: Metadata = {
  title: 'FreshTally - Smart Wet Market Management',
  description: 'The fastest POS and inventory system optimized for wet markets and perishable goods.',
  openGraph: {
    title: 'FreshTally - Smart Wet Market Management',
    description: 'The fastest POS and inventory system optimized for wet markets.',
    url: 'https://storesolution-3bee5.web.app',
    siteName: 'FreshTally',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'FreshTally Dashboard Preview',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FreshTally - Smart Wet Market Management',
    description: 'Optimized for wet market operations.',
    images: ['/og-image.png'],
  },
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0',
  themeColor: '#16a34a', // primary green
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/favicon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-gray-100">
        <FirebaseClientProvider>
          <div className="max-w-screen-xl mx-auto min-h-screen bg-background relative flex flex-col shadow-2xl">
            <TopBar />
            <main className="flex-1 pb-20">
              {children}
            </main>
            <Toaster />
          </div>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
