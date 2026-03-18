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
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
