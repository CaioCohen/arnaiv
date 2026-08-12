import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { DEFAULT_MODEL } from '../../shared/constants.js';
import type { ChatMessage } from '../../shared/types.js';

export interface ChatRequest {
  messages: ChatMessage[];
  systemPrompt?: string;
  model?: string;
}

export interface OpenAIClient {
  chat: {
    completions: {
      create: (request: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming) => Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>>;
    };
  };
}

export class OpenAIService {
  public constructor(private readonly client: OpenAIClient) {}

  public async stream(request: ChatRequest, onChunk: (content: string) => void): Promise<void> {
    const messages: ChatCompletionMessageParam[] = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    messages.push(
      ...request.messages
        .filter((message) => message.role !== 'system')
        .map(
          (message) =>
            ({ role: message.role, content: message.content }) as ChatCompletionMessageParam,
        ),
    );

    const stream = await this.client.chat.completions.create({
      model: request.model ?? DEFAULT_MODEL,
      messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta.content;

      if (content) {
        onChunk(content);
      }
    }
  }
}
