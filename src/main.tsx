import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'

import { ThemeProvider } from '@/contexts/theme-context'

import App from './app'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Disable retries for local operations to prevent issues when offline
      retry: false,
      // Reduce stale time for local data since it's fast to refetch
      staleTime: 1000,
      // Disable network online/offline detection since we work locally
      networkMode: 'always',
    },
    mutations: {
      // Disable retries for mutations to prevent hanging when offline
      retry: false,
      // Disable network online/offline detection since we work locally
      networkMode: 'always',
    },
  },
})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
