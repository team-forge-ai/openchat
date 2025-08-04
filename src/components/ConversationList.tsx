import { MessageSquare, Plus } from 'lucide-react'
import React from 'react'

import { Button } from '@/components/ui/button'
import type { Conversation } from '@/types'

interface ConversationListProps {
  conversations: Conversation[]
  selectedConversationId: number | null
  onSelectConversation: (id: number) => void
  onCreateConversation: () => void
  isLoading: boolean
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedConversationId,
  onSelectConversation,
  onCreateConversation,
  isLoading,
}) => {
  return (
    <div className="w-64 bg-muted border-r border-border flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <Button
          onClick={onCreateConversation}
          className="w-full"
          disabled={isLoading}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            No conversations yet
          </div>
        ) : (
          <div className="p-2">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => onSelectConversation(conversation.id)}
                className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${
                  selectedConversationId === conversation.id
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{conversation.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(conversation.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
