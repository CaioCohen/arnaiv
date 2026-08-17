import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../../shared/types';

interface MessagesProps {
  messages: ChatMessage[];
  generating: boolean;
}

export function Messages({ messages, generating }: MessagesProps): JSX.Element {
  const container = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);

  useEffect(() => {
    if (followLatest.current) {
      container.current?.scrollTo({ top: container.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, generating]);

  const updateFollowLatest = (): void => {
    const element = container.current;

    if (element) {
      followLatest.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    }
  };

  return (
    <div className="messages" ref={container} onScroll={updateFollowLatest}>
      {messages.filter((message) => !message.hidden).map((message) => (
        <article className={`message ${message.role}`} key={message.id}>
          <div className="role">{message.role === 'user' ? 'You' : 'ArnAIv'}</div>
          <div className="content">
            {message.content}
            {generating && message.role === 'assistant' && !message.content && (
              <span className="typing">Thinking</span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
