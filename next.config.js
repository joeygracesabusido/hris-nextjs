/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Fix ESM resolution issues for date-fns v3
  transpilePackages: ['date-fns'],

  // Configure allowed image domains if needed
  images: {
    domains: ['lh3.googleusercontent.com'], // For Google profile images
  },
}

module.exports = nextConfig