/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@boilerplate/ui', '@boilerplate/auth', '@boilerplate/billing'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'tbapcaxbawruijrigafn.supabase.co' },
    ],
  },
}

export default nextConfig
