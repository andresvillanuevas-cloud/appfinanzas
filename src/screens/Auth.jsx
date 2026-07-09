import { useState } from "react";
import { supabase } from "../lib/supabase";
import { C } from "../lib/theme";

export default function Auth() {
  const [mode, setMode] = useState("login"); // login | registro
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const { error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (mode === "registro") {
      setInfo("Cuenta creada. Revisa tu correo si se requiere confirmación, o inicia sesión.");
    }
  };

  return (
    <div
      style={{
        minHeight: "100svh",
        background: C.bg,
        color: C.txt,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: 24,
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: 360,
          maxWidth: "100%",
          background: C.card,
          border: `1px solid ${C.line}`,
          borderRadius: 20,
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, marginBottom: 4 }}>
          MiCuadra
        </h1>
        <p style={{ color: C.sub, fontSize: 14, margin: 0, marginBottom: 8 }}>
          {mode === "login" ? "Inicia sesión" : "Crea tu cuenta"}
        </p>

        <input
          type="email"
          required
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        {error && <p style={{ color: C.red, fontSize: 13, margin: 0 }}>{error}</p>}
        {info && <p style={{ color: C.green, fontSize: 13, margin: 0 }}>{info}</p>}

        <button
          type="submit"
          disabled={loading}
          style={{
            background: C.teal,
            color: C.txt,
            border: "none",
            borderRadius: 12,
            padding: "12px 0",
            fontWeight: 700,
            fontSize: 15,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "..." : mode === "login" ? "Entrar" : "Registrarme"}
        </button>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setInfo(null);
            setMode(mode === "login" ? "registro" : "login");
          }}
          style={{
            background: "none",
            border: "none",
            color: C.sub,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {mode === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
        </button>
      </form>
    </div>
  );
}

const inputStyle = {
  background: C.card2,
  border: `1px solid ${C.line}`,
  borderRadius: 12,
  padding: "12px 14px",
  color: C.txt,
  fontSize: 15,
  outline: "none",
};
