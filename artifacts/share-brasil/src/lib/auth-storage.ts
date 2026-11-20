import AsyncStorage from "@react-native-async-storage/async-storage";
import { gcm } from "@noble/ciphers/aes.js";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { fromByteArray, toByteArray } from "base64-js";
import { Platform } from "react-native";

const SESSION_KEY = "sharebrasil.supabase.session.v1";
const CIPHER_KEY = "sharebrasil.supabase.session.key.v1";
const webMemory = new Map<string, string>();

function encodeUtf8(value: string): Uint8Array {
  const binary = unescape(encodeURIComponent(value));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
function decodeUtf8(bytes: Uint8Array): string {
  const escaped = Array.from(bytes, (byte) => `%${byte.toString(16).padStart(2, "0")}`).join("");
  return decodeURIComponent(escaped);
}

function readWeb(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? webMemory.get(key) ?? null;
  } catch {
    return webMemory.get(key) ?? null;
  }
}
function writeWeb(key: string, value: string): void {
  webMemory.set(key, value);
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // A sessão continua disponível em memória se o browser bloquear o storage.
  }
}
function removeWeb(key: string): void {
  webMemory.delete(key);
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // Sem ação adicional.
  }
}
function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("Chave de sessão inválida");
  return Uint8Array.from(hex.match(/.{2}/g)!, (byte) => Number.parseInt(byte, 16));
}
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function getOrCreateCipherKey(): Promise<Uint8Array> {
  let saved = await SecureStore.getItemAsync(CIPHER_KEY);
  if (!saved) {
    saved = bytesToHex(Crypto.getRandomBytes(32));
    await SecureStore.setItemAsync(CIPHER_KEY, saved, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  return hexToBytes(saved);
}

/** AsyncStorage contém apenas ciphertext autenticado; a chave AES-256 fica no Keychain/Keystore. */
export const encryptedSupabaseStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") return readWeb(key);
    const saved = await AsyncStorage.getItem(`${SESSION_KEY}.${key}`);
    if (!saved) return null;
    try {
      const [version, nonce64, cipher64] = saved.split(":");
      if (version !== "v1" || !nonce64 || !cipher64) throw new Error("Formato inválido");
      const clear = gcm(await getOrCreateCipherKey(), toByteArray(nonce64)).decrypt(toByteArray(cipher64));
      return decodeUtf8(clear);
    } catch {
      // Dados sem chave ou corrompidos não podem ser recuperados com segurança.
      await AsyncStorage.removeItem(`${SESSION_KEY}.${key}`);
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      writeWeb(key, value);
      return;
    }
    const nonce = Crypto.getRandomBytes(12);
    const encrypted = gcm(await getOrCreateCipherKey(), nonce).encrypt(encodeUtf8(value));
    await AsyncStorage.setItem(`${SESSION_KEY}.${key}`, `v1:${fromByteArray(nonce)}:${fromByteArray(encrypted)}`);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === "web") {
      removeWeb(key);
      return;
    }
    await AsyncStorage.removeItem(`${SESSION_KEY}.${key}`);
  },
};
