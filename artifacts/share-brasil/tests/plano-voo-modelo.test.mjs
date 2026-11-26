import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(
  new URL("../src/features/plano-voo/modelo.ts", import.meta.url),
  "utf8",
);
const javascript = ts.transpile(source, {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
});
const modeloModule = { exports: {} };
const requireMock = (specifier) => {
  if (specifier === "@/src/lib/api") return { apiFetch: async () => ({}) };
  if (specifier === "@/hooks/useColors") return { useColors: () => ({}) };
  throw new Error(`Import não esperado no modelo do plano: ${specifier}`);
};
new Function("exports", "require", "module", javascript)(
  modeloModule.exports,
  requireMock,
  modeloModule,
);

const {
  criarFormularioIcao,
  formatarHoraUtc,
  gerarMensagemIcao,
  paraPlano,
  paraRegistro,
} = modeloModule.exports;

const planoExemplo = () => ({
  numeroVoo: "EBL-0003/26",
  solicitacaoId: "52",
  partida: "SBGR",
  chegada: "SBBR",
  trecho: "DCT",
  data: "2026-11-26",
  aeronave: "Cessna 172",
  aeronaveId: "10",
  matricula: "PR-ABC",
  horaPrevista: "10:00",
  estimativaVoo: "01:20",
  combustivelPrevisto: 120,
  alternates: "SBSP",
  passageiros: 2,
  peso: 180,
  piloto: "Piloto",
  copiloto: "Copiloto",
  observacoes: "",
  condicoes: "VMC",
  fpl: {
    ...criarFormularioIcao(),
    identificacao: "PRABC",
    tipoAeronave: "C172",
    equipamento: "SDFG/LB1",
    adep: "SBGR",
    eobt: "1000",
    velocidade: "N0150",
    nivel: "A045",
    rota: "DCT",
    ades: "SBBR",
    eet: "0120",
    alternado1: "SBSP",
    autonomia: "0400",
    pessoasABordo: "4",
    piloto: "Piloto",
    corAeronave: "BRANCA",
  },
  status: "rascunho",
});

test("extrai a hora UTC de horário simples e de timestamp", () => {
  assert.equal(formatarHoraUtc("14:35"), "14:35");
  assert.equal(formatarHoraUtc("2026-11-26T14:35:00Z"), "14:35");
  assert.equal(formatarHoraUtc("2026-11-26T14:35:00-03:00"), "17:35");
  assert.equal(formatarHoraUtc("1435Z"), "14:35");
  assert.equal(formatarHoraUtc("2026-11-26"), "");
});

test("plano salvo exibe apenas a hora UTC de um EOBT em timestamp", () => {
  const plano = paraPlano({
    id: "utc-1",
    numero_voo: "EBL-0003/26",
    adep: "SBGR",
    ades: "SBBR",
    data_voo: "2026-11-26",
    eobt: "2026-11-26T14:35:00Z",
    created_at: "2026-11-26T00:00:00Z",
    payload: { form: {} },
  });

  assert.equal(plano.horaPrevista, "14:35");
});

test("número operacional não substitui a identificação ICAO do Item 7", () => {
  const plano = planoExemplo();
  const registro = paraRegistro(plano);

  assert.equal(registro.numero_voo, "EBL-0003/26");
  assert.equal(registro.form.fpl.identificacao, "PRABC");

  const recuperado = paraPlano({
    id: "plan-1",
    numero_voo: registro.numero_voo,
    adep: registro.adep,
    ades: registro.ades,
    data_voo: registro.data_voo,
    eobt: registro.eobt,
    created_at: "2026-11-26T00:00:00Z",
    payload: { form: registro.form, contexto: registro.contexto },
  });

  assert.equal(recuperado.numeroVoo, "EBL-0003/26");
  assert.equal(recuperado.fpl.identificacao, "PRABC");
  assert.match(gerarMensagemIcao(recuperado.fpl), /^\(FPL-PRABC-/);
  assert.doesNotMatch(gerarMensagemIcao(recuperado.fpl), /FPL-EBL-0003/);
});

test("converte payload Vite legado sem confundir número do voo com Item 7", () => {
  const legado = {
    identificacao: "EBL-0003/26",
    numeroAeronaves: "1",
    tipoAeronave: "C172",
    esteira: "L",
    equipamento: "SDFG/LB1",
    adep: "SBGR",
    eobt: "10:00",
    velocidade: "N0150",
    nivel: "A045",
    rota: "DCT",
    ades: "SBBR",
    eet: "0120",
    alternado1: "SBSP",
    autonomia: "0400",
    pessoasABordo: "3",
    corAeronave: "BRANCA",
    piloto: "Piloto",
    dataVoo: "2026-11-26",
  };
  const plano = paraPlano({
    id: "legacy-1",
    numero_voo: "EBL-0003/26",
    adep: "SBGR",
    ades: "SBBR",
    data_voo: "2026-11-26",
    eobt: "10:00",
    created_at: "2026-11-26T00:00:00Z",
    payload: {
      form: legado,
      contexto: {
        solicitacao: {
          id: 52,
          numero_voo: "EBL-0003/26",
          matricula_registro: "PR-ABC",
          modelo: "Cessna 172",
        },
      },
    },
  });

  assert.equal(plano.numeroVoo, "EBL-0003/26");
  assert.equal(plano.solicitacaoId, "52");
  assert.equal(plano.matricula, "PR-ABC");
  assert.equal(plano.fpl.identificacao, "PRABC");
  assert.equal(plano.fpl.eobt, "10:00");
  assert.equal(plano.fpl.tipoAeronave, "C172");
});

test("Item 7 não preenche o número operacional quando ele está vazio", () => {
  const plano = { ...planoExemplo(), numeroVoo: "" };
  const registro = paraRegistro(plano);

  assert.equal(registro.numero_voo, null);
  assert.equal(registro.form.fpl.identificacao, "PRABC");

  const recuperado = paraPlano({
    id: "manual-1",
    numero_voo: registro.numero_voo,
    adep: registro.adep,
    ades: registro.ades,
    data_voo: registro.data_voo,
    eobt: registro.eobt,
    created_at: "2026-11-26T00:00:00Z",
    payload: { form: registro.form, contexto: registro.contexto },
  });

  assert.equal(recuperado.numeroVoo, "");
  assert.equal(recuperado.fpl.identificacao, "PRABC");
});

test("identificação ICAO legada sem solicitação não é relida como número do voo", () => {
  const plano = paraPlano({
    id: "legacy-manual-1",
    numero_voo: "PRABC",
    adep: "SBGR",
    ades: "SBBR",
    data_voo: "2026-11-26",
    eobt: "10:00",
    created_at: "2026-11-26T00:00:00Z",
    payload: {
      form: { identificacao: "PRABC", tipoAeronave: "C172" },
      contexto: null,
    },
  });

  assert.equal(plano.numeroVoo, "");
  assert.equal(plano.fpl.identificacao, "PRABC");
});
