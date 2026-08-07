import type { ReactNode } from 'react'
import './globals.css'

export const metadata = {
  title: 'PrismOffice (web)',
  description: 'AI-native office suite — browser edition',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
