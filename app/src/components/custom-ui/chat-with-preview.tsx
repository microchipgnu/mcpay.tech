// app/src/components/custom-ui/chat-with-preview.tsx
'use client';

import { useState } from 'react';
import { ChatBody } from '@/components/custom-ui/chat-body';
import { Button } from '@/components/ui/button';
import type { ChatMessage } from '@/types/chat';

export interface ChatWithPreviewProps {
  id: string;
  messages: ChatMessage[];
  status: 'idle' | 'streaming' | 'submitted' | 'ready';
  isReadonly?: boolean;
  onSendMessage: (text: string) => void;
  onStop?: () => void;
}

export default function ChatWithPreview({
  id,
  messages,
  status,
  isReadonly = false,
  onSendMessage,
  onStop,
}: ChatWithPreviewProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');

  return (
    <div className="flex flex-col h-dvh">
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-h-0">
          <ChatBody
            chatId={id}
            status={status}
            messages={messages}
            isReadonly={isReadonly}
            onSendMessage={onSendMessage}
            onStop={onStop}
          />
          {/* <DataStreamHandler /> */}
        </div>

        <div className="hidden md:flex flex-col w-2/3 border-l border-gray-200 bg-background">
          <div className="flex space-x-2 p-2 border-b border-muted-background">
            <Button
              variant="ghost"
              size="sm"
              className={`px-2 transition-opacity ${
                activeTab === 'preview' ? 'opacity-100 bg-accent' : 'opacity-50'
              }`}
              onClick={() => setActiveTab('preview')}
            >
              Preview
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`px-2 transition-opacity ${
                activeTab === 'code' ? 'opacity-100 bg-accent' : 'opacity-50'
              }`}
              onClick={() => setActiveTab('code')}
            >
              Code
            </Button>
          </div>
          <div className="flex-1 p-4 overflow-auto">
            {activeTab === 'preview' ? (
              <div>{/* preview renderer here */}</div>
            ) : (
              <div>{/* code viewer here */}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
