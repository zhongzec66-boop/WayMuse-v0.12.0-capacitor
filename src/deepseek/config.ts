import { DEFAULT_SYSTEM_PROMPT } from "./prompt";
import type { DeepSeekConfig } from "./types";

export const DEFAULT_DEEPSEEK_CONFIG: DeepSeekConfig = {
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-flash",
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  useContext: true,
  thinking: false,
  reasoningEffort: "high",
};

export const DEEPSEEK_MODELS = ["deepseek-flash", "deepseek-v4-pro"];

export function normalizeConfig(value: unknown): DeepSeekConfig {
  if (typeof value !== "object" || value === null)
    return { ...DEFAULT_DEEPSEEK_CONFIG };
  const input = value as Record<string, unknown>;
  const baseUrl =
    typeof input.baseUrl === "string" && /^https?:\/\//i.test(input.baseUrl)
      ? input.baseUrl.trim().replace(/\/+$/, "")
      : DEFAULT_DEEPSEEK_CONFIG.baseUrl;
  const model =
    typeof input.model === "string" && input.model.trim()
      ? input.model.trim()
      : DEFAULT_DEEPSEEK_CONFIG.model;
  const temperature =
    typeof input.temperature === "number" &&
    input.temperature >= 0 &&
    input.temperature <= 2
      ? input.temperature
      : DEFAULT_DEEPSEEK_CONFIG.temperature;
  const maxTokens =
    typeof input.maxTokens === "number" &&
    input.maxTokens >= 1 &&
    input.maxTokens <= 393216
      ? Math.round(input.maxTokens)
      : DEFAULT_DEEPSEEK_CONFIG.maxTokens;
  const systemPrompt =
    typeof input.systemPrompt === "string"
      ? input.systemPrompt.slice(0, 6000)
      : DEFAULT_DEEPSEEK_CONFIG.systemPrompt;
  const reasoningEffort =
    input.reasoningEffort === "low" ||
    input.reasoningEffort === "high" ||
    input.reasoningEffort === "max"
      ? input.reasoningEffort
      : DEFAULT_DEEPSEEK_CONFIG.reasoningEffort;
  return {
    baseUrl,
    model,
    temperature,
    maxTokens,
    systemPrompt,
    useContext: input.useContext !== false,
    thinking: input.thinking === true,
    reasoningEffort,
  };
}
