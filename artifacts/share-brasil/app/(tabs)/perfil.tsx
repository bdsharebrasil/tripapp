import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
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
import { useQueryClient } from "@tanstack/react-query";
import { HorasVoo } from "@/src/components/HorasVoo";
import { Avatar } from "@/src/components/Avatar";
import { Etiqueta, ErroConsulta, tema, Icon, Toque, type Icone } from "@/src/components/ui";
import { apiFetch } from "@/src/lib/api";
import { signOut } from "@/src/lib/session";
import { PerfilCompleto, situacaoValidade } from "@/src/lib/perfil";
import { avisar, confirmar } from "@/src/lib/confirmar";
import { anexarArquivo } from "@/src/lib/upload";
import { abrirArquivoPrivado } from "@/src/lib/arquivo-privado";

type Info = PerfilCompleto;
type Document = {
  id: string;
  nome_arquivo: string;
  tipo_documento?: string;
  categoria?: string;
  mime_type?: string;
  tipo_arquivo?: string;
  arquivo_url?: string;
  criado_em?: string;
};
type Salary = {
  id: string;
  competencia_ano: number;
  competencia_mes: number;
  rotulo?: string;
  tipo_pagamento?: string;
  valor_centavos: number;
  status: string;
  data_pagamento?: string;
  data_prevista?: string;
  holerite_url?: string | null;
  comprovante_url?: string | null;
};

// Seções de detalhe. `null` = tela resumo (a do layout novo).
type Secao = "dados" | "licencas" | "salario" | "ferias" | "docs";
const SECOES: Secao[] = ["dados", "licencas", "salario", "ferias", "docs"];
const titulos: Record<Secao, string> = {
  dados: "Dados pessoais",
  licencas: "Licenças e CMA",
  salario: "Salário",
  ferias: "Férias",
  docs: "Documentos",
};

const VERDE = "#2ee6a6";
const MESES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];
const date = (d?: string | null) =>
  d ? d.slice(0, 10).split("-").reverse().join("/") : "—";
