import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const screen = await readFile(new URL("../app/relatorio-viagem.tsx", import.meta.url), "utf8");

test("a tela pede o mês local e usa o resumo efetivo devolvido pela API", () => {
  assert.match(screen, /const currentMonth = localISO\(\)\.slice\(0, 7\)/);
  assert.match(screen, /`\$\{BASE\}\/minhas\?mes=\$\{encodeURIComponent\(currentMonth\)\}`/);
  assert.match(screen, /resumo_pagamentos\?\.pago_mes_centavos/);
  assert.match(screen, /paymentMonthSummary\?\.mes === currentMonth/);
  assert.match(screen, /return \{ \.\.\.calculated, pago: paidThisMonth \}/);
});

test("o total mensal não depende do limite de relatórios exibidos", () => {
  assert.match(screen, /pago: paidThisMonth/);
  assert.match(screen, /pagamento_data \|\| report\.data_pagamento/);
});
