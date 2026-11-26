import test from "node:test";
import assert from "node:assert/strict";
import {
  dataDespesaDeDiaMes,
  formatarDataDiaMes,
  valorDespesa,
  payloadDespesas,
} from "../src/lib/despesas.ts";

test("valor em reais conserva centavos digitados com vírgula e separador de milhar", () => {
  for (const [texto, valor] of [
    ["188,50", 188.5],
    ["1.234,56", 1234.56],
    ["R$ 8.920,00", 8920],
    ["123.45", 123.45],
    ["123,", 123],
  ])
    assert.equal(valorDespesa(texto), valor);
  assert.ok(Number.isNaN(valorDespesa("12,3,4")));
  assert.ok(Number.isNaN(valorDespesa("-10")));
});
test("item novo conserva o identificador obrigatório e não envia metadados de interface", () => {
  const item = {
    id: "uuid-novo",
    categoria: "Alimentação",
    data: "2026-11-21",
    valor: 188.5,
    pago_por: "tripulante_1",
    descricao: "  Refeição  ",
    valorTexto: "188,50",
    anexos: [],
  };
  const first = payloadDespesas([item]);
  assert.equal(first.despesas[0].id, "uuid-novo");
  assert.equal(first.despesas[0].descricao, "Refeição");
  assert.ok(!("valorTexto" in first.despesas[0]));
  assert.equal(
    payloadDespesas([{ ...item, valor: 200 }]).despesas[0].id,
    first.despesas[0].id,
  );
});

test("data de despesa aceita DD/MM no ano do voo e valida dias do calendário", () => {
  assert.equal(dataDespesaDeDiaMes("09/04", 2026), "2026-04-09");
  assert.equal(dataDespesaDeDiaMes("29/02", 2024), "2024-02-29");
  assert.equal(dataDespesaDeDiaMes("29/02", 2025), null);
  assert.equal(dataDespesaDeDiaMes("31/04", 2026), null);
  assert.equal(formatarDataDiaMes("2026-04-09"), "09/04");
  assert.equal(formatarDataDiaMes("2026-02-30"), "");
});
