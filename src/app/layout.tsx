import './globals.css'
import { myFont } from "@/src/app/fonts";
import { Toaster } from 'sonner';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Mandje',
  description: 'Household grocery list app',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Mandje',
  },
  applicationName: 'Mandje',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#1e3a8a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${myFont.className} antialiased h-full w-full`}>
        <Toaster position="top-center" richColors />
        {children}
      </body>
    </html>
  );
}