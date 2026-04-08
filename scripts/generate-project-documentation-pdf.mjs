import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();

const INPUT_HTML = path.join(projectRoot, "docs", "documentacao-completa-projeto.html");
const OUTPUT_PDF = path.join(projectRoot, "output", "pdf", "documentacao-completa-projeto.pdf");

const PAGE = {
  width: 595.28,
  height: 841.89,
  marginLeft: 52,
  marginRight: 52,
  marginTop: 58,
  marginBottom: 52
};

const STYLES = {
  h1: { font: "F2", size: 22, leading: 28, spacingBefore: 0, spacingAfter: 14 },
  h2: { font: "F2", size: 17, leading: 22, spacingBefore: 18, spacingAfter: 8 },
  h3: { font: "F2", size: 13.5, leading: 18, spacingBefore: 14, spacingAfter: 6 },
  h4: { font: "F2", size: 11.5, leading: 16, spacingBefore: 10, spacingAfter: 4 },
  p: { font: "F1", size: 10.5, leading: 15, spacingBefore: 0, spacingAfter: 8 },
  li: { font: "F1", size: 10.5, leading: 15, spacingBefore: 0, spacingAfter: 2, bulletIndent: 14 },
  code: { font: "F1", size: 9, leading: 13, spacingBefore: 4, spacingAfter: 8, indent: 12 },
  footer: { font: "F1", size: 9, leading: 11, spacingBefore: 0, spacingAfter: 0 }
};

function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

/* function sanitizePdfText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/…/g, "...")
    .replace(/→/g, "->")
    .replace(/•/g, "-")
    .replace(/\t/g, "  ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x0A\x20-\x7E\xA0-\xFF]/g, "");
} */

function stripTags(value) {
  return decodeEntities(String(value ?? "").replace(/<[^>]+>/g, ""));
}

function sanitizePdfText(value) {
  return String(value ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u2026/g, "...")
    .replace(/\u2192/g, "->")
    .replace(/\u2022/g, "-")
    .replace(/\t/g, "  ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x0A\x20-\x7E\xA0-\xFF]/g, "");
}

function extractBody(html) {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : html;
}

function htmlToBlocks(html) {
  let text = extractBody(html);

  text = text.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/gi, (_, code) => {
    const clean = decodeEntities(code).replace(/\r/g, "").trim();
    return `\n\n[[CODE]]\n${clean}\n[[/CODE]]\n\n`;
  });

  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, value) => `\n\n# ${stripTags(value)}\n\n`);
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, value) => `\n\n## ${stripTags(value)}\n\n`);
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, value) => `\n\n### ${stripTags(value)}\n\n`);
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, value) => `\n\n#### ${stripTags(value)}\n\n`);
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, value) => `\n- ${stripTags(value)}`);
  text = text.replace(/<tr[^>]*>/gi, "\n");
  text = text.replace(/<\/tr>/gi, "\n");
  text = text.replace(/<(th|td)[^>]*>/gi, "");
  text = text.replace(/<\/(th|td)>/gi, " | ");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, value) => `\`${stripTags(value)}\``);
  text = text.replace(/<\/?(div|section|article|nav|header|footer|main|table|thead|tbody|ul|ol)[^>]*>/gi, "\n");
  text = text.replace(/<\/?p[^>]*>/gi, "\n");
  text = text.replace(/<[^>]+>/g, "");
  text = decodeEntities(text).replace(/\r/g, "");

  const rawLines = text.split("\n").map(line => line.replace(/[ \t]+/g, " ").trim());
  const blocks = [];
  let paragraphBuffer = [];
  let codeBuffer = [];
  let insideCode = false;

  function flushParagraph() {
    if (!paragraphBuffer.length) return;
    blocks.push({ type: "p", text: paragraphBuffer.join(" ").trim() });
    paragraphBuffer = [];
  }

  function flushCode() {
    if (!codeBuffer.length) return;
    blocks.push({ type: "code", text: codeBuffer.join("\n").trimEnd() });
    codeBuffer = [];
  }

  for (const line of rawLines) {
    if (line === "[[CODE]]") {
      flushParagraph();
      insideCode = true;
      continue;
    }

    if (line === "[[/CODE]]") {
      insideCode = false;
      flushCode();
      continue;
    }

    if (insideCode) {
      codeBuffer.push(line);
      continue;
    }

    if (!line) {
      flushParagraph();
      continue;
    }

    if (line.startsWith("# ")) {
      flushParagraph();
      blocks.push({ type: "h1", text: line.slice(2).trim() });
      continue;
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      blocks.push({ type: "h2", text: line.slice(3).trim() });
      continue;
    }

    if (line.startsWith("### ")) {
      flushParagraph();
      blocks.push({ type: "h3", text: line.slice(4).trim() });
      continue;
    }

    if (line.startsWith("#### ")) {
      flushParagraph();
      blocks.push({ type: "h4", text: line.slice(5).trim() });
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      blocks.push({ type: "li", text: line.slice(2).trim() });
      continue;
    }

    paragraphBuffer.push(line.replace(/\s+\|\s*$/g, "").trim());
  }

  flushParagraph();
  flushCode();

  return blocks.filter(block => block.text);
}

