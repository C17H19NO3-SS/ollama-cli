# Adding New Providers (Vercel AI SDK)

The Ollama CLI integrates with the
[Vercel AI SDK](https://sdk.vercel.ai/docs/introduction) to support a wide range
of local and remote LLMs.

## Current Support

Currently, this project uses the `@ai-sdk/ollama` provider (via
`ollama-ai-provider`) under the hood to generate responses and tools.

## How to add a new provider

If you want to add support for a new provider (e.g. OpenAI, Anthropic, or Groq),
follow these steps:

1. **Install the provider SDK:**

   ```bash
   npm install @ai-sdk/openai -w @google/gemini-cli-core
   ```

2. **Add a new AuthType:** Open `packages/core/src/core/contentGenerator.ts` and
   add your provider to `AuthType`:

   ```typescript
   export enum AuthType {
     // ...
     USE_OLLAMA = 'ollama',
     USE_OPENAI = 'openai',
   }
   ```

   Then detect it via environment variables in `getAuthTypeFromEnv()`:

   ```typescript
   if (process.env['OPENAI_API_KEY']) {
     return AuthType.USE_OPENAI;
   }
   ```

3. **Create a ContentGenerator Adapter:** Create a file like
   `packages/core/src/core/openaiContentGenerator.ts`. Implement the
   `ContentGenerator` interface just like `OllamaContentGenerator.ts`. You will
   map internal representations (`GenerateContentParameters`) to Vercel's
   `generateText`/`streamText` and pass the specific provider (e.g.,
   `openai('gpt-4o')`).

4. **Wire it up:** In `packages/core/src/core/contentGenerator.ts` inside
   `createContentGenerator`, instantiate your new adapter if the AuthType
   matches:
   ```typescript
   if (config.authType === AuthType.USE_OPENAI) {
     return new LoggingContentGenerator(
       new OpenAiContentGenerator(gcConfig, config.apiKey),
       gcConfig,
     );
   }
   ```

That's it! By mapping our standard internal schema to Vercel AI Core messages,
all terminal features (function calling, read files, command executions) will
automatically work with your new model.
