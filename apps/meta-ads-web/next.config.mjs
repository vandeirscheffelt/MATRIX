/** @type {import('next').NextConfig} */
const config = {
  env: {
    API_URL: process.env.META_ADS_API_URL ?? 'http://localhost:3200',
  },
}

export default config
