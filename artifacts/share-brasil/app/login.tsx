import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { signIn } from "@/src/lib/session";
import { Icon, Toque } from "@/src/components/ui";

const EMAIL_DOMAIN = "share-brasil.com";
const C = {
  bg: "#0A1020",
  bgMid: "#101A33",
  bgEnd: "#141C2F",
  card: "rgba(20,28,47,0.92)",
  accent: "#F4C542",
  accentPressed: "#FFD563",
  onAccent: "#0A1020",
  text: "#EBEDFC",
  textSoft: "#D4D8EF",
  textMuted: "#B7BED7",
  danger: "#ff9aaa",
};
const REMEMBER_KEY = "sharebrasil.login.username";
const FLIGHT_ROUTES = [
  { y: 0.23, duration: 19000, delay: 0, size: 22, opacity: 0.34 },
  { y: 0.48, duration: 27000, delay: 5000, size: 16, opacity: 0.2 },
  { y: 0.72, duration: 23000, delay: 2000, size: 18, opacity: 0.25 },
  { y: 0.13, duration: 31000, delay: 9000, size: 14, opacity: 0.16 },
  { y: 0.86, duration: 25000, delay: 12000, size: 20, opacity: 0.22 },
];

function isValidUsername(value: string): boolean {
  return value.length > 0 && !/[\s@]/.test(value);
}

