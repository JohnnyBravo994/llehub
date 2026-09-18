"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("LLE Hub runtime error", error); }, [error]);
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--theme-bg)", color: "var(--theme-text)", fontFamily: "Montserrat, sans-serif", padding: "2rem" }}>
      <div style={{ maxWidth: 520, width: "100%", border: "1px solid var(--theme-border)", background: "var(--theme-surface)", padding: "2rem" }}>
        <div style={{ color: "var(--theme-accent)", letterSpacing: ".25em", fontSize: 11, textTransform: "uppercase", fontWeight: 700 }}>LLE Hub</div>
        <h1 style={{ fontSize: 24, margin: "1rem 0 .6rem" }}>O ecrã encontrou um erro.</h1>
        <p style={{ color: "var(--theme-text-muted)", lineHeight: 1.6, fontSize: 14 }}>Os dados ainda não foram gravados. Tenta reabrir este ecrã; se o erro se repetir, regista a ação que o provocou.</p>
        <button onClick={reset} style={{ marginTop: "1.5rem", padding: ".8rem 1rem", border: "1px solid var(--theme-input-border)", background: "var(--theme-input-bg)", color: "var(--theme-text)", cursor: "pointer" }}>Tentar novamente</button>
      </div>
    </main>
  );
}
