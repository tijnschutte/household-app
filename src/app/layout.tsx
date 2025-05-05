import './globals.css'
import { myFont } from "@/src/app/fonts";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${myFont.className} antialiased h-full w-full flex flex-col`}>
        <main className="flex-grow">
          {children}
        </main>
      </body>
    </html>
  );
}