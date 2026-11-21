import React, { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Botao, ErroConsulta, Painel, Secao, Vazio, tema, u } from "./ui";
import { apiFetch } from "../lib/api";
import { abrirArquivoPrivado } from "../lib/arquivo-privado";
import { avisar } from "../lib/confirmar";
import { hoje } from "../lib/perfil";
type Grupo = {
  id: string;
  rotulo: string;
  minutos_voo: number;
  minutos_totais: number;
  lancamentos: number;
};
type Resultado = {
  filtros: {
    inicio: string | null;
    fim: string | null;
    aeronave_id: string | null;
  };
  resumo: {
    minutos_voo: number;
    minutos_totais: number;
    lancamentos: number;
    rascunhos: number;
  };
  aeronaves: { id: string; matricula: string }[];
  por_aeronave: Grupo[];
  por_mes: Grupo[];
};
const hh = (m: number) =>
  `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
const input = {
  minHeight: 48,
  borderRadius: 12,
  padding: 12,
  color: tema.texto,
  backgroundColor: tema.fundo,
  borderWidth: 1,
  borderColor: tema.borda,
  flex: 1,
};
export function HorasVoo() {
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [aeronave, setAeronave] = useState("");
  const [data, setData] = useState<Resultado | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const requestId = useRef(0);
  const load = useCallback(async (params = "") => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    setData(null);
    try {
      const result = await apiFetch<Resultado>(
        `/api/colaborador/minhas-horas${params}`,
      );
      if (id === requestId.current) {
        setData(result);
        setQuery(params);
      }
    } catch (e) {
      if (id === requestId.current)
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível consultar suas horas.",
        );
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);
  const applied = useRef("");
  useFocusEffect(
    useCallback(() => {
      void load(applied.current);
      return () => {
        requestId.current++;
      };
    }, [load]),
  );
  const apply = (a = inicio, b = fim, plane = aeronave) => {
    const valid = (v: string) =>
      !v ||
      (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
        Number.isFinite(Date.parse(v)) &&
        new Date(v).toISOString().slice(0, 10) === v);
    if (!valid(a) || !valid(b) || (a && b && a > b))
      return avisar(
        "Período inválido",
        "Use AAAA-MM-DD e confira a ordem das datas.",
      );
    const params = new URLSearchParams();
    if (a) params.set("inicio", a);
    if (b) params.set("fim", b);
    if (plane) params.set("aeronave_id", plane);
    const suffix = params.size ? `?${params}` : "";
    applied.current = suffix;
    void load(suffix);
  };
  const exportPdf = async () => {
    if (!data || loading || pdfBusy) return;
    setPdfBusy(true);
    try {
      await abrirArquivoPrivado(
        `/api/colaborador/minhas-horas/pdf${query}`,
        "Minhas-horas",
        "application/pdf",
      );
    } catch (e) {
      avisar(
        "Não foi possível exportar",
        e instanceof Error ? e.message : "Tente novamente.",
      );
    } finally {
      setPdfBusy(false);
    }
  };
  const group = (g: Grupo) => (
    <View
      key={g.id}
      style={{
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: tema.borda,
      }}
    >
      <Text style={{ color: tema.texto, fontWeight: "700" }}>
        {g.rotulo.match(/^\d{4}-\d{2}$/)
          ? `${g.rotulo.slice(5)}/${g.rotulo.slice(0, 4)}`
          : g.rotulo}
      </Text>
      <Text style={{ color: tema.suave, marginTop: 6, fontSize: 12 }}>
        Voo {hh(g.minutos_voo)} · Total {hh(g.minutos_totais)} · {g.lancamentos}{" "}
        lançamentos
      </Text>
    </View>
  );
  return (
    <>
      <Painel>
        <Text style={{ color: tema.texto, fontWeight: "700", marginBottom: 8 }}>
          Personalizar período
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={[u.note, { textAlign: "left", marginBottom: 5 }]}>
              Data inicial
            </Text>
            <TextInput
              accessibilityLabel="Data inicial das horas"
              value={inicio}
              onChangeText={setInicio}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={tema.suave}
              style={input}
              maxLength={10}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[u.note, { textAlign: "left", marginBottom: 5 }]}>
              Data final
            </Text>
            <TextInput
              accessibilityLabel="Data final das horas"
              value={fim}
              onChangeText={setFim}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={tema.suave}
              style={input}
              maxLength={10}
            />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 18, marginVertical: 16 }}>
          <Pressable
            onPress={() => {
              const d = hoje();
              setInicio(d.slice(0, 7) + "-01");
              setFim(d);
              apply(d.slice(0, 7) + "-01", d);
            }}
          >
            <Text style={u.link}>Este mês</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setInicio("");
              setFim("");
              setAeronave("");
              apply("", "", "");
            }}
          >
            <Text style={u.link}>Todo o histórico</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          contentContainerStyle={{ gap: 8, paddingBottom: 15 }}
          showsHorizontalScrollIndicator={false}
        >
          {[
            { id: "", matricula: "Todas as aeronaves" },
            ...(data?.aeronaves || []),
          ].map((a) => (
            <Pressable
              key={a.id}
              accessibilityRole="button"
              accessibilityState={{ selected: aeronave === a.id }}
              onPress={() => setAeronave(a.id)}
              style={{
                padding: 10,
                borderRadius: 10,
                backgroundColor: aeronave === a.id ? tema.elevado : tema.fundo,
                borderWidth: 1,
                borderColor: aeronave === a.id ? tema.azul : tema.borda,
              }}
            >
              <Text style={{ color: tema.texto, fontSize: 12 }}>
                {a.matricula}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Botao
          texto="Aplicar filtros"
          icone="filter"
          disabled={loading || pdfBusy}
          onPress={() => apply()}
        />
      </Painel>
      {loading ? (
        <ActivityIndicator color={tema.azul} />
      ) : error ? (
        <ErroConsulta
          mensagem={error}
          atualizar={() => void load(applied.current)}
        />
      ) : data ? (
        <>
          <Text style={[u.note, { marginBottom: 10 }]}>
            Período aplicado: {data.filtros.inicio || "Início do histórico"} a{" "}
            {data.filtros.fim || "Fim do histórico"} ·{" "}
            {data.aeronaves.find((a) => a.id === data.filtros.aeronave_id)
              ?.matricula || "Todas as aeronaves"}
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[
              { label: "Horas de voo", value: data.resumo.minutos_voo },
              { label: "Horas totais", value: data.resumo.minutos_totais },
            ].map((x) => (
              <View key={x.label} style={[u.panel, { flex: 1, padding: 14 }]}>
                <Text
                  style={{ color: tema.texto, fontSize: 25, fontWeight: "700" }}
                >
                  {hh(x.value)}
                </Text>
                <Text style={[u.note, { textAlign: "left" }]}>{x.label}</Text>
              </View>
            ))}
          </View>
          <Text style={[u.note, { textAlign: "left", marginBottom: 15 }]}>
            Horas:minutos · Voo: DEP–POU · Total: AC–COR.{"\n"}
            {data.resumo.lancamentos} lançamentos · {data.resumo.rascunhos}{" "}
            rascunhos incluídos, sujeitos à conferência.
          </Text>
          <Botao
            texto="Exportar horas em PDF"
            icone="download"
            carregando={pdfBusy}
            onPress={() => void exportPdf()}
            secundario
          />
          {!data.resumo.lancamentos ? (
            <Vazio
              titulo="Nenhum lançamento neste período"
              texto="Ajuste os filtros para consultar outros registros."
            />
          ) : (
            <>
              <Secao titulo="Por aeronave" />
              <Painel>{data.por_aeronave.map(group)}</Painel>
              <Secao titulo="Por mês" />
              <Painel>{data.por_mes.map(group)}</Painel>
            </>
          )}
        </>
      ) : null}
    </>
  );
}
