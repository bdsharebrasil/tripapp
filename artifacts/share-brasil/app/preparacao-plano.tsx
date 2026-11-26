import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Cabecalho, Icon, tema, Toque } from "@/src/components/ui";
import { avisar, confirmar } from "@/src/lib/confirmar";
import { apiFetch } from "@/src/lib/api";

type EstadoItem = "pendente" | "concluido" | "na";
type ChecklistResponse = {
  id?: string;
  status?: string;
  observacoes?: string | null;
  itens?: Record<string, unknown>;
} | null;
type ItemChecklist = { id: string; titulo: string; apoio: string };
type GrupoChecklist = { id: string; titulo: string; itens: ItemChecklist[] };

const GRUPOS: GrupoChecklist[] = [
  {
    id: "plano",
    titulo: "PLANO ICAO",
    itens: [
      {
        id: "fpl_campos",
        titulo: "Itens 7–19 conferidos",
        apoio:
          "Confirme identificação, regras, aeronave, equipamento, rota, EET e informações suplementares.",
      },
      {
        id: "fpl_utc",
        titulo: "Data, EOBT e horários em UTC",
        apoio:
          "Valide a data e a hora de apresentação com a regra operacional aplicável.",
      },
      {
        id: "fpl_pob",
        titulo: "Pessoas a bordo e tripulação",
        apoio:
          "Confirme nomes, licenças, passageiros e total de pessoas a bordo.",
      },
    ],
  },
  {
    id: "rota",
    titulo: "ROTA E DESEMPENHO",
    itens: [
      {
        id: "rota_publicada",
        titulo: "Rota e restrições revisadas",
        apoio: "Confira cartas, NOTAM, espaços aéreos e restrições atuais.",
      },
      {
        id: "combustivel",
        titulo: "Combustível e reservas calculados",
        apoio:
          "Valide o cálculo com dados de desempenho, vento, peso e política do operador.",
      },
      {
        id: "alternado",
        titulo: "Alternados adequados e disponíveis",
        apoio:
          "Verifique meteorologia, horário, combustível, serviços e requisitos de alternado.",
      },
      {
        id: "peso_balanceamento",
        titulo: "Peso e balanceamento verificados",
        apoio: "Use os documentos e limites aprovados da aeronave.",
      },
    ],
  },
  {
    id: "meteo",
    titulo: "METEOROLOGIA E AERÓDROMOS",
    itens: [
      {
        id: "meteo_origem",
        titulo: "METAR/TAF de origem revisados",
        apoio: "Confirme validade, tendências e mínimos aplicáveis.",
      },
      {
        id: "meteo_destino",
        titulo: "METAR/TAF de destino revisados",
        apoio: "Confirme janela de chegada e condições previstas.",
      },
      {
        id: "notam",
        titulo: "NOTAM e ficha ROTAER consultados",
        apoio: "Confira aeródromos, pistas, auxílios, horários e restrições.",
      },
      {
        id: "cartas",
        titulo: "Cartas aeronáuticas vigentes consultadas",
        apoio: "Verifique validade e procedimentos publicados para o voo.",
      },
    ],
  },
  {
    id: "aeronave",
    titulo: "AERONAVE E TRIPULAÇÃO",
    itens: [
      {
        id: "aeronave_docs",
        titulo: "Documentos e situação da aeronave verificados",
        apoio:
          "Consulte os registros oficiais e o fluxo de liberação do operador.",
      },
      {
        id: "equipamentos",
        titulo: "Equipamentos declarados confirmados",
        apoio:
          "O item 10 deve refletir a configuração real e operacional da aeronave.",
      },
      {
        id: "briefing",
        titulo: "Briefing e planejamento da tripulação concluídos",
        apoio: "Inclua rota, combustível, meteorologia, NOTAM e contingências.",
      },
    ],
  },
  {
    id: "encaminhamento",
    titulo: "ENCAMINHAMENTO MANUAL",
    itens: [
      {
        id: "mensagem",
        titulo: "Mensagem FPL revisada pelo responsável",
        apoio:
          "Use o texto compartilhado pelo app apenas como rascunho para conferência.",
      },
      {
        id: "canal",
        titulo: "Canal oficial AIS/SIGMA confirmado",
        apoio: "Envie somente pelo canal oficial e credenciado do operador.",
      },
      {
        id: "protocolo",
        titulo: "Recibo ou protocolo externo conferido",
        apoio:
          "Após o envio fora do app, registre o protocolo nas observações, quando aplicável.",
      },
    ],
  },
];

