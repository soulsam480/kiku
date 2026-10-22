import { unzipSync, strFromU8 } from "fflate";

/**
 * Turn an upload into document text plus chapters.
 * Markdown and text split on level 1-2 headings; EPUB follows its spine, which is
 * how the book itself defines chapters.
 */
export function parseUpload(filename, bytes) {
  const name = filename.toLowerCase();

  if (name.endsWith(".epub")) return parseEpub(bytes);
  const text = new TextDecoder().decode(bytes);
  return parseText(filename.replace(/\.(md|markdown|txt)$/i, ""), text);
}

export function parseText(fallbackTitle, markdown) {
  const title = firstHeading(markdown) ?? fallbackTitle ?? "Untitled";
  return { title, author: "", markdown, chapters: splitByHeadings(markdown) };
}

/** Split on `#` and `##` headings; fall back to a size split when there are none. */
export function splitByHeadings(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const chapters = [];
  let current = { title: "", lines: [] };

  const flush = () => {
    const text = current.lines.join("\n").trim();
    if (text) chapters.push({ title: current.title || "Beginning", text });
    current = { title: "", lines: [] };
  };

  for (const line of lines) {
    const heading = /^(#{1,2})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      current.title = heading[2].trim();
      current.lines.push(line);
      continue;
    }
    current.lines.push(line);
  }
  flush();

  if (chapters.length > 1 || (chapters.length === 1 && chapters[0].text.length < 20000)) return chapters;
  return splitBySize(markdown);
}

function splitBySize(markdown, target = 8000) {
  const paragraphs = markdown.split(/\n{2,}/);
  const chapters = [];
  let buffer = "";

  for (const paragraph of paragraphs) {
    buffer += `${paragraph}\n\n`;
    if (buffer.length >= target) {
      chapters.push({ title: `Part ${chapters.length + 1}`, text: buffer.trim() });
      buffer = "";
    }
  }

  if (buffer.trim()) chapters.push({ title: `Part ${chapters.length + 1}`, text: buffer.trim() });
  return chapters;
}

function firstHeading(markdown) {
  const match = /^#{1,2}\s+(.+)$/m.exec(markdown);
  return match ? match[1].trim() : null;
}

// --- epub ------------------------------------------------------------------

function parseEpub(bytes) {
  let files;
  try {
    files = unzipSync(new Uint8Array(bytes));
  } catch {
    throw new Error("That does not look like a valid EPUB (unzip failed)");
  }

  const read = (path) => (files[path] ? strFromU8(files[path]) : "");

  const container = read("META-INF/container.xml");
  const opfPath = /full-path="([^"]+)"/.exec(container)?.[1];
  if (!opfPath) throw new Error("EPUB is missing its package document");

  const opf = read(opfPath);
  const base = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";

  const title = tag(opf, "dc:title") || "Untitled";
  const author = tag(opf, "dc:creator") || "";

  const manifest = new Map();
  for (const item of opf.matchAll(/<item\s[^>]*>/g)) {
    const id = attr(item[0], "id");
    const href = attr(item[0], "href");
    if (id && href) manifest.set(id, href);
  }

  const spine = [...opf.matchAll(/<itemref\s[^>]*idref="([^"]+)"[^>]*>/g)].map((match) => match[1]);
  const chapters = [];

  for (const idref of spine) {
    const href = manifest.get(idref);
    if (!href) continue;

    const html = read(decodeURIComponent(base + href));
    if (!html) continue;

    const text = htmlToText(html);
    if (!text || text.length < 40) continue;

    const heading = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i.exec(html);
    const chapterTitle = heading ? stripTags(heading[1]).trim() : "";

    chapters.push({ title: chapterTitle || `Chapter ${chapters.length + 1}`, text });
  }

  if (!chapters.length) throw new Error("No readable text found in that EPUB");

  const markdown = chapters.map((chapter) => `# ${chapter.title}\n\n${chapter.text}`).join("\n\n");
  return { title, author, markdown, chapters };
}

function tag(xml, name) {
  const match = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(xml);
  return match ? stripTags(match[1]).trim() : "";
}

function attr(source, name) {
  const match = new RegExp(`${name}="([^"]*)"`).exec(source);
  return match ? match[1] : "";
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, " ");
}

function htmlToText(html) {
  return stripTags(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<(br|\/p|\/div|\/h[1-6]|\/li)[^>]*>/gi, "\n"),
  )
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
