import { Capacitor, CapacitorHttp } from "@capacitor/core";

/**
 * 联网搜索。
 *
 * 设计前提：不假设有后端。搜索 key 由用户自己提供，存在本机；
 * 原生端走 CapacitorHttp 绕开 CORS，Web 预览退回 fetch。
 *
 * 支持两家：Serper（Google 结果）和 Tavily（面向 LLM 的摘要）。
 */

export type SearchProvider = "serper" | "tavily";

export type SearchHit = {
  title: string;
  url: string;
  snippet: string;
};

export type SearchConfig = {
  provider: SearchProvider;
  apiKey: string;
};

function normalizeProvider(value: string): SearchProvider {
  return value === "tavily" ? "tavily" : "serper";
}

async function post(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<unknown> {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.post({
      url,
      headers,
      data: body,
      responseType: "json",
    });
    if (response.status >= 400) {
      throw new Error(`搜索失败（HTTP ${response.status}）`);
    }
    return response.data;
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`搜索失败（HTTP ${res.status}）`);
  return await res.json();
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** 查一次，返回最多 5 条结果。 */
export async function webSearch(
  query: string,
  config: SearchConfig,
): Promise<SearchHit[]> {
  const q = query.trim().slice(0, 200);
  if (!q || !config.apiKey.trim()) return [];
  const provider = normalizeProvider(config.provider);

  try {
    if (provider === "tavily") {
      const data = (await post(
        "https://api.tavily.com/search",
        { "content-type": "application/json" },
        {
          api_key: config.apiKey.trim(),
          query: q,
          max_results: 5,
          search_depth: "basic",
        },
      )) as { results?: Array<Record<string, unknown>> };
      return (data.results ?? []).slice(0, 5).map((item) => ({
        title: asString(item.title) || asString(item.url),
        url: asString(item.url),
        snippet: asString(item.content).slice(0, 300),
      }));
    }

    const data = (await post(
      "https://google.serper.dev/search",
      {
        "content-type": "application/json",
        "X-API-KEY": config.apiKey.trim(),
      },
      { q, num: 5 },
    )) as { organic?: Array<Record<string, unknown>> };
    return (data.organic ?? []).slice(0, 5).map((item) => ({
      title: asString(item.title) || asString(item.link),
      url: asString(item.link),
      snippet: asString(item.snippet).slice(0, 300),
    }));
  } catch {
    return [];
  }
}

/** 把结果压成给模型的上下文片段。 */
export function formatSearchContext(query: string, hits: SearchHit[]): string {
  if (!hits.length) return "";
  const lines = hits.map(
    (hit, index) =>
      `${index + 1}. ${hit.title}\n   ${hit.snippet}\n   ${hit.url}`,
  );
  return [
    `【联网结果】查询「${query}」，来自公开网页，可能过期或不准确：`,
    ...lines,
    "引用时请说明来自网页，并把来源写在后面；不要编造结果里没有的内容。",
  ].join("\n");
}
