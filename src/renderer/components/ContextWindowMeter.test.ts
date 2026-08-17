import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ContextWindowMeter } from './ContextWindowMeter.js';

describe('ContextWindowMeter', () => {
  it('exposes a keyboard focus target and context tooltip', () => {
    const markup = renderToStaticMarkup(createElement(ContextWindowMeter, { messages: [] }));

    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain('role="tooltip"');
    expect(markup).toContain('Context window — 0%');
  });
});
