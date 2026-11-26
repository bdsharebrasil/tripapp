import { useFocusEffect, useRouter, type Href } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiFetch } from "@/src/lib/api";
import { PerfilCompleto, hoje } from "@/src/lib/perfil";
import { Avatar } from "@/src/components/Avatar";
import {
  ErroConsulta,
  Icon,
  Toque,
  tema,
  type Icone,
} from "@/src/components/ui";

type Voo = {
  id: string;
  numero_voo?: string;
  origem?: string;
  destino?: string;
  data_agendada?: string;
  horario_previsto_agendamento?: string;
  matricula_registro?: string;
  modelo?: string;
  numero_passageiros?: number | null;
  status?: string;
  pagamento_total?: number;
};

type RelatorioDespesa = {
  id?: string | number;
  relatorio_id?: string | number;
  numero_relatorio?: string;
  numero_voo?: string;
  status?: string;
  criado_em?: string;
  data_inicio?: string;
  data_fim?: string;
};

type Periodo = "hoje" | "semana" | "escala";

const PERIODOS: { chave: Periodo; rotulo: string }[] = [
  { chave: "hoje", rotulo: "Hoje" },
  { chave: "semana", rotulo: "Semana" },
  { chave: "escala", rotulo: "Escala" },
];

const AZUL_CLARO = "#7AA7FF";
const LOGO = require("@/assets/images/share-icon.png");

const ATALHOS: {
  rotulo: string;
  icone: Icone;
  path: Href;
  cor: string;
  corSuave: string;
}[] = [
  {
    rotulo: "Relatórios",
    icone: "file-text",
    path: "/(tabs)/despesa-viagem",
    cor: "#A78BFA",
    corSuave: "rgba(167, 139, 250, 0.16)",
  },
  {
    rotulo: "Financeiro",
    icone: "receipt",
    path: "/(tabs)/financeiro",
    cor: "#6FCF97",
    corSuave: "rgba(111, 207, 151, 0.16)",
  },
  {
    rotulo: "Manutenção",
    icone: "tool",
    path: "/manutencao",
    cor: "#FF8A8A",
    corSuave: "rgba(255, 138, 138, 0.16)",
  },
];

const DIAS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const MESES_ABREVIADOS = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
];

const EM_OPERACAO = new Set(["EM_SOLO", "EM_ROTA", "EM_VOO"]);
const CONFIRMADOS = new Set([
  "APROVADA",
  "APROVADO",
  "CONFIRMADA",
  "CONFIRMADO",
]);
const STATUS_APROVACAO_RELATORIO = new Set([
  "AGUARDANDO_APROVACAO",
  "AJUSTE_CONCLUIDO",
]);

const normalizarStatus = (status?: string) =>
  String(status || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

const rotuloStatus = (status?: string) => {
  const chave = normalizarStatus(status);
  if (chave === "EM_SOLO") return "Em solo";
  if (chave === "EM_ROTA" || chave === "EM_VOO") return "Em rota";
  if (CONFIRMADOS.has(chave)) return "Confirmado";
  return status || "Programado";
};

const dataDo = (v: Voo) => String(v.data_agendada || "").slice(0, 10);

const horarioDo = (v?: Voo) =>
  v?.horario_previsto_agendamento?.match(/\d{2}:\d{2}/)?.[0] ?? null;

const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const diaMes = (d?: string | null) => {
  if (!d) return "—";
  const [, m, dia] = d.slice(0, 10).split("-");
  const mes = MESES[Number(m) - 1] ?? "";
  return `${dia} ${mes.charAt(0).toUpperCase()}${mes.slice(1, 3)}`;
};

const dataEmDestaque = (d?: string) => {
  const [ano, mes, dia] = String(d || "")
    .slice(0, 10)
    .split("-");
  const mesAbreviado = MESES_ABREVIADOS[Number(mes) - 1];
  return ano && dia && mesAbreviado
    ? `${dia} ${mesAbreviado} ${ano}`
    : "A definir";
};

const identificadorSolicitacao = (id?: string) => {
  const codigo = String(id || "")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 8)
    .toUpperCase();
  return codigo ? `SOL-${codigo}` : "—";
};

const tempoParaPartida = (v: Voo) => {
  const hr = horarioDo(v);
  const dia = dataDo(v);
  if (!hr || !dia) return null;
  const minutos = Math.round(
    (new Date(`${dia}T${hr}:00`).getTime() - Date.now()) / 60000,
  );
  if (Number.isNaN(minutos) || minutos <= 0) return null;
  if (minutos < 60) return `${minutos}MIN`;
  return `${Math.floor(minutos / 60)}H${String(minutos % 60).padStart(2, "0")}MIN`;
};

