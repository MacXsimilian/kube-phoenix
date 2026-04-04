/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',      // static export — Go embeds and serves the output
  trailingSlash: true,   // /overview/ → overview/index.html
  images: {
    unoptimized: true,   // required for static export
  },
  pageExtensions: [
    'tsx', 'ts', 'jsx', 'js',
    // .proto.tsx pages (prototypes) are only included during dev-mock
    ...(process.env.NEXT_PUBLIC_PROTOTYPES === '1' ? ['proto.tsx'] : []),
  ],
}

export default nextConfig
