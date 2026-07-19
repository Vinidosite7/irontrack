"use client";
import { useState } from "react";
import { supabase } from "../lib/supabase";

const T = {
  bg: "#0a0c10", card: "rgba(20,24,31,0.9)", border: "#262c36",
  accent: "#F5A524", accent2: "#FFD27A", text: "#EDEBE6", muted: "#8b919c", red: "#f87171",
};

export default function Auth() {
  const [mode, setMode] = useState("login"); // login | signup | forgot
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (mode === "forgot") {
      if (!email.trim()) return setMsg({ type: "err", text: "Digita seu e-mail." });
      setLoading(true);
      setMsg(null);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined,
        });
        if (error) setMsg({ type: "err", text: "Não consegui enviar: " + error.message });
        else setMsg({ type: "ok", text: "Se esse e-mail tiver uma conta, o link de redefinição já foi enviado. Confere a caixa de entrada (e o spam)." });
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email.trim() || !pass) return setMsg({ type: "err", text: "Preenche e-mail e senha." });
    setLoading(true);
    setMsg(null);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
        if (error) setMsg({ type: "err", text: "Login falhou: " + error.message });
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: pass });
        if (error) setMsg({ type: "err", text: "Cadastro falhou: " + error.message });
        else if (data.user && !data.session) setMsg({ type: "ok", text: "Conta criada! Confirma o e-mail pra entrar (ou desative a confirmação no Supabase)." });
      }
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
      position: "relative", overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@600;700&family=Inter:wght@400;600;700&display=swap');
        input:focus { border-color: ${T.accent} !important; box-shadow: 0 0 0 3px rgba(245,165,36,0.12); }
        input::placeholder { color: #565b64; }
      `}</style>

      {/* aurora de fundo */}
      <div style={{
        position: "absolute", top: -160, left: "50%", transform: "translateX(-50%)",
        width: 520, height: 380, filter: "blur(50px)", pointerEvents: "none",
        background: "radial-gradient(ellipse at center, rgba(245,165,36,0.18), transparent 70%)",
      }} />

      <div style={{
        width: "100%", maxWidth: 380, background: T.card, border: `1px solid ${T.border}`,
        borderRadius: 18, padding: 26, backdropFilter: "blur(12px)", position: "relative",
      }}>
        <h1 style={{
          fontFamily: "'Oswald', sans-serif", fontSize: 30, margin: "0 0 4px",
          textTransform: "uppercase", letterSpacing: 3, fontWeight: 700, color: T.text, textAlign: "center",
        }}>
          Iron<span style={{ color: T.accent, textShadow: "0 0 24px rgba(245,165,36,0.6)" }}>Track</span>
        </h1>
        <p style={{ color: T.muted, fontSize: 12.5, textAlign: "center", margin: "0 0 22px" }}>
          Treino, dieta e evolução — sem desculpa.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input style={input} type="email" placeholder="E-mail" value={email}
            onChange={(e) => setEmail(e.target.value)} autoComplete="email"
            onKeyDown={(e) => e.key === "Enter" && mode === "forgot" && submit()} />
          {mode !== "forgot" && (
            <input style={input} type="password" placeholder="Senha" value={pass}
              onChange={(e) => setPass(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              onKeyDown={(e) => e.key === "Enter" && submit()} />
          )}

          {msg && (
            <div style={{
              fontSize: 13, padding: "10px 12px", borderRadius: 10, lineHeight: 1.5,
              background: msg.type === "err" ? "rgba(248,113,113,0.12)" : "rgba(74,222,128,0.12)",
              color: msg.type === "err" ? T.red : "#4ade80",
              border: `1px solid ${msg.type === "err" ? "rgba(248,113,113,0.3)" : "rgba(74,222,128,0.3)"}`,
            }}>{msg.text}</div>
          )}

          <button onClick={submit} disabled={loading} style={{
            background: `linear-gradient(110deg, ${T.accent} 40%, ${T.accent2} 50%, ${T.accent} 60%)`,
            backgroundSize: "220% 100%", color: "#0a0c10", border: "none", borderRadius: 12,
            padding: "13px 18px", fontWeight: 800, fontSize: 14, cursor: "pointer",
            boxShadow: "0 4px 18px rgba(245,165,36,0.28)", opacity: loading ? 0.7 : 1,
          }}>
            {loading ? "..." : mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link de redefinição"}
          </button>

          {mode === "login" && (
            <button onClick={() => { setMode("forgot"); setMsg(null); }} style={{
              background: "transparent", border: "none", color: T.muted, fontSize: 12.5,
              cursor: "pointer", padding: 4, fontFamily: "inherit", textAlign: "center",
            }}>
              Esqueci minha senha
            </button>
          )}

          <button onClick={() => { setMode(mode === "signup" ? "login" : mode === "forgot" ? "login" : "signup"); setMsg(null); }} style={{
            background: "transparent", border: "none", color: T.muted, fontSize: 13,
            cursor: "pointer", padding: 8, fontFamily: "inherit",
          }}>
            {mode === "signup" ? "Já tem conta? Entrar" : mode === "forgot" ? "Voltar pro login" : "Não tem conta? Criar agora"}
          </button>
        </div>
      </div>
    </div>
  );
}
