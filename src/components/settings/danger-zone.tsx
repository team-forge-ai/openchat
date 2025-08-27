import React, { useState } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useConversations } from '@/hooks/use-conversations'

export const DangerZone: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const { deleteAllConversations } = useConversations()

  const handleDeleteAll = () => {
    deleteAllConversations.mutate()
    setIsOpen(false)
  }

  return (
    <div className="border border-destructive/20 rounded-lg p-6 bg-destructive/5">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-destructive">
            Danger Zone
          </h3>
          <p className="text-sm text-muted-foreground">
            Irreversible and destructive actions.
          </p>
        </div>

        <div className="flex items-center justify-between p-4 border border-destructive/20 rounded-md">
          <div>
            <h4 className="font-medium">Delete all conversations</h4>
            <p className="text-sm text-muted-foreground">
              Permanently delete all conversations and messages. This action
              cannot be undone.
            </p>
          </div>

          <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={deleteAllConversations.isLoading}
              >
                {deleteAllConversations.isLoading
                  ? 'Deleting...'
                  : 'Delete All'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete all
                  conversations and messages from your device.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAll}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete All Conversations
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  )
}
