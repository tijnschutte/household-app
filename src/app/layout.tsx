import "./globals.css";
import { myFont } from "@/src/app/fonts";
import { Toaster } from "sonner";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Mandje",
  description: "Boodschappen en geld voor je huishouden",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mandje",
  },
  applicationName: "Mandje",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#1e3a8a",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className="h-full">
      <body
        className={`${myFont.className} antialiased h-full w-full bg-background text-foreground`}
      >
        {/* Bottom-center, offset clear of the add bar + tab bar: undo lives
            in these toasts, so they must sit within one-handed thumb reach. */}
        <Toaster
          position="bottom-center"
          richColors
          offset={{ bottom: "9.5rem" }}
          mobileOffset={{ bottom: "9.5rem" }}
        />
        {children}
      </body>
    </html>
  );
}
