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

const DROP_CONTENT_TAGS = new Set([
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
]);

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function sanitizeElementAttributes(element: HTMLElement) {
  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase();
    const value = attribute.value;

    if (name.startsWith("on")) {
      element.removeAttribute(attribute.name);
      continue;
    }

    if (name === "style") {
      const safeStyle = sanitizeStyle(value);
      if (safeStyle) {
        element.setAttribute("style", safeStyle);
      } else {
        element.removeAttribute("style");
      }
      continue;
    }

    if (name === "href" && element.tagName.toLowerCase() === "a") {
      const safeUrl = sanitizeUrl(value);
      if (safeUrl) {
        element.setAttribute("href", safeUrl);
        element.setAttribute("rel", "noopener noreferrer");
      } else {
        element.removeAttribute("href");
      }
      continue;
    }

    if ((name === "colspan" || name === "rowspan") && (element.tagName === "TD" || element.tagName === "TH")) {
      const numericValue = Number.parseInt(value, 10);
      if (Number.isFinite(numericValue) && numericValue > 0) {
        element.setAttribute(name, String(numericValue));
      } else {
        element.removeAttribute(name);
      }
      continue;
    }

    if (name === "scope" && (element.tagName === "TD" || element.tagName === "TH")) {
      const scope = value.trim().toLowerCase();
      if (SAFE_SCOPE_VALUES.has(scope)) {
        element.setAttribute("scope", scope);
      } else {
        element.removeAttribute("scope");
      }
      continue;
    }

    element.removeAttribute(attribute.name);
  }
}

function unwrapElement(element: HTMLElement) {
  const parent = element.parentNode;
  if (!parent) return;

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }
  parent.removeChild(element);
}

function sanitizeNode(node: Node) {
  if (node.nodeType === Node.COMMENT_NODE) {
    node.parentNode?.removeChild(node);
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();

  if (DROP_CONTENT_TAGS.has(tagName)) {
    element.remove();
    return;
  }

  if (!ALLOWED_TAGS.has(tagName)) {
    unwrapElement(element);
    return;
  }

  sanitizeElementAttributes(element);
  for (const child of Array.from(element.childNodes)) {
    sanitizeNode(child);
  }
}

export function sanitizeRichHtml(input: string | null | undefined): string {
  if (typeof input !== "string") return "";

  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return escapeHtml(input);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(input, "text/html");

  for (const child of Array.from(doc.body.childNodes)) {
    sanitizeNode(child);
  }

  return doc.body.innerHTML.trim();
}
