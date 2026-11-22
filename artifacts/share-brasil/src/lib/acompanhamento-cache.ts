import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getSession,
  getCachedSessionForOffline,
  onSessionChange,
} from "./session";
import type { VooAoVivo, Posicao } from "./acompanhamento";
export type LocalPonto = Posicao & { id: string; precisao_m: number };
export type CacheVoo = {
  voo: VooAoVivo | null;
  pontos: LocalPonto[];
  pendentes: LocalPonto[];
};
let ultimoUsuario: string | null = null;
export async function identidadeCache() {
  const s = await getSession().catch(() => getCachedSessionForOffline());
  ultimoUsuario = s?.user.id || null;
  return ultimoUsuario;
}
const chave = (user: string, voo: string) => `tripshare.live.${user}.${voo}`;
export async function lerCache(user: string, voo: string): Promise<CacheVoo> {
  const raw = await AsyncStorage.getItem(chave(user, voo));
  try {
    const c = JSON.parse(raw || "null");
    if (c && Array.isArray(c.pontos) && Array.isArray(c.pendentes)) return c;
  } catch {}
  return { voo: null, pontos: [], pendentes: [] };
}
export async function salvarCache(user: string, voo: string, data: CacheVoo) {
  // Persistência por usuário e voo: a fila só é removida após confirmação do Worker.
  if (ultimoUsuario !== user) return;
  await AsyncStorage.setItem(chave(user, voo), JSON.stringify(data));
  if (ultimoUsuario !== user) await AsyncStorage.removeItem(chave(user, voo));
}
onSessionChange((session) => {
  const old = ultimoUsuario;
  ultimoUsuario = session?.user.id || null;
  if (old && old !== ultimoUsuario)
    void AsyncStorage.getAllKeys().then((keys) =>
      AsyncStorage.multiRemove(
        keys.filter((k) => k.startsWith(`tripshare.live.${old}.`)),
      ),
    );
});
