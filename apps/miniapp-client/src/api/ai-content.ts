import { httpGet, httpPost } from '@/http/http';

export interface AiPlatform {
  platformCode: string;
  platformName: string;
  icon: string | null;
  maxLength: number | null;
  outputSchema: Record<string, string>;
}

export interface AiGeneratedContent {
  title?: string;
  summary?: string;
  body: string;
  tags?: string[];
}

export interface AiContentRecord {
  id: string;
  platformCode: string;
  platformName?: string;
  userInput: string;
  generatedContent: AiGeneratedContent;
  createTime: string;
}

export function getAiPlatforms() {
  return httpGet<AiPlatform[]>('/client/ai-content/platforms');
}

export function generateAiContent(data: { platformCode: string; userInput: string }) {
  return httpPost<AiContentRecord>('/client/ai-content/generate', data);
}

export function getAiHistory(pageNum: number = 1, pageSize: number = 10) {
  return httpGet<{ rows: AiContentRecord[]; total: number }>('/client/ai-content/history', {
    pageNum,
    pageSize,
  });
}
