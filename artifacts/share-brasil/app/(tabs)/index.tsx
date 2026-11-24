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
import { PerfilCompleto, hoje, moeda, dataBr } from "@/src/lib/perfil";
import { Avatar } from "@/src/components/Avatar";
import {
  BotaoIcone,
  ErroConsulta,
  Etiqueta,
  Icon,
  ItemLista,
  Secao,
  Toque,
  Vazio,
  tema,
  u,
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
type Relatorio = {
  id: string;
  status: string;
  pagamento_status?: string;
  pagamento_total?: number;
  pagamento_valor?: number;
};
export default function HomeScreen() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<PerfilCompleto | null>(null),
    [voos, setVoos] = useState<Voo[] | null>(null),
    [relatorios, setRelatorios] = useState<Relatorio[] | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    const resultados = await Promise.allSettled([
      apiFetch<PerfilCompleto>("/api/colaborador/perfil"),
      apiFetch<{ voos: Voo[] }>("/api/colaborador/meus-voos"),
      apiFetch<{ relatorios: Relatorio[] }>(
        "/api/financeiro/relatorios-despesa-viagem/minhas",
      ),
    ]);
    const [p, v, r] = resultados;
    setPerfil(p.status === "fulfilled" ? p.value : null);
    setVoos(v.status === "fulfilled" ? v.value.voos : null);
    setRelatorios(r.status === "fulfilled" ? r.value.relatorios : null);
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
    nome = p?.nome_exibicao || p?.nome_completo || "Tripulante";
  const normalizarStatus = (status?: string) =>
    String(status || "")
      .trim()
      .toUpperCase()
      .replace(/[\\s-]+/g, "_");
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
  const rascunhos = relatorios?.filter(
    (r) => r.status.toLowerCase() === "rascunho",
  ).length;
  const aprovacao = relatorios?.filter((r) =>
    ["finalizado", "aguardando_aprovacao", "ajuste_concluido"].includes(
      r.status.toLowerCase(),
    ),
  ).length;
  const reembolso = relatorios?.reduce(
    (n, r) =>
      n +
      (r.pagamento_status === "PENDENTE"
        ? Math.max(
            0,
            Number(r.pagamento_total || 0) - Number(r.pagamento_valor || 0),
          )
        : 0),
    0,
  );
  const shortcuts: {
    nome: string;
    rotulo: string;
    texto: string;
    icone: Icone;
    path: string;
  }[] = [
    {
      nome: "Agenda de voos",
      rotulo: "Voos",
      texto: "Horários e checklist",
      icone: "send",
      path: "/(tabs)/agenda",
    },
    {
      nome: "Plano de voo",
      rotulo: "Plano de voo",
      texto: "Planejamento e dados do voo",
      icone: "map",
      path: "/(tabs)/plano-voo",
    },
    {
      nome: "Diário de bordo",
      rotulo: "Diário",
      texto: "Completar e assinar",
      icone: "book-open",
      path: "/diario-bordo",
    },
    {
      nome: "Despesas",
      rotulo: "Despesas",
      texto: "Lançar e acompanhar",
      icone: "file-text",
      path: "/(tabs)/despesa-viagem",
    },
    {
      nome: "Minhas horas",
      rotulo: "Horas",
      texto: "Consultar e exportar PDF",
      icone: "bar-chart-2",
      path: "/minhas-horas",
    },
    {
      nome: "Manutenção",
      rotulo: "Manut.",
      texto: "Reportar ocorrência",
      icone: "tool",
      path: "/manutencao",
    },
  ];
  const proximo = voosRelevantes[0];
  const horario = (v?: Voo) =>
    v?.horario_previsto_agendamento?.match(/\d{2}:\d{2}/)?.[0] || "A definir";
  const cores = [tema.destaque, tema.verde, "#7AA2FF"];
  return (
    <SafeAreaView edges={["top"]} style={u.root}>
      {!!error && (
        <ErroConsulta mensagem={error} atualizar={() => void load()} />
      )}
      {loading ? (
        <ActivityIndicator color={tema.destaque} style={{ marginTop: 50 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => void load()}
              tintColor={tema.destaque}
            />
          }
          contentContainerStyle={s.content}
        >
          <View style={s.topo}>
            <Toque
              accessibilityLabel="Abrir perfil"
              accessibilityRole="button"
              onPress={() => router.push("/(tabs)/perfil")}
            >
              <Avatar nome={nome} disponivel={!!p?.foto_url} tamanho={48} />
            </Toque>
            <View style={{ flex: 1 }}>
              <Text style={s.hello}>Bem-vindo de volta</Text>
              <Text style={s.greeting} numberOfLines={1}>
                Olá, {nome.split(" ")[0]}
              </Text>
            </View>
            <BotaoIcone
              icone="bell"
              rotulo="Abrir notificações"
              onPress={() => router.push("/notificacoes")}
            />
          </View>

          <Toque
            accessibilityRole="button"
            accessibilityLabel={
              proximo
                ? `Próximo voo ${proximo.numero_voo || ""}`
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
            <Image
              source={require("../../assets/images/ceu-asa.jpg")}
              style={s.heroImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={[
                "rgba(10,16,32,0.15)",
                "rgba(10,16,32,0.55)",
                "rgba(10,16,32,0.95)",
              ]}
              locations={[0, 0.45, 1]}
              style={s.heroShade}
            >
              <View style={s.between}>
                <Text style={s.heroKicker}>
                  {proximo ? "Próximo voo" : "Sua agenda"}
                </Text>
                {proximo && <Etiqueta texto={rotuloStatus(proximo.status)} />}
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
                  <View style={s.heroMeta}>
                    <View>
                      <Text style={s.metaLabel}>Data</Text>
                      <Text style={s.metaValue}>
                        {dataBr(proximo.data_agendada)}
                      </Text>
                    </View>
                    <View>
                      <Text style={s.metaLabel}>Horário</Text>
                      <Text style={s.metaValue}>{horario(proximo)}</Text>
                    </View>
                    <View>
                      <Text style={s.metaLabel}>Voo</Text>
                      <Text style={s.metaValue}>
                        {proximo.numero_voo || "—"}
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

          <Secao titulo="Acesso rápido" />
          <View style={s.shortcuts}>
            {shortcuts.map((x, i) => (
              <Toque
                key={x.nome}
                accessibilityLabel={x.nome}
                accessibilityHint={x.texto}
                accessibilityRole="button"
                onPress={() => router.push(x.path as any)}
                style={s.shortcut}
              >
                <View
                  style={[
                    s.shortcutIcon,
                    { backgroundColor: cores[i % cores.length] + "1F" },
                  ]}
                >
                  <Icon
                    name={x.icone}
                    size={20}
                    color={cores[i % cores.length]}
                  />
                </View>
                <Text numberOfLines={1} style={s.shortcutTitle}>
                  {x.rotulo}
                </Text>
              </Toque>
            ))}
          </View>

          <Secao
            titulo="Voos ativos e confirmados"
            acao="Agenda"
            onPress={() => router.push("/(tabs)/agenda")}
          />
          {voosRelevantes.length ? (
            <View style={s.lista}>
              {voosRelevantes.map((v, i) => (
                <ItemLista
                  key={v.id}
                  icone="send"
                  cor="#7AA2FF"
                  titulo={`${v.origem || "—"} → ${v.destino || "—"}`}
                  apoio={`${v.numero_voo || "Voo programado"} · ${dataBr(v.data_agendada)} · ${horario(v)}${v.matricula_registro ? ` · ${v.matricula_registro}` : ""}`}
                  direita={<Etiqueta texto={rotuloStatus(v.status)} />}
                  ultimo={i === voosRelevantes.length - 1}
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/agenda",
                      params: { vooId: v.id },
                    })
                  }
                />
              ))}
            </View>
          ) : (
            <Vazio
              icone="calendar"
              titulo={
                voos ? "Nenhum voo ativo ou confirmado" : "Agenda indisponível"
              }
              texto={
                voos
                  ? "Voos em solo, em rota e próximos voos confirmados aparecerão aqui."
                  : "Atualize para consultar sua programação."
              }
            />
          )}

          <Secao
            titulo="Despesas de viagem"
            acao="Abrir"
            onPress={() => router.push("/(tabs)/despesa-viagem")}
          />
          <View style={s.summary}>
            <View style={s.summaryItem}>
              <Icon name="edit-3" size={18} color={tema.suave} />
              <Text style={s.stat}>{rascunhos ?? "—"}</Text>
              <Text style={s.statLabel}>Rascunhos</Text>
            </View>
            <View style={s.summaryItem}>
              <Icon name="clock" size={18} color={tema.destaque} />
              <Text style={s.stat}>{aprovacao ?? "—"}</Text>
              <Text style={s.statLabel}>Em aprovação</Text>
            </View>
            <View style={s.summaryItem}>
              <Icon name="credit-card" size={18} color={tema.verde} />
              <Text
                style={[s.stat, s.statMoeda]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {reembolso == null ? "—" : moeda(reembolso)}
              </Text>
              <Text style={s.statLabel}>A receber</Text>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 130 },
  topo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },
  hello: { color: tema.suave, fontSize: 14, fontFamily: "Inter_400Regular" },
  greeting: {
    color: tema.texto,
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    letterSpacing: -0.6,
    marginTop: 2,
  },
  between: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  hero: {
    minHeight: 210,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: tema.superficie,
  },
  heroImage: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  heroShade: { flex: 1, padding: 20, justifyContent: "space-between" },
  heroKicker: {
    color: tema.texto,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    opacity: 0.9,
  },
  heroVazio: {
    color: tema.texto,
    fontFamily: "Inter_600SemiBold",
    fontSize: 18,
    lineHeight: 25,
    marginTop: 60,
  },
  route: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 34,
    gap: 12,
  },
  airport: {
    fontSize: 30,
    letterSpacing: -0.8,
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
  heroMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  metaLabel: { color: tema.suave, fontSize: 12 },
  metaValue: {
    color: tema.texto,
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    marginTop: 3,
  },
  shortcuts: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  shortcut: {
    flexBasis: "30%",
    flexGrow: 1,
    minHeight: 96,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 20,
    backgroundColor: tema.superficie,
  },
  shortcutIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutTitle: {
    color: tema.texto,
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  lista: {
    backgroundColor: tema.superficie,
    borderRadius: 22,
    paddingHorizontal: 16,
  },
  summary: { flexDirection: "row", gap: 10 },
  summaryItem: {
    flex: 1,
    backgroundColor: tema.superficie,
    borderRadius: 20,
    padding: 14,
    gap: 6,
  },
  stat: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: tema.texto,
    marginTop: 6,
  },
  statMoeda: { fontSize: 16, marginTop: 10, marginBottom: 4 },
  statLabel: { color: tema.suave, fontSize: 12 },
});
