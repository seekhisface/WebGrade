import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/auth/provider';

export const metadata: Metadata = {
  title: 'WebGrade — Website Intelligence Platform',
  description: 'Behavioral forensics, SEO diagnostics, ad spend intelligence, and market opportunity analysis for founders.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <script src="https://www.webgrade.io/api/snippet?id=cmnf1qktr000313a6dovfcd55" async></script>
      </head>
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
