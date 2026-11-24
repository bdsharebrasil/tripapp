import { Icon, Toque } from "@/src/components/ui";
import { apiFetch } from "@/src/lib/api";
import { avisar } from "@/src/lib/confirmar";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Campo, SeletorSolicitacao } from "./Campos";
import {
  CONDICOES,
  Clima,
  Cores,
  FormularioPlano,
  ICAO,
  NovoPlano,
  StatusPlano,
  VooSolicitacao,
  buscarClima,
  corMetar,
  criarFormulario,
  mensagemErro,
} from "./modelo";

export function NovoPlanoModal({
  visivel,
  onFechar,
  onSalvar,
  colors,
}: {
  visivel: boolean;
  onFechar: () => void;
  onSalvar: (plano: NovoPlano) => Promise<boolean>;
  colors: Cores;
}) {
  const [form, setForm] = useState<FormularioPlano>(criarFormulario);
  const [salvando, setSalvando] = useState(false);
  const [clima, setClima] = useState<{ partida?: Clima; chegada?: Clima }>({});
  const [carregandoClima, setCarregandoClima] = useState(false);
  const [voos, setVoos] = useState<VooSolicitacao[]>([]);
  const [carregandoVoos, setCarregandoVoos] = useState(false);
  const [erroVoos, setErroVoos] = useState("");

  const partidaIcao = form.partida.trim().toUpperCase();
  const chegadaIcao = form.chegada.trim().toUpperCase();
  const icaoValidos = ICAO.test(partidaIcao) && ICAO.test(chegadaIcao);

  const set = (campo: keyof FormularioPlano, valor: string) =>
    setForm((atual) => ({ ...atual, [campo]: valor }));

  useEffect(() => {
    if (visivel) setForm(criarFormulario());
  }, [visivel]);

  useEffect(() => {
    if (!icaoValidos) {
      setClima({});
      setCarregandoClima(false);
      return;
    }
    let ativo = true;
    setCarregandoClima(true);
    const timer = setTimeout(() => {
      Promise.allSettled([buscarClima(partidaIcao), buscarClima(chegadaIcao)])
        .then(([p, c]) => {
          if (!ativo) return;
          setClima({
            partida: p.status === "fulfilled" ? p.value : undefined,
            chegada: c.status === "fulfilled" ? c.value : undefined,
          });
        })
        .finally(() => {
          if (ativo) setCarregandoClima(false);
        });
    }, 800);
    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [partidaIcao, chegadaIcao, icaoValidos]);

  useEffect(() => {
    if (!visivel) return;
    let ativo = true;
    setCarregandoVoos(true);
    setErroVoos("");
    apiFetch<{ voos: VooSolicitacao[] }>(
      "/api/financeiro/relatorios-despesa-viagem/meus-voos",
    )
      .then((r) => {
        if (ativo)
          setVoos(
            Array.isArray(r.voos) ? r.voos.filter((voo) => voo.numero_voo) : [],
          );
      })
      .catch((e) => {
        if (ativo) setErroVoos(mensagemErro(e));
      })
      .finally(() => {
        if (ativo) setCarregandoVoos(false);
      });
    return () => {
      ativo = false;
    };
  }, [visivel]);

  const selecionarVoo = (voo: VooSolicitacao) =>
    setForm((atual) => ({
      ...atual,
      partida: voo.origem?.trim().toUpperCase() || atual.partida,
      chegada: voo.destino?.trim().toUpperCase() || atual.chegada,
      data: voo.data_agendada?.slice(0, 10) || atual.data,
      matricula: voo.matricula?.trim().toUpperCase() || atual.matricula,
    }));

  const enviar = async (status: StatusPlano) => {
    if (!icaoValidos || !form.data.trim()) {
      avisar(
        "Campos obrigatórios",
        "Preencha partida e chegada (ICAO, 4 letras) e a data.",
      );
      return;
    }
    setSalvando(true);
    const ok = await onSalvar({
      partida: partidaIcao,
      chegada: chegadaIcao,
      trecho: form.trecho.trim() || `${partidaIcao}-${chegadaIcao}`,
      data: form.data.trim(),
      aeronave: form.aeronave.trim(),
      matricula: form.matricula.trim().toUpperCase(),
      horaPrevista: form.horaPrevista.trim(),
      estimativaVoo: form.estimativaVoo.trim(),
      combustivelPrevisto: Number(form.combustivelPrevisto) || 0,
      alternates: form.alternates.trim().toUpperCase(),
      passageiros: Number.parseInt(form.passageiros, 10) || 0,
      peso: Number(form.peso) || 0,
      piloto: form.piloto.trim(),
      copiloto: form.copiloto.trim(),
      observacoes: form.observacoes.trim(),
      condicoes: form.condicoes,
      status,
    });
    setSalvando(false);
    if (ok) onFechar();
  };

  const mostrarClima = partidaIcao.length > 0 || chegadaIcao.length > 0;

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={[mStyles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            mStyles.header,
            {
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
              paddingTop: Platform.OS === "ios" ? 60 : 16,
            },
          ]}
        >
          <Toque
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            onPress={onFechar}
          >
            <Icon name="x" size={22} color={colors.foreground} />
          </Toque>
          <Text style={[mStyles.title, { color: colors.foreground }]}>
            Novo plano de voo
          </Text>
          <Toque
            disabled={salvando}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              void enviar("enviado");
            }}
          >
            {salvando ? (
              <ActivityIndicator color={colors.secondary} />
            ) : (
              <Text style={[mStyles.saveText, { color: colors.secondary }]}>
                Enviar
              </Text>
            )}
          </Toque>
        </View>

        <ScrollView
          contentContainerStyle={mStyles.form}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[mStyles.secao, { color: colors.mutedForeground }]}>
            SOLICITAÇÃO DE VOO
          </Text>
          <SeletorSolicitacao
            voos={voos}
            carregando={carregandoVoos}
            erro={erroVoos}
            onSelecionar={selecionarVoo}
            colors={colors}
          />

          <Text style={[mStyles.secao, { color: colors.mutedForeground }]}>
            ROTA
          </Text>
          <View style={mStyles.row}>
            <Campo
              rotulo="Partida *"
              colors={colors}
              value={form.partida}
              onChangeText={(v) => set("partida", v)}
              placeholder="SBGR"
              autoCapitalize="characters"
              maxLength={4}
            />
            <Campo
              rotulo="Chegada *"
              colors={colors}
              value={form.chegada}
              onChangeText={(v) => set("chegada", v)}
              placeholder="SBBR"
              autoCapitalize="characters"
              maxLength={4}
            />
          </View>

          {mostrarClima && (
            <View
              style={[mStyles.wxPreview, { backgroundColor: colors.muted }]}
            >
              <View style={mStyles.wxRow}>
                <Icon name="cloud" size={14} color={colors.secondary} />
                <Text style={[mStyles.wxTitle, { color: colors.foreground }]}>
                  Meteorologia
                </Text>
                {carregandoClima && (
                  <ActivityIndicator
                    size="small"
                    color={colors.secondary}
                    style={{ marginLeft: 4 }}
                  />
                )}
              </View>
              {clima.partida && (
                <View style={mStyles.wxItem}>
                  <View
                    style={[
                      mStyles.wxDot,
                      { backgroundColor: corMetar(clima.partida.metar) },
                    ]}
                  />
                  <Text style={[mStyles.wxIcao, { color: colors.foreground }]}>
                    {partidaIcao}
                  </Text>
                  <Text
                    style={[mStyles.wxMetar, { color: colors.mutedForeground }]}
                    numberOfLines={1}
                  >
                    {clima.partida.metar || clima.partida.error || "Sem dados"}
                  </Text>
                </View>
              )}
              {clima.chegada && (
                <View style={mStyles.wxItem}>
                  <View
                    style={[
                      mStyles.wxDot,
                      { backgroundColor: corMetar(clima.chegada.metar) },
                    ]}
                  />
                  <Text style={[mStyles.wxIcao, { color: colors.foreground }]}>
                    {chegadaIcao}
                  </Text>
                  <Text
                    style={[mStyles.wxMetar, { color: colors.mutedForeground }]}
                    numberOfLines={1}
                  >
                    {clima.chegada.metar || clima.chegada.error || "Sem dados"}
                  </Text>
                </View>
              )}
              {!carregandoClima && !clima.partida && !clima.chegada && (
                <Text
                  style={[mStyles.wxHint, { color: colors.mutedForeground }]}
                >
                  Preencha os ICAOs para ver o METAR
                </Text>
              )}
            </View>
          )}

          <Campo
            rotulo="Aeródromo alternado"
            colors={colors}
            value={form.alternates}
            onChangeText={(v) => set("alternates", v)}
            placeholder="SBSP"
            autoCapitalize="characters"
          />

          <Text style={[mStyles.secao, { color: colors.mutedForeground }]}>
            AERONAVE E DATA
          </Text>
          <View style={mStyles.row}>
            <Campo
              rotulo="Aeronave"
              colors={colors}
              value={form.aeronave}
              onChangeText={(v) => set("aeronave", v)}
            />
            <Campo
              rotulo="Matrícula"
              colors={colors}
              value={form.matricula}
              onChangeText={(v) => set("matricula", v)}
              autoCapitalize="characters"
            />
          </View>
          <View style={mStyles.row}>
            <Campo
              rotulo="Data *"
              colors={colors}
              value={form.data}
              onChangeText={(v) => set("data", v)}
              placeholder="AAAA-MM-DD"
            />
            <Campo
              rotulo="Hora prevista"
              colors={colors}
              value={form.horaPrevista}
              onChangeText={(v) => set("horaPrevista", v)}
              placeholder="10:00"
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={mStyles.row}>
            <Campo
              rotulo="Estimativa (h)"
              colors={colors}
              value={form.estimativaVoo}
              onChangeText={(v) => set("estimativaVoo", v)}
              placeholder="01:30"
              keyboardType="numbers-and-punctuation"
            />
            <Campo
              rotulo="Combustível (L)"
              colors={colors}
              value={form.combustivelPrevisto}
              onChangeText={(v) => set("combustivelPrevisto", v)}
              keyboardType="numeric"
            />
          </View>
          <View style={mStyles.row}>
            <Campo
              rotulo="Pax"
              colors={colors}
              value={form.passageiros}
              onChangeText={(v) => set("passageiros", v)}
              keyboardType="numeric"
            />
            <Campo
              rotulo="Peso (kg)"
              colors={colors}
              value={form.peso}
              onChangeText={(v) => set("peso", v)}
              keyboardType="numeric"
            />
          </View>

          <Text style={[mStyles.secao, { color: colors.mutedForeground }]}>
            TRIPULAÇÃO
          </Text>
          <Campo
            rotulo="Comandante (PIC)"
            colors={colors}
            value={form.piloto}
            onChangeText={(v) => set("piloto", v)}
          />
          <Campo
            rotulo="Co-piloto (SIC)"
            colors={colors}
            value={form.copiloto}
            onChangeText={(v) => set("copiloto", v)}
          />

          <Text style={[mStyles.secao, { color: colors.mutedForeground }]}>
            CONDIÇÕES E OBS.
          </Text>
          <View style={mStyles.chipRow}>
            {CONDICOES.map((c) => {
              const ativo = form.condicoes === c;
              return (
                <Toque
                  key={c}
                  accessibilityRole="button"
                  onPress={() => set("condicoes", c)}
                  style={[
                    mStyles.chip,
                    { backgroundColor: ativo ? colors.primary : colors.muted },
                  ]}
                >
                  <Text
                    style={[
                      mStyles.chipText,
                      { color: ativo ? "#FFFFFF" : colors.mutedForeground },
                    ]}
                  >
                    {c}
                  </Text>
                </Toque>
              );
            })}
          </View>
          <Campo
            rotulo="Observações"
            colors={colors}
            multilinha
            multiline
            numberOfLines={4}
            value={form.observacoes}
            onChangeText={(v) => set("observacoes", v)}
            placeholder="Informações adicionais..."
          />
          <Toque
            disabled={salvando}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              void enviar("rascunho");
            }}
            style={[mStyles.rascunhoBtn, { backgroundColor: colors.muted }]}
          >
            <Text style={[mStyles.rascunhoText, { color: colors.foreground }]}>
              Salvar como rascunho
            </Text>
          </Toque>
        </ScrollView>
      </View>
    </Modal>
  );
}

export const mStyles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  saveText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  form: { padding: 16, gap: 4, paddingBottom: 40 },
  secao: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 4,
  },
  row: { flexDirection: "row", gap: 10 },
  campo: { flex: 1 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 4 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 10,
  },
  textarea: {
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: "top",
  },
  chipRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  chip: { borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  rascunhoBtn: { borderRadius: 12, padding: 14, alignItems: "center" },
  rascunhoText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  wxPreview: { borderRadius: 10, padding: 12, marginBottom: 12 },
  wxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  wxTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  wxItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  wxDot: { width: 8, height: 8, borderRadius: 4 },
  wxIcao: { fontSize: 13, fontFamily: "Inter_700Bold", width: 38 },
  wxMetar: {
    flex: 1,
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  wxHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