export default function HomeScreen() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<PerfilCompleto | null>(null);
  const [voos, setVoos] = useState<Voo[] | null>(null);
  const [relatorios, setRelatorios] = useState<RelatorioDespesa[]>([]);
  const [periodo, setPeriodo] = useState<Periodo>("escala");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const resultados = await Promise.allSettled([
      apiFetch<PerfilCompleto>("/api/colaborador/perfil"),
      apiFetch<{ voos: Voo[] }>("/api/colaborador/meus-voos"),
      apiFetch<{ relatorios: RelatorioDespesa[] }>(
        "/api/financeiro/relatorios-despesa-viagem/minhas",
      ),
    ]);
    const [p, v, r] = resultados;
    setPerfil(p.status === "fulfilled" ? p.value : null);
    setVoos(v.status === "fulfilled" ? v.value.voos : null);
    setRelatorios(
      r.status === "fulfilled" && Array.isArray(r.value.relatorios)
        ? r.value.relatorios
        : [],
    );
    if (resultados.some((x) => x.status === "rejected")) {
      setError("Alguns dados não puderam ser atualizados.");
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const p = perfil?.perfil;
  const nome = p?.nome_exibicao || p?.nome_completo || "Cmte";
  const agora = new Date();
  const horaAtual = agora.getHours();
  const saudacao =
    horaAtual < 12 ? "Bom dia" : horaAtual < 18 ? "Boa tarde" : "Boa noite";

  const hojeIso = hoje();
  const fimSemana = isoLocal(new Date(Date.now() + 7 * 86400000));

  const relevantes = (voos || [])
    .filter((v) => {
      const status = normalizarStatus(v.status);
      return (
        EM_OPERACAO.has(status) ||
        (dataDo(v) >= hojeIso && CONFIRMADOS.has(status))
      );
    })
    .sort((a, b) => {
      const aAtivo = EM_OPERACAO.has(normalizarStatus(a.status));
      const bAtivo = EM_OPERACAO.has(normalizarStatus(b.status));
      if (aAtivo !== bAtivo) return aAtivo ? -1 : 1;
      const partida = (v: Voo) => `${dataDo(v)} ${horarioDo(v) ?? ""}`;
      return partida(a).localeCompare(partida(b));
    });

  const filtrados = relevantes.filter((v) => {
    if (EM_OPERACAO.has(normalizarStatus(v.status))) return true;
    if (periodo === "hoje") return dataDo(v) === hojeIso;
    if (periodo === "semana") return dataDo(v) <= fimSemana;
    return true;
  });
  const relatoriosPendentes = relatorios.filter(
    (relatorio) =>
      Boolean(relatorio.id || relatorio.relatorio_id) &&
      STATUS_APROVACAO_RELATORIO.has(normalizarStatus(relatorio.status)),
  );
  const totalPendencias = filtrados.length + relatoriosPendentes.length;

  const proximo: Voo | undefined = relevantes[0];
  const proximoAtivo =
    !!proximo && EM_OPERACAO.has(normalizarStatus(proximo.status));
  const contagem = proximo && !proximoAtivo ? tempoParaPartida(proximo) : null;

  const kicker = proximoAtivo
    ? "EM OPERAÇÃO"
    : contagem
      ? `PRÓXIMO VOO · EM ${contagem}`
      : "PRÓXIMO VOO";

  const corStatusSuave = "rgba(111, 207, 151, 0.14)";

  return (
    <SafeAreaView edges={["top"]} style={s.root}>
      {!!error && (
        <ErroConsulta mensagem={error} atualizar={() => void load()} />
      )}
      {loading ? (
        <ActivityIndicator color={tema.destaque} style={{ marginTop: 50 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={s.scroll}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => void load()}
              tintColor={tema.destaque}
            />
          }
          contentContainerStyle={s.content}
        >
          <View style={s.cabecalho}>
            <Image
              source={LOGO}
              resizeMode="contain"
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={s.marcaDagua}
            />

            <View style={s.topo}>
              <Toque
                accessibilityLabel="Abrir perfil"
                accessibilityRole="button"
                onPress={() => router.push("/(tabs)/perfil")}
                style={s.avatarWrap}
              >
                <Avatar nome={nome} disponivel={!!p?.foto_url} tamanho={48} />
              </Toque>

              <Toque
                accessibilityLabel="Abrir notificações"
                accessibilityRole="button"
                onPress={() => router.push("/notificacoes")}
                style={s.iconBtn}
              >
                <Icon name="bell" size={20} color={tema.texto} />
              </Toque>
            </View>

            <View style={s.saudacaoPill}>
              <Text style={s.saudacao}>
                {saudacao}, <Text style={s.saudacaoDestaque}>cmte</Text>
              </Text>
            </View>
            <Text style={s.nome} numberOfLines={1}>
              {nome}
            </Text>
          </View>

          <View style={s.chips}>
            {PERIODOS.map((op) => {
              const ativo = periodo === op.chave;
              return (
                <Toque
                  key={op.chave}
                  accessibilityRole="button"
                  accessibilityState={{ selected: ativo }}
                  onPress={() => setPeriodo(op.chave)}
                  style={[s.chip, ativo && s.chipAtivo]}
                >
                  {op.chave === "hoje" && (
                    <Icon
                      name="sun"
                      size={16}
                      color={ativo ? "#FFFFFF" : tema.suave}
                    />
                  )}
                  <Text style={[s.chipTexto, ativo && s.chipTextoAtivo]}>
                    {op.rotulo}
                  </Text>
                </Toque>
              );
            })}
          </View>

          {proximo && (
            <View style={s.hero}>
              <Toque
                accessibilityRole="button"
                accessibilityLabel={`Abrir voo ${proximo.numero_voo || ""}`}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/agenda",
                    params: { vooId: proximo.id },
                  })
                }
                style={s.heroTopo}
              >
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={s.kicker} numberOfLines={1}>
                    {kicker}
                  </Text>
                  <Text style={s.matricula} numberOfLines={1}>
                    {[proximo.matricula_registro, proximo.modelo]
                      .filter(Boolean)
                      .join(" · ") ||
                      proximo.numero_voo ||
                      "Aeronave a definir"}
                  </Text>
                </View>

                <View
                  style={[s.pillStatus, { backgroundColor: corStatusSuave }]}
                >
                  <Text style={[s.pillStatusTexto, { color: tema.verde }]}>
                    {rotuloStatus(proximo.status).toUpperCase()}
                  </Text>
                </View>
              </Toque>

              <View style={s.dataVoo}>
                <Text style={s.dataVooRotulo}>DATA DO VOO</Text>
                <Text style={s.dataVooValor}>
                  {dataEmDestaque(proximo.data_agendada)}
                </Text>
              </View>

              <View style={s.rota}>
                <View>
                  <Text style={s.aeroporto}>{proximo.origem || "—"}</Text>
                  <Text style={s.horaRota}>
                    {horarioDo(proximo) ? `${horarioDo(proximo)} LT` : "--:--"}
                  </Text>
                </View>

                <View style={s.trilha}>
                  <View style={s.pontoRota} />
                  <View style={s.linhaPontilhada} />
                  <Icon name="airplane" size={18} color={tema.destaque} />
                  <View style={s.linhaPontilhada} />
                  <View style={s.pontoRota} />
                </View>

                <View style={{ alignItems: "flex-end" }}>
                  <Text style={s.aeroporto}>{proximo.destino || "—"}</Text>
                  <Text style={s.horaRota}>Destino</Text>
                </View>
              </View>

              <View style={s.resumoVoo}>
                <View style={s.resumoItem}>
                  <Text style={s.resumoRotulo}>SOLICITAÇÃO</Text>
                  <Text style={s.resumoValor} numberOfLines={1}>
                    {identificadorSolicitacao(proximo.id)}
                  </Text>
                </View>
                <View style={s.resumoItem}>
                  <Text style={s.resumoRotulo}>PAX</Text>
                  <Text style={s.resumoValor}>
                    {proximo.numero_passageiros ?? "—"}
                  </Text>
                </View>
              </View>

              <View style={s.heroAcoes}>
                <Toque
                  accessibilityRole="button"
                  accessibilityLabel="Abrir plano de voo"
                  onPress={() => router.push("/(tabs)/plano-voo")}
                  style={s.botaoPlano}
                >
                  <Icon name="navigation" size={16} color={tema.texto} />
                  <Text style={s.botaoPlanoTexto}>Plano de voo</Text>
                </Toque>
                <Toque
                  accessibilityRole="button"
                  accessibilityLabel={`Ver detalhes do voo ${proximo.numero_voo || ""}`}
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/agenda",
                      params: { vooId: proximo.id },
                    })
                  }
                  style={s.botaoDetalhes}
                >
                  <Text style={s.botaoDetalhesTexto}>Ver detalhes</Text>
                  <Icon name="chevron-right" size={18} color="#FFFFFF" />
                </Toque>
              </View>
            </View>
          )}

          <View style={s.secaoLinha}>
            <Text style={s.secaoTitulo}>Atalhos</Text>
          </View>
          <View style={s.grade}>
            {ATALHOS.map((a) => (
              <Toque
                key={a.rotulo}
                accessibilityLabel={a.rotulo}
                accessibilityRole="button"
                onPress={() => router.push(a.path)}
                style={s.atalho}
              >
                <View style={[s.atalhoIcone, { backgroundColor: a.corSuave }]}>
                  <Icon name={a.icone} size={20} color={a.cor} />
                </View>
                <Text style={s.atalhoRotulo}>{a.rotulo}</Text>
              </Toque>
            ))}
          </View>

          <View style={s.secaoLinha}>
            <View style={s.secaoTituloLinha}>
              <Text style={s.secaoTitulo}>Pendências</Text>
              {totalPendencias > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeTexto}>{totalPendencias}</Text>
                </View>
              )}
            </View>
            <Toque
              accessibilityRole="button"
              accessibilityLabel="Ver todas as pendências"
              onPress={() => router.push("/(tabs)/agenda")}
              hitSlop={8}
            >
              <Text style={s.verTodas}>Ver todas</Text>
            </Toque>
          </View>

          <View style={s.listaPendencias}>
            {totalPendencias ? (
              <>
                {relatoriosPendentes.map((relatorio) => {
                  const id = String(relatorio.id || relatorio.relatorio_id);
                  const data =
                    relatorio.criado_em ||
                    relatorio.data_fim ||
                    relatorio.data_inicio;
                  const referencia =
                    relatorio.numero_relatorio || relatorio.numero_voo;
                  return (
                    <Toque
                      key={`relatorio-${id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir relatório de viagem ${referencia || ""}`}
                      onPress={() =>
                        router.push({
                          pathname: "/(tabs)/despesa-viagem",
                          params: { relatorioId: id },
                        })
                      }
                      style={s.item}
                    >
                      <View
                        style={[
                          s.itemIcone,
                          { backgroundColor: "rgba(167, 139, 250, 0.16)" },
                        ]}
                      >
                        <Icon name="file-text" size={22} color="#A78BFA" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemTitulo} numberOfLines={1}>
                          Relatório de viagem
                          {referencia ? ` ${referencia}` : ""}
                        </Text>
                        <Text style={s.itemApoio} numberOfLines={1}>
                          Aguardando aprovação
                        </Text>
                      </View>
                      {data?.slice(0, 10) === hojeIso ? (
                        <Text style={s.itemHoje}>Hoje</Text>
                      ) : (
                        <Icon
                          name="chevron-right"
                          size={20}
                          color={tema.suave}
                        />
                      )}
                    </Toque>
                  );
                })}
                {filtrados.map((v) => {
                  const ativo = EM_OPERACAO.has(normalizarStatus(v.status));
                  const hojeVoo = dataDo(v) === hojeIso;
                  return (
                    <Toque
                      key={v.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${v.origem || "—"} para ${v.destino || "—"}`}
                      onPress={() =>
                        router.push({
                          pathname: "/(tabs)/agenda",
                          params: { vooId: v.id },
                        })
                      }
                      style={s.item}
                    >
                      <View
                        style={[
                          s.itemIcone,
                          {
                            backgroundColor: ativo
                              ? "rgba(111, 207, 151, 0.16)"
                              : "rgba(244, 197, 66, 0.16)",
                          },
                        ]}
                      >
                        <Icon
                          name="file-text"
                          size={22}
                          color={ativo ? tema.verde : tema.destaque}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.itemTitulo} numberOfLines={1}>
                          {v.origem || "—"} → {v.destino || "—"} ·{" "}
                          {diaMes(v.data_agendada)}
                        </Text>
                        <Text style={s.itemApoio} numberOfLines={1}>
                          {v.matricula_registro ||
                            v.numero_voo ||
                            "Voo programado"}{" "}
                          · {rotuloStatus(v.status)}
                        </Text>
                      </View>
                      {hojeVoo ? (
                        <Text style={s.itemHoje}>Hoje</Text>
                      ) : (
                        <Icon
                          name="chevron-right"
                          size={20}
                          color={tema.suave}
                        />
                      )}
                    </Toque>
                  );
                })}
              </>
            ) : (
              <View style={s.vazio}>
                <Text style={s.itemTitulo}>Nenhuma pendência</Text>
                <Text style={s.itemApoio}>
                  Voos em solo, em rota e confirmados aparecerão aqui.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: tema.fundo,
  },
  scroll: {
    flex: 1,
    backgroundColor: tema.fundo,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 140,
  },
  cabecalho: {
    overflow: "hidden",
  },
  marcaDagua: {
    position: "absolute",
    top: -30,
    right: -70,
    width: 300,
    height: 260,
    opacity: 0.06,
  },
  topo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 21,
    marginBottom: 20,
  },
  avatarWrap: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: tema.borda,
    padding: 2,
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  saudacaoPill: {
    alignSelf: "flex-start",
    borderWidth: 1.5,
    borderColor: "rgba(53, 99, 233, 0.8)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  saudacao: {
    color: tema.texto,
    fontFamily: "Inter_700Bold",
    fontSize: 22,
  },
  saudacaoDestaque: {
    color: AZUL_CLARO,
  },
  nome: {
    color: tema.texto,
    fontFamily: "Inter_700Bold",
    fontSize: 36,
    letterSpacing: -0.6,
    marginTop: 10,
  },
  chips: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
    marginBottom: 20,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: tema.borda,
    backgroundColor: tema.superficie,
  },
  chipAtivo: {
    backgroundColor: tema.azul,
    borderColor: tema.azul,
  },
  chipTexto: {
    color: tema.suave,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  chipTextoAtivo: {
    color: "#FFFFFF",
  },
  hero: {
    borderRadius: 24,
    padding: 18,
    gap: 14,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  heroTopo: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  kicker: {
    color: AZUL_CLARO,
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 1.2,
  },
  matricula: {
    color: tema.texto,
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    marginTop: 2,
  },
  dataVoo: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(244, 197, 66, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(244, 197, 66, 0.24)",
    gap: 3,
  },
  dataVooRotulo: {
    color: tema.suave,
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    letterSpacing: 1,
  },
  dataVooValor: {
    color: tema.destaque,
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    letterSpacing: 0.4,
  },
  pillStatus: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillStatusTexto: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.6,
  },
  rota: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  aeroporto: {
    color: tema.texto,
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    letterSpacing: 0.4,
  },
  horaRota: {
    color: tema.texto,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    marginTop: 2,
  },
  trilha: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  linhaPontilhada: {
    flex: 1,
    height: 1,
    borderTopWidth: 1.5,
    borderStyle: "dotted",
    borderColor: "#3A4A73",
  },
  pontoRota: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: AZUL_CLARO,
  },
  resumoVoo: {
    flexDirection: "row",
    gap: 8,
  },
  resumoItem: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: tema.fundo,
    borderWidth: 1,
    borderColor: tema.borda,
    gap: 3,
  },
  resumoRotulo: {
    color: tema.suave,
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    letterSpacing: 0.5,
  },
  resumoValor: {
    color: tema.texto,
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  heroAcoes: {
    flexDirection: "row",
    gap: 10,
  },
  botaoPlano: {
    height: 46,
    maxWidth: 142,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  botaoPlanoTexto: {
    color: tema.texto,
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  botaoDetalhes: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: tema.azul,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  botaoDetalhesTexto: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },
  secaoLinha: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 28,
    marginBottom: 14,
  },
  secaoTituloLinha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  secaoTitulo: {
    color: tema.texto,
    fontFamily: "Inter_700Bold",
    fontSize: 20,
  },
  verTodas: {
    color: AZUL_CLARO,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  badge: {
    minWidth: 26,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.perigo,
  },
  badgeTexto: {
    color: tema.fundo,
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  grade: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
    fontSize: 14,
    textAlign: "center",
  },
  atalho: {
    width: "31.5%",
    minHeight: 110,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  atalhoIcone: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  atalhoRotulo: {
    color: tema.texto,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    lineHeight: 18,
    textAlign: "center",
  },
  listaPendencias: {
    gap: 10,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  itemIcone: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitulo: {
    color: tema.texto,
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  itemApoio: {
    color: tema.suave,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 3,
  },
  itemHoje: {
    color: tema.destaque,
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  vazio: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
    gap: 6,
  },
});
