import React, { createContext, useContext, useState } from 'react'

type AppView = 'conversations' | 'settings'

interface AppContextValue {
  selectedConversationId: number | null
  setSelectedConversationId: (id: number | null) => void
  view: AppView
  setView: (view: AppView) => void
}

const AppContext = createContext<AppContextValue | undefined>(undefined)

interface AppContextProviderProps {
  children: React.ReactNode
}

export function AppContextProvider({ children }: AppContextProviderProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<
    number | null
  >(null)
  const [view, setView] = useState<AppView>('conversations')

  return (
    <AppContext.Provider
      value={{
        selectedConversationId,
        setSelectedConversationId,
        view,
        setView,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used within AppContextProvider')
  }
  return context
}
