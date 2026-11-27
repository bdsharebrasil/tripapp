import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appRoot = new URL("../", import.meta.url);
const [screen, nativeViewer, webFallback, packageFile, appConfig] =
  await Promise.all([
    readFile(new URL("app/relatorio-viagem.tsx", appRoot), "utf8"),
    readFile(new URL("src/components/RelatorioPdfViewer.native.tsx", appRoot), "utf8"),
    readFile(new URL("src/components/RelatorioPdfViewer.tsx", appRoot), "utf8"),
    readFile(new URL("package.json", appRoot), "utf8"),
    readFile(new URL("app.json", appRoot), "utf8"),
  ]);

test("relatório abre o leitor PDF na tela em todas as plataformas", () => {
  assert.match(screen, /const viewReportPdf = \(\) => \{\s*if \(selected\) setPdfPreviewOpen\(true\)/);
  assert.doesNotMatch(screen, /Platform\.OS === "web"[\s\S]{0,120}viewReportPdf/);
  assert.match(screen, /<RelatorioPdfViewer[\s\S]{0,260}visible=\{pdfPreviewOpen\}/);
  assert.match(screen, /Ver PDF do relatório/);
  assert.doesNotMatch(webFallback, /react-native-better-pdf/);
  assert.match(webFallback, /apiFetch<ApiBinary>/);
  assert.match(webFallback, /React\.createElement\("iframe"/);
  assert.match(webFallback, /onRequestClose=\{onClose\}/);
});

test("comprovantes têm botões separados e download explícito com fechar", () => {
  assert.match(screen, /item\.anexos\.map\(\(attachment, attachmentIndex\)[\s\S]{0,900}styles\.expenseAttachmentButton/);
  assert.match(screen, /setProofPdfPreview\(\{ path, title, mime \}\)/);
  assert.match(screen, /setProofPreview\([\s\S]{0,220}path,[\s\S]{0,80}mime:/);
  assert.match(screen, /accessibilityLabel="Baixar comprovante"/);
  assert.match(screen, /accessibilityLabel="Fechar comprovante"/);
  assert.match(screen, /onPress=\{\(\) => \{[\s\S]{0,220}downloadPrivateFile\(/);
  assert.doesNotMatch(screen, /proofBadgeButton/);
});

test("leitor nativo busca o PDF autenticado, exibe páginas e mantém download manual", () => {
  assert.match(nativeViewer, /import \{ PdfView \} from "react-native-better-pdf"/);
  assert.match(nativeViewer, /getToken\(\)/);
  assert.match(nativeViewer, /headers: \{ Authorization: `Bearer \$\{token\}` \}/);
  assert.match(nativeViewer, /source=\{source\}/);
  assert.match(nativeViewer, /onPageChange/);
  assert.match(nativeViewer, /onRequestClose=\{onClose\}/);
  assert.match(nativeViewer, /Tentar novamente/);
  assert.match(nativeViewer, /accessibilityLabel="Baixar arquivo PDF"/);
});

test("dependências nativas e arquitetura exigida estão declaradas", () => {
  const pack = JSON.parse(packageFile);
  const expo = JSON.parse(appConfig).expo;
  assert.equal(pack.dependencies["react-native-better-pdf"], "1.3.0");
  assert.equal(pack.dependencies["react-native-nitro-modules"], "0.37.0");
  assert.equal(expo.newArchEnabled, true);
});
