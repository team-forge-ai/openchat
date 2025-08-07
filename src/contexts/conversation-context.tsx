import React, { createContext, useContext, useState } from 'react'

interface ConversationContextValue {
  selectedConversationId: number | null
  setSelectedConversationId: (id: number | null) => void
}

const ConversationContext = createContext<ConversationContextValue | undefined>(
  undefined,
)

interface ConversationProviderProps {
  children: React.ReactNode
}

export function ConversationProvider({ children }: ConversationProviderProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<
    number | null
  >(null)

  return (
    <ConversationContext.Provider
      value={{ selectedConversationId, setSelectedConversationId }}
    >
      {children}
    </ConversationContext.Provider>
  )
}

export function useConversation() {
  const context = useContext(ConversationContext)
  if (!context) {
    throw new Error('useConversation must be used within ConversationProvider')
  }
  return context
}
