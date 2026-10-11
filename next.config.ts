import path from 'node:path'
import { withSentryConfig } from '@sentry/nextjs/config'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // A stray lockfile higher up the tree would otherwise be picked as the workspace root.
  turbopack: { root: path.resolve('.') },
}

export default withSentryConfig(nextConfig, { silent: !process.env.CI })
