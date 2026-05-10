import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/lib/theme';
import { DateFormatProvider } from '@/lib/dateFormat';
import { TimezoneProvider } from '@/lib/timezone';
import { installStaleAssetRecovery } from '@/lib/staleAssetRecovery';
import App from './App';
import './index.css';

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
            <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
              <App />
            </BrowserRouter>
          </QueryClientProvider>
        </TimezoneProvider>
      </DateFormatProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
