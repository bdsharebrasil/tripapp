import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export type Haptico = "selecao" | "leve" | "medio" | "sucesso" | "erro";

export function vibrar(tipo: Haptico = "leve") {
  if (Platform.OS === "web") return;
  const run = () => {
    switch (tipo) {
      case "selecao":
        return Haptics.selectionAsync();
      case "medio":
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case "sucesso":
        return Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      case "erro":
        return Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error,
        );
      default:
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };
  void run().catch(() => undefined);
}
