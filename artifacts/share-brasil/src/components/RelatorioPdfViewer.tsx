import { Feather } from "@expo/vector-icons";
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
import { apiFetch, type ApiBinary } from "@/src/lib/api";

type Props = {
  visible: boolean;
  path: string | null;
  title: string;
  onClose: () => void;
  onDownload?: () => void;
  downloadBusy?: boolean;
};

const pdfFrameStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  border: 0,
  backgroundColor: "#FFFFFF",
};

export default function RelatorioPdfViewer({
  visible,
  path,
  title,
  onClose,
  onDownload,
  downloadBusy = false,
}: Props) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!visible || !path) {
      setPdfUrl(null);
      setLoading(false);
      setError("");
      return;
    }

    let active = true;
    let objectUrl: string | null = null;
    setPdfUrl(null);
    setLoading(true);
    setError("");

    void apiFetch<ApiBinary>(path, {
      responseType: "binary",
      headers: { Accept: "application/pdf" },
      maxBytes: 40 * 1024 * 1024,
    })
      .then(({ bytes, mime }) => {
        if (mime !== "application/pdf" || String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") {
          throw new Error("O servidor não retornou um PDF válido.");
        }
        const ownedBytes = new Uint8Array(bytes.length);
        ownedBytes.set(bytes);
        objectUrl = URL.createObjectURL(
          new Blob([ownedBytes.buffer], { type: "application/pdf" }),
        );
        if (active) {
          setPdfUrl(objectUrl);
          setLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setLoading(false);
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível carregar o PDF. Verifique sua conexão e tente novamente.",
        );
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [visible, path, retryKey]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar visualização do PDF"
            onPress={onClose}
            style={styles.headerButton}
          >
            <Feather name="x" size={21} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {onDownload ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Baixar arquivo PDF"
              disabled={downloadBusy}
              onPress={onDownload}
              style={[styles.headerButton, downloadBusy && styles.disabled]}
            >
              {downloadBusy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="download" size={19} color="#FFFFFF" />
              )}
            </Pressable>
          ) : <View style={styles.headerButton} />}
        </View>
        <View style={styles.documentArea}>
          {pdfUrl && !error && React.createElement("iframe", {
            title: `PDF: ${title}`,
            src: pdfUrl,
            style: pdfFrameStyle,
            allowFullScreen: true,
          })}
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
  headerButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#14243A",
  },
  title: { flex: 1, minWidth: 0, color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  documentArea: { flex: 1, backgroundColor: "#30343B" },
  status: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "rgba(7, 16, 30, 0.72)",
  },
  statusText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  errorBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 14 },
  errorText: { color: "#FFFFFF", textAlign: "center", fontSize: 15, lineHeight: 22 },
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
  disabled: { opacity: 0.55 },
});
