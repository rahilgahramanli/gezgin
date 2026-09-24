import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GEZGIN admin',
  description: 'Moderasiya və istifadəçi idarəsi',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="az">
      <body>{children}</body>
    </html>
  );
}
