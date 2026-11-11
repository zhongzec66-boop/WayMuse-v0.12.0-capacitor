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
  /** 本条回答参考了几位学长（服务端命中经验库的条数） */
  kbCount?: number;
  /** 参考到的专业/方向，用于展开「参考了什么」 */
  kbTags?: string[];
  /** 用户这一条带的图片（dataURL），用于气泡里显示缩略图 */
  imageDataUrl?: string;
};

export type DeepSeekConfig = {
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  useContext: boolean;
  thinking: boolean;
  reasoningEffort: "low" | "high" | "max";
};

export type ChatRequestMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
