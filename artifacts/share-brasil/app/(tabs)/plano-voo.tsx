import { useColors } from "@/hooks/useColors";
import { Icon, Toque } from "@/src/components/ui";
import { apiFetch } from "@/src/lib/api";
import { avisar, confirmar } from "@/src/lib/confirmar";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CartaoPlano } from "@/src/features/plano-voo/CartaoPlano";
import { DetalheVoo } from "@/src/features/plano-voo/DetalheVoo";
import {
  NovoPlano,
  PlanoRegistro,
  PlanoVoo,
  mensagemErro,
  paraPlano,
  paraRegistro,
} from "@/src/features/plano-voo/modelo";
import { NovoPlanoModal } from "@/src/features/plano-voo/NovoPlanoModal";

export default function PlanoVooScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [planos, setPlanos] = useState<PlanoVoo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mostrarNovo, setMostrarNovo] = useState(false);
  const [planoSelecionado, setPlanoSelecionado] = useState<PlanoVoo | null>(
    null,
  );

  const carregar = useCallback(async () => {
    setErro("");
    try {
      const registros = await apiFetch<PlanoRegistro[]>(
        "/api/interno/planos-voo?mine=true",
      );
      setPlanos(Array.isArray(registros) ? registros.map(paraPlano) : []);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const ordenados = useMemo(
    () => [...planos].sort((a, b) => b.data.localeCompare(a.data)),
    [planos],
  );

  const salvarPlano = async (novo: NovoPlano): Promise<boolean> => {
    try {
      await apiFetch("/api/interno/planos-voo", {
        method: "POST",
        body: JSON.stringify(paraRegistro(novo)),
      });
      await carregar();
      return true;
    } catch (e) {
      avisar("Falha ao salvar", mensagemErro(e));
      return false;
    }
  };

  const excluirPlano = (id: string) =>
    confirmar(
      "Excluir plano",
      "Deseja remover este plano de voo?",
      async () => {
        try {
          await apiFetch(`/api/interno/planos-voo/${encodeURIComponent(id)}`, {
            method: "DELETE",
          });
          setPlanos((lista) => lista.filter((p) => p.id !== id));
        } catch (e) {
          avisar("Falha ao excluir", mensagemErro(e));
        }
      },
      true,
    );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 16,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>
          Plano de Voo
        </Text>
        <View style={styles.headerActions}>
          <Toque
            accessibilityRole="button"
            accessibilityLabel="Atualizar planos"
            style={[styles.iconBtn, { backgroundColor: colors.muted }]}
            onPress={() => {
              setCarregando(true);
              void carregar();
            }}
          >
            <Icon name="refresh-cw" size={18} color={colors.foreground} />
          </Toque>
          <Toque
            accessibilityRole="button"
            accessibilityLabel="Novo plano de voo"
            style={[styles.iconBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setMostrarNovo(true);
            }}
          >
            <Icon name="plus" size={20} color="#FFFFFF" />
          </Toque>
        </View>
      </View>

      {carregando ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={colors.secondary} />
      ) : (
        <FlatList
          data={ordenados}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CartaoPlano
              plano={item}
              onAbrir={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPlanoSelecionado(item);
              }}
              onExcluir={() => excluirPlano(item.id)}
              colors={colors}
            />
          )}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: 90 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            erro ? (
              <Text style={[styles.erro, { color: colors.destructive }]}>
                {erro}
              </Text>
            ) : undefined
          }
          ListEmptyComponent={
            erro ? undefined : (
              <View style={styles.empty}>
                <Icon
                  name="navigation"
                  size={40}
                  color={colors.mutedForeground}
                />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  Nenhum plano de voo
                </Text>
                <Text
                  style={[styles.emptySub, { color: colors.mutedForeground }]}
                >
                  Toque em + para criar o primeiro plano
                </Text>
              </View>
            )
          }
        />
      )}

      <NovoPlanoModal
        visivel={mostrarNovo}
        onFechar={() => setMostrarNovo(false)}
        onSalvar={salvarPlano}
        colors={colors}
      />
      <DetalheVoo
        plano={planoSelecionado}
        visivel={!!planoSelecionado}
        onFechar={() => setPlanoSelecionado(null)}
        colors={colors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  headerActions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { padding: 16 },
  erro: { padding: 12, fontSize: 13, fontFamily: "Inter_400Regular" },
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptySub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
