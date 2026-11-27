import { Feather } from "@expo/vector-icons";
import { PdfView } from "react-native-better-pdf";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiUrl } from "@/src/lib/api";
import { getToken } from "@/src/lib/session";

type Props = {
  visible: boolean;
  path: string | null;
  title: string;
  onClose: () => void;
  onDownload?: () => void;
  downloadBusy?: boolean;
};
type PdfSource = {
  uri: string;
  headers: { Authorization: string };
};

export default function RelatorioPdfViewer({
  visible,
  path,
  title,
  onClose,
  onDownload,
  downloadBusy = false,
}: Props) {
  const [source, setSource] = useState<PdfSource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pageLabel, setPageLabel] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!visible || !path) {
      setSource(null);
      setLoading(false);
      setError("");
      setPageLabel("");
      return;
    }

    let active = true;
    setSource(null);
    setLoading(true);
    setError("");
    setPageLabel("");

    void (async () => {
      const token = await getToken();
      if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
      const uri = apiUrl(path);
      if (active) {
        setSource({ uri, headers: { Authorization: `Bearer ${token}` } });
      }
    })().catch((cause: unknown) => {
      if (!active) return;
      setLoading(false);
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível preparar o PDF.",
      );
    });

    return () => {
      active = false;
    };
  }, [visible, path, retryKey]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar visualização do PDF"
            hitSlop={10}
            onPress={onClose}
            style={styles.closeButton}
          >
            <Feather name="x" size={22} color="#FFFFFF" />
          </Pressable>
          <View style={styles.titleWrap}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {!!pageLabel && <Text style={styles.pageLabel}>{pageLabel}</Text>}
          </View>
          {onDownload ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Baixar arquivo PDF"
              disabled={downloadBusy}
              onPress={onDownload}
              style={[styles.downloadButton, downloadBusy && styles.disabled]}
            >
              {downloadBusy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="download" size={19} color="#FFFFFF" />
              )}
            </Pressable>
          ) : <View style={styles.headerSpacer} />}
        </View>

        <View style={styles.documentArea}>
          {source && !error && (
            <PdfView
              key={`${path}-${retryKey}`}
              source={source}
              style={styles.pdf}
              colorScheme="light"
              pageAccessibilityLabel="Página {page} de {pageCount}"
              onLoad={({ pageCount }) => {
                setLoading(false);
                setPageLabel(`1 de ${pageCount} páginas`);
              }}
              onPageChange={({ page, pageCount }) => {
                setPageLabel(`${page + 1} de ${pageCount} páginas`);
              }}
              onError={(pdfError) => {
                if (pdfError.page !== undefined) {
                  setPageLabel("Uma página não pôde ser renderizada");
                  return;
                }
                setLoading(false);
                setError(
                  "Não foi possível carregar o PDF. Verifique sua conexão e tente novamente.",
                );
              }}
            />
          )}

          {loading && !error && (
            <View style={styles.status} pointerEvents="none">
              <ActivityIndicator size="large" color="#4B9DFF" />
              <Text style={styles.statusText}>Carregando PDF…</Text>
            </View>
          )}

          {!!error && (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={28} color="#FF8792" />
              <Text style={styles.errorText}>{error}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setRetryKey((current) => current + 1)}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>Tentar novamente</Text>
              </Pressable>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07101E" },
  header: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#20314A",
    gap: 10,
  },
  closeButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#14243A",
  },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  pageLabel: { color: "#AFC1D7", fontSize: 11, marginTop: 3 },
  headerSpacer: { width: 42 },
  downloadButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#14243A",
  },
  disabled: { opacity: 0.55 },
  documentArea: { flex: 1, backgroundColor: "#30343B" },
  pdf: { flex: 1, width: "100%" },
  status: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "rgba(7, 16, 30, 0.72)",
  },
  statusText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  errorBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 14,
  },
  errorText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 4,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#398DE3",
  },
  retryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
