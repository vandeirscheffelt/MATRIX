/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'tbapcaxbawruijrigafn.supabase.co' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
}

export default nextConfig
