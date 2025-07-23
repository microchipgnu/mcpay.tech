// app/src/app/build/page.tsx
'use client';

import React, { Suspense, useState } from 'react';
import ChatWithPreview from '@/components/custom-ui/chat-with-preview';
import type { ChatMessage } from '@/types/chat';
import { generateUUID } from '@/lib/utils';

export default function BuildPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<'idle' | 'streaming' | 'submitted' | 'ready'>('ready');

  const handleSendMessage = (text: string) => {
    // append a user message
    setMessages((msgs) => [
      ...msgs,
      { id: generateUUID(), role: 'user', parts: [{ type: 'text', text }] },
    ]);

    // here you could invoke your API and stream assistant responses,
    // updating `status` and appending assistant messages to `messages`.
  };

  const handleStop = () => {
    // stub: cancel a streaming response if you wire that up
    setStatus('idle');
  };

  return (
    <Suspense fallback={null}>
      <div className="flex flex-col h-screen">
        <ChatWithPreview
          id="main-chat"
          messages={messages}
          status={status}
          isReadonly={false}
          onSendMessage={handleSendMessage}
          onStop={handleStop}
        />
      </div>
    </Suspense>
  );
}