function wrapText(text, maxWidth, fontSize, indent = 0) {
  const safeText = String(text ?? "").replace(/\s+/g, " ").trim();

  if (!safeText) {
    return [];
  }

  const approxCharWidth = fontSize * 0.6;
  const usableWidth = Math.max(40, maxWidth - indent);
  const maxChars = Math.max(10, Math.floor(usableWidth / approxCharWidth));
  const words = safeText.split(" ");
  const lines = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
      continue;
    }

    let remaining = word;

    while (remaining.length > maxChars) {
      lines.push(remaining.slice(0, maxChars - 1) + "-");
      remaining = remaining.slice(maxChars - 1);
    }

    current = remaining;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function createTextOperation({ font, size, x, y, text }) {
  const safe = sanitizePdfText(text);
  return `BT /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${safe}) Tj ET`;
}

function buildPages(blocks) {
  const pages = [];
  let currentPage = [];
  let cursorY = PAGE.height - PAGE.marginTop;

  function pushPage() {
    if (!currentPage.length) return;
    pages.push(currentPage);
    currentPage = [];
    cursorY = PAGE.height - PAGE.marginTop;
  }

  function ensureSpace(requiredHeight) {
    if (cursorY - requiredHeight < PAGE.marginBottom) {
      pushPage();
    }
  }

  for (const block of blocks) {
    const style = STYLES[block.type] ?? STYLES.p;
    const availableWidth = PAGE.width - PAGE.marginLeft - PAGE.marginRight;
    const indent = block.type === "li"
      ? style.bulletIndent ?? 0
      : block.type === "code"
        ? style.indent ?? 0
        : 0;

    const lines = block.type === "code"
      ? String(block.text).split("\n").map(line => line || " ")
      : wrapText(block.text, availableWidth, style.size, indent);

    const blockHeight = style.spacingBefore + (lines.length * style.leading) + style.spacingAfter;
    ensureSpace(blockHeight);
    cursorY -= style.spacingBefore;

    lines.forEach((line, index) => {
      const x = PAGE.marginLeft + indent;
      const lineText = block.type === "li" && index === 0 ? `- ${line}` : line;

      currentPage.push(createTextOperation({
        font: style.font,
        size: style.size,
        x,
        y: cursorY,
        text: lineText
      }));

      cursorY -= style.leading;
    });

    cursorY -= style.spacingAfter;
  }

  pushPage();

  return pages.map((operations, index) => {
    const footer = createTextOperation({
      font: STYLES.footer.font,
      size: STYLES.footer.size,
      x: PAGE.marginLeft,
      y: 26,
      text: `Documentação do projeto Educação no Campo - Página ${index + 1} de ${pages.length}`
    });

    return [...operations, footer];
  });
}

function buildPdf(pages) {
  const objects = [];
  const contentObjectIds = [];
  const pageObjectIds = [];

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>";

  let nextObjectId = 5;

  pages.forEach(operations => {
    const pageId = nextObjectId++;
    const contentId = nextObjectId++;
    const content = operations.join("\n");
    const contentLength = Buffer.byteLength(content, "latin1");

    objects[contentId] = `<< /Length ${contentLength} >>\nstream\n${content}\nendstream`;
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width.toFixed(2)} ${PAGE.height.toFixed(2)}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;

    pageObjectIds.push(pageId);
    contentObjectIds.push(contentId);
  });

  objects[2] = `<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds.map(id => `${id} 0 R`).join(" ")}] >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let i = 1; i < objects.length; i++) {
    if (!objects[i]) continue;
    offsets[i] = Buffer.byteLength(pdf, "latin1");
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";

  for (let i = 1; i < objects.length; i++) {
    const offset = offsets[i] ?? 0;
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}

async function main() {
  const html = await fs.readFile(INPUT_HTML, "utf8");
  const blocks = htmlToBlocks(html);
  const pages = buildPages(blocks);
  const pdfBuffer = buildPdf(pages);

  await fs.mkdir(path.dirname(OUTPUT_PDF), { recursive: true });
  await fs.writeFile(OUTPUT_PDF, pdfBuffer);

  console.log(`PDF gerado em: ${OUTPUT_PDF}`);
  console.log(`Total de páginas: ${pages.length}`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
