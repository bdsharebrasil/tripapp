import { Alert, Platform } from "react-native";
export function confirmar(
  titulo: string,
  mensagem: string,
  acao: () => void,
  destrutivo = false,
) {
  if (Platform.OS === "web") {
    if (globalThis.confirm(`${titulo}\n\n${mensagem}`)) acao();
    return;
  }
  Alert.alert(titulo, mensagem, [
    { text: "Cancelar", style: "cancel" },
    {
      text: "Confirmar",
      style: destrutivo ? "destructive" : "default",
      onPress: acao,
    },
  ]);
}
export function avisar(titulo: string, mensagem: string) {
  if (Platform.OS === "web") globalThis.alert(`${titulo}\n\n${mensagem}`);
  else Alert.alert(titulo, mensagem);
}
