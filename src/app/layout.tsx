import './globals.css'
import { myFont } from "@/src/app/fonts";
import { ViewportProvider } from './ViewportProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${myFont.className} antialiased min-h-screen h-[calc(var(--vh)_*_100)] flex flex-col justify-center items-center overflow-x-hidden w-full`}>
        <ViewportProvider>
          {children}
        </ViewportProvider>
      </body>
    </html>
  );
}