import { useColors } from "@/hooks/useColors";
import { Icon, Toque } from "@/src/components/ui";
import { apiFetch } from "@/src/lib/api";
import { avisar, confirmar } from "@/src/lib/confirmar";
import { useRouter } from "expo-router";
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
import { ConsultaClima } from "@/src/features/plano-voo/ConsultaClima";
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
import ConsultaAerodromo from "../consulta-aerodromo";

export default function PlanoVooScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [planos, setPlanos] = useState<PlanoVoo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [planoSelecionado, setPlanoSelecionado] = useState<PlanoVoo | null>(
    null,
  );
  const [abaPrincipal, setAbaPrincipal] = useState<
    "plano" | "aerodromos" | "clima" | "salvos"
  >("plano");
  const [abaPlano, setAbaPlano] = useState<
    "formulario" | "rota" | "resumo"
  >("formulario");
  const [versaoFormulario, setVersaoFormulario] = useState(0);

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
            accessibilityLabel="Criar novo plano de voo"
            style={[styles.newPlanButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setAbaPrincipal("plano");
              setAbaPlano("formulario");
              setVersaoFormulario((versao) => versao + 1);
            }}
          >
            <Icon name="plus" size={17} color="#FFFFFF" />
            <Text style={styles.newPlanText}>Novo plano</Text>
          </Toque>
        </View>
      </View>

      <View
        style={[
          styles.tabs,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {(
          [
            ["plano", "Plano", "airplane"],
            ["aerodromos", "Aeródromos", "map"],
            ["clima", "Clima", "cloud"],
            ["salvos", "Salvos", "save"],
          ] as const
        ).map(([id, label, icon]) => {
          const ativo = abaPrincipal === id;
          return (
            <Toque
              key={id}
              accessibilityRole="tab"
              accessibilityState={{ selected: ativo }}
              onPress={() => setAbaPrincipal(id)}
              style={[
                styles.tab,
                { backgroundColor: ativo ? colors.primary : "transparent" },
              ]}
            >
              <Icon
                name={icon}
                size={15}
                color={ativo ? "#FFFFFF" : colors.mutedForeground}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.tabText,
                  { color: ativo ? "#FFFFFF" : colors.mutedForeground },
                ]}
              >
                {label}
              </Text>
            </Toque>
          );
        })}
      </View>

      <View
        style={[styles.tabContent, abaPrincipal !== "plano" && styles.hidden]}
      >
        <NovoPlanoModal
          key={versaoFormulario}
          visivel={abaPrincipal === "plano"}
          inline
          aba={abaPlano}
          onAbaChange={setAbaPlano}
          onFechar={() => setAbaPrincipal("salvos")}
          onSalvar={salvarPlano}
          colors={colors}
        />
      </View>

      <View
        style={[
          styles.tabContent,
          abaPrincipal !== "aerodromos" && styles.hidden,
        ]}
      >
        <ConsultaAerodromo integrado />
      </View>

      <View
        style={[styles.tabContent, abaPrincipal !== "clima" && styles.hidden]}
      >
        <ConsultaClima colors={colors} />
      </View>

      <View
        style={[styles.tabContent, abaPrincipal !== "salvos" && styles.hidden]}
      >
        {carregando ? (
          <ActivityIndicator
            style={{ marginTop: 30 }}
            color={colors.secondary}
          />
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
                  <Text
                    style={[styles.emptyTitle, { color: colors.foreground }]}
                  >
                    Nenhum plano de voo
                  </Text>
                  <Text
                    style={[styles.emptySub, { color: colors.mutedForeground }]}
                  >
                    Toque em Novo plano para criar o primeiro
                  </Text>
                </View>
              )
            }
          />
        )}
      </View>

      <DetalheVoo
        plano={planoSelecionado}
        visivel={!!planoSelecionado}
        onFechar={() => setPlanoSelecionado(null)}
        onAbrirAerodromo={(icao) => {
          setPlanoSelecionado(null);
          router.push({ pathname: "/consulta-aerodromo", params: { icao } });
        }}
        onAbrirChecklist={(plano) => {
          setPlanoSelecionado(null);
          router.push({
            pathname: "/preparacao-plano",
            params: {
              id: plano.id,
              numero: plano.numeroVoo,
              adep: plano.partida,
              ades: plano.chegada,
            },
          });
        }}
        onAbrirPreparacaoOperacional={(solicitacaoId) => {
          setPlanoSelecionado(null);
          router.push({
            pathname: "/preparacao-voo",
            params: { id: solicitacaoId },
          });
        }}
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
  newPlanButton: {
    minHeight: 38,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  newPlanText: { color: "#FFFFFF", fontSize: 12, fontFamily: "Inter_700Bold" },
  tabs: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
    gap: 4,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  tabText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  tabContent: { flex: 1 },
  hidden: { display: "none" },
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
