/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',      // static export — Go embeds and serves the output
  trailingSlash: true,   // /overview/ → overview/index.html
  images: {
    unoptimized: true,   // required for static export
  },
}

export default nextConfig