function FlightPlane({
  y,
  duration,
  delay,
  size,
  opacity,
  screenW,
  screenH,
}: (typeof FLIGHT_ROUTES)[number] & { screenW: number; screenH: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false),
    );
  }, [delay, duration, progress]);
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const fade = p < 0.15 ? p / 0.15 : p > 0.85 ? (1 - p) / 0.15 : 1;
    return {
      opacity: fade * opacity,
      transform: [
        { translateX: -40 + p * (screenW + 80) },
        { rotate: "90deg" },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", left: 0, top: screenH * y }, style]}
    >
      <Icon name="airplane" size={size} color={C.accent} />
    </Animated.View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [userFocused, setUserFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(REMEMBER_KEY)
      .then((saved) => {
        if (active && saved) {
          setUsername(saved);
          setRemember(true);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const fail = (message: string) => {
    setError(message);
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Error,
    ).catch(() => undefined);
  };
  const submit = async () => {
    if (busyRef.current) return;
    const user = username.trim();
    if (!user || !password) {
      fail("Preencha usuário e senha para continuar.");
      return;
    }
    if (!isValidUsername(user)) {
      fail("Informe apenas o usuário, sem espaços ou @.");
      return;
    }

    busyRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      if (remember) await AsyncStorage.setItem(REMEMBER_KEY, user);
      else await AsyncStorage.removeItem(REMEMBER_KEY);
      await signIn(user.toLowerCase(), password);
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => undefined);
      router.replace("/(tabs)");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message.toLowerCase() : "";
      if (/network|fetch|timeout|failed to connect/.test(message)) {
        fail("Sem conexão. Verifique sua internet e tente de novo.");
      } else if (
        /invalid login|invalid.*credential|wrong password|user not found|usuario_ou_senha/.test(
          message,
        )
      ) {
        fail("Usuário ou senha incorretos.");
      } else {
        fail("Não foi possível entrar. Confira seus dados e tente novamente.");
      }
    } finally {
      busyRef.current = false;
      setSubmitting(false);
    }
  };

  const canSubmit =
    isValidUsername(username) && password.length > 0 && !submitting;
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[C.bg, C.bgMid, C.bgEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {!reduceMotion &&
        FLIGHT_ROUTES.map((route, index) => (
          <FlightPlane
            key={index}
            {...route}
            screenW={width}
            screenH={height}
          />
        ))}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 18 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === "ios" ? "interactive" : "on-drag"
          }
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={
              reduceMotion
                ? undefined
                : FadeInDown.duration(600).springify().damping(18)
            }
            style={styles.card}
          >
            <Image
              source={require("../assets/images/logoshare.branco.png")}
              style={styles.logo}
              resizeMode="contain"
              accessible
              accessibilityLabel="Logo Share Brasil"
            />
            <Text style={styles.subtitle} maxFontSizeMultiplier={1.5}>
              Acesso ao Portal do Tripulante
            </Text>

            <Text style={styles.label}>Usuário</Text>
            <View style={[styles.field, userFocused && styles.fieldFocused]}>
              <Icon
                name="user"
                size={20}
                color={userFocused ? C.accent : "rgba(255,255,255,0.55)"}
              />
              <TextInput
                value={username}
                onChangeText={(value) => {
                  setError(null);
                  setUsername(value.replace(/[@\s]/g, "").toLowerCase());
                }}
                onFocus={() => setUserFocused(true)}
                onBlur={() => setUserFocused(false)}
                placeholder="seu.nome"
                placeholderTextColor="rgba(255,255,255,0.55)"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                textContentType="username"
                returnKeyType="next"
                editable={!submitting}
                onSubmitEditing={() => passwordRef.current?.focus()}
                accessibilityLabel="Usuário"
                accessibilityHint={`Seu e-mail será ${username || "usuario"}@${EMAIL_DOMAIN}`}
                style={styles.input}
              />
              <Text
                style={styles.suffix}
                adjustsFontSizeToFit
                numberOfLines={1}
              >
                @{EMAIL_DOMAIN}
              </Text>
            </View>

            <Text style={[styles.label, styles.passwordLabel]}>Senha</Text>
            <View style={[styles.field, passFocused && styles.fieldFocused]}>
              <Icon
                name="lock"
                size={20}
                color={passFocused ? C.accent : "rgba(255,255,255,0.55)"}
              />
              <TextInput
                ref={passwordRef}
                value={password}
                onChangeText={(value) => {
                  setError(null);
                  setPassword(value);
                }}
                onFocus={() => setPassFocused(true)}
                onBlur={() => setPassFocused(false)}
                placeholder="••••••••"
                placeholderTextColor="rgba(255,255,255,0.55)"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                editable={!submitting}
                onSubmitEditing={() => void submit()}
                accessibilityLabel="Senha"
                style={styles.input}
              />
              <Toque
                onPress={() => setShowPassword((shown) => !shown)}
                hitSlop={12}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword ? "Ocultar senha" : "Mostrar senha"
                }
              >
                <Icon
                  name={showPassword ? "eye-off" : "eye"}
                  size={21}
                  color="rgba(255,255,255,0.7)"
                />
              </Toque>
            </View>

            <Toque
              onPress={() => setRemember((value) => !value)}
              disabled={submitting}
              style={styles.rememberRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: remember }}
              accessibilityLabel="Lembrar meu acesso"
            >
              <View style={[styles.checkbox, remember && styles.checkboxOn]}>
                {remember && <Icon name="check" size={15} color={C.onAccent} />}
              </View>
              <Text style={styles.rememberText}>Lembrar meu acesso</Text>
            </Toque>

            {error && (
              <Text
                style={styles.error}
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
              >
                {error}
              </Text>
            )}
            <Toque
              onPress={() => void submit()}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel="Entrar"
              accessibilityState={{ disabled: !canSubmit, busy: submitting }}
              style={({ pressed }) => [
                styles.button,
                !canSubmit && styles.buttonDisabled,
                pressed && canSubmit && styles.buttonPressed,
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={C.onAccent} />
              ) : (
                <Text
                  style={[
                    styles.buttonText,
                    !canSubmit && styles.buttonTextDisabled,
                  ]}
                >
                  Entrar
                </Text>
              )}
            </Toque>
          </Animated.View>
          <Text style={styles.footer} maxFontSizeMultiplier={1.5}>
            Share Brasil · Portal do Tripulante
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: C.bg },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: C.card,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  logo: { alignSelf: "center", height: 82, width: 230, marginBottom: 4 },
  subtitle: {
    textAlign: "center",
    color: C.textMuted,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    marginTop: 2,
    marginBottom: 28,
  },
  label: {
    color: C.textSoft,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    marginBottom: 8,
    marginLeft: 4,
  },
  passwordLabel: { marginTop: 18 },
  field: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 16,
  },
  fieldFocused: {
    borderColor: "rgba(244,197,66,0.8)",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: C.text,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    minHeight: 56,
    paddingVertical: 12,
  },
  suffix: {
    color: "#B7BED7",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    maxWidth: 140,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    paddingHorizontal: 4,
    minHeight: 48,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: C.accent, borderColor: C.accent },
  rememberText: {
    color: C.textMuted,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  error: {
    color: C.danger,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginLeft: 4,
  },
  button: {
    minHeight: 58,
    borderRadius: 16,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    paddingHorizontal: 18,
  },
  buttonDisabled: { backgroundColor: "rgba(255,255,255,0.17)" },
  buttonPressed: { backgroundColor: C.accentPressed },
  buttonText: {
    color: C.onAccent,
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
  },
  buttonTextDisabled: { color: "#B7BED7" },
  footer: {
    color: "#B7BED7",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    textAlign: "center",
    marginTop: 20,
  },
});
