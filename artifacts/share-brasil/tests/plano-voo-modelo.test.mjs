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
  esteiraDaAeronave,
  normalizarAeronaveSolicitacao,
  velocidadeCruzeiroDaAeronave,
  velocidadeIcao,
  modeloParaFormulario,
  preencherDadosAeronaveIcao,
  normalizarRespostaRotaer,
  normalizarRespostaRota,
  formatarTempoVoo,
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

test("converte payload legado sem confundir número do voo com Item 7", () => {
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

test("seleção de aeronave preserva os dados D1 e prioriza a performance", () => {
  const aeronave = normalizarAeronaveSolicitacao({
    id: 10,
    matricula_registro: "PR-ABC",
    fabricante: "Cessna",
    modelo: "Cessna 172",
    designador_icao: "C172",
    tipo_aeronave: "PISTAO",
    velocidade_cruzeiro: 110,
    performance_velocidade_cruzeiro_kt: 125,
    consumo_combustivel: 32,
    equipamentos_icao: "SDFG",
    vigilancia_icao: "LB1",
    pbn_icao: "B2",
    autonomia_padrao_minutos: 240,
    cor_marcas: "BRANCA",
  });

  assert.equal(aeronave.id, "10");
  assert.equal(modeloParaFormulario(aeronave), "C172");
  assert.equal(velocidadeCruzeiroDaAeronave(aeronave), 125);
  assert.equal(velocidadeIcao(velocidadeCruzeiroDaAeronave(aeronave)), "N0125");
  assert.equal(esteiraDaAeronave(aeronave), "L");
  assert.equal(aeronave.equipamentos_icao, "SDFG");
  assert.equal(aeronave.autonomia_padrao_minutos, 240);
});

test("esteira de jato é M e não depende do campo designador ICAO", () => {
  assert.equal(
    esteiraDaAeronave({
      id: "j1",
      modelo: "Phenom 100",
      tipo_aeronave: "JATO",
      designador_icao: "E50P",
    }),
    "M",
  );
});

test("preenche todos os dados ICAO cadastrados da aeronave selecionada", () => {
  const aeronave = normalizarAeronaveSolicitacao({
    id: "42",
    matricula_registro: "PR-XYZ",
    fabricante: "Embraer",
    modelo: "EMB-711",
    designador_icao: "P28T",
    esteira_turbulencia: "H",
    equipamentos_icao: "SDFG",
    vigilancia_icao: "LB1",
    pbn_icao: "B2D2",
    autonomia_padrao_minutos: "305",
    cor_marcas: "BRANCA COM FAIXA AZUL",
    consumo_combustivel: "65,5",
    performance: {
      velocidade_cruzeiro_kt: "142",
      categoria: "A",
      teto_servico_ft: 18000,
      taxa_subida_fpm: 850,
      taxa_descida_fpm: 700,
    },
  });
  const fpl = preencherDadosAeronaveIcao(aeronave, criarFormularioIcao());

  assert.equal(fpl.identificacao, "PRXYZ");
  assert.equal(fpl.tipoAeronave, "P28T");
  assert.equal(fpl.esteira, "H");
  assert.equal(fpl.equipamento, "SDFG/LB1");
  assert.equal(fpl.velocidade, "N0142");
  assert.equal(fpl.autonomia, "0505");
  assert.equal(fpl.corAeronave, "BRANCA COM FAIXA AZUL");
  assert.match(fpl.outrasInformacoes, /REG\/PRXYZ/);
  assert.match(fpl.outrasInformacoes, /TYP\/EMB-711/);
  assert.match(fpl.outrasInformacoes, /PBN\/B2D2/);
  assert.equal(aeronave.consumo_combustivel, 65.5);
  assert.equal(aeronave.performance_categoria, "A");
  assert.equal(aeronave.performance_taxa_subida_fpm, 850);
});

test("normaliza envelopes ROTAER e variantes de coordenadas e pistas", () => {
  const aeroporto = normalizarRespostaRotaer(
    {
      success: true,
      data: {
        airport: {
          AeroCode: "SBSP",
          nome: "Congonhas",
          cidade: "São Paulo",
          uf: "SP",
          altFt: "2631",
          latitude: "-23.6261",
          longitude: "-46.6566",
          runways: {
            runway: [{ ident: "17R/35L", length: { "#text": "1940" } }],
          },
          services: {
            service: [
              {
                "@_type": "COM",
                type: "TWR",
                callsign: "CONGONHAS TOWER",
                freqs: { freq: { "#text": "118.250" } },
              },
            ],
          },
        },
      },
    },
    "SBSP",
  );

  assert.equal(aeroporto.icao, "SBSP");
  assert.equal(aeroporto.name, "Congonhas");
  assert.equal(aeroporto.city, "São Paulo");
  assert.equal(aeroporto.coordinates.lat, -23.6261);
  assert.equal(aeroporto.coordinates.lng, -46.6566);
  assert.equal(aeroporto.elevation, "2631");
  assert.equal(aeroporto.runways.length, 1);
  assert.equal(aeroporto.runways[0].ident, "17R/35L");
  assert.equal(aeroporto.frequencies[0].frequency, "118.250");
  assert.equal(aeroporto.frequencies[0].type, "TWR");
});

test("normaliza distância e tempo quando a API retorna aliases em envelope", () => {
  const rota = normalizarRespostaRota(
    {
      success: true,
      data: {
        flightplan: { route_string: "DCT", distance: "105 NM", ete: "01:30" },
        departure: { icao: "SBGR", lat: -23.4356, longitude: -46.4731 },
        destination: { icao: "SBBR", latitude: -15.8692, lon: -47.9208 },
      },
    },
    "SBGR",
    "SBBR",
  );

  assert.equal(rota.flightplan.route, "DCT");
  assert.equal(rota.flightplan.distance_nm, 105);
  assert.equal(rota.flightplan.flight_minutes, 90);
  assert.equal(formatarTempoVoo(rota.flightplan.flight_minutes), "1h 30min");
  assert.equal(rota.departure.icao, "SBGR");
});

test("calcula distância geodésica e tempo pela velocidade quando a API omite os dados", () => {
  const rota = normalizarRespostaRota(
    {
      departure: { icao: "SBGR", lat: -23.4356, lon: -46.4731 },
      destination: { icao: "SBBR", lat: -15.8692, lon: -47.9208 },
    },
    "SBGR",
    "SBBR",
    120,
  );

  assert.ok(rota.flightplan.distance_nm > 400);
  assert.ok(rota.flightplan.flight_minutes > 200);
  assert.match(rota.flightplan.estimated_time, /h/);
});
