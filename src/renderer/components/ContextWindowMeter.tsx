import { useId } from 'react';
import {
  contextWindowPercentage,
  estimateActiveContextTokens,
} from '../../shared/context';
import { CONTEXT_SUMMARIZATION_TOKEN_THRESHOLD } from '../../shared/constants';
import type { ChatMessage } from '../../shared/types';

interface ContextWindowMeterProps {
  messages: ChatMessage[];
}

export function ContextWindowMeter({ messages }: ContextWindowMeterProps): JSX.Element {
  const tooltipId = useId();
  const tokens = estimateActiveContextTokens(messages);
  const percentage = contextWindowPercentage(messages);
  const roundedPercentage = Math.round(percentage);
  const label = `Context window: ${tokens.toLocaleString()} of ${CONTEXT_SUMMARIZATION_TOKEN_THRESHOLD.toLocaleString()} estimated tokens (${roundedPercentage}%)`;

  return (
    <div
      aria-describedby={tooltipId}
      className="context-window-meter"
      tabIndex={0}
    >
      <progress
        aria-label={label}
        aria-valuemax={CONTEXT_SUMMARIZATION_TOKEN_THRESHOLD}
        aria-valuemin={0}
        aria-valuenow={tokens}
        max={CONTEXT_SUMMARIZATION_TOKEN_THRESHOLD}
        value={Math.min(tokens, CONTEXT_SUMMARIZATION_TOKEN_THRESHOLD)}
      />
      <span className="context-window-tooltip" id={tooltipId} role="tooltip">
        Context window — {roundedPercentage}%
      </span>
    </div>
  );
}
