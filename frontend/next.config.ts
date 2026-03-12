import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',      // static export — Go embeds and serves the output
  trailingSlash: true,   // /overview/ → overview/index.html
  images: {
    unoptimized: true,   // required for static export
  },
}

export default nextConfig
