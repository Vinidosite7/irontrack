"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import IronTrack from "../components/IronTrack";
import Auth from "../components/Auth";

export default function Page() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // carregando sessão
  if (session === undefined) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#0a0c10", color: "#8b919c", fontFamily: "Inter, sans-serif", fontSize: 14,
      }}>
        Carregando...
      </div>
    );
  }

  if (!session) return <Auth />;

  const deleteAccount = async () => {
    try {
      const res = await fetch("/api/delete-account", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        alert("Não consegui excluir a conta agora: " + (json.error || "erro desconhecido") + ". Tenta de novo ou fala comigo.");
        return;
      }
      await supabase.auth.signOut();
    } catch {
      alert("Falha de conexão ao excluir a conta. Tenta de novo.");
    }
  };

  return <IronTrack user={session.user} onLogout={() => supabase.auth.signOut()} onDeleteAccount={deleteAccount} />;
}
