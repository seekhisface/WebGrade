import type { Metadata } from 'next';
import './globals.css';

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
      <body className="antialiased">{children}</body>
    </html>
  );
}
