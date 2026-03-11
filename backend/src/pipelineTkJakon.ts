import "dotenv/config";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

type PipelineArgs = {
  dir: string;
  id: string;
  title?: string;
  status?: string;
  lokasi?: string;
  responden?: string;
  tipe?: string;
  keepIngestFile: boolean;
};

function parseArgs(argv: string[]): PipelineArgs {
  let dir = "";
  let id = `DC-TKJAKON-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
  let title = "";
  let status = "Completed";
  let lokasi = "";
  let responden = "";
  let tipe = "TK JAKON";
  let keepIngestFile = false;

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dir" && argv[i + 1]) {
      dir = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (a === "--id" && argv[i + 1]) {
      id = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (a === "--title" && argv[i + 1]) {
      title = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (a === "--status" && argv[i + 1]) {
      status = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (a === "--lokasi" && argv[i + 1]) {
      lokasi = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (a === "--responden" && argv[i + 1]) {
      responden = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (a === "--tipe" && argv[i + 1]) {
      tipe = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (a === "--keep-ingest-file") {
      keepIngestFile = true;
      continue;
    }
  }

  if (!dir) {
    throw new Error("Missing --dir <folder-path>");
  }

  return { dir, id, title, status, lokasi, responden, tipe, keepIngestFile };
}

function runStep(step: string, args: string[]) {
  const result = spawnSync("npx", ["tsx", step, ...args], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`Step failed: ${step}`);
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(opts.dir)) {
    throw new Error(`Directory not found: ${opts.dir}`);
  }

  const ingestOut = path.join(os.tmpdir(), `ingest-tk-jakon-${Date.now()}.json`);

  runStep("src/ingestDocuments.ts", ["--dir", opts.dir, "--out", ingestOut]);

  const publishArgs = ["--input", ingestOut, "--id", opts.id];
  if (opts.title) publishArgs.push("--title", opts.title);
  if (opts.status) publishArgs.push("--status", opts.status);
  if (opts.lokasi) publishArgs.push("--lokasi", opts.lokasi);
  if (opts.responden) publishArgs.push("--responden", opts.responden);
  if (opts.tipe) publishArgs.push("--tipe", opts.tipe);

  runStep("src/publishTkJakonFromIngest.ts", publishArgs);

  if (!opts.keepIngestFile) {
    fs.rmSync(ingestOut, { force: true });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        id: opts.id,
        sourceDir: opts.dir,
        tempIngestFile: opts.keepIngestFile ? ingestOut : "(deleted)",
      },
      null,
      2
    )
  );
}

main();

