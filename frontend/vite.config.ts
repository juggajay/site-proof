import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import path from 'path';

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
const PLACEHOLDER_MARKERS = ['example.', 'placeholder', 'your-'];

const manualChunkGroups: Record<string, string[]> = {
  'vendor-react': ['react', 'react-dom', 'react-router-dom'],
  'vendor-ui': [
    '@radix-ui/react-dialog',
    '@radix-ui/react-dropdown-menu',
    '@radix-ui/react-tabs',
    '@radix-ui/react-tooltip',
    '@radix-ui/react-accordion',
    '@radix-ui/react-alert-dialog',
    '@radix-ui/react-label',
    '@radix-ui/react-separator',
    '@radix-ui/react-slot',
    'class-variance-authority',
    'clsx',
    'tailwind-merge',
    'lucide-react',
  ],
  'vendor-data': [
    '@tanstack/react-query',
    'zustand',
    'zod',
    'react-hook-form',
    '@hookform/resolvers',
  ],
  'vendor-offline': ['dexie'],
};

const deferredHtmlModulePreloadPrefixes = [
  'vendor-pdf',
  'vendor-pdf-viewer',
  'vendor-charts',
  'PDFViewer',
  'BarChart',
  'jspdf',
  'ClaimsCharts',
  'HoldPointsChart',
  'LazyCharts',
  'pdf.worker',
  'pdfGenerator',
  'html2canvas',
  'index.es',
];

type ModulePreloadContext = {
  hostId: string;
  hostType: 'html' | 'js';
};

function hasPlaceholderMarker(value: string): boolean {
  const normalized = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker));
}

