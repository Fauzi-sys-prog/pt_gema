import "dotenv/config";
import { spawnSync } from "child_process";

function todayId(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `DC-TKJAKON-${y}${m}${day}`;
}

function main() {
  const defaults = [
    "--dir",
    "/Users/macbook/Downloads/data_pt_gema/clear",
    "--id",
    todayId(),
    "--title",
    "DATA DETAIL TK JAKON PT. ASAHIMAS INDONESIA",
    "--status",
    "Completed",
    "--tipe",
    "TK JAKON",
  ];

  const forwarded = process.argv.slice(2);
  const result = spawnSync("npx", ["tsx", "src/pipelineTkJakon.ts", ...defaults, ...forwarded], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

main();

