import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments, type Href } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/context/AppContext";
import { setUnauthorizedHandler } from "@/src/lib/session";
import { supabase } from "@/src/lib/supabase";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav({ session, authReady }: { session: Session | null; authReady: boolean }) {
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
      await supabase.auth.signOut();
      router.replace("/login" as Href);
    });
    return () => setUnauthorizedHandler(null);
  }, [router]);

  return (
    <Stack screenOptions={{ headerBackTitle: "Voltar" }}>
      <Stack.Screen name="login" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="novo-lancamento" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="preparacao-voo" options={{ headerShown: false }} />
      <Stack.Screen name="relatorio-viagem" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="manutencao" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="ferias" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="relatorio-voo" options={{ presentation: "modal", headerShown: false }} />
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
    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setAuthReady(true);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setSession(error ? null : data.session);
      setAuthReady(true);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
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
          <AppProvider>
            <GestureHandlerRootView>
              <KeyboardProvider>
                <RootLayoutNav session={session} authReady={authReady} />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </AppProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
