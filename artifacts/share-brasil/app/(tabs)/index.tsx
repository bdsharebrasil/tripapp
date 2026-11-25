import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
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
  status?: string;
};

const CORES = {
  fundo: "#0B0F22",
  card: "#141A32",
  cardBorda: "#222A46",
  amarelo: "#F5CE3E",
  amareloTexto: "#10152B",
  amareloSuave: "rgba(245, 206, 62, 0.14)",
  amareloBorda: "rgba(245, 206, 62, 0.42)",
  verde: "#34D399",
  verdeSuave: "rgba(52, 211, 153, 0.14)",
  muted: "#8E96B0",
  textoSecundario: "#B6BED4",
};

const LOGO = require("@/assets/images/share-icon.png");

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

const diaMes = (d?: string | null) => {
  if (!d) return "—";
  const [, m, dia] = d.slice(0, 10).split("-");
  const mes = MESES[Number(m) - 1] ?? "";
  return `${dia} ${mes.charAt(0).toUpperCase()}${mes.slice(1, 3)}`;
};

export default function HomeScreen() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<PerfilCompleto | null>(null);
  const [voos, setVoos] = useState<Voo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const resultados = await Promise.allSettled([
      apiFetch<PerfilCompleto>("/api/colaborador/perfil"),
      apiFetch<{ voos: Voo[] }>("/api/colaborador/meus-voos"),
    ]);
    const [p, v] = resultados;
    setPerfil(p.status === "fulfilled" ? p.value : null);
    setVoos(v.status === "fulfilled" ? v.value.voos : null);
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
  const dataHoje = `${DIAS[agora.getDay()]}, ${agora.getDate()} de ${MESES[agora.getMonth()]}`;

  const normalizarStatus = (status?: string) =>
    String(status || "")
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");

  const emAndamento = new Set(["EM_SOLO", "EM_ROTA", "EM_VOO"]);
  const confirmados = new Set([
    "APROVADA",
    "APROVADO",
    "CONFIRMADA",
    "CONFIRMADO",
  ]);

  const voosRelevantes = (voos || [])
    .filter((v) => {
      const status = normalizarStatus(v.status);
      const futuro = String(v.data_agendada || "").slice(0, 10) >= hoje();
      return emAndamento.has(status) || (futuro && confirmados.has(status));
    })
    .sort((a, b) => {
      const aAtivo = emAndamento.has(normalizarStatus(a.status));
      const bAtivo = emAndamento.has(normalizarStatus(b.status));
      if (aAtivo !== bAtivo) return aAtivo ? -1 : 1;
      return String(a.data_agendada || "").localeCompare(
        String(b.data_agendada || ""),
      );
    });

  const rotuloStatus = (status?: string) => {
    const chave = normalizarStatus(status);
    if (chave === "EM_SOLO") return "Em solo";
    if (chave === "EM_ROTA" || chave === "EM_VOO") return "Em rota";
    if (confirmados.has(chave)) return "Confirmado";
    return status || "Programado";
  };

  const shortcuts: {
    nome: string;
    rotulo: string;
    texto: string;
    icone: Icone;
    path: string;
  }[] = [
    {
      nome: "Minha agenda",
      rotulo: "Minha agenda",
      texto: "Consultar voos e operações",
      icone: "send",
      path: "/(tabs)/agenda",
    },
    {
      nome: "Plano de voo",
      rotulo: "Plano de voo",
      texto: "Planejar uma rota",
      icone: "map",
      path: "/(tabs)/plano-voo",
    },
    {
      nome: "Despesa de viagem",
      rotulo: "Despesas",
      texto: "Registrar e acompanhar despesas",
      icone: "file-text",
      path: "/(tabs)/despesa-viagem",
    },
    {
      nome: "Manutenção",
      rotulo: "Manutenção",
      texto: "Reportar ocorrência",
      icone: "tool",
      path: "/manutencao",
    },
  ];

  const horario = (v?: Voo) =>
    v?.horario_previsto_agendamento?.match(/\d{2}:\d{2}/)?.[0] || "A definir";
  const partida = (v: Voo) =>
    `${String(v.data_agendada || "").slice(0, 10)} ${horario(v)}`;
  const proximo =
    voosRelevantes.find((v) => emAndamento.has(normalizarStatus(v.status))) ??
    [...voosRelevantes].sort((a, b) => partida(a).localeCompare(partida(b)))[0];
  const proximoAtivo =
    !!proximo && emAndamento.has(normalizarStatus(proximo.status));

  const tituloSecao = (texto: string, direita?: React.ReactNode) => (
    <View style={s.secaoLinha}>
      <Text style={s.secaoTitulo}>{texto}</Text>
      {direita}
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} style={s.root}>
      {!!error && (
        <ErroConsulta mensagem={error} atualizar={() => void load()} />
      )}
      {loading ? (
        <ActivityIndicator color={CORES.amarelo} style={{ marginTop: 50 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={s.scroll}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => void load()}
              tintColor={CORES.amarelo}
            />
          }
          contentContainerStyle={s.content}
        >
          <View style={s.header}>
            <Image
              source={LOGO}
              resizeMode="contain"
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={s.logoFundo}
            />

            <View style={s.topo}>
              <Toque
                accessibilityLabel="Abrir perfil"
                accessibilityRole="button"
                onPress={() => router.push("/(tabs)/perfil")}
                style={s.avatarWrap}
              >
                <Avatar nome={nome} disponivel={!!p?.foto_url} tamanho={44} />
              </Toque>

              <Toque
                accessibilityLabel="Abrir notificações"
                accessibilityRole="button"
                onPress={() => router.push("/notificacoes")}
                style={s.iconBtn}
              >
                <Icon name="bell" size={20} color="#FFFFFF" />
              </Toque>
            </View>

            <Text style={s.greeting} numberOfLines={1} adjustsFontSizeToFit>
              {saudacao}, <Text style={s.greetingDestaque}>{nome}</Text>
            </Text>
            <Text style={s.dataHoje}>{dataHoje}</Text>

            <Toque
              accessibilityRole="button"
              accessibilityLabel={
                proximo
                  ? `${proximoAtivo ? "Voo em operação" : "Próximo voo"} ${proximo.numero_voo || ""}`
                  : "Abrir minha agenda"
              }
              onPress={() =>
                proximo
                  ? router.push({
                      pathname: "/(tabs)/agenda",
                      params: { vooId: proximo.id },
                    })
                  : router.push("/(tabs)/agenda")
              }
              style={[s.hero, proximoAtivo && s.heroAtivo]}
            >
              <LinearGradient
                colors={["#182142", "#121831"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.heroShade}
              >
                <View style={s.between}>
                  <View
                    style={[
                      s.kickerPill,
                      {
                        backgroundColor: proximoAtivo
                          ? CORES.verdeSuave
                          : CORES.amareloSuave,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.heroKicker,
                        {
                          color: proximoAtivo ? CORES.verde : CORES.amarelo,
                        },
                      ]}
                    >
                      {proximo
                        ? proximoAtivo
                          ? "VOO EM OPERAÇÃO"
                          : "PRÓXIMO VOO"
                        : "SUA AGENDA"}
                    </Text>
                  </View>

                  {proximo && (
                    <Text style={s.vooIdentificacao}>
                      {proximo.numero_voo || "—"} ·{" "}
                      {proximo.matricula_registro || "PR-SHB"}
                    </Text>
                  )}
                </View>

                {proximo ? (
                  <>
                    <View style={s.route}>
                      <Text style={s.airport}>{proximo.origem || "—"}</Text>
                      <View style={s.track}>
                        <View style={s.line} />
                        <Icon
                          name="airplane"
                          size={18}
                          color={CORES.amarelo}
                        />
                        <View style={s.line} />
                      </View>
                      <Text style={s.airport}>{proximo.destino || "—"}</Text>
                    </View>

                    <View style={[s.between, s.heroFooter]}>
                      <View>
                        <Text style={s.metaLabel}>Data</Text>
                        <Text style={s.metaValue}>
                          {diaMes(proximo.data_agendada)}
                        </Text>
                      </View>

                      <View style={{ alignItems: "center" }}>
                        <Text style={s.metaLabel}>Saída</Text>
                        <Text style={s.metaValue}>{horario(proximo)} Z</Text>
                      </View>

                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={s.metaLabel}>Status</Text>
                        <Text
                          style={[
                            s.metaValue,
                            {
                              color: proximoAtivo
                                ? CORES.verde
                                : CORES.amarelo,
                            },
                          ]}
                        >
                          {rotuloStatus(proximo.status)}
                        </Text>
                      </View>
                    </View>
                  </>
                ) : (
                  <Text style={s.heroVazio}>
                    {voos
                      ? "Nenhum voo ativo ou confirmado no momento."
                      : "Agenda indisponível. Puxe para atualizar."}
                  </Text>
                )}
              </LinearGradient>
            </Toque>
          </View>

          <View style={s.corpo}>
            <View style={s.shortcuts}>
              {shortcuts.map((x, i) => {
                const ativo = i === 0;
                return (
                  <Toque
                    key={x.nome}
                    accessibilityLabel={x.nome}
                    accessibilityHint={x.texto}
                    accessibilityRole="button"
                    onPress={() => router.push(x.path as any)}
                    style={[s.shortcut, ativo && s.shortcutAtivo]}
                  >
                    <View
                      style={[
                        s.shortcutIconWrap,
                        ativo && s.shortcutIconWrapAtivo,
                      ]}
                    >
                      <Icon
                        name={x.icone}
                        size={20}
                        color={ativo ? CORES.amareloTexto : CORES.amarelo}
                      />
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[
                        s.shortcutTitle,
                        ativo && s.shortcutTitleAtivo,
                      ]}
                    >
                      {x.rotulo}
                    </Text>
                  </Toque>
                );
              })}
            </View>

            {tituloSecao(
              "Relatórios a apresentar",
              voosRelevantes.length ? (
                <View style={s.badge}>
                  <Text style={s.badgeTexto}>{voosRelevantes.length}</Text>
                </View>
              ) : null,
            )}

            {voosRelevantes.length ? (
              voosRelevantes.map((v) => {
                const ativo = emAndamento.has(normalizarStatus(v.status));
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
                    <View style={s.itemIcone}>
                      <Icon
                        name="file-text"
                        size={22}
                        color={ativo ? CORES.verde : CORES.amarelo}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemTitulo} numberOfLines={1}>
                        {v.origem || "—"} → {v.destino || "—"} ·{" "}
                        {diaMes(v.data_agendada)}
                      </Text>
                      <Text style={s.itemApoio} numberOfLines={1}>
                        {v.numero_voo || "Voo programado"} · {horario(v)} ·{" "}
                        <Text
                          style={{
                            color: ativo ? CORES.verde : CORES.textoSecundario,
                            fontFamily: "Inter_600SemiBold",
                          }}
                        >
                          {rotuloStatus(v.status)}
                        </Text>
                      </Text>
                    </View>
                    <Icon
                      name="chevron-right"
                      size={20}
                      color={CORES.muted}
                    />
                  </Toque>
                );
              })
            ) : (
              <View style={s.vazio}>
                <Text style={s.itemTitulo}>
                  {voos
                    ? "Nenhum voo ativo ou confirmado"
                    : "Agenda indisponível"}
                </Text>
                <Text style={s.itemApoio}>
                  {voos
                    ? "Voos em solo, em rota e próximos voos confirmados aparecerão aqui."
                    : "Atualize para consultar sua programação."}
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
    backgroundColor: CORES.fundo,
  },
  scroll: {
    flex: 1,
    backgroundColor: CORES.fundo,
  },
  content: {
    paddingBottom: 140,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    overflow: "hidden",
  },
  logoFundo: {
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
    marginBottom: 20,
  },
  avatarWrap: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: CORES.cardBorda,
    padding: 2,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CORES.card,
    borderWidth: 1,
    borderColor: CORES.cardBorda,
  },
  greeting: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    letterSpacing: -0.5,
  },
  greetingDestaque: {
    color: CORES.amarelo,
  },
  dataHoje: {
    color: CORES.muted,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    marginTop: 4,
    marginBottom: 20,
  },
  between: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  hero: {
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: CORES.cardBorda,
  },
  heroAtivo: {
    borderColor: CORES.amareloBorda,
  },
  heroShade: {
    padding: 18,
    gap: 16,
  },
  kickerPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  heroKicker: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.6,
  },
  vooIdentificacao: {
    color: CORES.muted,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  heroVazio: {
    color: CORES.textoSecundario,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: 14,
  },
  route: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 2,
  },
  airport: {
    fontSize: 32,
    letterSpacing: 0.4,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  track: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  line: {
    height: 1,
    flex: 1,
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderColor: "#333D5E",
  },
  heroFooter: {
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CORES.cardBorda,
  },
  metaLabel: {
    color: CORES.muted,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
  metaValue: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    marginTop: 2,
  },
  corpo: {
    paddingHorizontal: 18,
  },
  shortcuts: {
    flexDirection: "row",
    gap: 10,
  },
  shortcut: {
    flex: 1,
    minHeight: 84,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 20,
    backgroundColor: CORES.card,
    borderWidth: 1,
    borderColor: CORES.cardBorda,
  },
  shortcutAtivo: {
    backgroundColor: CORES.amarelo,
    borderColor: CORES.amarelo,
  },
  shortcutIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: CORES.amareloSuave,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutIconWrapAtivo: {
    backgroundColor: "rgba(16, 21, 43, 0.12)",
  },
  shortcutTitle: {
    color: "#FFFFFF",
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
  shortcutTitleAtivo: {
    color: CORES.amareloTexto,
    fontFamily: "Inter_700Bold",
  },
  secaoLinha: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 26,
    marginBottom: 14,
  },
  secaoTitulo: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 19,
  },
  badge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CORES.amarelo,
  },
  badgeTexto: {
    color: CORES.amareloTexto,
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 15,
    marginBottom: 10,
    borderRadius: 20,
    backgroundColor: CORES.card,
    borderWidth: 1,
    borderColor: CORES.cardBorda,
  },
  itemIcone: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CORES.amareloSuave,
  },
  itemTitulo: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  itemApoio: {
    color: CORES.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 3,
  },
  vazio: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: CORES.card,
    borderWidth: 1,
    borderColor: CORES.cardBorda,
    gap: 6,
  },
});
