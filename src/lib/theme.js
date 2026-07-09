// Paleta y helpers compartidos, tomados tal cual del prototipo cuadra.jsx.
export const C = {
  bg: "#05070a",
  bg2: "#0a0e14",
  card: "#141920",
  card2: "#1b222c",
  line: "#232b36",
  teal: "#1a8a6f",
  tealDim: "#12564a",
  tealSoft: "rgba(26,138,111,.16)",
  green: "#2ecc8f",
  red: "#ef5b6e",
  redSoft: "rgba(239,91,110,.12)",
  orange: "#e08b3e",
  orangeSoft: "rgba(224,139,62,.14)",
  blue: "#3f7fe0",
  blueSoft: "rgba(63,127,224,.16)",
  violet: "#6c5ce7",
  violetSoft: "rgba(108,92,231,.16)",
  txt: "#f2f5f8",
  sub: "#8b95a3",
  faint: "#5a6473",
};

export const CLP = (n) =>
  "$" + Math.round(n).toLocaleString("es-CL", { maximumFractionDigits: 0 });

export const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export const keyToLabel = (k) => {
  if (!k) return "";
  const [y, m] = k.split("-").map(Number);
  return `${MESES[m - 1]}. ${y}`;
};

// Tipos de cuenta y prioridades, tal cual el prototipo
export const ACCOUNT_TYPES = [
  { id: "efectivo", label: "Efectivo", sub: "Billetera", icon: "💵", color: C.green, kind: "money" },
  { id: "banco", label: "Cuenta bancaria", sub: "Banco", icon: "🏛️", color: C.violet, kind: "money" },
  { id: "ahorro", label: "Ahorro", sub: "Reserva", icon: "🗄️", color: C.blue, kind: "money" },
  { id: "tarjeta", label: "Tarjeta de crédito", sub: "Cupo", icon: "💳", color: C.violet, kind: "card" },
  { id: "credito", label: "Crédito", sub: "Deuda", icon: "📄", color: C.orange, kind: "credit" },
  { id: "inversion", label: "Inversión", sub: "Valor", icon: "📈", color: C.orange, kind: "money" },
];

export const PRIORIDADES = [
  { id: "obligaciones", label: "Obligaciones", color: C.blue },
  { id: "necesidades", label: "Necesidades", color: C.teal },
  { id: "gustos", label: "Gustos", color: C.orange },
];
