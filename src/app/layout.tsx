import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { FirebaseClientProvider } from "@/firebase/client-provider"

export const metadata: Metadata = {
  title: 'FreshTally - Business Management',
  description: 'Fast, secure, and intuitive business management for store owners.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-gray-100">
        <FirebaseClientProvider>
          <div className="max-w-md mx-auto min-h-screen bg-background relative flex flex-col shadow-xl">
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
