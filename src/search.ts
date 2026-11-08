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

/* ── 免 key 的兜底搜索 ─────────────────────────────
   不填任何 key 也能联网：DuckDuckGo 的 Instant Answer 负责「是什么」，
   维基百科负责条目摘要。两家都支持跨域、都不需要注册。
   质量不如 Serper/Tavily，但「让用户少填一个密钥」值这个折中。 */

async function getJson(url: string): Promise<unknown> {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({
      url,
      responseType: "json",
    });
    if (response.status >= 400) throw new Error(`HTTP ${response.status}`);
    return response.data;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function searchDuckDuckGo(query: string): Promise<SearchHit[]> {
  try {
    const url =
      "https://api.duckduckgo.com/?q=" +
      encodeURIComponent(query) +
      "&format=json&no_html=1&skip_disambig=1";
    const data = (await getJson(url)) as {
      Heading?: string;
      AbstractText?: string;
      AbstractURL?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
    };
    const hits: SearchHit[] = [];
    if (data.AbstractText) {
      hits.push({
        title: data.Heading || query,
        url: data.AbstractURL ?? "",
        snippet: data.AbstractText.slice(0, 300),
      });
    }
    for (const item of data.RelatedTopics ?? []) {
      if (hits.length >= 4) break;
      if (item.Text && item.FirstURL) {
        hits.push({
          title: item.Text.slice(0, 60),
          url: item.FirstURL,
          snippet: item.Text.slice(0, 300),
        });
      }
    }
    return hits;
  } catch {
    return [];
  }
}

async function searchWikipedia(query: string): Promise<SearchHit[]> {
  try {
    const url =
      "https://zh.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=3&srsearch=" +
      encodeURIComponent(query);
    const data = (await getJson(url)) as {
      query?: { search?: Array<{ title?: string; snippet?: string }> };
    };
    return (data.query?.search ?? [])
      .filter((item) => item.title)
      .map((item) => ({
        title: item.title ?? "",
        url: `https://zh.wikipedia.org/wiki/${encodeURIComponent(item.title ?? "")}`,
        snippet: (item.snippet ?? "").replace(/<[^>]+>/g, "").slice(0, 300),
      }));
  } catch {
    return [];
  }
}

/** 不需要任何 key 的联网搜索。 */
export async function webSearchKeyless(query: string): Promise<SearchHit[]> {
  const q = query.trim().slice(0, 200);
  if (!q) return [];
  const [duck, wiki] = await Promise.all([
    searchDuckDuckGo(q),
    searchWikipedia(q),
  ]);
  // 去重后取前 5 条
  const seen = new Set<string>();
  const merged: SearchHit[] = [];
  for (const hit of [...duck, ...wiki]) {
    const key = hit.url || hit.title;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(hit);
    if (merged.length >= 5) break;
  }
  return merged;
}
