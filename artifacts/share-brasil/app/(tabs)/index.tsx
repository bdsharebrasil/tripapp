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
  status?: string;
};

// Cores do corpo claro da tela (o topo usa o tema escuro).
const CLARO = "#F4F7FC";
const AZUL = "#11699c";
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
// "2026-08-05" -> "05 Ago"
const diaMes = (d?: string | null) => {
  if (!d) return "—";
  const [, m, dia] = d.slice(0, 10).split("-");
  const mes = MESES[Number(m) - 1] ?? "";
  return `${dia} ${mes.charAt(0).toUpperCase()}${mes.slice(1, 3)}`;
};

export default function HomeScreen() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<PerfilCompleto | null>(null),
    [voos, setVoos] = useState<Voo[] | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    const resultados = await Promise.allSettled([
      apiFetch<PerfilCompleto>("/api/colaborador/perfil"),
      apiFetch<{ voos: Voo[] }>("/api/colaborador/meus-voos"),
    ]);
    const [p, v] = resultados;
    setPerfil(p.status === "fulfilled" ? p.value : null);
    setVoos(v.status === "fulfilled" ? v.value.voos : null);
    if (resultados.some((x) => x.status === "rejected"))
      setError("Alguns dados não puderam ser atualizados.");
    setLoading(false);
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const p = perfil?.perfil,
    nome = p?.nome_exibicao || p?.nome_completo || "Cmte";
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
        <ActivityIndicator color={tema.destaque} style={{ marginTop: 50 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: CLARO }}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => void load()}
              tintColor={tema.destaque}
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
              >
                <Avatar nome={nome} disponivel={!!p?.foto_url} tamanho={44} />
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

            <Text style={s.greeting} numberOfLines={1} adjustsFontSizeToFit>
              {saudacao},{" "}
              <Text style={s.greetingDestaque}>{nome}</Text>
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
              style={s.hero}
            >
              <LinearGradient
                colors={["#1C2856", "#182248"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.heroShade}
              >
                <View style={s.between}>
                  <Text style={s.heroKicker}>
                    {proximo
                      ? proximoAtivo
                        ? "VOO EM OPERAÇÃO"
                        : "PRÓXIMO VOO"
                      : "SUA AGENDA"}
                  </Text>
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
                        <Icon name="airplane" size={18} color={tema.destaque} />
                        <View style={s.line} />
                      </View>
                      <Text style={s.airport}>{proximo.destino || "—"}</Text>
                    </View>
                    <View style={s.between}>
                      <Text style={s.metaLabel}>
                        Saída{" "}
                        <Text style={s.metaValue}>{horario(proximo)} Z</Text>
                      </Text>
                      <Text style={s.metaLabel}>
                        Duração <Text style={s.metaValue}>A confirmar</Text>
                      </Text>
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
              {shortcuts.map((x, i) => (
                <Toque
                  key={x.nome}
                  accessibilityLabel={x.nome}
                  accessibilityHint={x.texto}
                  accessibilityRole="button"
                  onPress={() => router.push(x.path as any)}
                  style={[s.shortcut, i === 0 && s.shortcutAtivo]}
                >
                  <Icon name={x.icone} size={24} color={tema.fundo} />
                  <Text numberOfLines={1} style={s.shortcutTitle}>
                    {x.rotulo}
                  </Text>
                </Toque>
              ))}
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
              voosRelevantes.map((v) => (
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
                    <Icon name="file-text" size={24} color={AZUL} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemTitulo} numberOfLines={1}>
                      {v.origem || "—"} → {v.destino || "—"} ·{" "}
                      {diaMes(v.data_agendada)}
                    </Text>
                    <Text style={s.itemApoio} numberOfLines={1}>
                      {v.numero_voo || "Voo programado"} · {horario(v)} ·{" "}
                      {rotuloStatus(v.status)}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={22} color="#8A93A8" />
                </Toque>
              ))
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
  root: { flex: 1, backgroundColor: tema.fundo },
  content: { paddingBottom: 130 },
  header: {
    backgroundColor: tema.fundo,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 64,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: "hidden",
  },
  logoFundo: {
    position: "absolute",
    top: -30,
    right: -70,
    width: 300,
    height: 260,
    opacity: 0.1,
  },
  topo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  greeting: {
    color: tema.texto,
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    letterSpacing: -0.6,
  },
  greetingDestaque: { color: tema.destaque },
  dataHoje: {
    color: tema.suave,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    marginTop: 4,
    marginBottom: 22,
  },
  between: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  hero: {
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  heroShade: { padding: 20, gap: 18 },
  heroKicker: {
    color: tema.destaque,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    letterSpacing: 0.4,
  },
  vooIdentificacao: {
    color: tema.suave,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  heroVazio: {
    color: tema.texto,
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    lineHeight: 25,
    paddingVertical: 20,
  },
  route: { flexDirection: "row", alignItems: "center", gap: 12 },
  airport: {
    fontSize: 40,
    letterSpacing: -1,
    fontFamily: "Inter_700Bold",
    color: tema.texto,
  },
  track: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  line: {
    height: 1,
    flex: 1,
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(242,244,250,0.45)",
  },
  metaLabel: {
    color: tema.suave,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
  },
  metaValue: { color: tema.texto, fontFamily: "Inter_700Bold", fontSize: 17 },

  corpo: { paddingHorizontal: 20 },
  shortcuts: { flexDirection: "row", gap: 10, marginTop: -40 },
  shortcut: {
    flex: 1,
    minHeight: 76,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 20,
    backgroundColor: "#e9ecee",
    shadowColor: "#0B1230",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  shortcutAtivo: { backgroundColor: tema.destaque },
  shortcutTitle: {
    color: tema.fundo,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },

  secaoLinha: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 28,
    marginBottom: 14,
  },
  secaoTitulo: {
    color: tema.fundo,
    fontFamily: "Inter_700Bold",
    fontSize: 22,
  },
  badge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.destaque,
  },
  badgeTexto: {
    color: tema.fundo,
    fontFamily: "Inter_700Bold",
    fontSize: 14,
  },


  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    marginBottom: 10,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    shadowColor: "#0B1230",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  itemIcone: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8EDFB",
  },
  itemTitulo: {
    color: tema.fundo,
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
  itemApoio: {
    color: "#5E6A85",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginTop: 2,
  },
  vazio: {
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    gap: 4,
  },
});