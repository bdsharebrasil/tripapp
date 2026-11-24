import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Botao,
  Cabecalho,
  ErroConsulta,
  Icon,
  ItemLista,
  Painel,
  Tela,
  Toque,
  Vazio,
  tema,
} from "@/src/components/ui";
import { apiFetch } from "@/src/lib/api";
import { abrirArquivoPrivado } from "@/src/lib/arquivo-privado";
import { avisar } from "@/src/lib/confirmar";
import {
  PagamentoFolha,
  Recebimento,
  RelatorioReembolso,
  Situacao,
  agruparPorCompetencia,
  dataCurta,
  deFolha,
  deReembolso,
  mimeDoCaminho,
  moedaCentavos,
  nomeCompetencia,
} from "./modelo";

type Filtro = "todos" | "folha" | "reembolso";
const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: "todos", rotulo: "Todos" },
  { id: "folha", rotulo: "Salário" },
  { id: "reembolso", rotulo: "Reembolsos" },
];
const SITUACAO: Record<Situacao, { rotulo: string; cor: string }> = {
  recebido: { rotulo: "Recebido", cor: tema.verde },
  previsto: { rotulo: "A receber", cor: tema.destaque },
  cancelado: { rotulo: "Cancelado", cor: tema.perigo },
};

export function FinanceiroScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [itens, setItens] = useState<Recebimento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState("");
  const [ano, setAno] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [aberto, setAberto] = useState<Recebimento | null>(null);
  const [abrindo, setAbrindo] = useState(false);

  const carregar = useCallback(async (manual = false) => {
    if (manual) setAtualizando(true);
    setErro("");
    const [folha, reembolsos] = await Promise.allSettled([
      apiFetch<{ pagamentos: PagamentoFolha[] }>(
        "/api/colaborador/folha-pagamento",
      ),
      apiFetch<{ relatorios: RelatorioReembolso[] }>(
        "/api/financeiro/relatorios-despesa-viagem/minhas",
      ),
    ]);
    const lista: Recebimento[] = [];
    if (folha.status === "fulfilled" && Array.isArray(folha.value.pagamentos))
      lista.push(...folha.value.pagamentos.map(deFolha));
    if (
      reembolsos.status === "fulfilled" &&
      Array.isArray(reembolsos.value.relatorios)
    )
      lista.push(...reembolsos.value.relatorios.flatMap(deReembolso));
    setItens(lista);
    if (folha.status === "rejected" && reembolsos.status === "rejected")
      setErro("Não foi possível consultar seus recebimentos.");
    else if (folha.status === "rejected")
      setErro("Pagamentos da folha indisponíveis no momento.");
    else if (reembolsos.status === "rejected")
      setErro("Reembolsos de viagem indisponíveis no momento.");
    setCarregando(false);
    setAtualizando(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  const anos = useMemo(() => {
    const set = new Set(
      itens.map((i) => i.competencia.slice(0, 4)).filter(Boolean),
    );
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [itens]);
  const anoAtual = String(new Date().getFullYear());
  const anoSelecionado =
    ano && anos.includes(ano)
      ? ano
      : anos.includes(anoAtual)
        ? anoAtual
        : anos[0] || anoAtual;

  const doAno = itens.filter((i) => i.competencia.startsWith(anoSelecionado));
  const visiveis = doAno.filter(
    (i) => filtro === "todos" || i.origem === filtro,
  );
  const soma = (s: Situacao) =>
    doAno
      .filter((i) => i.situacao === s)
      .reduce((n, i) => n + i.valorCentavos, 0);
  const recebido = soma("recebido");
  const aReceber = soma("previsto");
  const grupos = agruparPorCompetencia(visiveis);

  const abrir = async (path: string, titulo: string, mime: string) => {
    if (abrindo) return;
    setAbrindo(true);
    try {
      await abrirArquivoPrivado(path, titulo, mime);
    } catch (e) {
      avisar(
        "Arquivo indisponível",
        e instanceof Error ? e.message : "Não foi possível abrir.",
      );
    } finally {
      setAbrindo(false);
    }
  };

  return (
    <Tela>
      <Cabecalho
        titulo="Financeiro"
        apoio="Seus recebimentos"
        acao={() => void carregar(true)}
      />
      {carregando ? (
        <ActivityIndicator color={tema.destaque} style={{ marginTop: 50 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.conteudo}
          refreshControl={
            <RefreshControl
              refreshing={atualizando}
              onRefresh={() => void carregar(true)}
              tintColor={tema.destaque}
            />
          }
        >
          {!!erro && (
            <ErroConsulta
              mensagem={erro}
              atualizar={() => void carregar(true)}
            />
          )}

          <View style={s.resumo}>
            <View style={s.resumoTopo}>
              <View style={s.resumoIcone}>
                <Icon name="wallet" size={20} color={tema.destaque} />
              </View>
              <Text style={s.resumoRotulo}>Recebido em {anoSelecionado}</Text>
            </View>
            <Text style={s.resumoValor} accessibilityRole="header">
              {moedaCentavos(recebido)}
            </Text>
            <View style={s.resumoLinha}>
              <View style={s.resumoCelula}>
                <Text style={s.celulaRotulo}>A receber</Text>
                <Text style={[s.celulaValor, { color: tema.destaque }]}>
                  {moedaCentavos(aReceber)}
                </Text>
              </View>
              <View style={s.divisor} />
              <View style={s.resumoCelula}>
                <Text style={s.celulaRotulo}>Lançamentos</Text>
                <Text style={s.celulaValor}>{doAno.length}</Text>
              </View>
            </View>
          </View>

          {anos.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.anos}
            >
              {anos.map((a) => {
                const ativo = a === anoSelecionado;
                return (
                  <Toque
                    key={a}
                    haptico="selecao"
                    accessibilityRole="button"
                    accessibilityState={{ selected: ativo }}
                    onPress={() => setAno(a)}
                    style={[s.ano, ativo && s.anoAtivo]}
                  >
                    <Text style={[s.anoTexto, ativo && s.anoTextoAtivo]}>
                      {a}
                    </Text>
                  </Toque>
                );
              })}
            </ScrollView>
          )}

          <View style={s.segmento} accessibilityRole="tablist">
            {FILTROS.map((f) => {
              const ativo = f.id === filtro;
              return (
                <Toque
                  key={f.id}
                  haptico="selecao"
                  accessibilityRole="tab"
                  accessibilityState={{ selected: ativo }}
                  onPress={() => setFiltro(f.id)}
                  style={[s.segItem, ativo && s.segAtivo]}
                >
                  <Text style={[s.segTexto, ativo && s.segTextoAtivo]}>
                    {f.rotulo}
                  </Text>
                </Toque>
              );
            })}
          </View>

          {!grupos.length && (
            <Vazio
              icone="wallet"
              titulo="Nenhum recebimento registrado"
              texto={
                itens.length
                  ? "Não há lançamentos para este filtro."
                  : "Pagamentos e reembolsos aparecerão aqui."
              }
            />
          )}

          {grupos.map(([competencia, lista]) => (
            <View key={competencia || "sem-data"}>
              <View style={s.grupo}>
                <Text style={s.grupoTitulo}>
                  {nomeCompetencia(competencia)}
                </Text>
                <Text style={s.grupoTotal}>
                  {moedaCentavos(
                    lista
                      .filter((i) => i.situacao !== "cancelado")
                      .reduce((n, i) => n + i.valorCentavos, 0),
                  )}
                </Text>
              </View>
              <Painel style={s.painel}>
                {lista.map((item, i) => {
                  const sit = SITUACAO[item.situacao];
                  return (
                    <ItemLista
                      key={item.id}
                      icone={
                        item.origem === "folha" ? "credit-card" : "receipt"
                      }
                      cor={sit.cor}
                      titulo={item.titulo}
                      apoio={dataCurta(item.data)}
                      ultimo={i === lista.length - 1}
                      onPress={() => setAberto(item)}
                      direita={
                        <View style={s.direita}>
                          <Text
                            style={[
                              s.valor,
                              item.situacao === "cancelado" && s.valorCancelado,
                            ]}
                          >
                            {moedaCentavos(item.valorCentavos)}
                          </Text>
                          <Text style={[s.situacao, { color: sit.cor }]}>
                            {sit.rotulo}
                          </Text>
                        </View>
                      }
                    />
                  );
                })}
              </Painel>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal
        visible={!!aberto}
        transparent
        animationType="slide"
        onRequestClose={() => setAberto(null)}
      >
        <View style={s.fundoModal}>
          <Toque
            haptico={false}
            accessibilityLabel="Fechar detalhes"
            style={StyleSheet.absoluteFill}
            onPress={() => setAberto(null)}
          />
          {aberto && (
            <View
              style={[s.folha, { paddingBottom: Math.max(insets.bottom, 20) }]}
            >
              <View style={s.alca} />
              <Text style={s.folhaApoio}>
                {aberto.origem === "folha" ? "Folha de pagamento" : "Reembolso"}
              </Text>
              <Text style={s.folhaTitulo}>{aberto.titulo}</Text>
              <Text style={s.folhaValor}>
                {moedaCentavos(aberto.valorCentavos)}
              </Text>
              <View style={s.detalhes}>
                <Linha
                  rotulo="Situação"
                  valor={SITUACAO[aberto.situacao].rotulo}
                  cor={SITUACAO[aberto.situacao].cor}
                />
                {!!aberto.status && (
                  <Linha
                    rotulo="Status"
                    valor={aberto.status.replace(/_/g, " ")}
                  />
                )}
                <Linha
                  rotulo={
                    aberto.situacao === "recebido" ? "Pago em" : "Data prevista"
                  }
                  valor={dataCurta(aberto.data)}
                />
                {!!aberto.detalhe && (
                  <Linha rotulo="Referência" valor={aberto.detalhe} ultimo />
                )}
              </View>
              <View style={s.acoes}>
                {!!aberto.holeriteUrl && (
                  <Botao
                    texto="Abrir holerite"
                    icone="file-text"
                    carregando={abrindo}
                    onPress={() =>
                      void abrir(
                        aberto.holeriteUrl || "",
                        "Holerite",
                        "application/pdf",
                      )
                    }
                  />
                )}
                {!!aberto.comprovanteUrl && (
                  <Botao
                    secundario
                    texto="Comprovante"
                    icone="paperclip"
                    carregando={abrindo}
                    onPress={() =>
                      void abrir(
                        aberto.comprovanteUrl || "",
                        "Comprovante de pagamento",
                        mimeDoCaminho(aberto.comprovanteUrl || ""),
                      )
                    }
                  />
                )}
                {!!aberto.relatorioId && (
                  <Botao
                    secundario
                    texto="Ver relatório de viagem"
                    icone="file-text"
                    onPress={() => {
                      const relatorioId = aberto.relatorioId;
                      setAberto(null);
                      router.push({
                        pathname: "/relatorio-viagem",
                        params: { relatorioId },
                      });
                    }}
                  />
                )}
              </View>
            </View>
          )}
        </View>
      </Modal>
    </Tela>
  );
}

function Linha({
  rotulo,
  valor,
  cor = tema.texto,
  ultimo,
}: {
  rotulo: string;
  valor: string;
  cor?: string;
  ultimo?: boolean;
}) {
  return (
    <View style={[s.linha, !ultimo && s.linhaDivisor]}>
      <Text style={s.linhaRotulo}>{rotulo}</Text>
      <Text style={[s.linhaValor, { color: cor }]} numberOfLines={2}>
        {valor}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  conteudo: { paddingHorizontal: 20, paddingBottom: 120 },
  resumo: {
    backgroundColor: tema.superficie,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  resumoTopo: { flexDirection: "row", alignItems: "center", gap: 10 },
  resumoIcone: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: tema.destaque + "1F",
    alignItems: "center",
    justifyContent: "center",
  },
  resumoRotulo: {
    color: tema.suave,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  resumoValor: {
    color: tema.texto,
    fontFamily: "Inter_700Bold",
    fontSize: 34,
    letterSpacing: -1,
    marginTop: 14,
  },
  resumoLinha: {
    flexDirection: "row",
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tema.borda,
  },
  resumoCelula: { flex: 1, gap: 4 },
  divisor: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: tema.borda,
    marginHorizontal: 16,
  },
  celulaRotulo: { color: tema.suave, fontSize: 13 },
  celulaValor: {
    color: tema.texto,
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
  },
  anos: { gap: 8, paddingBottom: 12 },
  ano: {
    paddingHorizontal: 16,
    minHeight: 40,
    borderRadius: 20,
    backgroundColor: tema.superficie,
    justifyContent: "center",
  },
  anoAtivo: { backgroundColor: tema.destaque },
  anoTexto: { color: tema.suave, fontFamily: "Inter_600SemiBold" },
  anoTextoAtivo: { color: tema.sobreDestaque },
  segmento: {
    flexDirection: "row",
    backgroundColor: tema.superficie,
    borderRadius: 16,
    padding: 4,
    marginBottom: 4,
  },
  segItem: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  segAtivo: { backgroundColor: tema.elevado },
  segTexto: { color: tema.suave, fontFamily: "Inter_500Medium", fontSize: 14 },
  segTextoAtivo: { color: tema.texto, fontFamily: "Inter_600SemiBold" },
  grupo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginTop: 24,
    marginBottom: 10,
  },
  grupoTitulo: {
    color: tema.texto,
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    letterSpacing: -0.3,
  },
  grupoTotal: { color: tema.suave, fontFamily: "Inter_500Medium" },
  painel: {
    paddingVertical: 2,
    borderWidth: 0,
    marginBottom: 0,
  },
  valor: {
    color: tema.texto,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  direita: { alignItems: "flex-end", gap: 3 },
  situacao: { fontSize: 12, fontFamily: "Inter_500Medium" },
  valorCancelado: { color: tema.suave, textDecorationLine: "line-through" },
  fundoModal: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  folha: {
    backgroundColor: tema.superficie,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  alca: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: tema.borda,
    marginBottom: 18,
  },
  folhaApoio: {
    color: tema.suave,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    fontFamily: "Inter_500Medium",
  },
  folhaTitulo: {
    color: tema.texto,
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    marginTop: 4,
  },
  folhaValor: {
    color: tema.texto,
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    letterSpacing: -1,
    marginTop: 8,
  },
  detalhes: {
    backgroundColor: tema.elevado,
    borderRadius: 18,
    paddingHorizontal: 16,
    marginTop: 18,
  },
  linha: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 14,
  },
  linhaDivisor: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.borda,
  },
  linhaRotulo: { color: tema.suave, fontSize: 14 },
  linhaValor: {
    flexShrink: 1,
    textAlign: "right",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  acoes: { gap: 10, marginTop: 18 },
});