function lerEstado(valor: unknown): EstadoItem {
  const candidate =
    typeof valor === "string"
      ? valor
      : valor && typeof valor === "object"
        ? String(
            (valor as { estado?: unknown; status?: unknown }).estado ??
              (valor as { status?: unknown }).status ??
              "",
          )
        : "";
  const normalizado = candidate.toLocaleLowerCase("pt-BR");
  if (["concluido", "concluído", "feito", "ok"].includes(normalizado))
    return "concluido";
  if (["na", "n/a", "nao_aplicavel", "não se aplica"].includes(normalizado))
    return "na";
  return "pendente";
}

export default function PreparacaoPlanoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string | string[];
    numero?: string | string[];
    adep?: string | string[];
    ades?: string | string[];
  }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const numero = Array.isArray(params.numero)
    ? params.numero[0]
    : params.numero;
  const adep = Array.isArray(params.adep) ? params.adep[0] : params.adep;
  const ades = Array.isArray(params.ades) ? params.ades[0] : params.ades;
  const [itens, setItens] = useState<Record<string, EstadoItem>>({});
  const [observacoes, setObservacoes] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [dirty, setDirty] = useState(false);
  const endpoint = `/api/interno/planos-voo/${encodeURIComponent(id || "")}/checklist`;

  const carregar = useCallback(async () => {
    if (!id) {
      setErro("Não foi informado o identificador do plano salvo.");
      setCarregando(false);
      return;
    }
    setCarregando(true);
    setErro("");
    try {
      const response = await apiFetch<ChecklistResponse>(endpoint);
      const data = response?.itens || {};
      const initial: Record<string, EstadoItem> = {};
      for (const group of GRUPOS) {
        for (const item of group.itens)
          initial[item.id] = lerEstado(data[item.id]);
      }
      setItens(initial);
      setObservacoes(response?.observacoes || "");
      setDirty(false);
    } catch (cause) {
      setErro(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar o checklist.",
      );
    } finally {
      setCarregando(false);
    }
  }, [endpoint, id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const total = useMemo(
    () => GRUPOS.reduce((acc, group) => acc + group.itens.length, 0),
    [],
  );
  const resolvidos = useMemo(
    () =>
      Object.values(itens).filter(
        (state) => state === "concluido" || state === "na",
      ).length,
    [itens],
  );
  const pendentes = Math.max(total - resolvidos, 0);

  const alterarEstado = (itemId: string) => {
    setItens((old) => ({
      ...old,
      [itemId]:
        old[itemId] === "concluido"
          ? "na"
          : old[itemId] === "na"
            ? "pendente"
            : "concluido",
    }));
    setDirty(true);
  };

  const salvar = async (concluir = false) => {
    if (!id || salvando) return;
    if (concluir && pendentes > 0) {
      avisar(
        "Checklist incompleto",
        `Ainda há ${pendentes} item(ns) pendente(s). Marque como não aplicável somente quando isso for apropriado.`,
      );
      return;
    }
    setSalvando(true);
    try {
      await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({
          itens,
          observacoes,
          status: concluir ? "concluido" : "rascunho",
        }),
      });
      setDirty(false);
      avisar(
        concluir ? "Checklist concluído" : "Preparação salva",
        concluir
          ? "O checklist de apoio foi concluído. Isso não transmite, aceita ou aprova o plano no SIGMA."
          : "As alterações foram salvas no checklist deste plano.",
      );
      await carregar();
    } catch (cause) {
      avisar(
        "Falha ao salvar",
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar o checklist.",
      );
    } finally {
      setSalvando(false);
    }
  };

  const sair = () => {
    if (dirty) {
      confirmar(
        "Alterações não salvas",
        "Deseja sair sem salvar a preparação?",
        () => router.back(),
        true,
      );
      return;
    }
    router.back();
  };

  const abrirConsulta = (codigo?: string) => {
    if (!codigo) return;
    router.push({ pathname: "/consulta-aerodromo", params: { icao: codigo } });
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.root}>
      <Cabecalho
        titulo="Preparação do plano"
        apoio="CHECKLIST DE PLANEJAMENTO"
        voltar={sair}
      />
      {carregando ? (
        <ActivityIndicator color={tema.destaque} style={{ marginTop: 30 }} />
      ) : erro ? (
        <View style={styles.errorCard}>
          <Text style={styles.body}>{erro}</Text>
          <Toque onPress={() => void carregar()} style={styles.secondaryButton}>
            <Text style={styles.buttonText}>Tentar novamente</Text>
          </Toque>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={[
              styles.content,
              { paddingBottom: insets.bottom + 110 },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.summary}>
              <Text style={styles.flight}>{numero || "Plano de voo"}</Text>
              <Text style={styles.route}>
                {adep || "ADEP"} → {ades || "ADES"}
              </Text>
              <Text style={styles.progress}>
                {resolvidos}/{total} resolvidos · {pendentes} pendentes
              </Text>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${total ? (resolvidos / total) * 100 : 0}%` },
                  ]}
                />
              </View>
              <View style={styles.airportActions}>
                {!!adep && (
                  <Toque
                    onPress={() => abrirConsulta(adep)}
                    style={styles.airportButton}
                  >
                    <Icon name="map" size={14} color={tema.destaque} />
                    <Text style={styles.airportButtonText}>
                      Consultar {adep}
                    </Text>
                  </Toque>
                )}
                {!!ades && (
                  <Toque
                    onPress={() => abrirConsulta(ades)}
                    style={styles.airportButton}
                  >
                    <Icon name="map" size={14} color={tema.destaque} />
                    <Text style={styles.airportButtonText}>
                      Consultar {ades}
                    </Text>
                  </Toque>
                )}
              </View>
            </View>

            <View style={styles.warning}>
              <Icon name="alert-circle" size={17} color={tema.destaque} />
              <Text style={styles.warningText}>
                Checklist de apoio à preparação. Não substitui documentos
                oficiais, decisão do comandante nem procedimentos do operador;
                não envia ou aprova o plano no SIGMA.
              </Text>
            </View>

            {GRUPOS.map((group) => (
              <View key={group.id} style={styles.group}>
                <Text style={styles.groupTitle}>{group.titulo}</Text>
                {group.itens.map((item) => {
                  const state = itens[item.id] || "pendente";
                  const label =
                    state === "concluido"
                      ? "Concluído"
                      : state === "na"
                        ? "Não aplicável"
                        : "Pendente";
                  return (
                    <Toque
                      key={item.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: state !== "pendente" }}
                      onPress={() => alterarEstado(item.id)}
                      style={styles.item}
                    >
                      <View
                        style={[
                          styles.check,
                          state === "concluido" && styles.checkDone,
                          state === "na" && styles.checkNa,
                        ]}
                      >
                        {state === "concluido" ? (
                          <Icon name="check" size={16} color="#FFFFFF" />
                        ) : state === "na" ? (
                          <Text style={styles.naText}>—</Text>
                        ) : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{item.titulo}</Text>
                        <Text style={styles.itemHelp}>{item.apoio}</Text>
                        <Text
                          style={[
                            styles.itemState,
                            state === "concluido" && { color: tema.verde },
                          ]}
                        >
                          {label} · toque para alterar
                        </Text>
                      </View>
                    </Toque>
                  );
                })}
              </View>
            ))}

            <View style={styles.group}>
              <Text style={styles.groupTitle}>
                OBSERVAÇÕES E PROTOCOLO EXTERNO
              </Text>
              <TextInput
                accessibilityLabel="Observações da preparação"
                value={observacoes}
                onChangeText={(value) => {
                  setObservacoes(value);
                  setDirty(true);
                }}
                placeholder="Registre ressalvas, decisões do responsável ou o protocolo recebido fora do app."
                placeholderTextColor={tema.suave}
                multiline
                textAlignVertical="top"
                style={styles.notes}
              />
            </View>
          </ScrollView>
          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <Toque
              accessibilityRole="button"
              disabled={salvando || !dirty}
              onPress={() => void salvar(false)}
              style={[
                styles.saveButton,
                (!dirty || salvando) && { opacity: 0.5 },
              ]}
            >
              {salvando ? (
                <ActivityIndicator color={tema.texto} />
              ) : (
                <Icon name="save" size={17} color={tema.texto} />
              )}
              <Text style={styles.buttonText}>Salvar</Text>
            </Toque>
            <Toque
              accessibilityRole="button"
              disabled={salvando || pendentes > 0}
              onPress={() =>
                confirmar(
                  "Concluir checklist?",
                  "Isso registra a conclusão do checklist de apoio, mas não transmite nem aprova o plano no SIGMA.",
                  () => void salvar(true),
                )
              }
              style={[
                styles.completeButton,
                (salvando || pendentes > 0) && { opacity: 0.5 },
              ]}
            >
              <Icon name="check-circle" size={17} color={tema.sobreDestaque} />
              <Text style={styles.completeText}>
                {salvando ? "Salvando…" : "Concluir preparação"}
              </Text>
            </Toque>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tema.fundo },
  content: { paddingHorizontal: 18, paddingTop: 2, gap: 12 },
  summary: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  flight: { color: tema.texto, fontSize: 18, fontFamily: "Inter_700Bold" },
  route: {
    color: tema.destaque,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },
  progress: { color: tema.suave, fontSize: 12, marginTop: 10 },
  progressTrack: {
    height: 6,
    backgroundColor: tema.elevado,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 8,
  },
  progressFill: { height: 6, backgroundColor: tema.verde, borderRadius: 999 },
  airportActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  airportButton: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: tema.borda,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  airportButtonText: {
    color: tema.texto,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  warning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#F4C54212",
    borderWidth: 1,
    borderColor: "#F4C54230",
  },
  warningText: { flex: 1, color: tema.suave, fontSize: 11, lineHeight: 16 },
  group: {
    backgroundColor: tema.superficie,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  groupTitle: {
    color: tema.destaque,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.1,
    marginTop: 8,
    marginBottom: 4,
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tema.borda,
  },
  check: {
    width: 25,
    height: 25,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: tema.borda,
    marginTop: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  checkDone: { backgroundColor: "#248B70", borderColor: "#248B70" },
  checkNa: { backgroundColor: tema.elevado, borderColor: tema.suave },
  naText: { color: tema.suave, fontSize: 14, fontWeight: "800" },
  itemTitle: {
    color: tema.texto,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  itemHelp: { color: tema.suave, fontSize: 11, lineHeight: 16, marginTop: 3 },
  itemState: {
    color: tema.destaque,
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    marginTop: 5,
  },
  notes: {
    minHeight: 96,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tema.borda,
    backgroundColor: tema.fundo,
    color: tema.texto,
    fontSize: 13,
    lineHeight: 19,
    marginVertical: 8,
  },
  footer: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: tema.borda,
    backgroundColor: tema.fundo,
  },
  saveButton: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: tema.elevado,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  completeButton: {
    flex: 1.4,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: tema.destaque,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  completeText: {
    color: tema.sobreDestaque,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  buttonText: {
    color: tema.texto,
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
  },
  errorCard: {
    marginHorizontal: 18,
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: tema.superficie,
    gap: 12,
  },
  body: { color: tema.texto, fontSize: 13, lineHeight: 20 },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: tema.elevado,
    alignItems: "center",
    justifyContent: "center",
  },
});
