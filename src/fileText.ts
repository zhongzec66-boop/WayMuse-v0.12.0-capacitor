import type { ChangeEvent } from "react";

/**
 * 把用户拖进来的文件变成纯文本。
 *
 * 目标只有一个：让模型真的能读到内容，而不是只看到文件名。
 * 按类型分派到不同的解析器，认不出来的就老实返回空串，
 * 由界面显示「只记了文件名」，绝不假装读到。
 */

/** 送进对话的字数上限（模型上下文有限，宁少勿爆） */
export const TEXT_LIMIT = 16000;

export type ExtractedText = {
  /** 提取到的正文；空串表示没提取到 */
  text: string;
  /** 给界面看的来源说明 */
  source: "text" | "pdf" | "docx" | "sheet" | "image" | "none";
  /** 是否因为过长被截断 */
  truncated?: boolean;
};

let pdfReady: Promise<typeof import("pdfjs-dist")> | null = null;

async function loadPdf() {
  if (!pdfReady) {
    pdfReady = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    })();
  }
  return pdfReady;
}

async function readPdf(file: File): Promise<string> {
  try {
    const pdfjs = await loadPdf();
    const buffer = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) })
      .promise;
    const pages: string[] = [];
    // 只读前 30 页：课件和讲义够用，整本教材会拖死主线程
    const limit = Math.min(doc.numPages, 30);
    for (let i = 1; i <= limit; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const line = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (line) pages.push(line);
    }
    return pages.join("\n");
  } catch {
    return "";
  }
}

async function readDocx(file: File): Promise<string> {
  try {
    const mammoth = await import("mammoth/mammoth.browser");
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value ?? "";
  } catch {
    return "";
  }
}

async function readSheet(file: File): Promise<string> {
  try {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const book = XLSX.read(buffer, { type: "array" });
    const parts: string[] = [];
    // 只读前 3 个 sheet，够看课表和成绩单
    for (const name of book.SheetNames.slice(0, 3)) {
      const sheet = book.Sheets[name];
      if (!sheet) continue;
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      if (csv.trim()) parts.push(`【${name}】\n${csv}`);
    }
    return parts.join("\n\n");
  } catch {
    return "";
  }
}

function isPlainText(file: File): boolean {
  return (
    file.type.startsWith("text/") ||
    /\.(txt|md|markdown|mdx|csv|tsv|json|jsonl|log|ya?ml|html?|xml|svg|css|scss|jsx?|tsx?|py|java|c|cc|cpp|h|hpp|go|rs|rb|php|sh|sql|tex|ini|conf|toml)$/i.test(
      file.name,
    )
  );
}

export async function extractFileText(file: File): Promise<ExtractedText> {
  let raw = "";
  let source: ExtractedText["source"] = "none";

  if (isPlainText(file)) {
    source = "text";
    try {
      raw = await file.text();
    } catch {
      raw = "";
    }
  } else if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
    source = "pdf";
    raw = await readPdf(file);
  } else if (
    /\.docx$/i.test(file.name) ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    source = "docx";
    raw = await readDocx(file);
  } else if (
    /\.(xlsx|xls|csv)$/i.test(file.name) ||
    file.type.includes("spreadsheet") ||
    file.type === "application/vnd.ms-excel"
  ) {
    source = "sheet";
    raw = await readSheet(file);
  } else if (file.type.startsWith("image/")) {
    // 图片交给原生 OCR，这里不处理
    return { text: "", source: "image" };
  }

  const text = raw.trim();
  if (!text) return { text: "", source: "none" };
  if (text.length > TEXT_LIMIT) {
    return {
      text: `${text.slice(0, TEXT_LIMIT)}\n（文件较长，以上是前 ${TEXT_LIMIT} 字）`,
      source,
      truncated: true,
    };
  }
  return { text, source };
}

/** 生成给模型看的附件块；content 为空时明确说明看不到内容 */
export function buildFileBlock(
  name: string,
  size: number,
  content: string,
): string {
  const header = JSON.stringify({
    n: name.slice(0, 80),
    s: size,
    b: !content,
  });
  if (!content) {
    return (
      `[[FILE:${header}]]` +
      "\n（这是二进制文件，你只能看到文件名和大小，看不到里面的内容）" +
      "\n[[/FILE]]"
    );
  }
  return `[[FILE:${header}]]\n${content}\n[[/FILE]]`;
}

export type { ChangeEvent };
