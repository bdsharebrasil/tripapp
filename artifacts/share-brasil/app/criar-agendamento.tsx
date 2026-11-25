import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, ScrollView, Text } from "react-native";
import { CampoTexto, Escolha } from "@/src/components/CamposOperacao";
import {
  Botao,
  Cabecalho,
  ErroConsulta,
  Tela,
  tema,
} from "@/src/components/ui";
import { apiFetch } from "@/src/lib/api";
import { avisar } from "@/src/lib/confirmar";
import { hoje, type PerfilCompleto } from "@/src/lib/perfil";
import { dataValida, horaValida } from "@/src/features/diario/modelo";

type Opcoes = {
  aeronaves: { id: string; matricula_registro: string }[];
  clientes: { id: string; nome: string }[];
  socios: { id: string; nome: string }[];
  vinculos: {
    aeronave_id: string;
    cliente_id?: string;
    socio_id?: string;
    codigo_cliente?: string;
  }[];
};

export default function CriarAgendamento() {
  const router = useRouter();
  const lista = useQuery({
    queryKey: ["opcoes-agendamento"],
    queryFn: () => apiFetch<Opcoes>("/api/interno/agendamento/opcoes"),
  });
  const perfil = useQuery({
    queryKey: ["perfil-agendamento"],
    queryFn: () => apiFetch<PerfilCompleto>("/api/colaborador/perfil"),
  });
  const [aeronave, setAeronave] = useState(""),
    [titular, setTitular] = useState("");
  const [origem, setOrigem] = useState(""),
    [destino, setDestino] = useState("");
  const [data, setData] = useState(hoje),
    [hora, setHora] = useState("");
  const [funcao, setFuncao] = useState("piloto_id");
  const [salvando, setSalvando] = useState(false),
    [erro, setErro] = useState("");
  const opcoes = lista.data;
  const vinculos =
    opcoes?.vinculos.filter(
      (v) => v.aeronave_id === aeronave && v.codigo_cliente?.trim(),
    ) || [];
  const titulares = [
    ...(opcoes?.clientes
      .filter((c) => vinculos.some((v) => v.cliente_id === c.id))
      .map((c) => ({ ...c, id: "cliente:" + c.id })) || []),
    ...(opcoes?.socios
      .filter((s) => vinculos.some((v) => v.socio_id === s.id))
      .map((s) => ({ ...s, id: "socio:" + s.id })) || []),
  ];
  const tripulante = perfil.data?.tripulante;
  const salvar = async () => {
    if (salvando) return;
    if (
      !aeronave ||
      !titular ||
      !origem.trim() ||
      !destino.trim() ||
      !dataValida(data) ||
      (hora && !horaValida(hora))
    ) {
      setErro(
        "Selecione a aeronave e o titular e confira a rota, a data e o horário.",
      );
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      const [tipo, id] = titular.split(":");
      await apiFetch("/api/interno/agendamento", {
        method: "POST",
        body: JSON.stringify({
          aeronave_id: aeronave,
          [tipo + "_id"]: id,
          origem: origem.trim(),
          destino: destino.trim(),
          data_agendada: data,
          horario_previsto_agendamento: hora || undefined,
          ...(tripulante?.id ? { [funcao]: tripulante.id } : {}),
        }),
      });
      router.back();
      avisar("Agendamento criado", "O agendamento aguarda aprovação.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao criar o agendamento.");
    } finally {
      setSalvando(false);
    }
  };
  return (
    <Tela>
      <Cabecalho
        titulo="Criar agendamento"
        apoio="Meus voos"
        voltar={() => router.back()}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 14, padding: 18, paddingBottom: 120 }}
      >
        {lista.isPending || perfil.isPending ? (
          <ActivityIndicator />
        ) : lista.isError || perfil.isError ? (
          <ErroConsulta
            mensagem="Não foi possível carregar as opções de agendamento."
            atualizar={() => {
              void lista.refetch();
              void perfil.refetch();
            }}
          />
        ) : (
          <>
            <Escolha
              rotulo="Aeronave"
              opcoes={(opcoes?.aeronaves || []).map((a) => ({
                id: a.id,
                nome: a.matricula_registro,
              }))}
              valor={aeronave}
              alterar={(id) => {
                setAeronave(id);
                setTitular("");
              }}
            />
            {!!aeronave && (
              <Escolha
                key={aeronave}
                rotulo="Titular"
                opcoes={titulares}
                valor={titular}
                alterar={setTitular}
              />
            )}
            {tripulante?.id && (
              <Escolha
                rotulo="Minha função no voo"
                opcoes={[
                  { id: "piloto_id", nome: "Comandante" },
                  { id: "copiloto_id", nome: "Copiloto" },
                ]}
                valor={funcao}
                alterar={setFuncao}
              />
            )}
            <CampoTexto
              rotulo="Origem"
              value={origem}
              onChangeText={setOrigem}
              autoCapitalize="characters"
            />
            <CampoTexto
              rotulo="Destino"
              value={destino}
              onChangeText={setDestino}
              autoCapitalize="characters"
            />
            <CampoTexto
              rotulo="Data (AAAA-MM-DD)"
              value={data}
              onChangeText={setData}
              maxLength={10}
            />
            <CampoTexto
              rotulo="Horário previsto em Brasília (opcional)"
              placeholder="HH:MM"
              value={hora}
              onChangeText={setHora}
              maxLength={5}
            />
            {!!erro && (
              <Text accessibilityRole="alert" style={{ color: tema.perigo }}>
                {erro}
              </Text>
            )}
            <Botao
              texto="Criar agendamento"
              carregando={salvando}
              onPress={() => void salvar()}
            />
          </>
        )}
      </ScrollView>
    </Tela>
  );
}
