import { useEffect, useRef, useState } from "react";
import lowIcon from "../../assets/low.png";
import mediumIcon from "../../assets/medium.png";
import highIcon from "../../assets/high.png";
import type { ReasoningEffort } from "../../shared/types";

const reasoningOptions: Record<
  ReasoningEffort,
  { icon: string; label: string }
> = {
  low: { icon: lowIcon, label: "Low" },
  medium: { icon: mediumIcon, label: "Medium" },
  high: { icon: highIcon, label: "High" },
};

interface ChatInputProps {
  disabled: boolean;
  focusRequest: number;
  onFocus: () => void;
  onSend: (content: string, reasoningEffort: ReasoningEffort) => void;
}

export function ChatInput({
  disabled,
  focusRequest,
  onFocus,
  onSend,
}: ChatInputProps): JSX.Element {
  const [value, setValue] = useState("");
  const [reasoningEffort, setReasoningEffort] =
    useState<ReasoningEffort>("medium");
  const [isReasoningMenuOpen, setIsReasoningMenuOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (focusRequest && !disabled) {
      ref.current?.focus();
    }
  }, [disabled, focusRequest]);

  const submit = (): void => {
    const content = value.trim();

    if (!content || disabled) {
      return;
    }

    setValue("");
    onSend(content, reasoningEffort);
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
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <div className="reasoning-selector">
        <button
          type="button"
          className="reasoning-trigger"
          aria-haspopup="listbox"
          aria-expanded={isReasoningMenuOpen}
          disabled={disabled}
          onClick={() => setIsReasoningMenuOpen((open) => !open)}
        >
          <img src={reasoningOptions[reasoningEffort].icon} alt="" />
          <span>{reasoningOptions[reasoningEffort].label}</span>
          <span className="reasoning-chevron" aria-hidden="true">
            ⌄
          </span>
        </button>
        {isReasoningMenuOpen && (
          <div
            className="reasoning-menu"
            role="listbox"
            aria-label="Reasoning effort"
          >
            {(
              Object.entries(reasoningOptions) as [
                ReasoningEffort,
                { icon: string; label: string },
              ][]
            ).map(([effort, option]) => (
              <button
                key={effort}
                type="button"
                role="option"
                aria-selected={reasoningEffort === effort}
                className={reasoningEffort === effort ? "selected" : ""}
                onClick={() => {
                  setReasoningEffort(effort);
                  setIsReasoningMenuOpen(false);
                }}
              >
                <img src={option.icon} alt="" />
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <button onClick={submit} disabled={disabled || !value.trim()}>
        Send
      </button>
    </div>
  );
}
