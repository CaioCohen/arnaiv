import { useRef, useState } from 'react';

interface ChatInputProps {
  disabled: boolean;
  onFocus: () => void;
  onSend: (content: string) => void;
}

export function ChatInput({ disabled, onFocus, onSend }: ChatInputProps): JSX.Element {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = (): void => {
    const content = value.trim();

    if (!content || disabled) {
      return;
    }

    setValue('');
    onSend(content);
    requestAnimationFrame(() => ref.current?.focus());
  };

  return (
    <div className="composer">
      <textarea
        ref={ref}
        aria-label="Message ArnAIv"
        value={value}
        disabled={disabled}
        placeholder="Message ArnAIv..."
        onFocus={onFocus}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <button onClick={submit} disabled={disabled || !value.trim()}>
        Send
      </button>
    </div>
  );
}
