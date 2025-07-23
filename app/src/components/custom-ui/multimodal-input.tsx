'use client';

import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import { SuggestedActions } from '@/components/custom-ui/suggested-actions';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ArrowDown, ArrowUp, Ban } from 'lucide-react';
import { toast } from 'sonner';

interface MultimodalInputProps {
  chatId: string;
  messagesCount: number;
  status: 'idle' | 'streaming' | 'submitted' | 'ready';
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  isReadonly?: boolean;
  onStop?: () => void;
  onSendMessage: (text: string) => void;
}

export function MultimodalInput({
  chatId,
  messagesCount,
  status,
  input,
  setInput,
  isReadonly = false,
  onStop,
  onSendMessage,
}: MultimodalInputProps) {
  const handleSubmit = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    onSendMessage(text);
    setInput('');
  }, [input, onSendMessage, setInput]);

  const { isAtBottom, scrollToBottom } = useScrollToBottom();

  return (
    <div className="relative w-full flex flex-col gap-2 bg-background">
      <AnimatePresence>
        {!isAtBottom && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="absolute left-1/2 bottom-20 -translate-x-1/2 z-50"
          >
            <Button
              size="icon"
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                scrollToBottom();
              }}
            >
              <ArrowDown size={16} />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {messagesCount === 0 && (
        <SuggestedActions chatId={chatId} sendMessage={onSendMessage} />
      )}

      <div className="flex w-full items-end gap-2 p-4">
        <Textarea
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (status === 'streaming') {
                toast.error(
                  'Please wait for the response before sending a new message.'
                );
              } else {
                handleSubmit();
              }
            }
          }}
          className="flex-1 resize-none"
          rows={2}
        />

        {status === 'streaming' ? (
          <Button variant="ghost" onClick={onStop} title="Stop generation">
            <Ban size={16} />
          </Button>
        ) : (
          <Button
            variant="ghost"
            onClick={handleSubmit}
            disabled={!input.trim()}
            title="Send message"
          >
            <ArrowUp size={16} />
          </Button>
        )}
      </div>
    </div>
  );
}
