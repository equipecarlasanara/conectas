import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const routes = [
  "app/api/admin/usuarios/route.ts",
  "app/api/calendario/[token]/route.ts",
  "app/api/cron/alertas/route.ts",
  "app/api/importar/route.ts",
];

try {
  for (const rel of routes) {
    const p = path.join(root, rel);
    if (fs.existsSync(p)) {
      fs.renameSync(p, p + ".bak");
    }
  }
  execSync("npx next build", {
    stdio: "inherit",
    env: { ...process.env, CF_EXPORT: "1" },
  });
} finally {
  for (const rel of routes) {
    const p = path.join(root, rel);
    if (fs.existsSync(p + ".bak")) {
      fs.renameSync(p + ".bak", p);
    }
  }
}
