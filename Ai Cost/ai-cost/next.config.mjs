/** @type {import('next').NextConfig} */
const nextConfig = {
  // Framer Motion v12 layout animations are incompatible with React 19
  // Strict Mode's doubleInvokeEffectsInDEV — causes infinite recursion.
  // Disable strict mode in dev until framer-motion ships a fix.
  reactStrictMode: false,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=()' },
        ]
      }
    ];
  },
  serverExternalPackages: ['hnswlib-node']
};

export default nextConfig;
