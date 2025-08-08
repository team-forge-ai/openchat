import React from 'react'

export const ChatEmptyState: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full relative">
      <picture className="absolute inset-0 h-full w-full overflow-hidden z-0">
        <source
          type="image/webp"
          srcSet="/images/nux/640.webp 640w, /images/nux/1280.webp 1280w, /images/nux/1920.webp 1920w"
        />
        <img
          className="absolute inset-0 h-full w-full scale-[1.02] object-cover opacity-50 blur-2xl dark:opacity-30"
          alt=""
          aria-hidden="true"
          src="/images/nux/640.webp"
          srcSet="/images/nux/640.webp 640w, /images/nux/1280.webp 1280w, /images/nux/1920.webp 1920w"
          sizes="100vw"
          loading="eager"
          fetchPriority="high"
        />
        <div className="absolute inset-0 h-full w-full bg-gradient-to-b from-transparent to-white dark:to-black" />
      </picture>
      <div className="relative z-10 text-center text-foreground">
        <div className="text-lg font-medium mb-2">Welcome to OpenChat</div>
        <div>Send a message to get started.</div>
      </div>
    </div>
  )
}
