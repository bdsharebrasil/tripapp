import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
  const ordenados = (voos || [])
    .filter(
      (v) =>
        String(v.data_agendada || "").slice(0, 10) >= hoje() &&
        !["CANCELADA", "CANCELADO"].includes(v.status?.toUpperCase() || ""),
    )
    .sort((a, b) =>
      String(a.data_agendada).localeCompare(String(b.data_agendada)),
    );
  const atual = ordenados[0];
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
    texto: string;
    icone: Icone;
    path: string;
  }[] = [
    {
      nome: "Agenda de voos",
      texto: "Horários e checklist",
      icone: "send",
      path: "/(tabs)/agenda",
    },
    {
      nome: "Documentos",
      texto: "Licenças e arquivos",
      icone: "shield",
      path: "/(tabs)/perfil",
    },
    {
      nome: "Diário de bordo",
      texto: "Completar e assinar",
      icone: "book-open",
      path: "/diario-bordo",
    },
    {
      nome: "Despesas",
      texto: "Lançar e acompanhar",
      icone: "file-text",
      path: "/(tabs)/financeiro",
    },
    {
      nome: "Minhas horas",
      texto: "Consultar e exportar PDF",
      icone: "bar-chart-2",
      path: "/minhas-horas",
    },
    {
      nome: "Manutenção",
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
              colors={["rgba(12,14,18,0.25)", "rgba(12,14,18,0.35)", "#0c0e12"]}
              style={s.heroShade}
            >
              <View style={s.between}>
                <View style={{ flex: 1 }}>
                  <Image
                    source={require("../../assets/images/logoshare.branco.png")}
                    resizeMode="contain"
                    style={{ width: 110, height: 36 }}
                  />
                  <Text style={s.brand}>TRIP SHARE</Text>
                  <Text style={s.hello}>ÁREA DA TRIPULAÇÃO</Text>
                </View>
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
          <Secao
            titulo={
              atual?.data_agendada?.slice(0, 10) === hoje()
                ? "Seu voo de hoje"
                : "Próximo voo"
            }
            acao="Minha agenda"
            onPress={() => router.push("/(tabs)/agenda")}
          />
          {atual ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/agenda",
                  params: { vooId: atual.id },
                })
              }
            >
              <LinearGradient
                colors={["#292e37", "#202630", "#191d24"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.flight}
              >
                <View style={s.between}>
                  <Text style={s.flightNo}>
                    {atual.numero_voo || "Voo programado"}
                  </Text>
                  <Etiqueta texto={atual.status || "Programado"} />
                </View>
                <View style={s.route}>
                  <View>
                    <Text style={s.airport}>{atual.origem || "—"}</Text>
                    <Text style={s.hello}>Origem</Text>
                  </View>
                  <View style={s.track}>
                    <View style={s.line} />
                    <Feather name="send" size={22} color={tema.azul} />
                    <View style={s.line} />
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={s.airport}>{atual.destino || "—"}</Text>
                    <Text style={s.hello}>Destino</Text>
                  </View>
                </View>
                <Text style={s.meta}>
                  {dataBr(atual.data_agendada)} ·{" "}
                  {atual.horario_previsto_agendamento?.match(
                    /\d{2}:\d{2}/,
                  )?.[0] || "Horário a definir"}{" "}
                  · {atual.matricula_registro || "Aeronave a definir"}
                </Text>
                <View style={s.flightFooter}>
                  <Text style={s.cta}>Horários, checklist e briefing</Text>
                  <Feather name="arrow-up-right" color={tema.azul} size={20} />
                </View>
              </LinearGradient>
            </Pressable>
          ) : (
            <Vazio
              icone="calendar"
              titulo={voos ? "Nenhum voo próximo" : "Agenda indisponível"}
              texto={
                voos
                  ? "Consulte seus voos anteriores na agenda."
                  : "Atualize para consultar sua programação."
              }
            />
          )}
          <Secao titulo="O que você precisa fazer" />
          <View style={s.grid}>
            {shortcuts.map((x) => (
              <Pressable
                key={x.nome}
                accessibilityLabel={x.nome}
                accessibilityRole="button"
                onPress={() => router.push(x.path as any)}
                style={({ pressed }) => [
                  s.shortcut,
                  pressed && { backgroundColor: tema.elevado },
                ]}
              >
                <View style={s.shortcutIcon}>
                  <Feather name={x.icone} size={21} color={tema.azul} />
                </View>
                <Text style={s.shortcutTitle}>{x.nome}</Text>
              </Pressable>
            ))}
          </View>
          {ordenados.length > 1 && (
            <>
              <Secao
                titulo="Próximas escalas"
                acao="Ver todas"
                onPress={() => router.push("/(tabs)/agenda")}
              />
              <View style={s.upcoming}>
                {ordenados.slice(1, 4).map((v) => (
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
                    <Feather name="calendar" size={20} color={tema.azul} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.flightNo}>
                        {v.numero_voo || "Voo programado"}
                      </Text>
                      <Text style={s.hello}>
                        {v.origem || "—"} → {v.destino || "—"}
                      </Text>
                    </View>
                    <Text style={s.hello}>{dataBr(v.data_agendada)}</Text>
                    <Feather
                      name="chevron-right"
                      color={tema.suave}
                      size={18}
                    />
                  </Pressable>
                ))}
              </View>
            </>
          )}
          <Secao
            titulo="Suas despesas de viagem"
            acao="Abrir"
            onPress={() => router.push("/(tabs)/financeiro")}
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
          <Pressable
            onPress={() => router.push("/(tabs)/perfil")}
            style={s.account}
          >
            <Image
              source={require("../../assets/images/logoshare.branco.png")}
              style={{ width: 80, height: 30 }}
              resizeMode="contain"
            />
            <Text style={s.hello}>Minha conta e documentos</Text>
            <Feather name="arrow-right" size={17} color={tema.suave} />
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  hero: { marginHorizontal: -20, minHeight: 250 },
  heroShade: { padding: 22, paddingTop: 12, paddingBottom: 28, flex: 1 },
  brand: {
    color: tema.texto,
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    letterSpacing: 1.5,
    marginTop: 4,
  },
  greeting: {
    color: tema.texto,
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    marginTop: 38,
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
    borderColor: "#4b5663",
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
  line: { height: 1, backgroundColor: "#53606d", flex: 1 },
  meta: { fontSize: 11, lineHeight: 18, color: "#bfd1e3" },
  flightFooter: {
    borderTopWidth: 1,
    borderTopColor: "#3b4550",
    marginTop: 17,
    paddingTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cta: { color: tema.azul, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  shortcut: {
    width: "30%",
    flexGrow: 1,
    padding: 12,
    alignItems: "center",
    minHeight: 112,
    borderRadius: 20,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  shortcutIcon: {
    alignSelf: "center",
    padding: 10,
    backgroundColor: tema.elevado,
    borderRadius: 13,
    marginBottom: 8,
  },
  shortcutTitle: {
    color: tema.texto,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    textAlign: "center",
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
  account: {
    marginTop: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 16,
  },
});