const dataCurta = (d?: string | null) => {
  if (!d) return "—";
  const [a, m, dia] = d.slice(0, 10).split("-");
  return `${dia} ${MESES[Number(m) - 1] ?? ""} ${a}`;
};
const money = (c?: number) =>
  (Number(c || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
const mimeFromPath = (path: string): string => {
  const value = decodeURIComponent(
    path.split("?key=").pop() || path,
  ).toLowerCase();
  return /\.jpe?g$/.test(value)
    ? "image/jpeg"
    : /\.png$/.test(value)
      ? "image/png"
      : /\.webp$/.test(value)
        ? "image/webp"
        : "application/pdf";
};
// AJUSTAR: critério para identificar ressarcimentos na folha.
const ehRessarcimento = (x: Salary) =>
  /ressarc/i.test(`${x.rotulo ?? ""} ${x.tipo_pagamento ?? ""}`);

export function PerfilScreen({ initialTab }: { initialTab?: Secao } = {}) {
  const insets = useSafeAreaInsets(),
    router = useRouter();
  const { secao: secaoParam } = useLocalSearchParams<{ secao?: string }>();
  const [secao, setSecao] = useState<Secao | null>(() => {
    if (initialTab) return initialTab;
    if (secaoParam === "horas") return "licencas";
    return SECOES.find((s) => s === secaoParam) ?? null;
  });
  const [licencasTab, setLicencasTab] = useState<"licencas" | "horas">(
    secaoParam === "horas" ? "horas" : "licencas",
  );
  const queryClient = useQueryClient();
  const [data, setData] = useState<Info | null>(null);
  const [docs, setDocs] = useState<Document[]>([]),
    [salaries, setSalaries] = useState<Salary[]>([]);
  const [loading, setLoading] = useState(true),
    [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const [editing, setEditing] = useState(false),
    [displayName, setDisplayName] = useState(""),
    [phone, setPhone] = useState("");
  const [docCategory, setDocCategory] = useState("Documentos pessoais");
  const [photoVersion, setPhotoVersion] = useState(0);
  const [paymentsError, setPaymentsError] = useState(false),
    [documentsError, setDocumentsError] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [p, d, s] = await Promise.allSettled([
        apiFetch<Info>("/api/colaborador/perfil"),
        apiFetch<Document[]>("/api/colaborador/documentos"),
        apiFetch<{ pagamentos: Salary[] }>("/api/colaborador/folha-pagamento"),
      ]);
      if (p.status === "fulfilled") {
        setData(p.value);
        setDisplayName(
          p.value.perfil?.nome_exibicao || p.value.perfil?.nome_completo || "",
        );
        setPhone(p.value.perfil?.telefone || "");
      } else {
        setData(null);
        setError(
          p.reason instanceof Error ? p.reason.message : "Perfil indisponível.",
        );
      }
      setDocs(
        d.status === "fulfilled" && Array.isArray(d.value) ? d.value : [],
      );
      setSalaries(
        s.status === "fulfilled" && Array.isArray(s.value.pagamentos)
          ? s.value.pagamentos
          : [],
      );
      setPaymentsError(s.status === "rejected");
      setDocumentsError(d.status === "rejected");
      if (d.status === "rejected" || s.status === "rejected")
        setError(
          "Documentos ou pagamentos indisponíveis. Atualize para tentar novamente.",
        );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível carregar o perfil.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const saveProfile = async () => {
    if (busy || !data) return;
    setBusy("profile");
    try {
      await apiFetch("/api/colaborador/perfil", {
        method: "PATCH",
        body: JSON.stringify({
          nome_exibicao: displayName.trim(),
          telefone: phone.trim(),
        }),
      });
      setEditing(false);
      await load(true);
      avisar("Perfil atualizado", "Seus dados foram atualizados.");
    } catch (e) {
      avisar(
        "Erro",
        e instanceof Error ? e.message : "Falha ao atualizar perfil.",
      );
    } finally {
      setBusy("");
    }
  };
  const uploadPhoto = async () => {
    if (busy) return;
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted)
        return avisar("Permissão necessária", "Autorize acesso às fotos.");
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      if (a.fileSize && a.fileSize > 10 * 1024 * 1024)
        return avisar("Arquivo grande", "O limite da foto é 10 MB.");
      setBusy("foto");
      const form = new FormData();
      await anexarArquivo(
        form,
        "foto",
        a.uri,
        a.fileName || "foto-perfil.jpg",
        a.mimeType || "image/jpeg",
      );
      await apiFetch("/api/colaborador/foto", { method: "POST", body: form });
      setPhotoVersion((v) => v + 1);
      await load(true);
      avisar("Foto atualizada", "A foto do perfil foi salva.");
    } catch (e) {
      avisar(
        "Não foi possível enviar",
        e instanceof Error ? e.message : "Tente novamente.",
      );
    } finally {
      setBusy("");
    }
  };
  const uploadDoc = async () => {
    if (busy) return;
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      if (a.size && a.size > 10 * 1024 * 1024)
        return avisar("Arquivo grande", "O limite de documentos é 10 MB.");
      if (
        !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
          a.mimeType || "",
        )
      )
        return avisar(
          "Formato não permitido",
          "Selecione PDF, JPG, PNG ou WEBP.",
        );
      setBusy("doc");
      const form = new FormData();
      await anexarArquivo(
        form,
        "arquivo",
        a.uri,
        a.name || "documento.pdf",
        a.mimeType || "application/pdf",
      );
      form.append("tipo_documento", docCategory);
      await apiFetch("/api/colaborador/documentos", {
        method: "POST",
        body: form,
      });
      await load(true);
      avisar(
        "Documento enviado",
        "O arquivo foi adicionado aos seus documentos.",
      );
    } catch (e) {
      avisar(
        "Não foi possível enviar",
        e instanceof Error ? e.message : "Verifique os dados.",
      );
    } finally {
      setBusy("");
    }
  };
  const openPrivate = async (
    path: string | undefined,
    name: string,
    mime: string,
  ) => {
    if (!path || busy) return;
    setBusy("abrir");
    try {
      await abrirArquivoPrivado(path, name, mime);
    } catch (e) {
      avisar(
        "Arquivo indisponível",
        e instanceof Error ? e.message : "Não foi possível abrir.",
      );
    } finally {
      setBusy("");
    }
  };
  const removeDoc = (doc: Document) => {
    if (busy) return;
    confirmar(
      "Excluir documento?",
      "O arquivo será removido do seu perfil.",
      async () => {
        setBusy("delete");
        try {
          await apiFetch(
            `/api/colaborador/documentos/${encodeURIComponent(doc.id)}`,
            { method: "DELETE" },
          );
          await load(true);
        } catch (e) {
          avisar(
            "Erro",
            e instanceof Error ? e.message : "Não foi possível excluir.",
          );
        } finally {
          setBusy("");
        }
      },
      true,
    );
  };
  const logout = async () => {
    if (busy) return;
    setBusy("logout");
    try {
      await signOut();
      queryClient.clear();
      router.replace("/login");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível sair. Tente novamente.",
      );
      setBusy("");
    }
  };

  const p = data?.perfil;
  const fullName = p?.nome_exibicao || p?.nome_completo || "Colaborador";
  const cargo = p?.departamento || p?.tipo_user || "Tripulação";
  const canac = p?.canac || data?.tripulante?.canac;

  // --- resumo ---
  const anos = p?.data_admissao
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(p.data_admissao).getTime()) / 31557600000,
        ),
      )
    : undefined;
  // AJUSTAR: ligar ao mesmo dado usado por <HorasVoo />.
  const horasTotais: string | undefined = undefined;
  const horasMes: string | undefined = undefined;
  const ultimoSalario = salaries
    .filter((x) => !ehRessarcimento(x) && x.data_pagamento)
    .sort(
      (a, b) =>
        b.competencia_ano - a.competencia_ano ||
        b.competencia_mes - a.competencia_mes,
    )[0];
  const ressarcimentosPendentes = salaries
    .filter((x) => ehRessarcimento(x) && !x.data_pagamento)
    .reduce((t, x) => t + x.valor_centavos, 0);
  const hoje = new Date().toISOString().slice(0, 10);
  const proximasFerias = [...(data?.ferias || [])]
    .filter((f) => (f.data_fim || "") >= hoje)
    .sort((a, b) => (a.data_inicio || "").localeCompare(b.data_inicio || ""))[0];
  const situacaoCma = situacaoValidade(data?.cma?.validade);

  const row = (a: string, b: unknown) => (
    <View style={styles.infoRow}>
      <Text style={styles.muted}>{a}</Text>
      <Text style={styles.infoValue}>
        {b === null || b === undefined || b === "" ? "—" : String(b)}
      </Text>
    </View>
  );
  const linha = (
    icone: Icone,
    rotulo: string,
    onPress: () => void,
    opts: { extra?: React.ReactNode; cor?: string; ultimo?: boolean } = {},
  ) => (
    <Toque
      key={rotulo}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={onPress}
      style={[styles.listaLinha, !opts.ultimo && styles.listaDivisor]}
    >
      <Icon name={icone} size={20} color={opts.cor ?? tema.destaque} />
      <Text style={[styles.listaTexto, opts.cor ? { color: opts.cor } : null]}>
        {rotulo}
      </Text>
      {opts.extra}
      {opts.cor ? null : (
        <Icon name="chevron-right" size={20} color={tema.suave} />
      )}
    </Toque>
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.root}>
      <View style={styles.header}>
        {secao ? (
          <View style={styles.headerEsq}>
            <Toque
              accessibilityRole="button"
              accessibilityLabel="Voltar ao perfil"
              onPress={() => {
                setSecao(null);
                setEditing(false);
              }}
              style={styles.iconBtn}
            >
              <Icon name="chevron-left" color={tema.texto} size={20} />
            </Toque>
            <Text style={styles.titleSecao}>{titulos[secao]}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.title}>Perfil</Text>
            <Toque
              accessibilityRole="button"
              accessibilityLabel="Editar dados pessoais"
              onPress={() => setSecao("dados")}
              style={styles.iconBtn}
            >
              <Icon name="edit-3" color={tema.texto} size={20} />
            </Toque>
          </>
        )}
      </View>
      {!!error && (
        <ErroConsulta mensagem={error} atualizar={() => void load(true)} />
      )}
      {loading ? (
        <ActivityIndicator color={tema.destaque} style={{ marginTop: 36 }} />
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load(true)}
              tintColor={tema.destaque}
            />
          }
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: insets.bottom + 110,
          }}
        >
          {!secao && (
            <>
              <View style={styles.hero}>
                <Toque
                  accessibilityRole="button"
                  accessibilityLabel="Atualizar foto do perfil"
                  accessibilityState={{ disabled: !!busy }}
                  disabled={!!busy}
                  onPress={() => void uploadPhoto()}
                  style={styles.avatarRing}
                >
                  {busy === "foto" ? (
                    <ActivityIndicator color={tema.destaque} />
                  ) : (
                    <Avatar
                      nome={fullName}
                      disponivel={!!p?.foto_url}
                      versao={photoVersion}
                      tamanho={92}
                    />
                  )}
                </Toque>
                <Text style={styles.name}>{fullName}</Text>
                <Text style={styles.subtitulo}>
                  {cargo} · {canac ? `CANAC ${canac}` : "CANAC não informado"}
                </Text>
              </View>

              <View style={styles.stats}>
                <Toque
                  style={styles.stat}
                  onPress={() => {
                    setLicencasTab("horas");
                    setSecao("licencas");
                  }}
                >
                  <Text style={styles.statValue}>{horasTotais ?? "—"}</Text>
                  <Text style={styles.statLabel}>Horas totais</Text>
                </Toque>
                <Toque
                  style={styles.stat}
                  onPress={() => {
                    setLicencasTab("horas");
                    setSecao("licencas");
                  }}
                >
                  <Text style={styles.statValue}>{horasMes ?? "—"}</Text>
                  <Text style={styles.statLabel}>Este mês</Text>
                </Toque>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{anos ?? "—"}</Text>
                  <Text style={styles.statLabel}>Anos</Text>
                </View>
              </View>

              <View style={styles.salario}>
                <Text style={styles.salarioLabel}>Último salário creditado</Text>
                <Text style={styles.salarioValor}>
                  {ultimoSalario ? money(ultimoSalario.valor_centavos) : "—"}
                </Text>
                {ultimoSalario ? (
                  <View style={styles.salarioStatus}>
                    <Icon name="check-circle" size={18} color={VERDE} />
                    <Text style={{ color: VERDE, fontSize: 14 }}>
                      Caiu em {dataCurta(ultimoSalario.data_pagamento)}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.salarioLabel}>
                    {paymentsError
                      ? "Pagamentos indisponíveis."
                      : "Nenhum pagamento registrado."}
                  </Text>
                )}
                <View style={styles.divisor} />
                <View style={styles.between}>
                  <View>
                    <Text style={styles.salarioLabel}>
                      Ressarcimentos pendentes
                    </Text>
                    <Text style={styles.ressarcimento}>
                      {money(ressarcimentosPendentes)}
                    </Text>
                  </View>
                  <Toque
                    accessibilityRole="button"
                    accessibilityLabel="Abrir extrato de pagamentos"
                    onPress={() => setSecao("salario")}
                    style={styles.extrato}
                  >
                    <Text style={styles.extratoText}>Extrato</Text>
                  </Toque>
                </View>
              </View>

              <Toque
                accessibilityRole="button"
                accessibilityLabel="Férias"
                onPress={() => setSecao("ferias")}
                style={styles.feriasCard}
              >
                <View style={styles.iconeQuadro}>
                  <Icon name="sun" size={24} color="#7cc4ff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.feriasTitulo}>Férias</Text>
                  <Text style={styles.subtitulo}>
                    {proximasFerias
                      ? `Próximas: ${dataCurta(proximasFerias.data_inicio)} – ${dataCurta(proximasFerias.data_fim)}`
                      : "Nenhuma programada"}
                  </Text>
                </View>
                <Icon name="chevron-right" size={22} color={tema.suave} />
              </Toque>

              <View style={styles.lista}>
                {linha("user", "Dados pessoais", () => setSecao("dados"))}
                {linha(
                  "shield",
                  "Licenças e CMA",
                  () => {
                    setLicencasTab("licencas");
                    setSecao("licencas");
                  },
                  {
                    extra: (
                      <Text
                        style={{
                          color: situacaoCma === "Vencido" ? tema.perigo : VERDE,
                          fontSize: 14,
                        }}
                      >
                        {situacaoCma}
                      </Text>
                    ),
                  },
                )}
                {linha("file-text", "Documentos", () => setSecao("docs"))}
                {/* AJUSTAR: nomes das rotas abaixo */}
                {linha("map", "Relatórios de viagem", () =>
                  router.push("/relatorio-viagem"),
                )}
                {linha("tool", "Reports de manutenção", () =>
                  router.push("/manutencao"),
                )}
                {linha("log-out", "Sair", () => void logout(), {
                  cor: tema.perigo,
                  ultimo: true,
                })}
              </View>
            </>
          )}

          {secao === "dados" && (
            <View style={styles.card}>
              <View style={styles.between}>
                <Text style={styles.heading}>Dados pessoais</Text>
                <Toque onPress={() => setEditing(!editing)}>
                  <Text style={styles.link}>
                    {editing ? "Cancelar" : "Editar"}
                  </Text>
                </Toque>
              </View>
              {editing ? (
                <>
                  <Text style={styles.label}>Nome de exibição</Text>
                  <TextInput
                    style={styles.input}
                    value={displayName}
                    onChangeText={setDisplayName}
                  />
                  <Text style={styles.label}>Telefone</Text>
                  <TextInput
                    style={styles.input}
                    value={phone}
                    keyboardType="phone-pad"
                    onChangeText={setPhone}
                  />
                  <Toque
                    style={styles.primary}
                    disabled={!!busy}
                    onPress={() => void saveProfile()}
                  >
                    <Text style={styles.primaryText}>
                      {busy === "profile" ? "Salvando…" : "Salvar alterações"}
                    </Text>
                  </Toque>
                </>
              ) : (
                <>
                  {row("Nome completo", p?.nome_completo)}
                  {row("E-mail", p?.email_envio || p?.email)}
                  {row("Telefone", p?.telefone)}
                  {row("CANAC", canac)}
                  {row("Tipo de licença", data?.tripulante?.tipo_licenca)}
                  {row(
                    "Cidade/UF",
                    [p?.cidade, p?.uf].filter(Boolean).join(" / "),
                  )}
                  {row("Admissão", date(p?.data_admissao))}
                </>
              )}
            </View>
          )}

          {secao === "licencas" && (
            <>
              <View style={styles.tabs}>
                {(
                  [
                    ["licencas", "Licenças", "shield"],
                    ["horas", "Minhas horas", "bar-chart-2"],
                  ] as const
                ).map(([id, label, icon]) => (
                  <Toque
                    key={id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: licencasTab === id }}
                    onPress={() => setLicencasTab(id)}
                    style={[styles.tab, licencasTab === id && styles.tabActive]}
                  >
                    <Icon
                      name={icon}
                      size={17}
                      color={licencasTab === id ? tema.fundo : tema.suave}
                    />
                    <Text
                      style={[
                        styles.tabText,
                        licencasTab === id && { color: tema.fundo },
                      ]}
                    >
                      {label}
                    </Text>
                  </Toque>
                ))}
              </View>
              {licencasTab === "horas" ? (
                <HorasVoo />
              ) : (
                <>
                  <View style={styles.card}>
                    <View style={styles.between}>
                      <View>
                        <Text style={styles.kicker}>CERTIFICADO MÉDICO</Text>
                        <Text style={[styles.heading, { marginTop: 8 }]}>
                          CMA
                        </Text>
                      </View>
                      <Etiqueta
                        texto={situacaoCma}
                        alerta={situacaoCma === "Vencido"}
                      />
                    </View>
                    {row("Classe", data?.cma?.classe)}
                    {row("Validade", date(data?.cma?.validade))}
                    {!data?.cma && (
                      <Text style={styles.muted}>
                        Nenhum CMA cadastrado. Solicite a atualização à equipe
                        responsável.
                      </Text>
                    )}
                  </View>
                  <Text style={styles.section}>
                    MINHAS HABILITAÇÕES · {data?.habilitacoes?.length ?? "—"}
                  </Text>
                  {data?.habilitacoes === undefined ? (
                    <View style={styles.card}>
                      <Text style={styles.muted}>
                        Não foi possível consultar as habilitações. Atualize o
                        aplicativo e tente novamente.
                      </Text>
                    </View>
                  ) : !data.habilitacoes.length ? (
                    <View style={styles.card}>
                      <Text style={styles.muted}>
                        Nenhuma habilitação cadastrada.
                      </Text>
                    </View>
                  ) : (
                    data.habilitacoes.map((h) => (
                      <View key={h.id} style={styles.card}>
                        <View style={styles.between}>
                          <View>
                            <Text style={styles.heading}>
                              {h.tipo_habilitacao}
                            </Text>
                            <Text style={styles.secondary}>
                              Validade: {date(h.data_validade)}
                            </Text>
                          </View>
                          <Etiqueta
                            texto={situacaoValidade(h.data_validade)}
                            alerta={
                              situacaoValidade(h.data_validade) === "Vencido"
                            }
                          />
                        </View>
                      </View>
                    ))
                  )}
                </>
              )}
            </>
          )}

          {secao === "salario" && (
            <>
              <Text style={styles.section}>MEUS PAGAMENTOS</Text>
              {!salaries.length && (
                <View style={styles.card}>
                  <Text style={styles.muted}>
                    {paymentsError
                      ? "Não foi possível consultar seus pagamentos."
                      : "Nenhum pagamento registrado."}
                  </Text>
                </View>
              )}
              {salaries.map((x) => (
                <View key={x.id} style={styles.card}>
                  <View style={styles.between}>
                    <Text style={styles.heading}>
                      {x.rotulo || x.tipo_pagamento || "Pagamento"}
                    </Text>
                    <Text style={styles.status}>{x.status}</Text>
                  </View>
                  <Text style={styles.amount}>{money(x.valor_centavos)}</Text>
                  <Text style={styles.secondary}>
                    Competência {String(x.competencia_mes).padStart(2, "0")}/
                    {x.competencia_ano}
                  </Text>
                  <Text style={styles.muted}>
                    Pagamento: {date(x.data_pagamento || x.data_prevista)}
                  </Text>
                  {x.holerite_url && (
                    <Toque
                      style={styles.outline}
                      onPress={() =>
                        void openPrivate(
                          x.holerite_url || undefined,
                          "Holerite",
                          "application/pdf",
                        )
                      }
                    >
                      <Icon name="file-text" color={tema.destaque} size={16} />
                      <Text style={styles.link}>Abrir holerite</Text>
                    </Toque>
                  )}
                  {x.comprovante_url && (
                    <Toque
                      style={styles.outline}
                      onPress={() =>
                        void openPrivate(
                          x.comprovante_url || undefined,
                          "Comprovante de pagamento",
                          mimeFromPath(x.comprovante_url || ""),
                        )
                      }
                    >
                      <Icon name="paperclip" color={tema.destaque} size={16} />
                      <Text style={styles.link}>Comprovante</Text>
                    </Toque>
                  )}
                </View>
              ))}
            </>
          )}

          {secao === "ferias" && (
            <View style={styles.card}>
              <Text style={styles.heading}>Férias</Text>
              <Text style={styles.secondary}>
                Referência de 30 dias ·{" "}
                {data?.resumo_ferias?.dias_utilizados ?? "—"} dias aprovados
              </Text>
              <Text style={styles.muted}>
                *O saldo depende do fechamento do RH.
              </Text>
              <Toque
                style={styles.primary}
                onPress={() => router.push("/ferias")}
              >
                <Icon name="calendar" color={tema.fundo} size={17} />
                <Text style={styles.primaryText}>
                  Consultar e solicitar férias
                </Text>
              </Toque>
              {(data?.ferias || []).slice(0, 3).map((f) => (
                <View key={f.id} style={styles.infoRow}>
                  <Text style={styles.muted}>
                    {date(f.data_inicio)} — {date(f.data_fim)}
                  </Text>
                  <Text style={styles.infoValue}>{f.status}</Text>
                </View>
              ))}
            </View>
          )}

          {secao === "docs" && (
            <>
              <View style={styles.card}>
                <Text style={styles.heading}>Adicionar documento</Text>
                <Text style={styles.muted}>
                  PDF ou imagem até 10 MB, armazenados com acesso privado.
                </Text>
                <Text style={styles.label}>Categoria</Text>
                <View style={styles.categories}>
                  {[
                    "Documentos pessoais",
                    "CMA",
                    "Habilitação",
                    "Licença",
                    "Outros",
                  ].map((cat) => (
                    <Toque
                      key={cat}
                      style={[
                        styles.chip,
                        docCategory === cat && styles.chipActive,
                      ]}
                      onPress={() => setDocCategory(cat)}
                    >
                      <Text
                        style={{
                          color: docCategory === cat ? tema.fundo : tema.suave,
                          fontSize: 12,
                          fontWeight: "700",
                        }}
                      >
                        {cat}
                      </Text>
                    </Toque>
                  ))}
                </View>
                <Toque
                  style={styles.primary}
                  disabled={!!busy}
                  onPress={() => void uploadDoc()}
                >
                  <Icon name="upload" size={17} color={tema.fundo} />
                  <Text style={styles.primaryText}>
                    {busy === "doc"
                      ? "Enviando…"
                      : "Selecionar e enviar arquivo"}
                  </Text>
                </Toque>
              </View>
              <Text style={styles.section}>
                MEUS DOCUMENTOS · {documentsError ? "—" : docs.length}
              </Text>
              {!docs.length && (
                <View style={styles.card}>
                  <Text style={styles.muted}>
                    {documentsError
                      ? "Não foi possível consultar seus documentos."
                      : "Nenhum documento registrado."}
                  </Text>
                </View>
              )}
              {docs.map((d) => (
                <View key={d.id} style={styles.docRow}>
                  <Icon name="file" size={20} color={tema.destaque} />
                  <Toque
                    style={{ flex: 1 }}
                    onPress={() =>
                      void openPrivate(
                        d.arquivo_url ||
                          `/api/colaborador/documentos/${encodeURIComponent(d.id)}/arquivo`,
                        d.nome_arquivo,
                        d.mime_type || d.tipo_arquivo || "application/pdf",
                      )
                    }
                  >
                    <Text style={styles.link} numberOfLines={1}>
                      {d.nome_arquivo}
                    </Text>
                    <Text style={styles.muted}>
                      {d.tipo_documento || d.categoria || "Documento"} ·{" "}
                      {date(d.criado_em)}
                    </Text>
                  </Toque>
                  <Toque onPress={() => removeDoc(d)}>
                    <Icon name="trash-2" color="#ff9a9a" size={18} />
                  </Toque>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
export default PerfilScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tema.fundo },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerEsq: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 34, fontWeight: "800", color: tema.texto },
  titleSecao: { fontSize: 22, fontWeight: "800", color: tema.texto },
  iconBtn: {
    height: 44,
    width: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  hero: { alignItems: "center", marginTop: 8, marginBottom: 22 },
  avatarRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 4,
    borderColor: tema.destaque,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  name: { fontSize: 26, fontWeight: "800", color: tema.texto, marginTop: 16 },
  subtitulo: { fontSize: 14, color: tema.suave, marginTop: 4 },
  stats: { flexDirection: "row", gap: 12, marginBottom: 16 },
  stat: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 20,
    alignItems: "center",
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  statValue: { color: tema.texto, fontSize: 22, fontWeight: "800" },
  statLabel: { color: tema.suave, fontSize: 12, marginTop: 2 },
  salario: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    backgroundColor: "#173250",
    borderWidth: 1,
    borderColor: "#24476b",
  },
  salarioLabel: { color: tema.suave, fontSize: 14 },
  salarioValor: {
    color: tema.texto,
    fontSize: 34,
    fontWeight: "800",
    marginVertical: 6,
  },
  salarioStatus: { flexDirection: "row", alignItems: "center", gap: 8 },
  divisor: {
    height: 1,
    backgroundColor: "#2a4d73",
    marginVertical: 16,
  },
  ressarcimento: {
    color: tema.destaque,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 4,
  },
  extrato: {
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2a3a55",
  },
  extratoText: { color: tema.texto, fontSize: 16, fontWeight: "600" },
  feriasCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 24,
    marginBottom: 16,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  iconeQuadro: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1d3a5c",
  },
  feriasTitulo: { color: tema.texto, fontSize: 20, fontWeight: "700" },
  lista: {
    borderRadius: 24,
    backgroundColor: tema.superficie,
    borderWidth: 1,
    borderColor: tema.borda,
    overflow: "hidden",
  },
  listaLinha: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 60,
    paddingHorizontal: 18,
  },
  listaDivisor: { borderBottomWidth: 1, borderBottomColor: tema.borda },
  listaTexto: { flex: 1, color: tema.texto, fontSize: 18 },

  // detalhes das seções
  kicker: {
    fontSize: 9,
    color: tema.destaque,
    letterSpacing: 1.5,
    fontWeight: "800",
  },
  secondary: { fontSize: 13, color: tema.suave, marginTop: 6, lineHeight: 19 },
  tabs: { flexDirection: "row", gap: 8, paddingBottom: 18 },
  tab: {
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    borderRadius: 13,
    gap: 7,
    backgroundColor: tema.fundo,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  tabActive: { backgroundColor: tema.destaque, borderColor: tema.destaque },
  tabText: {
    fontSize: 11,
    fontWeight: "700",
    color: tema.suave,
    textAlign: "center",
  },
  card: {
    backgroundColor: tema.elevado,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  heading: { color: tema.texto, fontWeight: "800", fontSize: 16 },
  muted: { color: tema.suave, fontSize: 12, lineHeight: 19, marginTop: 4 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 9,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: tema.borda,
  },
  infoValue: {
    color: tema.texto,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
    flexShrink: 1,
  },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 9,
  },
  label: {
    color: tema.suave,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 15,
    marginBottom: 6,
  },
  input: {
    backgroundColor: tema.fundo,
    borderWidth: 1,
    borderColor: tema.borda,
    color: tema.texto,
    fontSize: 15,
    padding: 12,
    borderRadius: 10,
    minHeight: 47,
  },
  primary: {
    minHeight: 52,
    backgroundColor: tema.destaque,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 15,
  },
  primaryText: { color: tema.fundo, fontSize: 14, fontWeight: "800" },
  outline: {
    borderColor: tema.borda,
    borderWidth: 1,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    minHeight: 47,
    marginTop: 13,
  },
  link: { color: tema.destaque, fontSize: 13, fontWeight: "700" },
  status: {
    fontSize: 11,
    color: "#9be6c7",
    backgroundColor: "#194c3d",
    borderRadius: 7,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  section: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: tema.suave,
    marginTop: 13,
    marginBottom: 12,
  },
  amount: { fontSize: 24, fontWeight: "800", color: tema.texto, marginTop: 11 },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: {
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: tema.elevado,
  },
  chipActive: { backgroundColor: tema.destaque, borderColor: tema.destaque },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: tema.elevado,
    borderRadius: 20,
    padding: 15,
    marginBottom: 9,
  },
});