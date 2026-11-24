import { useLocalSearchParams } from "expo-router";
import { HorasVoo } from "@/src/components/HorasVoo";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
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
import { apiFetch } from "@/src/lib/api";
import { signOut } from "@/src/lib/session";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/src/components/Avatar";
import {
  Etiqueta,
  ErroConsulta,
  tema,
  u,
  Icon,
  Toque,
} from "@/src/components/ui";
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
const BG = tema.fundo,
  CARD = tema.superficie,
  BORDER = tema.borda,
  ACCENT = tema.destaque,
  MUTED = tema.suave;
const tabs = [
  { id: "dados", label: "Dados", icon: "user" },
  { id: "licencas", label: "Licenças", icon: "shield" },
  { id: "salario", label: "Salário", icon: "credit-card" },
  { id: "ferias", label: "Férias", icon: "sun" },
  { id: "docs", label: "Docs", icon: "file-text" },
] as const;
type Tab = (typeof tabs)[number]["id"];
const date = (d?: string | null) =>
  d ? d.slice(0, 10).split("-").reverse().join("/") : "—";
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

export function PerfilScreen({ initialTab }: { initialTab?: Tab } = {}) {
  const insets = useSafeAreaInsets(),
    router = useRouter();
  const { secao } = useLocalSearchParams<{ secao?: string }>();
  const [tab, setTab] = useState<Tab>(() => {
    if (initialTab) return initialTab;
    if (secao === "horas") return "licencas";
    return (
      (["dados", "licencas", "salario", "ferias", "docs"] as const).find(
        (section) => section === secao,
      ) ?? "dados"
    );
  });
  const [licencasTab, setLicencasTab] = useState<"licencas" | "horas">(
    secao === "horas" ? "horas" : "licencas",
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
  const row = (a: string, b: unknown) => (
    <View style={styles.infoRow}>
      <Text style={styles.muted}>{a}</Text>
      <Text style={styles.infoValue}>
        {b === null || b === undefined || b === "" ? "—" : String(b)}
      </Text>
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} style={[styles.root, { paddingTop: 8 }]}>
      <View style={styles.header}>
        <Toque
          accessibilityRole="button"
          accessibilityLabel="Atualizar perfil"
          accessibilityState={{ busy: refreshing || loading }}
          disabled={refreshing || loading}
          onPress={() => void load(true)}
          style={styles.iconBtn}
        >
          <Icon name="refresh-cw" color={ACCENT} size={18} />
        </Toque>
        <Toque
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
          accessibilityState={{ disabled: !!busy, busy: busy === "logout" }}
          disabled={!!busy}
          onPress={() => void logout()}
          style={styles.iconBtn}
        >
          {busy === "logout" ? (
            <ActivityIndicator size="small" color={tema.perigo} />
          ) : (
            <Icon name="log-out" color={tema.perigo} size={18} />
          )}
        </Toque>
      </View>
      <View style={styles.headerCopy}>
        <Text style={styles.title}>Meu perfil</Text>
        <Text style={styles.headerSubtitle}>
          Dados e documentos da tripulação
        </Text>
      </View>
      <View style={styles.sheet}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={[styles.tabs, { paddingHorizontal: 17 }]}
        >
          {tabs.map((t) => (
            <Toque
              key={t.id}
              accessibilityRole="button"
              accessibilityState={{ selected: tab === t.id }}
              onPress={() => setTab(t.id)}
              style={[styles.tab, tab === t.id && styles.tabActive]}
            >
              <Icon name={t.icon} size={17} color={tab === t.id ? BG : MUTED} />
              <Text style={[styles.tabText, tab === t.id && { color: BG }]}>
                {t.label}
              </Text>
            </Toque>
          ))}
        </ScrollView>
        {!!error && (
          <ErroConsulta mensagem={error} atualizar={() => void load(true)} />
        )}
        {loading ? (
          <ActivityIndicator color={ACCENT} style={{ marginTop: 36 }} />
        ) : (
          <ScrollView
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void load(true)}
                tintColor={ACCENT}
              />
            }
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: 17,
              paddingBottom: insets.bottom + 110,
            }}
          >
            <View style={styles.metrics}>
              <Toque style={styles.metric} onPress={() => setTab("licencas")}>
                <Text style={styles.metricValue}>
                  {situacaoValidade(data?.cma?.validade)}
                </Text>
                <Text style={styles.muted}>CMA</Text>
              </Toque>
              <Toque style={styles.metric} onPress={() => setTab("licencas")}>
                <Text style={styles.metricValue}>
                  {data?.habilitacoes?.length ?? "—"}
                </Text>
                <Text style={styles.muted}>Habilitações</Text>
              </Toque>
              <Toque style={styles.metric} onPress={() => setTab("docs")}>
                <Text style={styles.metricValue}>
                  {documentsError ? "—" : docs.length}
                </Text>
                <Text style={styles.muted}>Documentos</Text>
              </Toque>
            </View>
            {tab === "dados" && (
              <>
                <View style={styles.hero}>
                  <Avatar
                    nome={fullName}
                    disponivel={!!p?.foto_url}
                    versao={photoVersion}
                    tamanho={76}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{fullName}</Text>
                    <Text style={styles.secondary}>
                      {p?.departamento || p?.tipo_user || "Tripulação"}
                    </Text>
                    <Text style={styles.kicker}>
                      {p?.canac || data?.tripulante?.canac
                        ? `CANAC ${p?.canac || data?.tripulante?.canac}`
                        : "CANAC não informado"}
                    </Text>
                  </View>
                </View>
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
                          {busy === "profile"
                            ? "Salvando…"
                            : "Salvar alterações"}
                        </Text>
                      </Toque>
                    </>
                  ) : (
                    <>
                      {row("Nome completo", p?.nome_completo)}
                      {row("E-mail", p?.email_envio || p?.email)}
                      {row("Telefone", p?.telefone)}
                      {row("CANAC", p?.canac || data?.tripulante?.canac)}
                      {row("Tipo de licença", data?.tripulante?.tipo_licenca)}
                      {row(
                        "Cidade/UF",
                        [p?.cidade, p?.uf].filter(Boolean).join(" / "),
                      )}
                      {row("Admissão", date(p?.data_admissao))}
                    </>
                  )}
                </View>
              </>
            )}
            {tab === "licencas" && (
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
                      style={[
                        styles.tab,
                        licencasTab === id && styles.tabActive,
                      ]}
                    >
                      <Icon
                        name={icon}
                        size={17}
                        color={licencasTab === id ? BG : MUTED}
                      />
                      <Text
                        style={[
                          styles.tabText,
                          licencasTab === id && { color: BG },
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
                          texto={situacaoValidade(data?.cma?.validade)}
                          alerta={
                            situacaoValidade(data?.cma?.validade) === "Vencido"
                          }
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
            {tab === "salario" && (
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
                        <Icon name="file-text" color={ACCENT} size={16} />
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
                        <Icon name="paperclip" color={ACCENT} size={16} />
                        <Text style={styles.link}>Comprovante</Text>
                      </Toque>
                    )}
                  </View>
                ))}
              </>
            )}
            {tab === "ferias" && (
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
                  <Icon name="calendar" color={BG} size={17} />
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
            {tab === "docs" && (
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
                            color: docCategory === cat ? BG : MUTED,
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
                    <Icon name="upload" size={17} color={BG} />
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
                    <Icon name="file" size={20} color={ACCENT} />
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
            <View style={styles.footer}>
              <Avatar
                nome={fullName}
                disponivel={!!p?.foto_url}
                versao={photoVersion}
                tamanho={46}
              />
              <Toque
                accessibilityRole="button"
                accessibilityLabel="Atualizar foto do perfil"
                accessibilityState={{ disabled: !!busy }}
                disabled={!!busy}
                onPress={() => void uploadPhoto()}
                style={styles.footerPill}
              >
                {busy === "foto" ? (
                  <ActivityIndicator size="small" color={ACCENT} />
                ) : (
                  <>
                    <Icon name="camera" size={16} color={ACCENT} />
                    <Text style={styles.link}>Atualizar foto do perfil</Text>
                  </>
                )}
              </Toque>
            </View>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
export default PerfilScreen;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    paddingHorizontal: 18,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerCopy: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 20 },
  sheet: {
    flex: 1,
    backgroundColor: CARD,
    borderTopLeftRadius: 28,
    paddingTop: 18,
    overflow: "hidden",
  },
  tabsScroll: { flexGrow: 0 },
  kicker: {
    fontSize: 9,
    color: ACCENT,
    letterSpacing: 1.5,
    fontWeight: "800",
  },
  title: { fontSize: 24, fontWeight: "800", color: tema.texto, marginTop: 4 },
  headerSubtitle: { fontSize: 11, color: MUTED, marginTop: 2 },
  iconBtn: {
    height: 44,
    width: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
  },
  hero: {
    backgroundColor: BG,
    borderRadius: 24,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    borderWidth: 1,
    borderColor: BORDER,
  },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: 20,
    backgroundColor: tema.elevado,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: { width: 66, height: 66, borderRadius: 20 },
  avatarText: { color: tema.texto, fontWeight: "800", fontSize: 22 },
  name: { fontSize: 19, fontWeight: "800", color: tema.texto },
  secondary: { fontSize: 13, color: MUTED, marginTop: 6, lineHeight: 19 },
  tabs: { flexDirection: "row", gap: 8, paddingBottom: 18 },
  tab: {
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    borderRadius: 13,
    gap: 7,
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tabActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  tabText: {
    fontSize: 11,
    fontWeight: "700",
    color: MUTED,
    textAlign: "center",
  },
  card: {
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 17,
    padding: 16,
    marginBottom: 12,
  },
  heading: { color: tema.texto, fontWeight: "800", fontSize: 16 },
  muted: { color: MUTED, fontSize: 12, lineHeight: 19, marginTop: 4 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 9,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
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
    color: MUTED,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 15,
    marginBottom: 6,
  },
  input: {
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
    color: tema.texto,
    fontSize: 15,
    padding: 12,
    borderRadius: 10,
    minHeight: 47,
  },
  primary: {
    minHeight: 52,
    backgroundColor: ACCENT,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 15,
  },
  primaryText: { color: BG, fontSize: 14, fontWeight: "800" },
  outline: {
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    minHeight: 47,
    marginTop: 13,
  },
  link: { color: ACCENT, fontSize: 13, fontWeight: "700" },
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
    color: MUTED,
    marginTop: 13,
    marginBottom: 12,
  },
  amount: { fontSize: 24, fontWeight: "800", color: tema.texto, marginTop: 11 },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: {
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: tema.elevado,
  },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: BG,
    borderRadius: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 9,
  },
  metrics: { flexDirection: "row", gap: 9, marginBottom: 12 },
  metric: {
    flex: 1,
    height: 84,
    borderRadius: 14,
    padding: 12,
    justifyContent: "space-between",
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  metricValue: { color: tema.texto, fontSize: 18, fontWeight: "800" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
  },
  footerPill: {
    flex: 1,
    minHeight: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: tema.elevado,
    borderWidth: 1,
    borderColor: BORDER,
  },
  error: {
    padding: 13,
    backgroundColor: "#532735",
    borderRadius: 12,
    marginHorizontal: 18,
  },
});
