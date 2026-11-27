import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [pdf, agenda, preparacao, packageFile, lockfile, files] =
  await Promise.all([
    readFile(new URL("src/lib/briefing-pdf.ts", root), "utf8"),
    readFile(new URL("app/(tabs)/agenda.tsx", root), "utf8"),
    readFile(new URL("app/preparacao-voo.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("../../pnpm-lock.yaml", root), "utf8"),
    readFile(new URL("src/lib/arquivo-privado.ts", root), "utf8"),
  ]);

test("briefing usa download autenticado, valida PDF e limpa a cópia temporária", () => {
  assert.match(pdf, /abrirArquivoPrivado\(/);
  assert.match(pdf, /preparacao\/pdf\?versao/);
  assert.match(files, /apiFetch<ApiBinary>/);
  assert.match(files, /responseType:\s*['"]binary['"]/);
  assert.match(files, /ascii\.startsWith\("%PDF-"\)/);
  assert.match(files, /Sharing\.shareAsync\(file\.uri/);
  assert.match(files, /file\.delete\(\)/);
  assert.doesNotMatch(pdf, /\?token=|\?access_token=|Linking\.openURL/);
});

test("agenda e checklist oferecem briefing da versão recebida pelo Worker", () => {
  assert.match(agenda, /abrirBriefingPdf\(\s*voo\.id,\s*snapshot\.versao/);
  assert.match(preparacao, /abrirBriefingPdf\(\s*id,\s*snapshot\.versao/);
  assert.match(preparacao, /if \(dirty\)/);
});

test("checklist de aeronave usa as quatro seções operacionais", async () => {
  const checklist = await readFile(
    new URL("src/features/checklist/checklist.ts", root),
    "utf8",
  );
  assert.match(checklist, /Coordenação de voo/);
  assert.match(checklist, /Despachante — check externo/);
  assert.match(checklist, /Aeronave — check interno/);
  assert.match(checklist, /Segurança e documentação crítica/);
});

test("dependências Expo SDK 58 de PDF estão alinhadas ao lockfile", () => {
  const pack = JSON.parse(packageFile);
  assert.equal(pack.dependencies["expo-file-system"], "~58.0.14");
  assert.equal(pack.dependencies["expo-sharing"], "~58.0.23");
  assert.match(lockfile, /expo-sharing@58\.0\.23/);
  assert.match(lockfile, /expo-file-system@58\.0\.14/);
});
