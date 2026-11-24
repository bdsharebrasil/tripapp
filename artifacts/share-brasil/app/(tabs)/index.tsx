import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiFetch } from "@/src/lib/api";
import { PerfilCompleto, hoje, moeda, dataBr } from "@/src/lib/perfil";
import { Avatar } from "@/src/components/Avatar";
import {
  Cabecalho,
  ErroConsulta,
  Etiqueta,
  Secao,
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
  const router = useRouter(),
    insets = useSafeAreaInsets();
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
  return (
    <View style={[u.root, { paddingTop: insets.top + 4 }]}>
      {!!error && (
        <ErroConsulta mensagem={error} atualizar={() => void load()} />
      )}
      {loading ? (
        <ActivityIndicator color={tema.azul} style={{ marginTop: 50 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => void load()}
              tintColor={tema.azul}
            />
          }
          contentContainerStyle={s.content}
        >
          <ImageBackground
            source={require("../../assets/images/ceu-asa.jpg")}
            style={s.hero}
            imageStyle={{ opacity: 0.8 }}
          >
            <LinearGradient
              colors={["rgba(8,13,24,0.25)", "rgba(8,13,24,0.45)", "#080D18"]}
              style={s.heroShade}
            >
              <View style={s.between}>
                <View style={{ flex: 1 }}></View>
                <Pressable
                  accessibilityLabel="Abrir notificações"
                  onPress={() => router.push("/notificacoes")}
                  style={u.icon}
                >
                  <Feather name="bell" size={21} color={tema.texto} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Abrir perfil"
                  onPress={() => router.push("/(tabs)/perfil")}
                >
                  <Avatar nome={nome} disponivel={!!p?.foto_url} tamanho={46} />
                </Pressable>
              </View>
              <Text style={s.greeting}>Olá, {nome.split(" ")[0]}</Text>
              <Text style={s.tagline}>
                Sua operação de hoje, em um só lugar.
              </Text>
            </LinearGradient>
          </ImageBackground>
          <Secao titulo="Acesso rápido" />
          <View style={s.shortcuts}>
            {shortcuts.map((x) => (
              <Pressable
                key={x.nome}
                accessibilityLabel={x.nome}
                accessibilityHint={x.texto}
                accessibilityRole="button"
                onPress={() => router.push(x.path as any)}
                style={({ pressed }) => [
                  s.shortcut,
                  pressed && { backgroundColor: tema.elevado },
                ]}
              >
                <Feather name={x.icone} size={16} color={tema.destaque} />
                <Text numberOfLines={1} style={s.shortcutTitle}>
                  {x.rotulo}
                </Text>
              </Pressable>
            ))}
          </View>
          <Secao
            titulo="Próximo voo e voos ativos"
            acao="Minha agenda"
            onPress={() => router.push("/(tabs)/agenda")}
          />
          {voosRelevantes.length ? (
            <View style={s.upcoming}>
              {voosRelevantes.map((v) => (
                <Pressable
                  key={v.id}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/agenda",
                      params: { vooId: v.id },
                    })
                  }
                  style={s.nextFlight}
                >
                  <Feather name="send" size={19} color={tema.azul} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={s.between}>
                      <Text style={s.flightNo}>
                        {v.numero_voo || "Voo programado"}
                      </Text>
                      <Etiqueta texto={rotuloStatus(v.status)} />
                    </View>
                    <Text style={s.hello}>
                      {v.origem || "—"} → {v.destino || "—"} ·{" "}
                      {dataBr(v.data_agendada)}
                    </Text>
                    <Text style={s.hello}>
                      {v.horario_previsto_agendamento?.match(
                        /\d{2}:\d{2}/,
                      )?.[0] || "Horário a definir"}
                      {v.matricula_registro ? ` · ${v.matricula_registro}` : ""}
                    </Text>
                  </View>
                  <Feather name="chevron-right" color={tema.suave} size={18} />
                </Pressable>
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
            titulo="Suas despesas de viagem"
            acao="Abrir"
            onPress={() => router.push("/(tabs)/despesa-viagem")}
          />
          <View style={s.summary}>
            <View style={s.summaryItem}>
              <Text style={s.stat}>{rascunhos ?? "—"}</Text>
              <Text style={s.hello}>Rascunhos</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.stat}>{aprovacao ?? "—"}</Text>
              <Text style={s.hello}>Em aprovação</Text>
            </View>
            <View style={s.summaryItem}>
              <Feather name="credit-card" size={20} color={tema.verde} />
              <Text style={[s.hello, { marginTop: 6 }]}>
                {reembolso == null ? "Indisponível" : moeda(reembolso)}
              </Text>
              <Text style={s.shortcutNote}>A receber</Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  hero: { minHeight: 220, borderRadius: 24, overflow: "hidden" },
  heroShade: { padding: 20, paddingTop: 14, paddingBottom: 24, flex: 1 },
  greeting: {
    color: tema.texto,
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    marginTop: 25,
  },
  tagline: {
    color: "#d7d9de",
    fontSize: 14,
    marginTop: 7,
    maxWidth: 240,
    lineHeight: 21,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  hello: { color: tema.suave, fontSize: 11, lineHeight: 18 },
  name: {
    color: tema.texto,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    marginTop: 2,
  },
  between: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  flight: {
    padding: 20,
    borderRadius: 24,
    borderColor: tema.borda,
    borderWidth: 1,
  },
  flightNo: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: tema.texto,
  },
  route: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 25,
    marginBottom: 21,
    gap: 10,
  },
  airport: {
    fontSize: 30,
    letterSpacing: -1,
    fontFamily: "Inter_700Bold",
    color: tema.texto,
  },
  track: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  line: { height: 1, backgroundColor: tema.borda, flex: 1 },
  meta: { fontSize: 11, lineHeight: 18, color: tema.suave },
  flightFooter: {
    borderTopWidth: 1,
    borderTopColor: tema.borda,
    marginTop: 17,
    paddingTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cta: { color: tema.destaque, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  shortcuts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 2,
  },
  shortcut: {
    flexBasis: "30%",
    flexGrow: 1,
    minHeight: 76,
    paddingHorizontal: 8,
    paddingVertical: 10,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    borderRadius: 17,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  shortcutTitle: {
    color: tema.texto,
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    flexShrink: 1,
  },
  shortcutNote: {
    color: tema.suave,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 4,
  },
  upcoming: {
    borderWidth: 1,
    borderColor: tema.borda,
    backgroundColor: tema.superficie,
    borderRadius: 18,
    paddingHorizontal: 14,
  },
  nextFlight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 15,
  },
  summary: {
    backgroundColor: tema.superficie,
    borderRadius: 20,
    paddingVertical: 18,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: tema.borda,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  stat: {
    fontSize: 23,
    fontFamily: "Inter_700Bold",
    color: tema.texto,
    marginBottom: 4,
  },
});
