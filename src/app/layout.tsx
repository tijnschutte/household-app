import './globals.css'
import { myFont } from "@/src/app/fonts";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${myFont.className} antialiased w-full min-h-screen`}>
        <main className="flex flex-col flex-1 items-center justify-center border h-[100dvh]">
          {children}
        </main>
      </body>
    </html>
  );
}