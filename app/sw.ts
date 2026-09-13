import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from 'serwist';
import { NetworkOnly, Serwist } from 'serwist';

type SwScope = SerwistGlobalConfig & {
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
};

// `self` comes from the DOM lib (no webworker lib in tsconfig by design),
// so cast instead of annotating with ServiceWorkerGlobalScope.
// NOTE (deviation from Task 7 brief): the precache reads `self` inline
// rather than via an intermediate `swSelf` const, because Serwist injects
// the manifest by string-matching the literal `self.__SW_MANIFEST` in the
// compiled bundle (default `injectionPoint`) — an aliased identifier would
// fail the build with "Can't find self.__SW_MANIFEST in your SW source".
// The TS assertion is erased at compile time, so the literal survives.

// HR, payroll, and auth API responses must never be served stale.
// These NetworkOnly routes are evaluated BEFORE defaultCache.
const neverCache: RuntimeCaching[] = [
  {
    matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/api/'),
    handler: new NetworkOnly(),
  },
  {
    // Face-api model weights: large blobs, loaded on demand. Keep them
    // out of the precache/runtime caches in v1 to avoid storage pressure.
    matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/models/'),
    handler: new NetworkOnly(),
  },
];

const serwist = new Serwist({
  precacheEntries: (self as unknown as SwScope).__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [...neverCache, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher({ request }) {
          return request.destination === 'document';
        },
      },
    ],
  },
});

serwist.addEventListeners();
