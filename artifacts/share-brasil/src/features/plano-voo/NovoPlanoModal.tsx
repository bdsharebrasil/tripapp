import { Icon, Toque } from "@/src/components/ui";
import { apiFetch } from "@/src/lib/api";
import { avisar } from "@/src/lib/confirmar";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { MapaVoo } from "@/src/components/MapaVoo";
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
import type { PerfilCompleto } from "@/src/lib/perfil";
import {
  CONDICOES,
  Clima,
  Cores,
  FormularioIcao,
  FormularioPlano,
  ICAO,
  NovoPlano,
  PessoaTripulacao,
  StatusPlano,
  VooSolicitacao,
  buscarClima,
  buscarRota,
  corMetar,
  AeronaveSolicitacao,
  criarFormulario,
  criarFormularioIcao,
  formatarHoraUtc,
  formatarTempoVoo,
  mensagemErro,
  modeloParaFormulario,
  preencherDadosAeronaveIcao,
  normalizarAeronaveSolicitacao,
  esteiraDaAeronave,
  velocidadeCruzeiroDaAeronave,
  velocidadeIcao,
  validarFpl,
} from "./modelo";

export function NovoPlanoModal({
  visivel,
  onFechar,
  onSalvar,
  colors,
  inline = false,
  aba = "formulario",
  onAbaChange,
}: {
  visivel: boolean;
  onFechar: () => void;
  onSalvar: (plano: NovoPlano) => Promise<boolean>;
  colors: Cores;
  inline?: boolean;
  aba?: "formulario" | "rota" | "resumo";
  onAbaChange?: (aba: "formulario" | "rota" | "resumo") => void;
}) {
  const [form, setForm] = useState<FormularioPlano>(criarFormulario);
  const [fpl, setFpl] = useState<FormularioIcao>(criarFormularioIcao);
  const [numeroVoo, setNumeroVoo] = useState("");
  const [solicitacaoId, setSolicitacaoId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [clima, setClima] = useState<{ partida?: Clima; chegada?: Clima }>({});
  const [carregandoClima, setCarregandoClima] = useState(false);
  const [voos, setVoos] = useState<VooSolicitacao[]>([]);
  const [carregandoVoos, setCarregandoVoos] = useState(false);
  const [erroVoos, setErroVoos] = useState("");
  const [aeronaves, setAeronaves] = useState<AeronaveSolicitacao[]>([]);
  const [aeronaveSelecionada, setAeronaveSelecionada] =
    useState<AeronaveSolicitacao | null>(null);
  const [carregandoAeronaves, setCarregandoAeronaves] = useState(false);
  const [aeronaveAberta, setAeronaveAberta] = useState(false);
  const [calculandoRota, setCalculandoRota] = useState(false);
  const [rotaCalculada, setRotaCalculada] = useState<Awaited<
    ReturnType<typeof buscarRota>
  > | null>(null);
  const [erroRota, setErroRota] = useState("");
  const [versaoRota, setVersaoRota] = useState(0);

  const partidaIcao = form.partida.trim().toUpperCase();
  const chegadaIcao = form.chegada.trim().toUpperCase();
  const icaoValidos = ICAO.test(partidaIcao) && ICAO.test(chegadaIcao);

  const set = (campo: keyof FormularioPlano, valor: string) =>
    setForm((atual) => ({ ...atual, [campo]: valor }));
  const setCampoFpl = (campo: keyof FormularioIcao, valor: string) =>
    setFpl((atual) => ({ ...atual, [campo]: valor }));

  useEffect(() => {
    if (visivel && !inline) {
      setForm(criarFormulario());
      setFpl(criarFormularioIcao());
      setNumeroVoo("");
      setSolicitacaoId("");
      setAeronaveSelecionada(null);
    }
  }, [visivel, inline]);

  useEffect(() => {
    if (!icaoValidos) {
      setClima({});
      setCarregandoClima(false);
      return;
    }
    let ativo = true;
    const atualizarClima = () => {
      setCarregandoClima(true);
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
    };
    const timer = setTimeout(atualizarClima, 800);
    const intervalo = setInterval(atualizarClima, 5 * 60 * 1000);
    return () => {
      ativo = false;
      clearTimeout(timer);
      clearInterval(intervalo);
    };
  }, [partidaIcao, chegadaIcao, icaoValidos]);

  useEffect(() => {
    if (!visivel || !icaoValidos) {
      setRotaCalculada(null);
      setErroRota("");
      setCalculandoRota(false);
      return;
    }
    let ativo = true;
    setRotaCalculada(null);
    setErroRota("");
    const timer = setTimeout(() => {
      setCalculandoRota(true);
      buscarRota(
        partidaIcao,
        chegadaIcao,
        form.aeronaveId,
        (aeronaveSelecionada
          ? velocidadeCruzeiroDaAeronave(aeronaveSelecionada)
          : undefined) ??
          (Number(fpl.velocidade.replace(/^[NKM]/i, "")) || undefined),
      )
        .then((rota) => {
          if (!ativo) return;
          if (rota.error) {
            setErroRota(rota.error);
            return;
          }
          setRotaCalculada(rota);
          const rotaTexto =
            rota.flightplan?.route || `${partidaIcao}-${chegadaIcao}`;
          setForm((atual) => ({
            ...atual,
            trecho: rotaTexto,
            estimativaVoo:
              rota.flightplan?.estimated_time || atual.estimativaVoo,
            combustivelPrevisto:
              rota.fuel?.total_required != null
                ? String(Math.round(rota.fuel.total_required))
                : atual.combustivelPrevisto,
          }));
          setFpl((atual) => {
            return {
              ...atual,
              adep: partidaIcao,
              ades: chegadaIcao,
              rota: rotaTexto,
              tipoAeronave:
                atual.tipoAeronave ||
                rota.performance?.tipo_aeronave ||
                rota.performance?.modelo ||
                "",
              velocidade:
                atual.velocidade ||
                velocidadeIcao(
                  rota.performance?.velocidade_cruzeiro_kt ?? null,
                ),
            };
          });
        })
        .catch((cause: unknown) => {
          if (ativo) setErroRota(mensagemErro(cause));
        })
        .finally(() => {
          if (ativo) setCalculandoRota(false);
        });
    }, 350);
    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [
    visivel,
    partidaIcao,
    chegadaIcao,
    icaoValidos,
    form.aeronaveId,
    form.matricula,
    aeronaveSelecionada,
    versaoRota,
  ]);

  useEffect(() => {
    if (!visivel) return;
    let ativo = true;
    setVoos([]);
    setAeronaves([]);
    setCarregandoAeronaves(true);
    setCarregandoVoos(true);
    setErroVoos("");
    Promise.all([
      apiFetch<{
        agendamentos: VooSolicitacao[];
        tripulacao?: PessoaTripulacao[];
        aeronaves?: Record<string, any>[];
      }>("/api/interno/agendamento?inicio=2000-01-01&fim=2099-12-31"),
      apiFetch<PerfilCompleto>("/api/colaborador/perfil"),
    ])
      .then(([r, perfil]) => {
        if (!ativo) return;
        setAeronaves(
          (Array.isArray(r.aeronaves) ? r.aeronaves : []).map((row) => ({
            ...normalizarAeronaveSolicitacao(row),
          })),
        );
        const pessoas = Array.isArray(r.tripulacao) ? r.tripulacao : [];
        const tripulanteId = String(perfil.tripulante?.id ?? "");
        const nome = (id?: string | null) =>
          pessoas.find((pessoa) => String(pessoa.id) === String(id))
            ?.nome_completo ||
          pessoas.find((pessoa) => String(pessoa.id) === String(id))?.nome ||
          "";
        setVoos(
          tripulanteId && Array.isArray(r.agendamentos)
            ? r.agendamentos
                .filter(
                  (voo) =>
                    voo.numero_voo &&
                    [voo.piloto_id, voo.copiloto_id].some(
                      (id) => String(id ?? "") === tripulanteId,
                    ),
                )
                .map((voo) => ({
                  ...voo,
                  piloto_nome: voo.piloto_nome || nome(voo.piloto_id),
                  copiloto_nome: voo.copiloto_nome || nome(voo.copiloto_id),
                }))
            : [],
        );
        if (!tripulanteId) {
          setErroVoos(
            "Não foi possível identificar seu vínculo como tripulante para listar solicitações.",
          );
        }
      })
      .catch((e) => {
        if (ativo) setErroVoos(mensagemErro(e));
      })
      .finally(() => {
        if (ativo) {
          setCarregandoVoos(false);
          setCarregandoAeronaves(false);
        }
      });
    return () => {
      ativo = false;
    };
  }, [visivel]);

  const selecionarAeronave = (aeronave: AeronaveSolicitacao) => {
    setAeronaveSelecionada(aeronave);
    const matricula =
      aeronave.registration ||
      aeronave.matricula_registro ||
      aeronave.matricula ||
      "";
    setForm((atual) => ({
      ...atual,
      aeronaveId: aeronave.id,
      aeronave: [
        aeronave.manufacturer || aeronave.fabricante,
        aeronave.model || aeronave.modelo,
      ]
        .filter(Boolean)
        .join(" "),
      matricula:
        aeronave.registration ||
        aeronave.matricula_registro ||
        aeronave.matricula ||
        "",
    }));
    setFpl((atual) => preencherDadosAeronaveIcao(aeronave, atual, matricula));
    setAeronaveAberta(false);
  };

  const calcularRota = async () => {
    if (!icaoValidos) {
      avisar("Rota incompleta", "Informe origem e destino com 4 letras ICAO.");
      return;
    }
    setRotaCalculada(null);
    setErroRota("");
    setVersaoRota((valor) => valor + 1);
  };

  const selecionarVoo = (voo: VooSolicitacao) => {
    const partida = voo.origem?.trim().toUpperCase() || "";
    const chegada = voo.destino?.trim().toUpperCase() || "";
    const aeronaveSelecionada = aeronaves.find(
      (item) => item.id === String(voo.aeronave_id || ""),
    );
    const matricula =
      voo.matricula_registro ||
      voo.matricula ||
      aeronaveSelecionada?.registration ||
      aeronaveSelecionada?.matricula_registro ||
      "";
    const identificacaoSugerida = matricula
      .replace(/[^A-Z0-9]/gi, "")
      .toUpperCase();
    const tipo =
      modeloParaFormulario(aeronaveSelecionada || { id: "" }) ||
      voo.modelo ||
      "";
    const nomeAeronave = aeronaveSelecionada
      ? [
          aeronaveSelecionada.manufacturer || aeronaveSelecionada.fabricante,
          aeronaveSelecionada.model || aeronaveSelecionada.modelo,
        ]
          .filter(Boolean)
          .join(" ")
      : "";
    const eobt = formatarHoraUtc(voo.horario_previsto_agendamento);
    const comandante = voo.piloto_nome || "";
    const copiloto = voo.copiloto_nome || "";
    const passageiros = String(voo.numero_passageiros ?? 0);
    const pessoasConhecidas = String(
      (Number.parseInt(passageiros, 10) || 0) +
        Number(Boolean(comandante)) +
        Number(Boolean(copiloto)),
    );
    setNumeroVoo(voo.numero_voo.trim().toUpperCase());
    setSolicitacaoId(String(voo.id ?? voo.solicitacao_id ?? ""));
    setAeronaveSelecionada(aeronaveSelecionada || null);
    setForm((atual) => ({
      ...atual,
      partida,
      chegada,
      data: voo.data_agendada?.slice(0, 10) || atual.data,
      aeronaveId: voo.aeronave_id || "",
      aeronave: nomeAeronave || tipo,
      matricula: matricula.trim().toUpperCase(),
      horaPrevista: eobt,
      passageiros,
      piloto: comandante,
      copiloto: copiloto,
    }));
    setFpl((atual) => {
      const preenchido = aeronaveSelecionada
        ? preencherDadosAeronaveIcao(aeronaveSelecionada, atual, matricula)
        : atual;
      return {
        ...preenchido,
        identificacao:
          preenchido.identificacao ||
          (/^[A-Z0-9]{2,7}$/.test(identificacaoSugerida)
            ? identificacaoSugerida
            : ""),
        adep: partida || atual.adep,
        ades: chegada || atual.ades,
        eobt: eobt.replace(":", ""),
        tipoAeronave: (
          preenchido.tipoAeronave ||
          tipo ||
          atual.tipoAeronave
        ).toUpperCase(),
        pessoasABordo: pessoasConhecidas,
        piloto: comandante || atual.piloto,
        outrasInformacoes:
          matricula && !aeronaveSelecionada
            ? `REG/${matricula.replace(/-/g, "")} TYP/${tipo}`
                .trim()
                .toUpperCase()
            : preenchido.outrasInformacoes,
      };
    });
  };

  const enviar = async (status: StatusPlano) => {
    const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(form.data.trim());
    const alternativoValido =
      !form.alternates.trim() ||
      /^[A-Z]{4}$/.test(form.alternates.trim().toUpperCase());
    const dadosFpl = {
      ...fpl,
      identificacao: fpl.identificacao,
      adep: partidaIcao,
      ades: chegadaIcao,
      eobt: form.horaPrevista.replace(/:/g, "").trim() || fpl.eobt,
      tipoAeronave: fpl.tipoAeronave || form.aeronave,
      pessoasABordo: fpl.pessoasABordo,
      piloto: fpl.piloto || form.piloto,
      rota: fpl.rota || form.trecho,
    };
    const errosFpl = status === "preparado" ? validarFpl(dadosFpl) : [];
    if (!icaoValidos || !dataValida || !alternativoValido || errosFpl.length) {
      avisar(
        status === "preparado"
          ? "Revise o formulário ICAO"
          : "Campos obrigatórios",
        status === "preparado"
          ? errosFpl.join("\n")
          : "Preencha partida e chegada (ICAO, 4 letras), use data AAAA-MM-DD e informe um alternado válido com 4 letras.",
      );
      return;
    }
    setSalvando(true);
    const ok = await onSalvar({
      numeroVoo: numeroVoo.trim().toUpperCase(),
      solicitacaoId,
      partida: partidaIcao,
      chegada: chegadaIcao,
      trecho: form.trecho.trim() || `${partidaIcao}-${chegadaIcao}`,
      data: form.data.trim(),
      aeronave: form.aeronave.trim(),
      aeronaveId: form.aeronaveId,
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
      fpl: dadosFpl,
      status,
    });
    setSalvando(false);
    if (ok) onFechar();
  };

  const mostrarClima = partidaIcao.length > 0 || chegadaIcao.length > 0;
  const mostrarFormulario = !inline || aba === "formulario";
  const mostrarRota = !inline || aba === "rota";
  const mostrarResumo = inline && aba === "resumo";

  const conteudo = (
    <View style={[mStyles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          mStyles.header,
          {
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
            paddingTop: !inline && Platform.OS === "ios" ? 60 : 16,
          },
        ]}
      >
        {!inline && (
          <Toque
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            onPress={onFechar}
          >
            <Icon name="x" size={22} color={colors.foreground} />
          </Toque>
        )}
        <Text style={[mStyles.title, { color: colors.foreground }]}>
          {inline ? "Plano ICAO para o SIGMA" : "Novo plano de voo"}
        </Text>
        <Toque
          disabled={salvando}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            void enviar("preparado");
          }}
        >
          {salvando ? (
            <ActivityIndicator color={colors.secondary} />
          ) : (
            <Text style={[mStyles.saveText, { color: colors.secondary }]}>
              Preparar FPL
            </Text>
          )}
        </Toque>
      </View>

      {inline && (
        <View style={[mStyles.subtabs, { borderBottomColor: colors.border }]}>
          {(
            [
              ["formulario", "Formulário"],
              ["rota", "Rota"],
              ["resumo", "Resumo"],
            ] as const
          ).map(([id, label]) => {
            const ativo = aba === id;
            return (
              <Toque
                key={id}
                accessibilityRole="tab"
                accessibilityState={{ selected: ativo }}
                onPress={() => onAbaChange?.(id)}
                style={[
                  mStyles.subtab,
                  {
                    backgroundColor: ativo ? colors.primary : colors.muted,
                    borderColor: ativo ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    mStyles.subtabText,
                    { color: ativo ? "#FFFFFF" : colors.mutedForeground },
                  ]}
                >
                  {label}
                </Text>
              </Toque>
            );
          })}
        </View>
      )}

      <ScrollView
        contentContainerStyle={mStyles.form}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {mostrarResumo ? (
          <View
            style={[
              mStyles.resumoCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[mStyles.resumoTitulo, { color: colors.foreground }]}>
              Resumo do plano para envio ao SIGMA
            </Text>
            {[
              ["Número do voo", numeroVoo || "—"],
              ["Partida", partidaIcao || "—"],
              ["Chegada", chegadaIcao || "—"],
              ["Rota ICAO", fpl.rota || form.trecho || "—"],
              ["Alternado", fpl.alternado1 || form.alternates || "—"],
              ["Aeronave", form.matricula || form.aeronave || "—"],
              ["Data", form.data || "—"],
              [
                "EOBT UTC",
                fpl.eobt || form.horaPrevista.replace(":", "") || "—",
              ],
              ["Piloto", fpl.piloto || form.piloto || "—"],
              ["Copiloto", form.copiloto || "—"],
            ].map(([rotulo, valor]) => (
              <View
                key={rotulo}
                style={[
                  mStyles.resumoLinha,
                  { borderBottomColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    mStyles.resumoRotulo,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {rotulo}
                </Text>
                <Text
                  style={[mStyles.resumoValor, { color: colors.foreground }]}
                >
                  {valor}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <>
            {mostrarFormulario && (
              <>
                <Text
                  style={[mStyles.secao, { color: colors.mutedForeground }]}
                >
                  SOLICITAÇÃO DE VOO
                </Text>
                <SeletorSolicitacao
                  voos={voos}
                  carregando={carregandoVoos}
                  erro={erroVoos}
                  valor={numeroVoo}
                  onChangeText={(valor) => {
                    setNumeroVoo(valor);
                    setSolicitacaoId("");
                  }}
                  onSelecionar={selecionarVoo}
                  colors={colors}
                />
                {inline && (
                  <Text
                    style={[mStyles.abaHint, { color: colors.mutedForeground }]}
                  >
                    Informe origem, destino e rota na aba Rota.
                  </Text>
                )}
              </>
            )}

            {mostrarRota && (
              <>
                <Text
                  style={[mStyles.secao, { color: colors.mutedForeground }]}
                >
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
                    style={[
                      mStyles.wxPreview,
                      { backgroundColor: colors.muted },
                    ]}
                  >
                    <View style={mStyles.wxRow}>
                      <Icon name="cloud" size={14} color={colors.secondary} />
                      <Text
                        style={[mStyles.wxTitle, { color: colors.foreground }]}
                      >
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
                        <Text
                          style={[mStyles.wxIcao, { color: colors.foreground }]}
                        >
                          {partidaIcao}
                        </Text>
                        <Text
                          style={[
                            mStyles.wxMetar,
                            { color: colors.mutedForeground },
                          ]}
                          numberOfLines={1}
                        >
                          {clima.partida.metar ||
                            clima.partida.error ||
                            "Sem dados"}
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
                        <Text
                          style={[mStyles.wxIcao, { color: colors.foreground }]}
                        >
                          {chegadaIcao}
                        </Text>
                        <Text
                          style={[
                            mStyles.wxMetar,
                            { color: colors.mutedForeground },
                          ]}
                          numberOfLines={1}
                        >
                          {clima.chegada.metar ||
                            clima.chegada.error ||
                            "Sem dados"}
                        </Text>
                      </View>
                    )}
                    {!carregandoClima && !clima.partida && !clima.chegada && (
                      <Text
                        style={[
                          mStyles.wxHint,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        Preencha os ICAOs para ver o METAR
                      </Text>
                    )}
                  </View>
                )}

                <Campo
                  rotulo="Item 16 · Aeródromo alternado 1"
                  colors={colors}
                  value={fpl.alternado1}
                  onChangeText={(v) => {
                    setCampoFpl("alternado1", v.toUpperCase());
                    set("alternates", v.toUpperCase());
                  }}
                  placeholder="SBSP"
                  autoCapitalize="characters"
                  maxLength={4}
                />

                <View style={mStyles.calcularLinha}>
                  <Text
                    style={[
                      mStyles.secaoInline,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    ROTA
                  </Text>
                  <Toque
                    disabled={calculandoRota || !icaoValidos}
                    onPress={() => void calcularRota()}
                    style={[
                      mStyles.calcularBtn,
                      { backgroundColor: colors.primary },
                    ]}
                  >
                    {calculandoRota ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Icon name="navigation" size={16} color="#FFFFFF" />
                    )}
                    <Text style={mStyles.calcularText}>Calcular rota</Text>
                  </Toque>
                </View>
                {!!erroRota && (
                  <Text style={[mStyles.wxHint, { color: colors.destructive }]}>
                    Não foi possível calcular a rota: {erroRota}
                  </Text>
                )}
                {rotaCalculada && (
                  <View
                    style={[
                      mStyles.wxPreview,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text
                      style={[mStyles.wxTitle, { color: colors.foreground }]}
                    >
                      Cálculo atualizado
                    </Text>
                    <Text
                      style={[
                        mStyles.wxHint,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {rotaCalculada.flightplan?.distance_nm != null
                        ? `Distância: ${Math.round(rotaCalculada.flightplan.distance_nm)} NM`
                        : "Distância indisponível"}
                      {rotaCalculada.flightplan?.flight_minutes
                        ? ` · Tempo de voo: ${formatarTempoVoo(rotaCalculada.flightplan.flight_minutes)}`
                        : rotaCalculada.flightplan?.estimated_time
                          ? ` · Tempo de voo: ${rotaCalculada.flightplan.estimated_time}`
                          : " · Tempo de voo indisponível"}
                      {rotaCalculada.fuel?.total_required != null
                        ? ` · ${Math.round(rotaCalculada.fuel.total_required)} L de combustível`
                        : ""}
                    </Text>
                    {rotaCalculada.flightplan?.route ? (
                      <Text
                        selectable
                        style={[
                          mStyles.wxMetar,
                          { color: colors.foreground, marginTop: 6 },
                        ]}
                      >
                        Rota AIS: {rotaCalculada.flightplan.route}
                      </Text>
                    ) : null}
                    {rotaCalculada.departure && rotaCalculada.destination ? (
                      <>
                        <MapaVoo
                          origem={rotaCalculada.departure}
                          destino={rotaCalculada.destination}
                          posicao={null}
                          trilha={[]}
                          origemNome={rotaCalculada.departure.icao}
                          destinoNome={rotaCalculada.destination.icao}
                          atual={false}
                          meteorologia={{
                            latitude:
                              (rotaCalculada.departure.lat +
                                rotaCalculada.destination.lat) /
                              2,
                            longitude:
                              (rotaCalculada.departure.lon +
                                rotaCalculada.destination.lon) /
                              2,
                            icao: `${partidaIcao}–${chegadaIcao}`,
                          }}
                        />
                      </>
                    ) : (
                      <Text
                        style={[
                          mStyles.wxHint,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        Coordenadas dos aeródromos não foram retornadas; os
                        dados do cálculo estão preenchidos.
                      </Text>
                    )}
                  </View>
                )}
              </>
            )}

            {mostrarFormulario && (
              <>
                <Text
                  style={[mStyles.secao, { color: colors.mutedForeground }]}
                >
                  AERONAVE E DATA
                </Text>
                <View>
                  <Text style={[mStyles.label, { color: colors.foreground }]}>
                    Aeronave
                  </Text>
                  <Toque
                    accessibilityRole="button"
                    onPress={() => setAeronaveAberta((aberta) => !aberta)}
                    style={[
                      mStyles.input,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        color: form.aeronave
                          ? colors.foreground
                          : colors.mutedForeground,
                        flex: 1,
                      }}
                    >
                      {carregandoAeronaves
                        ? "Carregando aeronaves…"
                        : form.aeronave
                          ? `${form.matricula} · ${form.aeronave}`
                          : "Selecionar aeronave"}
                    </Text>
                    <Icon
                      name="chevron-down"
                      size={18}
                      color={colors.mutedForeground}
                    />
                  </Toque>
                  {aeronaveAberta && (
                    <View
                      style={{
                        maxHeight: 180,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                        marginBottom: 10,
                        overflow: "hidden",
                      }}
                    >
                      {aeronaves.map((aeronave) => (
                        <Toque
                          key={aeronave.id}
                          onPress={() => selecionarAeronave(aeronave)}
                          style={{
                            padding: 12,
                            borderBottomWidth: StyleSheet.hairlineWidth,
                            borderBottomColor: colors.border,
                          }}
                        >
                          <Text
                            style={{
                              color: colors.foreground,
                              fontFamily: "Inter_700Bold",
                              fontSize: 14,
                            }}
                          >
                            {aeronave.registration ||
                              aeronave.matricula_registro ||
                              aeronave.matricula}
                          </Text>
                          <Text
                            style={{
                              color: colors.mutedForeground,
                              fontSize: 12,
                              marginTop: 2,
                            }}
                          >
                            {[
                              aeronave.manufacturer || aeronave.fabricante,
                              aeronave.model || aeronave.modelo,
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          </Text>
                        </Toque>
                      ))}
                      {!aeronaves.length && !carregandoAeronaves && (
                        <Text
                          style={{
                            color: colors.mutedForeground,
                            padding: 12,
                            fontSize: 12,
                          }}
                        >
                          Nenhuma aeronave disponível
                        </Text>
                      )}
                    </View>
                  )}
                </View>
                {aeronaveSelecionada && (
                  <View
                    style={[
                      mStyles.aircraftDataCard,
                      {
                        backgroundColor: colors.muted,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        mStyles.aircraftDataTitle,
                        { color: colors.foreground },
                      ]}
                    >
                      DADOS DA AERONAVE · D1
                    </Text>
                    {[
                      [
                        "Fabricante / modelo",
                        [
                          aeronaveSelecionada.fabricante,
                          aeronaveSelecionada.modelo,
                        ]
                          .filter(Boolean)
                          .join(" "),
                      ],
                      [
                        "Velocidade de cruzeiro",
                        velocidadeCruzeiroDaAeronave(aeronaveSelecionada)
                          ? `${velocidadeCruzeiroDaAeronave(aeronaveSelecionada)} kt`
                          : "—",
                      ],
                      [
                        "Consumo de combustível",
                        aeronaveSelecionada.consumo_combustivel ||
                        aeronaveSelecionada.fuel_consumption
                          ? `${aeronaveSelecionada.consumo_combustivel || aeronaveSelecionada.fuel_consumption} L/h`
                          : "—",
                      ],
                      [
                        "Categoria / teto",
                        [
                          aeronaveSelecionada.performance_categoria,
                          aeronaveSelecionada.performance_teto_servico_ft
                            ? `${aeronaveSelecionada.performance_teto_servico_ft} ft`
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" · "),
                      ],
                      [
                        "Subida / descida",
                        [
                          aeronaveSelecionada.performance_taxa_subida_fpm
                            ? `${aeronaveSelecionada.performance_taxa_subida_fpm} fpm`
                            : "",
                          aeronaveSelecionada.performance_taxa_descida_fpm
                            ? `${aeronaveSelecionada.performance_taxa_descida_fpm} fpm`
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" / "),
                      ],
                      [
                        "Designador ICAO aplicado",
                        aeronaveSelecionada.designador_icao ||
                          "— (usa o modelo cadastrado)",
                      ],
                      [
                        "Esteira aplicada",
                        esteiraDaAeronave(aeronaveSelecionada),
                      ],
                      [
                        "Equipamentos / vigilância / PBN",
                        [
                          aeronaveSelecionada.equipamentos_icao,
                          aeronaveSelecionada.vigilancia_icao,
                          aeronaveSelecionada.pbn_icao,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "— (preenchimento manual)",
                      ],
                      [
                        "Autonomia / cor-marcas",
                        [
                          aeronaveSelecionada.autonomia_padrao_minutos
                            ? `${aeronaveSelecionada.autonomia_padrao_minutos} min`
                            : "",
                          aeronaveSelecionada.cor_marcas,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "— (preenchimento manual)",
                      ],
                    ].map(([rotulo, valor]) => (
                      <View key={rotulo} style={mStyles.aircraftDataRow}>
                        <Text
                          style={[
                            mStyles.aircraftDataLabel,
                            { color: colors.mutedForeground },
                          ]}
                        >
                          {rotulo}
                        </Text>
                        <Text
                          style={[
                            mStyles.aircraftDataValue,
                            { color: colors.foreground },
                          ]}
                        >
                          {valor || "—"}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                <Campo
                  rotulo="Matrícula"
                  colors={colors}
                  value={form.matricula}
                  editable={false}
                  autoCapitalize="characters"
                />
                <View style={mStyles.row}>
                  <Campo
                    rotulo="Data *"
                    colors={colors}
                    value={form.data}
                    onChangeText={(v) => set("data", v)}
                    placeholder="AAAA-MM-DD"
                  />
                  <Campo
                    rotulo="Hora prevista (UTC)"
                    colors={colors}
                    value={form.horaPrevista}
                    onChangeText={(v) => set("horaPrevista", v)}
                    placeholder="HH:MM"
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

                <Text
                  style={[mStyles.secao, { color: colors.mutedForeground }]}
                >
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

                <Text
                  style={[mStyles.secao, { color: colors.mutedForeground }]}
                >
                  FORMULÁRIO ICAO · ITENS 7–19
                </Text>
                <Text
                  style={[
                    mStyles.aviso,
                    {
                      color: colors.mutedForeground,
                      backgroundColor: colors.muted,
                    },
                  ]}
                >
                  Dados importados são apenas uma base. Confirme designador,
                  equipamentos, horários UTC, desempenho e todos os itens antes
                  de encaminhar pelo canal AIS/SIGMA autorizado.
                </Text>
                <Campo
                  rotulo="Item 7 · Identificação da aeronave ICAO"
                  colors={colors}
                  value={fpl.identificacao}
                  onChangeText={(v) =>
                    setCampoFpl(
                      "identificacao",
                      v
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 7),
                    )
                  }
                  placeholder="Ex.: PRABC"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={7}
                />
                <View style={mStyles.row}>
                  <Campo
                    rotulo="Item 9 · Nº de aeronaves"
                    colors={colors}
                    value={fpl.numeroAeronaves}
                    onChangeText={(v) => setCampoFpl("numeroAeronaves", v)}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Campo
                    rotulo="Item 9 · Modelo da aeronave"
                    colors={colors}
                    value={fpl.tipoAeronave}
                    onChangeText={(v) =>
                      setCampoFpl("tipoAeronave", v.toUpperCase())
                    }
                    placeholder="Cessna 172"
                    autoCapitalize="characters"
                    maxLength={20}
                  />
                </View>
                <Text style={[mStyles.label, { color: colors.foreground }]}>
                  Item 8 · Regra de voo
                </Text>
                <View style={mStyles.choiceRow}>
                  {(["I", "V", "Y", "Z"] as const).map((value) => (
                    <Toque
                      key={value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: fpl.regraVoo === value }}
                      onPress={() =>
                        setFpl((atual) => ({ ...atual, regraVoo: value }))
                      }
                      style={[
                        mStyles.choice,
                        {
                          backgroundColor:
                            fpl.regraVoo === value
                              ? colors.primary
                              : colors.muted,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color:
                            fpl.regraVoo === value
                              ? "#FFFFFF"
                              : colors.foreground,
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 12,
                        }}
                      >
                        {value}
                      </Text>
                    </Toque>
                  ))}
                </View>
                <Text style={[mStyles.label, { color: colors.foreground }]}>
                  Item 8 · Tipo de voo
                </Text>
                <View style={mStyles.choiceRow}>
                  {(["S", "N", "G", "M", "X"] as const).map((value) => (
                    <Toque
                      key={value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: fpl.tipoVoo === value }}
                      onPress={() =>
                        setFpl((atual) => ({ ...atual, tipoVoo: value }))
                      }
                      style={[
                        mStyles.choice,
                        {
                          backgroundColor:
                            fpl.tipoVoo === value
                              ? colors.primary
                              : colors.muted,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color:
                            fpl.tipoVoo === value
                              ? "#FFFFFF"
                              : colors.foreground,
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 12,
                        }}
                      >
                        {value}
                      </Text>
                    </Toque>
                  ))}
                </View>
                <Text style={[mStyles.label, { color: colors.foreground }]}>
                  Item 9 · Esteira de turbulência
                </Text>
                <View style={mStyles.choiceRow}>
                  {(["L", "M", "H", "J"] as const).map((value) => (
                    <Toque
                      key={value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: fpl.esteira === value }}
                      onPress={() =>
                        setFpl((atual) => ({ ...atual, esteira: value }))
                      }
                      style={[
                        mStyles.choice,
                        {
                          backgroundColor:
                            fpl.esteira === value
                              ? colors.primary
                              : colors.muted,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color:
                            fpl.esteira === value
                              ? "#FFFFFF"
                              : colors.foreground,
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 12,
                        }}
                      >
                        {value}
                      </Text>
                    </Toque>
                  ))}
                </View>
                <Campo
                  rotulo="Item 10 · Equipamento / vigilância ICAO"
                  colors={colors}
                  value={fpl.equipamento}
                  onChangeText={(v) =>
                    setCampoFpl("equipamento", v.toUpperCase())
                  }
                  placeholder="SDFG/LB1"
                  autoCapitalize="characters"
                />

                <Text
                  style={[mStyles.secao, { color: colors.mutedForeground }]}
                >
                  ITEM 15 · VELOCIDADE, NÍVEL E ROTA
                </Text>
                <View style={mStyles.row}>
                  <Campo
                    rotulo="Velocidade TAS"
                    colors={colors}
                    value={fpl.velocidade}
                    onChangeText={(v) =>
                      setCampoFpl("velocidade", v.toUpperCase())
                    }
                    placeholder="N0150"
                    autoCapitalize="characters"
                    maxLength={5}
                  />
                  <Campo
                    rotulo="Nível"
                    colors={colors}
                    value={fpl.nivel}
                    onChangeText={(v) => setCampoFpl("nivel", v.toUpperCase())}
                    placeholder="A045 / VFR"
                    autoCapitalize="characters"
                    maxLength={5}
                  />
                </View>
                <Campo
                  rotulo="Item 15 · Rota AISWEB ou planejada"
                  colors={colors}
                  value={fpl.rota}
                  onChangeText={(v) => setCampoFpl("rota", v.toUpperCase())}
                  placeholder="SBGR DCT ... SBBR"
                  autoCapitalize="characters"
                  multilinha
                  multiline
                  numberOfLines={3}
                />
                <Text
                  style={[mStyles.secao, { color: colors.mutedForeground }]}
                >
                  ITEM 16 · EET E ALTERNADOS
                </Text>
                <View style={mStyles.row}>
                  <Campo
                    rotulo="EET (HHMM)"
                    colors={colors}
                    value={fpl.eet}
                    onChangeText={(v) =>
                      setCampoFpl("eet", v.replace(/\D/g, "").slice(0, 4))
                    }
                    placeholder="0135"
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                  <Campo
                    rotulo="Alternado 2"
                    colors={colors}
                    value={fpl.alternado2}
                    onChangeText={(v) =>
                      setCampoFpl("alternado2", v.toUpperCase())
                    }
                    placeholder="SBGO"
                    autoCapitalize="characters"
                    maxLength={4}
                  />
                </View>
                <Campo
                  rotulo="Item 18 · Outras informações (REG/, PBN/ etc.)"
                  colors={colors}
                  value={fpl.outrasInformacoes}
                  onChangeText={(v) =>
                    setCampoFpl("outrasInformacoes", v.toUpperCase())
                  }
                  placeholder="REG/PRABC TYP/C172"
                  autoCapitalize="characters"
                  multilinha
                  multiline
                  numberOfLines={3}
                />

                <Text
                  style={[mStyles.secao, { color: colors.mutedForeground }]}
                >
                  ITEM 19 · INFORMAÇÃO SUPLEMENTAR
                </Text>
                <View style={mStyles.row}>
                  <Campo
                    rotulo="Autonomia (HHMM)"
                    colors={colors}
                    value={fpl.autonomia}
                    onChangeText={(v) =>
                      setCampoFpl("autonomia", v.replace(/\D/g, "").slice(0, 4))
                    }
                    placeholder="0520"
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                  <Campo
                    rotulo="Pessoas a bordo"
                    colors={colors}
                    value={fpl.pessoasABordo}
                    onChangeText={(v) =>
                      setCampoFpl(
                        "pessoasABordo",
                        v.replace(/\D/g, "").slice(0, 2),
                      )
                    }
                    placeholder="4"
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
                <Campo
                  rotulo="Rádio de emergência"
                  colors={colors}
                  value={fpl.radioEmergencia}
                  onChangeText={(v) =>
                    setCampoFpl("radioEmergencia", v.toUpperCase())
                  }
                  placeholder="U V ELT"
                  autoCapitalize="characters"
                />
                <Campo
                  rotulo="Equipamento de sobrevivência"
                  colors={colors}
                  value={fpl.sobrevivencia}
                  onChangeText={(v) =>
                    setCampoFpl("sobrevivencia", v.toUpperCase())
                  }
                  placeholder="P D M J"
                  autoCapitalize="characters"
                />
                <View style={mStyles.row}>
                  <Campo
                    rotulo="Coletes salva-vidas"
                    colors={colors}
                    value={fpl.coletes}
                    onChangeText={(v) =>
                      setCampoFpl("coletes", v.toUpperCase())
                    }
                    autoCapitalize="characters"
                  />
                  <Campo
                    rotulo="Botes"
                    colors={colors}
                    value={fpl.botes}
                    onChangeText={(v) => setCampoFpl("botes", v.toUpperCase())}
                    autoCapitalize="characters"
                  />
                </View>
                <View style={mStyles.row}>
                  <Campo
                    rotulo="Cor e marcas"
                    colors={colors}
                    value={fpl.corAeronave}
                    onChangeText={(v) => setCampoFpl("corAeronave", v)}
                    placeholder="Branca e azul"
                  />
                  <Campo
                    rotulo="Piloto em comando"
                    colors={colors}
                    value={fpl.piloto || form.piloto}
                    onChangeText={(v) => setCampoFpl("piloto", v)}
                  />
                </View>
                <Campo
                  rotulo="Observações suplementares"
                  colors={colors}
                  value={fpl.observacoes}
                  onChangeText={(v) => setCampoFpl("observacoes", v)}
                  multilinha
                  multiline
                  numberOfLines={3}
                />

                <Text
                  style={[mStyles.secao, { color: colors.mutedForeground }]}
                >
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
                          {
                            backgroundColor: ativo
                              ? colors.primary
                              : colors.muted,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            mStyles.chipText,
                            {
                              color: ativo ? "#FFFFFF" : colors.mutedForeground,
                            },
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
                  style={[
                    mStyles.rascunhoBtn,
                    { backgroundColor: colors.muted },
                  ]}
                >
                  <Text
                    style={[mStyles.rascunhoText, { color: colors.foreground }]}
                  >
                    Salvar como rascunho
                  </Text>
                </Toque>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );

  return inline ? (
    conteudo
  ) : (
    <Modal
      visible={visivel}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      {conteudo}
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
  subtabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  subtab: {
    flex: 1,
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  subtabText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  resumoCard: { borderWidth: 1, borderRadius: 12, padding: 14 },
  resumoTitulo: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  resumoLinha: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  resumoRotulo: { fontSize: 11, fontFamily: "Inter_500Medium" },
  resumoValor: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  aircraftDataCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  aircraftDataTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  aircraftDataRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  aircraftDataLabel: {
    width: 142,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  aircraftDataValue: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  abaHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 8,
  },
  aviso: {
    borderRadius: 10,
    padding: 12,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  choice: {
    minWidth: 42,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
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
  calcularLinha: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  secaoInline: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
  },
  calcularBtn: {
    minHeight: 38,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  calcularText: { color: "#FFFFFF", fontSize: 13, fontFamily: "Inter_700Bold" },
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
