import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../../../", import.meta.url));
async function files(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", ".expo"].includes(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...(await files(p)));
    else result.push(p);
  }
  return result;
}
test("package.json ativos correspondem ao app Expo e não incluem dependências antigas", async () => {
  const manifests = ["package.json", "artifacts/share-brasil/package.json"];
  for (const name of manifests) {
    const pkg = JSON.parse(await readFile(path.join(root, name), "utf8"));
    for (const dep of Object.keys({
      ...pkg.dependencies,
      ...pkg.devDependencies,
    })) {
      assert.doesNotMatch(
        dep,
        /^(?:@replit\/|replit-|express$|pg$|postgres$|drizzle|@supabase\/)/,
      );
    }
  }
  const expo = JSON.parse(
    await readFile(path.join(root, "artifacts/share-brasil/app.json"), "utf8"),
  ).expo;
  assert.equal(expo.web.bundler, "metro");
  for (const dir of [
    "artifacts/api-server",
    "artifacts/mockup-sandbox",
    "lib",
    "scripts",
    "attached_assets",
  ])
    await assert.rejects(access(path.join(root, dir)));
  const lock = await readFile(path.join(root, "pnpm-lock.yaml"), "utf8");
  assert.doesNotMatch(
    lock,
    /@replit\/|replit-|drizzle-orm|drizzle-kit|express@|postgres@|@supabase\//,
  );
});
test("rede remota fica em apiFetch; upload lê somente Blob/Data local", async () => {
  const app = path.join(root, "artifacts/share-brasil");
  for (const dir of ["app", "components", "src"])
    for (const file of await files(path.join(app, dir))) {
      if (!/\.[jt]sx?$/.test(file)) continue;
      const source = await readFile(file, "utf8");
      assert.doesNotMatch(
        source,
        /supabase|DATABASE_URL|\.replit|@workspace\/api|https?:\/\/[^"'`\s]*replit/i,
      );
      if (
        /\bfetch\s*\(|downloadFileAsync\s*\(|new\s+XMLHttpRequest/.test(source)
      ) {
        const rel = path.relative(app, file).replaceAll("\\", "/");
        assert.ok(
          ["src/lib/api.ts", "src/lib/upload.ts"].includes(rel),
          `Rede fora da camada única: ${rel}`,
        );
      }
    }
  const upload = await readFile(path.join(app, "src/lib/upload.ts"), "utf8");
  assert.match(upload, /blob:.*data:/);
});
