// Adaptado de Boarding Pass, Kokonut UI — Dorian Baffier, MIT.
// https://kokonutui.com/docs/cards/boarding-pass
import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type TextStyle,
} from "react-native";
import { tema, Icon, Toque } from "./ui";
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export type DadosCartaoVoo = {
  id: string;
  numero_voo?: string;
  origem?: string;
  destino?: string;
  data_agendada?: string;
  horario_previsto_agendamento?: string;
  matricula_registro?: string;
  modelo?: string;
  status?: string;
  cliente_razao_social?: string | null;
};
function useMovimentoReduzido() {
  const [reduce, setReduce] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (active) setReduce(v);
    });
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduce,
    );
    return () => {
      active = false;
      listener.remove();
    };
  }, []);
  return reduce;
}
function Digito({
  value,
  delay,
  reduce,
  style,
}: {
  value: string;
  delay: number;
  reduce: boolean;
  style?: TextStyle;
}) {
  const previous = useRef(value),
    animation = useRef(new Animated.Value(1)).current;
  const [old, setOld] = useState<string | null>(null);
  useEffect(() => {
    if (previous.current === value) return;
    setOld(previous.current);
    previous.current = value;
    animation.stopAnimation();
    animation.setValue(reduce ? 1 : 0);
    const run = Animated.timing(animation, {
      toValue: 1,
      duration: reduce ? 0 : 320,
      delay: reduce ? 0 : delay,
      easing: EASE_OUT,
      useNativeDriver: true,
    });
    run.start(({ finished }) => {
      if (finished) setOld(null);
    });
    return () => run.stop();
  }, [value, delay, reduce, animation]);
  return (
    <View accessible={false} style={{ overflow: "hidden" }}>
      {old !== null && !reduce && (
        <Animated.Text
          style={[
            style,
            {
              position: "absolute",
              opacity: animation.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0],
              }),
              transform: [
                {
                  translateY: animation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 24],
                  }),
                },
              ],
            },
          ]}
        >
          {old}
        </Animated.Text>
      )}
      <Animated.Text
        style={[
          style,
          {
            opacity: animation,
            transform: [
              {
                translateY: animation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-24, 0],
                }),
              },
            ],
          },
        ]}
      >
        {value === " " ? "\u00a0" : value}
      </Animated.Text>
    </View>
  );
}
function Flap({
  value,
  reduce,
  style,
}: {
  value: string;
  reduce: boolean;
  style?: TextStyle;
}) {
  const previous = useRef(value);
  let order = 0;
  const delays = [...value].map((c, i) =>
    previous.current[i] !== c ? order++ * 60 : 0,
  );
  useEffect(() => {
    previous.current = value;
  }, [value]);
  return (
    <View
      accessible
      accessibilityLabel={value}
      style={{ flexDirection: "row", flexWrap: "wrap" }}
    >
      {[...value].map((c, i) => (
        <Digito
          key={`${i}-${value.length}`}
          value={c}
          delay={delays[i]}
          reduce={reduce}
          style={style}
        />
      ))}
    </View>
  );
}
function Fade({
  value,
  reduce,
  style,
  duration = 220,
  delay = 0,
}: {
  value: string;
  reduce: boolean;
  style?: TextStyle;
  duration?: number;
  delay?: number;
}) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    anim.setValue(reduce ? 1 : 0);
    const run = Animated.timing(anim, {
      toValue: 1,
      duration: reduce ? 0 : duration,
      delay: reduce ? 0 : delay,
      easing: EASE_OUT,
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [value, reduce, duration, delay, anim]);
  return (
    <Animated.Text
      style={[
        style,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        },
      ]}
    >
      {value}
    </Animated.Text>
  );
}
function Campo({
  label,
  value,
  issued,
  reduce,
}: {
  label: string;
  value: string;
  issued: string;
  reduce: boolean;
}) {
  const changed = value !== issued;
  return (
    <View style={{ flex: 1, minWidth: 80 }}>
      <Text style={s.label}>{label}</Text>
      <Flap
        value={value}
        reduce={reduce}
        style={{ ...s.value, color: changed ? "#d6b58c" : tema.texto }}
      />
      <View style={{ minHeight: 18 }}>
        {changed && (
          <Fade
            value={issued}
            reduce={reduce}
            duration={240}
            delay={250}
            style={s.previous}
          />
        )}
      </View>
    </View>
  );
}
const date = (v?: string) =>
  v ? v.slice(0, 10).split("-").reverse().join("/") : "A definir";
