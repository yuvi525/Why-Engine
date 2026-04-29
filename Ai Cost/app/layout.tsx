import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Vela — AI Cost Autopilot',
  description: 'Reduce AI costs by up to 90% with intelligent model routing.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  )
}
