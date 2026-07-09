import { supabase } from "../lib/supabase";
import { C } from "../lib/theme";

export default function Mas({ session }) {
  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Más</h2>
      <p style={{ color: C.sub, fontSize: 14, margin: 0 }}>{session?.user?.email}</p>
      <button
        onClick={() => supabase.auth.signOut()}
        style={{
          background: C.redSoft,
          color: C.red,
          border: "none",
          borderRadius: 12,
          padding: "12px 16px",
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",
          alignSelf: "flex-start",
        }}
      >
        Cerrar sesión
      </button>
    </div>
  );
}
