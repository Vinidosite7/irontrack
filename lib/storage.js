import { supabase } from "./supabase";

const KEY = "irontrack:data";

// Carrega: tenta a nuvem primeiro (fonte da verdade), cai pro cache local se offline.
export async function loadRemote(userId) {
  let local = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) local = JSON.parse(raw);
  } catch {}
  try {
    const { data, error } = await supabase
      .from("user_data")
      .select("data")
      .eq("user_id", userId)
      .maybeSingle();
    if (!error && data && data.data) return data.data;
  } catch {}
  return local;
}

// Salva: local na hora (zero latência), nuvem com debounce de 1.2s
// pra não martelar o Supabase a cada tecla.
let timer;
export function saveRemote(userId, payload) {
  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {}
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      await supabase.from("user_data").upsert({
        user_id: userId,
        data: payload,
        updated_at: new Date().toISOString(),
      });
    } catch {}
  }, 1200);
}
