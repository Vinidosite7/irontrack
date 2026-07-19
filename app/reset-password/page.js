"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const T = {
  bg: "#0a0c10", card: "rgba(20,24,31,0.9)", border: "#262c36",
  accent: "#F5A524", accent2: "#FFD27A", text: "#EDEBE6", muted: "#8b919c", red: "#f87171",
};

export default function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // supabase-js troca o token da URL por uma sessão de recuperação automaticamente
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async () => {
    if (pass.length < 6) return setMsg({ type: "err", text: "A senha precisa ter pelo menos 6 caracteres." });
    if (pass !== pass2) return setMsg({ type: "err", text: "As senhas não coincidem." });
    setLoading(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: pass });
      if (error) setMsg({ type: "err", text: "Não consegui atualizar: " + error.message });
      else setDone(true);
    } finally {
      setLoading(false);
    }
  };

  const input = {
    background: "#1c212a", border: `1px solid ${T.border}`, borderRadius: 12,
    color: T.text, padding: "13px 14px", fontSize: 15, width: "100%",
    boxSizing: "border-box", outline: "none", fontFamily: "Inter, sans-serif",
  };

  return (
    <div style={{
      minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center",
      justifyContent: "center", padding: 20, fontFamily: "Inter, -apple-system, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Inter:wght@400;600;700&display=swap');
        input:focus { border-color: ${T.accent} !important; }
        input::placeholder { color: #565b64; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 380, background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: 26 }}>
        <h1 style={{
          fontFamily: "'Oswald', sans-serif", fontSize: 24, margin: "0 0 18px",
          textTransform: "uppercase", letterSpacing: 2, fontWeight: 700, color: T.text, textAlign: "center",
        }}>
          Nova senha
        </h1>

        {done ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ color: T.text, fontSize: 14, lineHeight: 1.6 }}>Senha atualizada! Pode voltar pro app e entrar normal.</p>
            <a href="/" style={{ color: T.accent, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>← Voltar pro IronTrack</a>
          </div>
        ) : !ready ? (
          <p style={{ color: T.muted, fontSize: 13, textAlign: "center" }}>Confirmando o link de redefinição...</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input style={input} type="password" placeholder="Nova senha" value={pass} onChange={(e) => setPass(e.target.value)} />
            <input style={input} type="password" placeholder="Confirma a nova senha" value={pass2}
              onChange={(e) => setPass2(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
            {msg && (
              <div style={{
                fontSize: 13, padding: "10px 12px", borderRadius: 10,
                background: "rgba(248,113,113,0.12)", color: T.red, border: "1px solid rgba(248,113,113,0.3)",
              }}>{msg.text}</div>
            )}
            <button onClick={submit} disabled={loading} style={{
              background: `linear-gradient(110deg, ${T.accent} 40%, ${T.accent2} 50%, ${T.accent} 60%)`,
              color: "#0a0c10", border: "none", borderRadius: 12, padding: "13px 18px",
              fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: loading ? 0.7 : 1,
            }}>
              {loading ? "..." : "Salvar nova senha"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
