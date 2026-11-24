import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Redirect,
  Stack,
  useRouter,
  useSegments,
  type Href,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { AppState, Platform, View } from "react-native";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Session } from "@/src/lib/session";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { tema } from "@/src/components/ui";
import { setUnauthorizedHandler } from "@/src/lib/session";
import {
  getSession,
  getCachedSessionForOffline,
  onSessionChange,
} from "@/src/lib/session";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav({
  session,
  authReady,
}: {
  session: Session | null;
  authReady: boolean;
}) {
  const router = useRouter();
  const segments = useSegments();
  const currentRoot = segments[0] as string | undefined;

  useEffect(() => {
    if (!authReady || !currentRoot) return;
    if (!session && currentRoot !== "login") router.replace("/login" as Href);
    else if (session && currentRoot === "login") router.replace("/(tabs)");
  }, [authReady, currentRoot, router, session]);

  useEffect(() => {
    setUnauthorizedHandler(async () => {
      router.replace("/login" as Href);
    });
    return () => setUnauthorizedHandler(null);
  }, [router]);

  if (!session && currentRoot !== "login") return <Redirect href="/login" />;

  return (
    <Stack
      key={session?.user.id || "login"}
      screenOptions={{ headerBackTitle: "Voltar" }}
    >
      <Stack.Screen
        name="login"
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="novo-lancamento"
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen name="preparacao-voo" options={{ headerShown: false }} />
      <Stack.Screen
        name="relatorio-viagem"
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="manutencao"
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="ferias"
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen
        name="relatorio-voo"
        options={{ presentation: "modal", headerShown: false }}
      />
      <Stack.Screen name="acompanhar-voo" options={{ headerShown: false }} />
      <Stack.Screen name="minhas-horas" options={{ headerShown: false }} />
      <Stack.Screen name="diario-bordo" options={{ headerShown: false }} />
      <Stack.Screen name="notificacoes" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") {
      try {
        for (const key of [
          "profile",
          "flights",
          "flightPlans",
          "travelReports",
          "maintenance",
          "vacations",
          "financial",
        ])
          globalThis.localStorage?.removeItem(`sb:${key}`);
      } catch {
        /* storage opcional */
      }
    }
    let active = true;
    const unsubscribe = onSessionChange((next) => {
      if (!active) return;
      queryClient.clear();
      setSession(next);
      setAuthReady(true);
    });
    const refresh = () =>
      void getSession()
        .then((next) => {
          if (active) {
            setSession(next);
            setAuthReady(true);
          }
        })
        .catch(async () => {
          const cached = await getCachedSessionForOffline();
          if (active) {
            setSession(cached);
            setAuthReady(true);
          }
        });
    refresh();
    const timer = setInterval(refresh, 30000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      active = false;
      unsubscribe();
      clearInterval(timer);
      listener.remove();
    };
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && authReady) void SplashScreen.hideAsync();
  }, [authReady, fontError, fontsLoaded]);

  if ((!fontsLoaded && !fontError) || !authReady) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView
            style={{ flex: 1, backgroundColor: tema.fundo }}
          >
            <View
              style={{
                flex: 1,
                width: "100%",
                maxWidth: 720,
                alignSelf: "center",
              }}
            >
              <KeyboardProvider>
                <RootLayoutNav session={session} authReady={authReady} />
              </KeyboardProvider>
            </View>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
