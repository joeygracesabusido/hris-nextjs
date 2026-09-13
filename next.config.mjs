// @ts-check
import withSerwistInit from '@serwist/next';
import { spawnSync } from 'node:child_process';

const gitHead = String(
  spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).stdout || '',
).trim();
const revision = gitHead || crypto.randomUUID();

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
  register: false,
  additionalPrecacheEntries: [{ url: '/offline', revision }],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['date-fns'],
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
};

export default withSerwist(nextConfig);
