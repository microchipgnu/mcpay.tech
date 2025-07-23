'use client';

import { AnimatePresence, motion } from 'motion/react';
import { memo } from 'react';
import type { ChatMessage } from '@/types/chat';
import { cn, sanitizeText } from '@/lib/utils';

interface PreviewMessageProps {
  message: ChatMessage;
  isLoading: boolean;
  requiresScrollPadding?: boolean;
}

function PurePreviewMessage({
  message,
  isLoading,
  requiresScrollPadding = false,
}: PreviewMessageProps) {
  return (
    <AnimatePresence>
      <motion.div
        data-testid={`message-${message.role}`}
        className="w-full mx-auto max-w-3xl px-4 group/message"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role={message.role}
      >
        <div
          className={cn(
            'flex gap-4 w-full',
            message.role === 'user' ? 'ml-auto max-w-2xl' : undefined
          )}
        >
          {/* Assistant icon placeholder */}
          {message.role === 'assistant' && (
            <div className="size-8 flex items-center justify-center rounded-full ring-1 ring-border bg-background" />
          )}
          
          <div
            className={cn('flex flex-col gap-4 w-full', {
              'min-h-96': message.role === 'assistant' && requiresScrollPadding,
            })}
          >
            <div
              data-testid="message-content"
              className={cn('flex flex-col gap-4', {
                'bg-primary text-primary-foreground px-3 py-2 rounded-xl':
                  message.role === 'user',
              })}
            >
              {sanitizeText(
                message.parts.find((p) => p.type === 'text')?.text || ''
              )}
            </div>

            {isLoading && message.role === 'assistant' && (
              <div className="text-sm text-muted-foreground">Typing…</div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prev, next) =>
    prev.isLoading === next.isLoading &&
    prev.message.id === next.message.id &&
    prev.requiresScrollPadding === next.requiresScrollPadding
);

export const ThinkingMessage = () => (
  <motion.div
    data-testid="message-assistant-loading"
    className="w-full mx-auto max-w-3xl px-4 group/message min-h-96"
    initial={{ y: 5, opacity: 0 }}
    animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
    data-role="assistant"
  >
    <div className="flex items-center gap-4 px-3 py-2 rounded-xl bg-muted">
      <div className="size-8 flex items-center justify-center rounded-full ring-1 ring-border" />
      <div className="flex-1 text-muted-foreground">Hmm…</div>
    </div>
  </motion.div>
);
