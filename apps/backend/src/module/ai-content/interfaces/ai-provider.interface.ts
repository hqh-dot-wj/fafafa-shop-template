export interface AiGenerateResult {
  content: Record<string, unknown>;
  promptTokens: number;
  completionTokens: number;
}

export interface AiGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiProvider {
  generateText(systemPrompt: string, userMessage: string, options?: AiGenerateOptions): Promise<AiGenerateResult>;
}
