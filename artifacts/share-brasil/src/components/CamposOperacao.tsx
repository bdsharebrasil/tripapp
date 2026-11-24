import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { tema, Toque } from "./ui";

export function CampoTexto({
  rotulo,
  ...props
}: TextInputProps & { rotulo: string }) {
  return (
    <View style={s.grupo}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <TextInput
        accessibilityLabel={rotulo}
        style={s.campo}
        placeholderTextColor={tema.suave}
        autoCorrect={false}
        {...props}
      />
    </View>
  );
}

export function Escolha({
  rotulo,
  opcoes,
  valor,
  alterar,
}: {
  rotulo: string;
  opcoes: { id: string; nome: string }[];
  valor: string;
  alterar: (valor: string) => void;
}) {
  const [aberta, setAberta] = useState(false);
  const [busca, setBusca] = useState("");
  const nome = opcoes.find((item) => item.id === valor)?.nome;
  const filtradas = opcoes.filter((item) =>
    item.nome.toLocaleLowerCase().includes(busca.trim().toLocaleLowerCase()),
  );
  return (
    <View style={s.grupo}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <Toque
        accessibilityRole="button"
        accessibilityState={{ expanded: aberta }}
        accessibilityLabel={rotulo + ", " + (nome || "Selecionar")}
        style={s.campo}
        onPress={() => {
          setAberta(!aberta);
          setBusca("");
        }}
      >
        <Text style={s.texto}>{nome || "Selecionar"} ▾</Text>
      </Toque>
      {aberta && (
        <View style={s.grupo}>
          {opcoes.length > 8 && (
            <TextInput
              accessibilityLabel={`Buscar em ${rotulo}`}
              style={s.campo}
              placeholder="Buscar"
              placeholderTextColor={tema.suave}
              value={busca}
              onChangeText={setBusca}
            />
          )}
          {filtradas.map((item) => (
            <Toque
              key={item.id}
              accessibilityRole="button"
              style={s.opcao}
              onPress={() => {
                alterar(item.id);
                setAberta(false);
              }}
            >
              <Text style={s.texto}>{item.nome}</Text>
            </Toque>
          ))}
          {!filtradas.length && (
            <Text style={s.rotulo}>Nenhuma opção disponível.</Text>
          )}
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  grupo: { gap: 6 },
  rotulo: { color: tema.suave, fontSize: 14 },
  texto: { color: tema.texto, fontSize: 16 },
  campo: {
    color: tema.texto,
    borderWidth: 1,
    borderColor: tema.borda,
    borderRadius: 12,
    padding: 12,
    minHeight: 46,
    backgroundColor: tema.superficie,
  },
  opcao: { padding: 12, borderBottomWidth: 1, borderColor: tema.borda },
});
