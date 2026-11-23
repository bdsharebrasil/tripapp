import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = new URL("../", import.meta.url);
const sources = Object.fromEntries(
  await Promise.all(
    [
      ["despesas", "app/relatorio-viagem.tsx"],
      ["perfil", "app/(tabs)/perfil.tsx"],
      ["ferias", "app/ferias.tsx"],
      ["history", "app/relatorio-voo.tsx"],
      ["diario", "app/(tabs)/diario.tsx"],
      ["novo", "app/novo-lancamento.tsx"],
      ["home", "app/(tabs)/index.tsx"],
      ["files", "src/lib/arquivo-privado.ts"],
      ["package", "package.json"],
      ["lock", "../../pnpm-lock.yaml"],
    ].map(async ([name, file]) => [
      name,
      await readFile(new URL(file, app), "utf8"),
    ]),
  ),
);

test("Despesas cria relatório pelo voo e seleciona o registro salvo", () => {
  assert.match(sources.despesas, /\/iniciar-do-voo/);
  assert.match(
    sources.despesas,
    /setSelectedId\(String\(result\.relatorio\.id\)\)/,
  );
  assert.match(sources.despesas, /Criar nova despesa/);
  assert.match(sources.despesas, /despesas-tripulante/);
  assert.match(sources.despesas, /finalizar/);
  assert.doesNotMatch(sources.despesas, /AsyncStorage|useApp\(/);
});

test("Comprovantes podem ser enviados por fotos, câmera ou arquivo e abertos de forma privada", () => {
  assert.match(sources.despesas, /ImagePicker\.launchCameraAsync/);
  assert.match(sources.despesas, /ImagePicker\.launchImageLibraryAsync/);
  assert.match(sources.despesas, /DocumentPicker\.getDocumentAsync/);
  assert.match(sources.despesas, /anexos-tripulante/);
  assert.match(sources.despesas, /abrirArquivoPrivado/);
  assert.match(sources.files, /apiFetch<ApiBinary>/);
  assert.match(sources.files, /responseType:\s*['"]binary['"]/);
  assert.match(sources.files, /Sharing\.shareAsync/);
  assert.match(sources.files, /file\.delete\(\)/);
  assert.doesNotMatch(sources.files, /AsyncStorage|\?token=/);
});

test("Histórico e reembolsos usam campos do Worker", () => {
  assert.match(sources.despesas, /historico_ajustes/);
  assert.match(sources.despesas, /pagamento_status/);
  assert.match(sources.despesas, /pagamento_total/);
  assert.match(sources.home, /\/api\/colaborador\/perfil/);
  assert.match(sources.home, /pagamento_total/);
});

test("Perfil, folha, documentos, férias e histórico deixam de usar operações locais", () => {
  assert.match(sources.perfil, /\/api\/colaborador\/perfil/);
  assert.match(sources.perfil, /\/api\/colaborador\/folha-pagamento/);
  assert.match(sources.perfil, /\/api\/colaborador\/documentos/);
  assert.match(sources.perfil, /DocumentPicker\.getDocumentAsync/);
  assert.match(sources.ferias, /\/api\/colaborador\/ferias/);
  assert.match(sources.ferias, /method: "POST"/);
  assert.match(sources.history, /\/api\/colaborador\/meus-voos/);
  for (const name of ["perfil", "ferias", "history", "diario", "novo"]) {
    assert.doesNotMatch(
      sources[name],
      /addFlight\(|addVacationRequest\(|updateVacationRequest\(|AsyncStorage|DEMO_/,
    );
  }
});

test("Nenhum botão de lançamento escreve registro fictício; DocumentPicker SDK 58 está travado", () => {
  assert.match(sources.novo, /router\.replace\("\/\(tabs\)\/agenda"\)/);
  assert.doesNotMatch(sources.novo, /addFlight\(/);
  const pkg = JSON.parse(sources.package);
  assert.equal(pkg.devDependencies["expo-document-picker"], "~58.0.5");
  assert.match(sources.lock, /expo-document-picker@58\.0\.5/);
});
