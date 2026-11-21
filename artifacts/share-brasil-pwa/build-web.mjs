import { spawnSync } from "node:child_process";
import { readFile, writeFile, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Web, iOS e Android usam as mesmas telas e os mesmos contratos de API.
const app = fileURLToPath(new URL("../share-brasil/", import.meta.url));
const out = fileURLToPath(new URL("./dist/", import.meta.url));
const result = spawnSync(
  "pnpm",
  ["exec", "expo", "export", "--platform", "web", "--output-dir", out],
  {
    cwd: app,
    stdio: "inherit",
    env: {
      ...process.env,
      EXPO_PUBLIC_API_URL:
        process.env.EXPO_PUBLIC_API_URL || "https://api.share-brasil.com",
    },
  },
);
if (result.status !== 0) process.exit(result.status || 1);
await copyFile(
  new URL("../share-brasil/assets/images/icon.png", import.meta.url),
  `${out}/icon.png`,
);
await writeFile(
  `${out}/manifest.webmanifest`,
  JSON.stringify({
    name: "Trip Share",
    short_name: "Trip Share",
    start_url: "/",
    display: "standalone",
    theme_color: "#060e1c",
    background_color: "#060e1c",
    icons: [
      {
        src: "/icon.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
    ],
  }),
);
const html = await readFile(`${out}/index.html`, "utf8");
await writeFile(
  `${out}/index.html`,
  html.replace(
    "</head>",
    '<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#060e1c"></head>',
  ),
);
await writeFile(`${out}/_redirects`, "/* /index.html 200\n");
await writeFile(
  `${out}/_headers`,
  "/index.html\n  Cache-Control: no-cache\n/manifest.webmanifest\n  Cache-Control: no-cache\n",
);
