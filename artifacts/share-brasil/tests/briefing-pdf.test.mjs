import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [pdf, agenda, preparacao, packageFile, lockfile] = await Promise.all([
  readFile(new URL("src/lib/briefing-pdf.ts", root), "utf8"),
  readFile(new URL("app/(tabs)/agenda.tsx", root), "utf8"),
  readFile(new URL("app/preparacao-voo.tsx", root), "utf8"),
  readFile(new URL("package.json", root), "utf8"),
  readFile(new URL("../../../pnpm-lock.yaml", root), "utf8"),
]);

test("briefing usa download autenticado, valida PDF e limpa a cópia temporária", () => {
  assert.match(pdf, /getToken\(\)/);
  assert.match(pdf, /File\.downloadFileAsync\(apiUrl\(caminho\), arquivo, \{/);
  assert.match(pdf, /Authorization: `Bearer \$\{token\}`/);
  assert.match(pdf, /String\.fromCharCode\(\.\.\.assinatura\) !== "%PDF-"/);
  assert.match(pdf, /Sharing\.shareAsync\(arquivo\.uri/);
  assert.match(pdf, /arquivo\.delete\(\)/);
  assert.doesNotMatch(pdf, /\?token=|\?access_token=|Linking\.openURL/);
});

test("agenda e checklist oferecem briefing da versão recebida pelo Worker", () => {
  assert.match(agenda, /abrirBriefingPdf\(voo\.id, snapshot\.versao/);
  assert.match(preparacao, /abrirBriefingPdf\(id, snapshot\.versao/);
  assert.match(preparacao, /if \(dirty\)/);
});

test("dependências Expo SDK 57 de PDF estão alinhadas ao lockfile", () => {
  const pack = JSON.parse(packageFile);
  assert.equal(pack.dependencies["expo-file-system"], "~57.0.7");
  assert.equal(pack.dependencies["expo-sharing"], "~57.0.26");
  assert.match(lockfile, /expo-sharing@57\.0\.26/);
  assert.match(lockfile, /expo-file-system@57\.0\.7/);
});
