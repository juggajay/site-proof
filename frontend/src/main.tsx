import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/lib/theme';
import { DateFormatProvider } from '@/lib/dateFormat';
import { TimezoneProvider } from '@/lib/timezone';
import { installStaleAssetRecovery } from '@/lib/staleAssetRecovery';
import { initSentry } from '@/lib/sentry';
import App from './App';
import './index.css';

// Initialize error monitoring before the app renders.
initSentry();

installStaleAssetRecovery();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <DateFormatProvider>
        <TimezoneProvider>
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <Sentry.ErrorBoundary
                fallback={
                  <div
                    role="alert"
                    style={{
                      padding: '2rem',
                      textAlign: 'center',
                      fontFamily: 'system-ui, sans-serif',
                    }}
                  >
                    <h1>Something went wrong</h1>
                    <p>An unexpected error occurred. Please refresh the page.</p>
                  </div>
                }
              >
                <App />
              </Sentry.ErrorBoundary>
            </BrowserRouter>
          </QueryClientProvider>
        </TimezoneProvider>
      </DateFormatProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