function validateProductionPublicBaseUrl(name: string, value: string | undefined): void {
  const rawValue = value?.trim() ?? '';
  if (!rawValue || rawValue === '/') {
    return;
  }

  const withoutTrailingSlash = rawValue.replace(/\/+$/, '');
  if (withoutTrailingSlash.startsWith('/') && !withoutTrailingSlash.startsWith('//')) {
    return;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(withoutTrailingSlash);
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) URL or a same-origin path`);
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error(`${name} must use HTTP or HTTPS`);
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error(`${name} must use HTTPS in production`);
  }

  if (LOCAL_HOSTNAMES.has(parsedUrl.hostname)) {
    throw new Error(`${name} cannot point to localhost in production`);
  }

  if (hasPlaceholderMarker(withoutTrailingSlash)) {
    throw new Error(`${name} must not use placeholder values in production`);
  }
}

function validateProductionPublicEnv(env: Record<string, string | undefined>): void {
  validateProductionPublicBaseUrl('VITE_API_URL', env.VITE_API_URL);
  validateProductionPublicBaseUrl('VITE_SUPABASE_URL', env.VITE_SUPABASE_URL);
  if (!env.VITE_SENTRY_DSN?.trim()) {
    throw new Error(
      'VITE_SENTRY_DSN is required for production builds (frontend error monitoring). ' +
        'Set it in the build environment; it never crashes the browser app at runtime.',
    );
  }
}

function shouldDeferHtmlModulePreload(dep: string): boolean {
  const fileName = dep.replace(/\\/g, '/').split('/').pop() || dep;
  return deferredHtmlModulePreloadPrefixes.some((prefix) => fileName.startsWith(prefix));
}

function resolveModulePreloadDependencies(
  _filename: string,
  deps: string[],
  context: ModulePreloadContext,
): string[] {
  if (context.hostType !== 'html') {
    return deps;
  }

  return deps.filter((dep) => !shouldDeferHtmlModulePreload(dep));
}

function matchesOptimizedDependency(normalizedId: string, packageName: string): boolean {
  const optimizedPackageName = packageName.replace('/', '_');
  const marker = `/node_modules/.vite/deps/${optimizedPackageName}`;
  const markerIndex = normalizedId.indexOf(marker);

  if (markerIndex === -1) {
    return false;
  }

  const nextCharacter = normalizedId.charAt(markerIndex + marker.length);
  return (
    nextCharacter === '' || nextCharacter === '.' || nextCharacter === '?' || nextCharacter === '_'
  );
}

function matchesPackage(normalizedId: string, packageName: string): boolean {
  return (
    normalizedId.includes(`/node_modules/${packageName}/`) ||
    matchesOptimizedDependency(normalizedId, packageName)
  );
}

function isCoreReactRuntimeModule(normalizedId: string): boolean {
  return (
    normalizedId.includes('vite/preload-helper') ||
    normalizedId.includes('react/jsx-runtime') ||
    normalizedId.includes('react/jsx-dev-runtime') ||
    normalizedId.includes('react_jsx-runtime') ||
    normalizedId.includes('react_jsx-dev-runtime')
  );
}

function manualChunks(id: string): string | undefined {
  const normalizedId = id.replace(/\\/g, '/');

  if (isCoreReactRuntimeModule(normalizedId)) {
    return 'vendor-react';
  }

  if (!normalizedId.includes('/node_modules/')) {
    return undefined;
  }

  for (const [chunkName, packages] of Object.entries(manualChunkGroups)) {
    if (packages.some((packageName) => matchesPackage(normalizedId, packageName))) {
      return chunkName;
    }
  }

  return undefined;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (mode === 'production') {
    validateProductionPublicEnv(env);
  }

  const apiProxyTarget = env.VITE_API_URL || 'http://localhost:3001';

  // Upload source maps to Sentry only when the build environment provides the
  // upload credentials (auth token + org + project). Otherwise build normally
  // without emitting/uploading maps.
  const sentryAuthToken = env.SENTRY_AUTH_TOKEN;
  const sentryOrg = env.SENTRY_ORG;
  const sentryProject = env.SENTRY_PROJECT || env.SENTRY_FRONTEND_PROJECT;
  const uploadSentrySourcemaps =
    mode === 'production' && Boolean(sentryAuthToken && sentryOrg && sentryProject);

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: [
          'siteproof-icon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
        ],
        manifest: {
          name: 'SiteProof v3',
          short_name: 'SiteProof',
          description: 'Civil Execution and Conformance Platform',
          theme_color: '#1e40af',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          // Keep heavyweight lazy features out of the install-time precache.
          // They are still fetched and HTTP-cached on demand when users open PDF,
          // export, or analytics flows.
          globIgnores: [
            '**/assets/pdf.worker*.mjs',
            '**/assets/pdfGenerator*.js',
            '**/assets/PDFViewer*.js',
            '**/assets/PDFViewer*.css',
            '**/assets/jspdf*.js',
            '**/assets/vendor-pdf*.js',
            '**/assets/vendor-pdf-viewer*.js',
            '**/assets/vendor-pdf-viewer*.css',
            '**/assets/vendor-charts*.js',
            '**/assets/BarChart*.js',
            '**/assets/ClaimsCharts*.js',
            '**/assets/HoldPointsChart*.js',
            '**/assets/LazyCharts*.js',
            '**/assets/html2canvas*.js',
            '**/assets/index.es*.js',
          ],
          // Import the push notification service worker
          importScripts: ['sw-push.js'],
        },
      }),
      ...(uploadSentrySourcemaps
        ? [
            sentryVitePlugin({
              org: sentryOrg,
              project: sentryProject,
              authToken: sentryAuthToken,
              telemetry: false,
              ...(env.VITE_SENTRY_RELEASE ? { release: { name: env.VITE_SENTRY_RELEASE } } : {}),
              sourcemaps: {
                filesToDeleteAfterUpload: ['./dist/**/*.map'],
              },
            }),
          ]
        : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5174,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      // Emit source maps only when we are uploading them to Sentry; the plugin
      // deletes the emitted .map files after upload so they are never shipped.
      sourcemap: uploadSentrySourcemaps,
      modulePreload: {
        resolveDependencies: resolveModulePreloadDependencies,
      },
      rollupOptions: {
        output: {
          manualChunks,
        },
      },
      chunkSizeWarningLimit: 500,
    },
  };
});
