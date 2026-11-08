export type DeepSeekUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type DeepSeekMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  createdAt: number;
  model?: string;
  usage?: DeepSeekUsage;
  latencyMs?: number;
  finishReason?: string;
  stopped?: boolean;
  error?: boolean;
};

export type DeepSeekConfig = {
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  useContext: boolean;
  thinking: boolean;
  reasoningEffort: "low" | "high" | "max";
};

export type ChatRequestMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
