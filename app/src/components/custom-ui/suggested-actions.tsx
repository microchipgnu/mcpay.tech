'use client';

import { motion } from "motion/react";
import { Button } from '@/components/ui/button';
import { memo } from 'react';

interface SuggestedActionsProps {
  chatId: string;
  sendMessage: (text: string) => void;
}

const suggestedActions = [
  {
    title: 'What are the advantages',
    label: 'of using Next.js?',
    action: 'What are the advantages of using Next.js?',
  },
  {
    title: 'Write code to',
    label: "demonstrate Dijkstra's algorithm",
    action: "Write code to demonstrate Dijkstra's algorithm",
  },
  {
    title: 'Help me write an essay',
    label: 'about Silicon Valley',
    action: 'Help me write an essay about Silicon Valley',
  },
  {
    title: 'What is the weather',
    label: 'in San Francisco?',
    action: 'What is the weather in San Francisco?',
  },
];

function PureSuggestedActions({ chatId, sendMessage }: SuggestedActionsProps) {
  return (
    <div
      data-testid="suggested-actions"
      className="grid sm:grid-cols-2 gap-2 w-full"
    >
      {suggestedActions.map((item, idx) => (
        <motion.div
          key={`suggested-action-${idx}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.05 * idx }}
          className={idx > 1 ? 'hidden sm:block' : 'block'}
        >
          <Button
            variant="ghost"
            onClick={() => sendMessage(item.action)}
            className="text-left border rounded-xl px-4 py-3.5 text-sm w-full h-auto flex flex-col gap-1 justify-start items-start"
          >
            <span className="font-medium">{item.title}</span>
            <span className="text-muted-foreground">{item.label}</span>
          </Button>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prev, next) => prev.chatId === next.chatId
);
