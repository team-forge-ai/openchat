import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react'

type Theme = 'dark' | 'light' | 'system'
type Scheme = Exclude<Theme, 'system'>

const DEFAULT_STORAGE_KEY = 'vite-ui-theme'

function getSystemScheme(): Scheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function applyThemeClass(root: HTMLElement, scheme: Scheme): void {
  root.classList.remove('light', 'dark')
  root.classList.add(scheme)
}

interface ThemeProviderProps {
  children: ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

interface ThemeProviderState {
  theme: Theme
  resolvedTheme: Scheme
  setTheme: (theme: Theme) => void
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined,
)

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = DEFAULT_STORAGE_KEY,
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem(storageKey) as Theme) || defaultTheme
    } catch {
      return defaultTheme
    }
  })

  const resolvedTheme: Scheme = theme === 'system' ? getSystemScheme() : theme

  useLayoutEffect(() => {
    const root = window.document.documentElement
    const schemeToApply: Scheme = theme === 'system' ? getSystemScheme() : theme
    applyThemeClass(root, schemeToApply)
  }, [theme])

  useEffect(() => {
    const mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (event: MediaQueryListEvent) => {
      const scheme: Scheme = event.matches ? 'dark' : 'light'

      if (theme === 'system') {
        const root = window.document.documentElement
        applyThemeClass(root, scheme)
      }
    }

    mediaQueryList.addEventListener('change', handleChange)

    return () => {
      mediaQueryList.removeEventListener('change', handleChange)
    }
  }, [theme])

  const value: ThemeProviderState = {
    theme,
    resolvedTheme,
    setTheme: (nextTheme: Theme) => {
      try {
        localStorage.setItem(storageKey, nextTheme)
      } catch {
        // no-op if storage is unavailable
      }
      setTheme(nextTheme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export function useTheme(): ThemeProviderState {
  const context = useContext(ThemeProviderContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
