import test from "node:test";
import assert from "node:assert/strict";
import { dataValida, leitura, horasDecimais, minutosOperacao } from "../src/features/diario/modelo.ts";

test("diário aplica a base da aeronave e mantém leituras desconhecidas distintas de zero", () => {
  const mes = { modo_celula: "tvoo", celula_atual_tvoo: 0, celula_atual_ttotal: 95, celula_prox_revisao_tvoo: 110 };
  assert.equal(leitura(mes, "atual"), 0);
  assert.equal(leitura(mes, "prox_revisao"), 110);
  assert.equal(leitura({ ...mes, modo_celula: "tempo_total" }, "atual"), 95);
  assert.equal(horasDecimais(leitura(undefined, "atual")), "—");
  assert.equal(leitura({ celula_prox_revisao_ttotal: 0 }, "prox_revisao"), null);
  assert.equal(horasDecimais(-0.5), "−0h 30m");
});

test("lançamento valida a data e calcula horas UTC inclusive na virada do mês", () => {
  assert.equal(dataValida("2024-02-29"), true);
  assert.equal(dataValida("2026-02-29"), false);
  assert.deepEqual(minutosOperacao(["23:40", "23:55", "00:55", "01:00"]), { voo: 60, total: 80 });
  assert.equal(minutosOperacao(["10:00", "10:20", "10:20", "10:45"]), null);
  assert.equal(minutosOperacao(["10:00", "10:20", "10:10", "09:00"]), null);
  assert.equal(minutosOperacao(["10:00", "10:60", "", "11:30"]), null);
});
