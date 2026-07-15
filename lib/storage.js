import { supabase } from "./supabase";

const KEY = "irontrack:data";

// Carrega local + nuvem e fica com o MAIS RECENTE (evita a nuvem antiga
// sobrescrever uma edição local que ainda não sincronizou).
export async function loadRemote(userId) {
  let local = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) local = JSON.parse(raw);
  } catch {}
  let cloud = null;
  try {
    const { data, error } = await supabase
      .from("user_data")
      .select("data")
      .eq("user_id", userId)
      .maybeSingle();
    if (!error && data && data.data) cloud = data.data;
  } catch {}
  if (cloud && local) {
    return (cloud._updatedAt || 0) >= (local._updatedAt || 0) ? cloud : local;
  }
  return cloud || local;
}

let timer = null;
let pending = null;

async function flush() {
  if (!pending) return;
  const { userId, payload } = pending;
  pending = null;
  clearTimeout(timer);
  try {
    await supabase.from("user_data").upsert({
      user_id: userId,
      data: payload,
      updated_at: new Date().toISOString(),
    });
  } catch {}
}

// Salva: local na hora, nuvem com debounce curto.
// Se o app for fechado/minimizado, o flush dispara imediato (visibilitychange/pagehide)
// pra não perder edição no iPhone.
export function saveRemote(userId, data) {
  const payload = { ...data, _updatedAt: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {}
  pending = { userId, payload };
  clearTimeout(timer);
  timer = setTimeout(flush, 800);
}

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", () => flush());
}
