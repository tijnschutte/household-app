import './globals.css'
import { myFont } from "@/src/app/fonts";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${myFont.className} antialiased min-h-screen flex flex-col h-screen justify-center items-center overflow-x-hidden w-full`}>
        {/* <div className=""> */}
        {children}
        {/* </div> */}
      </body>
    </html>
  );
}