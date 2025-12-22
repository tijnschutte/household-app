import './globals.css'
import { myFont } from "@/src/app/fonts";
import { Toaster } from 'sonner';

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