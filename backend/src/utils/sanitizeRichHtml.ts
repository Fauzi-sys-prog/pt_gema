const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "blockquote",
  "br",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "li",
  "ol",
  "p",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);

const DROP_CONTENT_TAGS = [
  "applet",
  "base",
  "button",
  "embed",
  "form",
  "iframe",
  "input",
  "link",
  "math",
  "meta",
  "object",
  "option",
  "script",
  "select",
  "style",
  "svg",
  "textarea",
];

const ALLOWED_STYLE_PROPERTIES = new Set([
  "background",
  "background-color",
  "border",
  "border-bottom",
  "border-collapse",
  "border-left",
  "border-right",
  "border-top",
  "color",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "height",
  "letter-spacing",
  "line-height",
  "margin",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "max-width",
  "min-width",
  "padding",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "text-align",
  "text-decoration",
  "vertical-align",
  "white-space",
  "width",
]);

const SAFE_SCOPE_VALUES = new Set(["col", "row", "colgroup", "rowgroup"]);

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sanitizeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^(?:javascript|vbscript|data):/i.test(trimmed)) return null;
  if (/^(?:https?:|mailto:|tel:|#|\/)/i.test(trimmed)) return trimmed;
  return null;
}

function sanitizeStyle(styleValue: string): string {
  return styleValue
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const separatorIndex = declaration.indexOf(":");
      if (separatorIndex <= 0) return null;

      const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
      const value = declaration.slice(separatorIndex + 1).trim();

      if (!ALLOWED_STYLE_PROPERTIES.has(property)) return null;
      if (!value) return null;
      if (/(?:expression|javascript:|vbscript:|data:|url\s*\(|@import|behavior\s*:|-moz-binding)/i.test(value)) {
        return null;
      }
      if (!/^[#(),.%\s+\-/"'a-zA-Z0-9]+$/.test(value)) return null;

      return `${property}: ${value}`;
    })
    .filter((value): value is string => Boolean(value))
    .join("; ");
}

function sanitizeTagAttributes(tagName: string, rawAttributes: string): string {
  const safeAttributes: string[] = [];
  const attributeRegex =
    /([^\s=<>"'/`]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

  let match: RegExpExecArray | null;
  while ((match = attributeRegex.exec(rawAttributes)) !== null) {
    const attributeName = String(match[1] || "").trim().toLowerCase();
    const rawValue = String(match[2] ?? match[3] ?? match[4] ?? "");

    if (!attributeName || attributeName.startsWith("on")) continue;

    if (attributeName === "href" && tagName === "a") {
      const safeUrl = sanitizeUrl(rawValue);
      if (safeUrl) {
        safeAttributes.push(`href="${escapeAttribute(safeUrl)}"`);
        safeAttributes.push('rel="noopener noreferrer"');
      }
      continue;
    }

    if (attributeName === "style") {
      const safeStyle = sanitizeStyle(rawValue);
      if (safeStyle) {
        safeAttributes.push(`style="${escapeAttribute(safeStyle)}"`);
      }
      continue;
    }

    if (attributeName === "colspan" || attributeName === "rowspan") {
      const numericValue = Number.parseInt(rawValue, 10);
      if (Number.isFinite(numericValue) && numericValue > 0) {
        safeAttributes.push(`${attributeName}="${numericValue}"`);
      }
      continue;
    }

    if (attributeName === "scope" && (tagName === "th" || tagName === "td")) {
      const scope = rawValue.trim().toLowerCase();
      if (SAFE_SCOPE_VALUES.has(scope)) {
        safeAttributes.push(`scope="${scope}"`);
      }
    }
  }

  return safeAttributes.length > 0 ? ` ${safeAttributes.join(" ")}` : "";
}

export function sanitizeRichHtml(input: string | null | undefined): string {
  if (typeof input !== "string") return "";

  let sanitized = input.replace(/\u0000/g, "").replace(/<!--[\s\S]*?-->/g, "");

  for (const tag of DROP_CONTENT_TAGS) {
    const blockPattern = new RegExp(
      `<\\s*${tag}\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*${tag}\\s*>`,
      "gi"
    );
    const singlePattern = new RegExp(`<\\s*\\/?\\s*${tag}\\b[^>]*>`, "gi");
    sanitized = sanitized.replace(blockPattern, "");
    sanitized = sanitized.replace(singlePattern, "");
  }

  sanitized = sanitized.replace(/<[^>]+>/g, (fullTag) => {
    const closingMatch = fullTag.match(/^<\s*\/\s*([a-zA-Z0-9]+)\s*>$/);
    if (closingMatch) {
      const tagName = String(closingMatch[1] || "").toLowerCase();
      if (ALLOWED_TAGS.has(tagName) && tagName !== "br" && tagName !== "hr") {
        return `</${tagName}>`;
      }
      return "";
    }

    const openMatch = fullTag.match(/^<\s*([a-zA-Z0-9]+)\b([^>]*)\/?\s*>$/);
    if (!openMatch) return "";

    const tagName = String(openMatch[1] || "").toLowerCase();
    if (!ALLOWED_TAGS.has(tagName)) return "";

    if (tagName === "br" || tagName === "hr") {
      return `<${tagName}>`;
    }

    const safeAttributes = sanitizeTagAttributes(tagName, String(openMatch[2] || ""));
    return `<${tagName}${safeAttributes}>`;
  });

  return sanitized.trim();
}
