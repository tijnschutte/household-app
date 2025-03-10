import '@/app/ui/global.css';
import { inter } from '@/app/ui/fonts';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.className} antialiased w-full max-w-4xl mx-auto px-4 sm:px-6 md:px-8 min-h-screen`}
      >
        <div className="flex flex-col min-h-screen">{children}</div>
      </body>
    </html>
  );
}