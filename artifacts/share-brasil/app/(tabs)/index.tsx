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
  status?: string;
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
    rotulo: "Diário de Bordo",
    icone: "book-open",
    path: "/diario-bordo",
    cor: "#3563E9",
    corSuave: "rgba(53, 99, 233, 0.18)",
  },
  {
    rotulo: "Plano de Voo",
    icone: "navigation",
    path: "/(tabs)/plano-voo",
    cor: "#2DD4BF",
    corSuave: "rgba(45, 212, 191, 0.16)",
  },
  {
    rotulo: "Relatórios",
    icone: "file-text",
    path: "/relatorio-voo",
    cor: "#A78BFA",
    corSuave: "rgba(167, 139, 250, 0.16)",
  },
  {
    rotulo: "Reembolsos",
    icone: "receipt",
    path: "/(tabs)/despesa-viagem",
    cor: "#6FCF97",
    corSuave: "rgba(111, 207, 151, 0.16)",
  },
  {
    rotulo: "Férias",
    icone: "sun",
    path: "/ferias",
    cor: "#F4C542",
    corSuave: "rgba(244, 197, 66, 0.16)",
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

const EM_OPERACAO = new Set(["EM_SOLO", "EM_ROTA", "EM_VOO"]);
const CONFIRMADOS = new Set([
  "APROVADA",
  "APROVADO",
  "CONFIRMADA",
  "CONFIRMADO",
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
  const [periodo, setPeriodo] = useState<Periodo>("escala");
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
                    {proximo.matricula_registro || "PR-SHB"}
                  </Text>
                  <Text style={s.vooNumero} numberOfLines={1}>
                    {proximo.numero_voo || "Voo programado"}
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

              <View style={s.heroAcoes}>
                <Toque
                  accessibilityRole="button"
                  accessibilityLabel="Plano de voo"
                  onPress={() => router.push("/(tabs)/plano-voo")}
                  style={s.botaoPrimario}
                >
                  <Icon name="navigation" size={18} color="#FFFFFF" />
                  <Text style={s.botaoPrimarioTexto}>Plano de voo</Text>
                </Toque>
                <Toque
                  accessibilityRole="button"
                  accessibilityLabel="Diário de bordo"
                  onPress={() => router.push("/diario-bordo")}
                  style={s.botaoDiario}
                >
                  <Icon name="book-open" size={20} color={tema.fundo} />
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
                <Text style={s.atalhoRotulo} numberOfLines={2}>
                  {a.rotulo}
                </Text>
              </Toque>
            ))}
          </View>

          <View style={s.secaoLinha}>
            <View style={s.secaoTituloLinha}>
              <Text style={s.secaoTitulo}>Pendências</Text>
              {filtrados.length > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeTexto}>{filtrados.length}</Text>
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
            {filtrados.length ? (
              filtrados.map((v) => {
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
                      <Icon name="chevron-right" size={20} color={tema.suave} />
                    )}
                  </Toque>
                );
              })
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
    gap: 18,
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
  vooNumero: {
    color: tema.texto,
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
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
  heroAcoes: {
    flexDirection: "row",
    gap: 10,
  },
  botaoPrimario: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: tema.azul,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  botaoPrimarioTexto: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 16,
  },
  botaoDiario: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
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
  },
  atalho: {
    width: "31.5%",
    minHeight: 110,
    padding: 14,
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
