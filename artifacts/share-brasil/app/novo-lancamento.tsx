import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ScrollView, Text } from "react-native";
import { CampoTexto, Escolha } from "@/src/components/CamposOperacao";
import { Botao, Cabecalho, Tela, tema } from "@/src/components/ui";
import { ApiError, apiFetch } from "@/src/lib/api";
import {
  API_DIARIO,
  dataValida,
  minutosOperacao,
  naturezas,
  type ModoCelula,
} from "@/src/features/diario/modelo";

const camposHorario = [
  ["tempo_ac", "Acionamento"],
  ["tempo_dep", "Decolagem"],
  ["tempo_pou", "Pouso"],
  ["tempo_cor", "Corte"],
] as const;

export default function NovoLancamento() {
  const router = useRouter();
  const { aeronaveId, diarioMesId, competencia, matricula, modoAnterior } =
    useLocalSearchParams<{
      aeronaveId?: string;
      diarioMesId?: string;
      competencia?: string;
      matricula?: string;
      modoAnterior?: string;
    }>();
  const hoje = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(
    hoje.startsWith(competencia || "") ? hoje : competencia + "-01",
  );
  const [origem, setOrigem] = useState(""),
    [destino, setDestino] = useState("");
  const [pic, setPic] = useState(""),
    [sic, setSic] = useState(""),
    [natureza, setNatureza] = useState("");
  const [horarios, setHorarios] = useState({
    tempo_ac: "",
    tempo_dep: "",
    tempo_pou: "",
    tempo_cor: "",
  });
  const [mesId, setMesId] = useState(diarioMesId);
  const [modo, setModo] = useState<ModoCelula>(
    modoAnterior === "tvoo" ? "tvoo" : "tempo_total",
  );
  const [celula, setCelula] = useState(""),
    [revisao, setRevisao] = useState("");
  const [erro, setErro] = useState(""),
    [salvando, setSalvando] = useState(false);
  const duracao = minutosOperacao(
    camposHorario.map(([chave]) => horarios[chave]),
  );
  const primeiroMes = !mesId && !modoAnterior;
  const salvar = async () => {
    if (!aeronaveId || !competencia || salvando) return;
    if (
      !dataValida(data) ||
      !data.startsWith(competencia + "-") ||
      data > hoje
    ) {
      setErro("Informe uma data de voo dentro do mês selecionado, até hoje.");
      return;
    }
    if (
      !origem.trim() ||
      !destino.trim() ||
      !pic.trim() ||
      !natureza ||
      !duracao
    ) {
      setErro(
        "Confira a rota, o CANAC do comandante, a natureza e os quatro horários UTC.",
      );
      return;
    }
    if (sic.trim() && sic.trim() === pic.trim()) {
      setErro("Confira os CANAC do comandante e do copiloto.");
      return;
    }
    const decimal = /^\d+(?:[.,]\d+)?$/;
    if (
      primeiroMes &&
      (!decimal.test(celula) || (revisao && !decimal.test(revisao)))
    ) {
      setErro(
        "Informe a leitura inicial de célula em horas decimais e confira a próxima revisão.",
      );
      return;
    }
    setErro("");
    setSalvando(true);
    try {
      let id = mesId;
      if (!id) {
        const [ano, mes] = competencia.split("-").map(Number);
        const unidade = modo === "tvoo" ? "tvoo" : "ttotal";
        try {
          const criado = await apiFetch<{ id: string }>(API_DIARIO + "/mes", {
            method: "POST",
            body: JSON.stringify({
              aeronave_id: aeronaveId,
              ano,
              mes,
              modo_celula: modo,
              ...(primeiroMes
                ? {
                    ["celula_anterior_" + unidade]: Number(
                      celula.replace(",", "."),
                    ),
                  }
                : {}),
              ...(primeiroMes && revisao
                ? {
                    ["celula_prox_revisao_" + unidade]: Number(
                      revisao.replace(",", "."),
                    ),
                  }
                : {}),
            }),
          });
          id = criado.id;
        } catch (e) {
          const conflito =
            e instanceof ApiError && e.status === 409
              ? (e.body as { error?: string; id?: string } | null)
              : null;
          if (conflito?.error !== "diario_mes_ja_existe" || !conflito.id)
            throw e;
          id = conflito.id;
        }
        setMesId(id);
      }
      await apiFetch(API_DIARIO + "/lancamentos", {
        method: "POST",
        body: JSON.stringify({
          diario_mes_id: id,
          aeronave_id: aeronaveId,
          data_registro: data,
          aerodromo_partida: origem.trim(),
          aerodromo_chegada: destino.trim(),
          pic_canac: pic.trim(),
          sic_canac: sic.trim() || null,
          natureza_voo: natureza,
          ...horarios,
        }),
      });
      router.back();
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Não foi possível salvar o lançamento.",
      );
    } finally {
      setSalvando(false);
    }
  };
  return (
    <Tela>
      <Cabecalho
        apoio={matricula || "Diário de bordo"}
        titulo="Lançar horas de voo"
        voltar={() => router.back()}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 14, padding: 18, paddingBottom: 120 }}
      >
        {!aeronaveId || !competencia ? (
          <Botao
            texto="Escolher aeronave e mês"
            onPress={() => router.replace("/diario-bordo")}
          />
        ) : (
          <>
            {primeiroMes && (
              <>
                <Escolha
                  rotulo="Base da célula"
                  opcoes={[
                    { id: "tempo_total", nome: "Tempo total (AC–COR)" },
                    { id: "tvoo", nome: "Tempo de voo (DEP–POU)" },
                  ]}
                  valor={modo}
                  alterar={(v) => setModo(v as ModoCelula)}
                />
                <CampoTexto
                  rotulo="Célula no início do mês (horas decimais)"
                  keyboardType="decimal-pad"
                  value={celula}
                  onChangeText={setCelula}
                />
                <CampoTexto
                  rotulo="Próxima revisão (horas decimais, opcional)"
                  keyboardType="decimal-pad"
                  value={revisao}
                  onChangeText={setRevisao}
                />
              </>
            )}
            <CampoTexto
              rotulo="Data do acionamento UTC (AAAA-MM-DD)"
              value={data}
              onChangeText={setData}
              maxLength={10}
            />
            <CampoTexto
              rotulo="Aeródromo de partida"
              value={origem}
              onChangeText={setOrigem}
              autoCapitalize="characters"
            />
            <CampoTexto
              rotulo="Aeródromo de chegada"
              value={destino}
              onChangeText={setDestino}
              autoCapitalize="characters"
            />
            <CampoTexto
              rotulo="CANAC do comandante"
              value={pic}
              onChangeText={setPic}
              keyboardType="number-pad"
            />
            <CampoTexto
              rotulo="CANAC do copiloto (opcional)"
              value={sic}
              onChangeText={setSic}
              keyboardType="number-pad"
            />
            <Escolha
              rotulo="Natureza do voo"
              opcoes={naturezas.map((nome) => ({ id: nome, nome }))}
              valor={natureza}
              alterar={setNatureza}
            />
            {camposHorario.map(([chave, label]) => (
              <CampoTexto
                key={chave}
                rotulo={label + " (UTC)"}
                placeholder="HH:MM"
                value={horarios[chave]}
                maxLength={5}
                onChangeText={(v) =>
                  setHorarios((anterior) => ({ ...anterior, [chave]: v }))
                }
              />
            ))}
            {duracao && (
              <Text style={{ color: tema.texto }}>
                Tempo de voo {Math.floor(duracao.voo / 60)}h {duracao.voo % 60}m
                · Tempo total {Math.floor(duracao.total / 60)}h{" "}
                {duracao.total % 60}m
              </Text>
            )}
            {!!erro && (
              <Text accessibilityRole="alert" style={{ color: tema.perigo }}>
                {erro}
              </Text>
            )}
            <Botao
              texto="Salvar lançamento"
              carregando={salvando}
              onPress={() => void salvar()}
            />
          </>
        )}
      </ScrollView>
    </Tela>
  );
}