const time = (v?: string) => v?.match(/\d{2}:\d{2}/)?.[0] || "—";
const statuses: Record<string, string> = {
  APROVADA: "Confirmado",
  APROVADO: "Confirmado",
  EM_SOLO: "Em solo",
  EM_ROTA: "Em voo",
  EM_VOO: "Em voo",
  ENCERRADA: "Encerrado",
  CONCLUIDO: "Concluído",
  CANCELADA: "Cancelado",
  CANCELADO: "Cancelado",
  PENDENTE: "Pendente",
};
/** Dados obrigatórios: nenhuma simulação, troca automática de status ou informação de poltrona. */
export function CartaoVoo({
  voo,
  onPress,
}: {
  voo: DadosCartaoVoo;
  onPress?: () => void;
}) {
  const reduce = useMovimentoReduzido();
  const [issued] = useState(() => ({
    aircraft: voo.matricula_registro || "A definir",
    date: date(voo.data_agendada),
    time: time(voo.horario_previsto_agendamento),
  }));
  const status = String(voo.status || "PROGRAMADO").toUpperCase();
  const label = statuses[status] || status.replace(/_/g, " ");
  const color = status.includes("CANCEL")
    ? tema.perigo
    : ["APROVADA", "APROVADO", "EM_ROTA", "EM_VOO"].includes(status)
      ? tema.verde
      : tema.azul;
  return (
    <Toque
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={
        onPress
          ? `Consultar voo ${voo.numero_voo || "programado"}, ${voo.origem || "origem a definir"} para ${voo.destino || "destino a definir"}`
          : undefined
      }
      style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
    >
      <View style={s.body}>
        <View style={s.row}>
          <View style={[s.row, { flex: 1, justifyContent: "flex-start" }]}>
            <View style={s.icon}>
              <Icon name="airplane" size={15} color={tema.fundo} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.number}>{voo.numero_voo || "Voo programado"}</Text>
            </View>
          </View>
          <View style={[s.badge, { backgroundColor: color + "15" }]}>
            <Fade
              value={label}
              reduce={reduce}
              style={{ color, fontSize: 11, fontFamily: "Inter_600SemiBold" }}
            />
          </View>
        </View>
        <View style={[s.row, { marginVertical: 24 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.airport}>{voo.origem || "—"}</Text>
            <Text style={s.label}>Origem</Text>
          </View>
          <View style={s.track}>
            <View style={s.dash} />
            <Icon name="airplane" size={20} color={tema.suave} />
            <View style={s.dash} />
          </View>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text style={s.airport}>{voo.destino || "—"}</Text>
            <Text style={s.label}>Destino</Text>
          </View>
        </View>
        <View style={[s.row, { flexWrap: "wrap", alignItems: "flex-start" }]}>
          <Campo
            label="Aeronave"
            value={voo.matricula_registro || "A definir"}
            issued={issued.aircraft}
            reduce={reduce}
          />
          <Campo
            label="Data"
            value={date(voo.data_agendada)}
            issued={issued.date}
            reduce={reduce}
          />
          <Campo
            label="Previsto · UTC"
            value={time(voo.horario_previsto_agendamento)}
            issued={issued.time}
            reduce={reduce}
          />
        </View>
        <Fade
          value={
            voo.cliente_razao_social ||
            voo.modelo ||
            "Horários, checklist e briefing do voo"
          }
          reduce={reduce}
          style={s.note}
        />
      </View>
      <View style={s.tear}>
        <View style={s.perforation} />
        <View style={[s.notch, { left: -11 }]} />
        <View style={[s.notch, { right: -11 }]} />
      </View>
      <View style={[s.row, s.footer]}>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={s.label}>ÁREA DA TRIPULAÇÃO</Text>
          <Text style={s.footerText}>
            {onPress ? "Consultar voo e operação →" : "Dados da operação"}
          </Text>
        </View>
      </View>
    </Toque>
  );
}
const s = StyleSheet.create({
  card: {
    backgroundColor: tema.superficie,
    borderRadius: 23,
    marginBottom: 12,
  },
  body: { padding: 18 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 9,
  },
  number: { color: "#F2F3F6", fontSize: 16, marginTop: 3 },
  icon: {
    backgroundColor: tema.azul,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 6,
    maxWidth: "45%",
    overflow: "hidden",
  },
  airport: {
    color: tema.texto,
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    letterSpacing: -1,
  },
  label: { color: tema.suave, fontSize: 10, marginBottom: 5, marginTop: 3 },
  track: { flex: 0.8, flexDirection: "row", alignItems: "center", gap: 6 },
  dash: {
    flex: 1,
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderColor: tema.borda,
  },
  value: {
    color: tema.texto,
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
  previous: {
    color: tema.suave,
    fontSize: 10,
    textDecorationLine: "line-through",
  },
  note: { color: tema.suave, fontSize: 11, lineHeight: 17, marginTop: 4 },
  tear: { height: 1, justifyContent: "center" },
  perforation: {
    marginHorizontal: 16,
    borderTopWidth: 2,
    borderStyle: "dashed",
    borderColor: tema.borda,
  },
  notch: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: tema.fundo,
    borderWidth: 1,
    borderColor: tema.borda,
  },
  footer: { padding: 18 },
  footerText: {
    color: tema.azul,
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    textAlign: "right",
  },
});
