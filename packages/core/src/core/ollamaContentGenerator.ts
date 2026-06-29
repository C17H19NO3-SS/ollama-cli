/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable */
import type { ContentGenerator } from './contentGenerator.js';
import type { Config } from '../config/config.js';
import type {
  GenerateContentParameters,
  GenerateContentResponse,
} from '@google/genai';
import { LlmRole } from '../telemetry/llmRole.js';
import { generateText, streamText } from 'ai';
import { createOllama } from 'ollama-ai-provider';
import { debugLogger } from '../utils/debugLogger.js';

export class OllamaContentGenerator implements ContentGenerator {
  constructor(
    private readonly config: Config,
    private readonly baseUrl?: string,
  ) {}

  private mapContentsToCoreMessages(contents: any): any[] {
    if (!Array.isArray(contents)) return [];
    return contents.map((c: any) => {
      const parts = Array.isArray(c.parts) ? c.parts : c.parts ? [c.parts] : [];
      const text = parts.map((p: any) => p.text || '').join('');
      return {
        role: c.role === 'user' ? 'user' : 'assistant',
        content: text,
      };
    });
  }

  async generateContent(
    request: GenerateContentParameters,
    _userPromptId: string,
    _role: LlmRole,
  ): Promise<GenerateContentResponse> {
    debugLogger.log('OllamaContentGenerator.generateContent', { request });

    const modelId = request.model || this.config.getModel() || 'llama3.1';

    const ollamaProvider = createOllama(
      this.baseUrl ? { baseURL: this.baseUrl } : {},
    );

    const messages = this.mapContentsToCoreMessages(request.contents);
    let systemPrompt = '';
    if (request.config?.systemInstruction) {
      if (typeof request.config.systemInstruction === 'string') {
        systemPrompt = request.config.systemInstruction;
      } else if (
        Array.isArray((request.config.systemInstruction as any).parts)
      ) {
        systemPrompt = (request.config.systemInstruction as any).parts
          .map((p: any) => p.text)
          .join('');
      } else if ((request.config.systemInstruction as any).parts?.text) {
        systemPrompt = (request.config.systemInstruction as any).parts.text;
      } else if ((request.config.systemInstruction as any).text) {
        systemPrompt = (request.config.systemInstruction as any).text;
      }
    }

    try {
      const { text } = await generateText({
        model: ollamaProvider(modelId) as any,
        system: systemPrompt,
        messages: messages,
        temperature: request.config?.temperature,
      });

      return {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [{ text }],
            },
          },
        ],
        text,
      } as unknown as GenerateContentResponse;
    } catch (e) {
      debugLogger.error('Ollama generation failed', e);
      throw e;
    }
  }

  async generateContentStream(
    request: GenerateContentParameters,
    _userPromptId: string,
    _role: LlmRole,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    const config = this.config;
    const baseUrl = this.baseUrl;
    const mapContentsToCoreMessages = this.mapContentsToCoreMessages.bind(this);

    async function* asyncGenerator(): AsyncGenerator<GenerateContentResponse> {
      const modelId = request.model || config.getModel() || 'llama3.1';
      const messages = mapContentsToCoreMessages(request.contents);
      let systemPrompt = '';
      if (request.config?.systemInstruction) {
        if (typeof request.config.systemInstruction === 'string') {
          systemPrompt = request.config.systemInstruction;
        } else if (
          Array.isArray((request.config.systemInstruction as any).parts)
        ) {
          systemPrompt = (request.config.systemInstruction as any).parts
            .map((p: any) => p.text)
            .join('');
        }
      }

      const ollamaProvider = createOllama(baseUrl ? { baseURL: baseUrl } : {});

      const { textStream } = await streamText({
        model: ollamaProvider(modelId) as any,
        system: systemPrompt,
        messages: messages,
        temperature: request.config?.temperature,
      });

      for await (const textPart of textStream) {
        yield {
          candidates: [
            {
              content: {
                role: 'model',
                parts: [{ text: textPart }],
              },
            },
          ],
          text: textPart,
        } as unknown as GenerateContentResponse;
      }
    }
    return asyncGenerator();
  }

  async countTokens(request: any): Promise<any> {
    let text = '';
    if (request.generateContentRequest?.contents) {
      text = request.generateContentRequest.contents
        .map((c: any) => {
          const parts = Array.isArray(c.parts)
            ? c.parts
            : c.parts
              ? [c.parts]
              : [];
          return parts.map((p: any) => p.text).join('') || '';
        })
        .join('');
    } else if (request.contents) {
      text = request.contents
        .map((c: any) => {
          const parts = Array.isArray(c.parts)
            ? c.parts
            : c.parts
              ? [c.parts]
              : [];
          return parts.map((p: any) => p.text).join('') || '';
        })
        .join('');
    }
    const tokenCount = Math.ceil(text.length / 4);
    return {
      totalTokens: tokenCount,
    };
  }

  async embedContent(_request: any): Promise<any> {
    throw new Error('Embeddings not yet supported by this Ollama adapter');
  }
}
