import { Inter } from 'next/font/google'
import Providers from './providers'

const inter = Inter({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'] })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <head>
        <title>kube-phoenix</title>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🐦‍🔥</text></svg>" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
