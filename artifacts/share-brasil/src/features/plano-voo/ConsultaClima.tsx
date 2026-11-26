import { Icon, Toque } from "@/src/components/ui";
import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CartaoClima } from "./CartaoClima";
import { buscarClima, mensagemErro } from "./modelo";
import type { Clima, Cores } from "./modelo";

export function ConsultaClima({ colors }: { colors: Cores }) {
  const [icao, setIcao] = useState("");
  const [pesquisado, setPesquisado] = useState("");
  const [dados, setDados] = useState<Clima | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  const consultar = async () => {
    const codigo = icao.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(codigo)) {
      setErro("Informe um código ICAO de quatro letras, por exemplo SBGR.");
      setDados(null);
      return;
    }

    setCarregando(true);
    setErro("");
    setPesquisado(codigo);
    setDados(null);
    try {
      setDados(await buscarClima(codigo));
    } catch (cause) {
      setErro(mensagemErro(cause));
    } finally {
      setCarregando(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.heading}>
          <Icon name="cloud" size={18} color={colors.secondary} />
          <Text style={[styles.title, { color: colors.foreground }]}>
            Meteorologia aeronáutica
          </Text>
        </View>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          CÓDIGO ICAO
        </Text>
        <View style={styles.searchRow}>
          <TextInput
            accessibilityLabel="Código ICAO para consulta meteorológica"
            value={icao}
            onChangeText={(value) =>
              setIcao(
                value
                  .toUpperCase()
                  .replace(/[^A-Z]/g, "")
                  .slice(0, 4),
              )
            }
            onSubmitEditing={() => void consultar()}
            placeholder="Ex.: SBGR"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={4}
            returnKeyType="search"
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.foreground,
              },
            ]}
          />
          <Toque
            accessibilityRole="button"
            disabled={carregando}
            onPress={() => void consultar()}
            style={[styles.button, { backgroundColor: colors.primary }]}
          >
            {carregando ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Icon name="search" size={17} color="#FFFFFF" />
            )}
            <Text style={styles.buttonText}>Consultar</Text>
          </Toque>
        </View>
        <Text style={[styles.helper, { color: colors.mutedForeground }]}>
          Consulte METAR e TAF de um aeródromo.
        </Text>
      </View>

      {!!erro && (
        <Text style={[styles.error, { color: colors.destructive }]}>
          {erro}
        </Text>
      )}
      {!!pesquisado && (
        <CartaoClima
          icao={pesquisado}
          dados={dados}
          carregando={carregando}
          colors={colors}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  title: { fontSize: 16, fontFamily: "Inter_700Bold" },
  label: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    marginBottom: 6,
  },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  button: {
    minHeight: 42,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  buttonText: { color: "#FFFFFF", fontSize: 13, fontFamily: "Inter_700Bold" },
  helper: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8 },
  error: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
