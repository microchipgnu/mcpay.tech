// app/src/components/custom-ui/chat-body.tsx
'use client';

import { useState } from 'react';
import type { ChatMessage } from '@/types/chat';
import { Messages } from '@/components/custom-ui/messages';
import { MultimodalInput } from '@/components/custom-ui/multimodal-input';

export interface ChatBodyProps {
  chatId: string;
  status: 'idle' | 'streaming' | 'submitted' | 'ready';
  messages: ChatMessage[];
  isReadonly?: boolean;
  onSendMessage: (text: string) => void;
  onStop?: () => void;
}

export function ChatBody({
  chatId,
  status,
  messages,
  isReadonly = false,
  onSendMessage,
  onStop,
}: ChatBodyProps) {
  const [input, setInput] = useState('');

  return (
    <div className="flex flex-col min-w-0 h-dvh bg-background">
      <Messages status={status} messages={messages} />

      <form
        className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl"
        onSubmit={(e) => {
          e.preventDefault();
          if (!isReadonly && input.trim()) {
            onSendMessage(input);
            setInput('');
          }
        }}
      >
        <MultimodalInput
          chatId={chatId}
          messagesCount={messages.length}
          status={status}
          input={input}
          setInput={setInput}
          isReadonly={isReadonly}
          onStop={onStop}
          onSendMessage={onSendMessage}
        />
      </form>
    </div>
  );
}
