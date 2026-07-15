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

  return <IronTrack user={session.user} onLogout={() => supabase.auth.signOut()} />;
}
