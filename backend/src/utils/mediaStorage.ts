import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { env } from "../config/env";

type MediaFieldRule = {
  path: string[];
  metaPath: string[];
  filePrefix: string;
};

const RESOURCE_MEDIA_RULES: Record<string, MediaFieldRule[]> = {
  "surat-jalan": [
    {
      path: ["podPhoto"],
      metaPath: ["podPhotoMeta"],
      filePrefix: "pod-photo",
    },
    {
      path: ["podSignature"],
      metaPath: ["podSignatureMeta"],
      filePrefix: "pod-signature",
    },
  ],
  "proof-of-delivery": [
    {
      path: ["photo"],
      metaPath: ["photoMeta"],
      filePrefix: "pod-photo",
    },
    {
      path: ["signature"],
      metaPath: ["signatureMeta"],
      filePrefix: "pod-signature",
    },
  ],
};

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getByPath(obj: Record<string, unknown>, pathParts: string[]): unknown {
  let cur: unknown = obj;
  for (const key of pathParts) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function setByPath(obj: Record<string, unknown>, pathParts: string[], value: unknown): void {
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < pathParts.length - 1; i += 1) {
    const key = pathParts[i];
    const next = cur[key];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      cur[key] = {};
    }
    cur = cur[key] as Record<string, unknown>;
  }
  cur[pathParts[pathParts.length - 1]] = value;
}

function parseDataUrl(input: string): { mime: string; data: Buffer } | null {
  const match = input.match(/^data:([^;]+);base64,(.+)$/i);
  if (!match) return null;
  const mime = String(match[1] || "").toLowerCase();
  const base64 = String(match[2] || "");
  const ext = MIME_EXT[mime];
  if (!ext) return null;
  try {
    const data = Buffer.from(base64, "base64");
    if (!data.length) return null;
    return { mime, data };
  } catch {
    return null;
  }
}

export async function storeImageDataUrl(params: {
  dataUrl: string;
  resource: string;
  entityIdHint?: string;
  filePrefix: string;
}): Promise<{ url: string; metadata: Record<string, unknown> } | null> {
  const parsed = parseDataUrl(params.dataUrl);
  if (!parsed) return null;

  const ext = MIME_EXT[parsed.mime] || "bin";
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const entityPart = String(params.entityIdHint || "entity").replace(/[^\w-]+/g, "_");
  const fileName = `${params.filePrefix}-${entityPart}-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  const dirRelative = path.posix.join(params.resource, yyyy, mm);
  const absoluteDir = path.resolve(env.uploadDir, dirRelative);
  const absoluteFile = path.resolve(absoluteDir, fileName);

  await fs.mkdir(absoluteDir, { recursive: true });
  await fs.writeFile(absoluteFile, parsed.data);

  const relativePublicPath = path.posix.join("/uploads", dirRelative, fileName);
  const base = String(env.filePublicBaseUrl || "").replace(/\/+$/, "");
  const url = `${base}${relativePublicPath}`;
  return {
    url,
    metadata: {
      url,
      mimeType: parsed.mime,
      sizeBytes: parsed.data.byteLength,
      fileName,
      storedAt: now.toISOString(),
    },
  };
}

export async function materializeMediaDataUrls(params: {
  resource: string;
  payload: unknown;
  entityIdHint?: string;
}): Promise<Record<string, unknown>> {
  const rules = RESOURCE_MEDIA_RULES[params.resource];
  const payload = asRecord(params.payload);
  if (!rules || rules.length === 0) return payload;

  const result = { ...payload } as Record<string, unknown>;
  for (const rule of rules) {
    const current = getByPath(result, rule.path);
    if (typeof current !== "string") continue;
    if (!current.trim().toLowerCase().startsWith("data:image/")) continue;

    const stored = await storeImageDataUrl({
      dataUrl: current,
      resource: params.resource,
      entityIdHint: params.entityIdHint,
      filePrefix: rule.filePrefix,
    });
    if (!stored) continue;
    setByPath(result, rule.path, stored.url);
    setByPath(result, rule.metaPath, stored.metadata);
  }

  return result;
}
