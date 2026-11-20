import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { encryptedSupabaseStorage } from "./auth-storage";

const configuredUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
const configuredKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
export const isSupabaseConfigured = Boolean(configuredUrl && configuredKey);

// Mantém a inicialização do app estável quando as variáveis ainda não estiverem
// disponíveis; o login apresenta uma mensagem compreensível nesse caso.
export const supabase = createClient(
  configuredUrl || "https://missing-project.supabase.co",
  configuredKey || "missing-public-anon-key",
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      storage: encryptedSupabaseStorage,
    },
  },
);

if (Platform.OS !== "web") {
  // Migra de forma segura a versão anterior, que guardava somente o JWT bruto.
  void SecureStore.deleteItemAsync("sharebrasil.session.token").catch(() => undefined);
  if (AppState.currentState === "active") supabase.auth.startAutoRefresh();
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
