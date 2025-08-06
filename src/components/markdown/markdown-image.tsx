import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { DownloadIcon, XIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

import {
  Dialog,
  DialogClose,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { DialogContentWithoutCloseButton as DialogContent } from '@/components/ui/dialog-ext'
import { downloadFile } from '@/lib/dom-utils'

interface MarkdownImageProps {
  src?: string
  alt?: string
}

export function MarkdownImage({
  src,
  alt,
  ...props
}: MarkdownImageProps & React.ImgHTMLAttributes<HTMLImageElement>) {
  const [isOpen, setIsOpen] = useState(false)

  if (!src) {
    return <img src={src} alt={alt} {...props} />
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <VisuallyHidden asChild>
        <DialogTitle asChild>
          <span>{alt}</span>
        </DialogTitle>
      </VisuallyHidden>
      <DialogTrigger asChild>
        <img
          src={src}
          alt={alt}
          {...props}
          className="cursor-pointer transition-transform duration-200 ease-in-out hover:scale-105"
        />
      </DialogTrigger>
      <DialogContent className="max-w-max! min-w-[300px] p-0">
        <img
          src={src}
          alt={alt}
          className="max-h-[90vh] w-full rounded-lg object-contain"
        />
        <div className="absolute right-4 top-4 flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              if (src) {
                downloadFile(src, alt || 'image')
              }
            }}
          >
            <DownloadIcon className="h-4 w-4" />
          </Button>
          <DialogClose asChild>
            <Button variant="outline" size="icon">
              <XIcon className="h-4 w-4" />
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}
