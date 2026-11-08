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
  if (!q) return [];
  // 没有 key 就走免 key 的 DuckDuckGo + 维基，用户不需要配置任何东西
  if (!config.apiKey.trim()) return webSearchKeyless(q);
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

function decodeEntities(input: string): string {
  return input
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Bing 网页结果。
 *
 * 为什么是 Bing 而不是 DuckDuckGo / 维基：后两家在国内不可达，
 * 免 key 通道会静默返回空数组，用户以为在联网、其实没有。
 * Bing 国内可直连，用 CapacitorHttp 走原生请求也没有跨域问题。
 *
 * 这是抓 HTML，结构变了会失效——所以失败时返回空数组，
 * 由上层明确告诉用户「没拿到结果」，绝不假装搜过。
 */
async function searchBing(query: string): Promise<SearchHit[]> {
  const url =
    "https://cn.bing.com/search?q=" + encodeURIComponent(query) + "&count=8";
  const ua =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) " +
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 " +
    "Mobile/15E148 Safari/604.1";
  let html: string;
  try {
    if (Capacitor.isNativePlatform()) {
      const response = await CapacitorHttp.get({
        url,
        headers: { "user-agent": ua, "accept-language": "zh-CN,zh;q=0.9" },
        responseType: "text",
      });
      if (response.status >= 400) return [];
      html = typeof response.data === "string" ? response.data : "";
    } else {
      const res = await fetch(url, {
        headers: { "user-agent": ua, "accept-language": "zh-CN,zh;q=0.9" },
      });
      if (!res.ok) return [];
      html = await res.text();
    }
  } catch {
    return [];
  }
  if (!html) return [];

  const hits: SearchHit[] = [];
  for (const raw of html.split('<li class="b_algo"').slice(1)) {
    const block = raw.split("</li>")[0] ?? "";
    const link = block.match(
      /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/,
    );
    if (!link) continue;
    const snippet = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    hits.push({
      title: decodeEntities(link[2]).slice(0, 80) || link[1],
      url: link[1],
      snippet: decodeEntities(snippet?.[1] ?? "").slice(0, 300),
    });
    if (hits.length >= 5) break;
  }
  return hits;
}
/** 不需要任何 key 的联网搜索（Bing，国内可直连）。 */
export async function webSearchKeyless(query: string): Promise<SearchHit[]> {
  const q = query.trim().slice(0, 200);
  if (!q) return [];
  const found = await searchBing(q);
  // 去重后取前 5 条
  const seen = new Set<string>();
  const merged: SearchHit[] = [];
  for (const hit of found) {
    const key = hit.url || hit.title;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(hit);
    if (merged.length >= 5) break;
  }
  return merged;
}
