import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(
  new URL("../src/features/checklist/checklist.ts", import.meta.url),
  "utf8",
);
const javascript = ts.transpile(source, {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
});
const checklistModule = { exports: {} };
new Function("exports", "require", "module", javascript)(
  checklistModule.exports,
  () => {
    throw new Error("O módulo do checklist não deve importar dependências.");
  },
  checklistModule,
);

const { checklistItemResolvido, proximaSecaoPendente } =
  checklistModule.exports;

test("considera concluído e não aplicável como itens resolvidos", () => {
  assert.equal(checklistItemResolvido("CONCLUIDO"), true);
  assert.equal(checklistItemResolvido("NAO_APLICAVEL"), true);
  assert.equal(checklistItemResolvido("PENDENTE"), false);
  assert.equal(checklistItemResolvido("EM_ANDAMENTO"), false);
});

test("avança à próxima etapa incompleta e volta ao início se necessário", () => {
  const secoes = [
    { id: "a", itens: [{ id: "a1" }] },
    { id: "b", itens: [{ id: "b1" }, { id: "b2" }] },
    { id: "c", itens: [{ id: "c1" }] },
  ];
  const estados = {
    a1: "CONCLUIDO",
    b1: "PENDENTE",
    b2: "PENDENTE",
    c1: "NAO_APLICAVEL",
  };

  assert.equal(proximaSecaoPendente(secoes, estados, "a"), "b");
  assert.equal(proximaSecaoPendente(secoes, estados, "c"), "b");
  assert.equal(
    proximaSecaoPendente(
      secoes,
      {
        a1: "CONCLUIDO",
        b1: "CONCLUIDO",
        b2: "NAO_APLICAVEL",
        c1: "CONCLUIDO",
      },
      "c",
    ),
    "",
  );
});
