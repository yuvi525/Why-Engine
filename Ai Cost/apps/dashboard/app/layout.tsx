import './globals.css';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export const metadata = {
  title: 'Vela - AI Cost Autopilot',
  description: 'AI Routing & Cost Management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-[#0A0A0F] text-[#E8E8F0] font-sans antialiased min-h-screen flex">
        <Sidebar />
        <div className="flex-1 flex flex-col pl-[220px]">
          <Header />
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
