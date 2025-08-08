import type { Insertable, Selectable, Updateable } from 'kysely'

import type { DB } from '@/types/db'

export type { DB }

export type Conversation = Selectable<DB['conversations']>
export type Message = Selectable<DB['messages']>
export type MessageStatus = Selectable<DB['messages']>['status']

export type NewConversation = Insertable<DB['conversations']>
export type ConversationUpdate = Updateable<DB['conversations']>
export type NewMessage = Insertable<DB['messages']>
export type MessageUpdate = Updateable<DB['messages']>
