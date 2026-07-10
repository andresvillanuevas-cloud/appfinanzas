import { C } from "./theme";

// Categorías comunes para partir (Chile). Se siembran automáticamente la
// primera vez que una cuenta no tiene ninguna categoría. Color por grupo,
// igual que las prioridades: obligaciones=azul, necesidades=teal,
// gustos=naranja, ingresos=verde.
export const DEFAULT_CATEGORIES = [
  // Obligaciones
  { name: "Arriendo / Dividendo", type: "gasto", prioridad: "obligaciones", icon: "🏠", color: C.blue },
  { name: "Cuentas (luz, agua, gas)", type: "gasto", prioridad: "obligaciones", icon: "💡", color: C.blue },
  { name: "Internet / Teléfono", type: "gasto", prioridad: "obligaciones", icon: "📱", color: C.blue },
  // Necesidades
  { name: "Supermercado", type: "gasto", prioridad: "necesidades", icon: "🛒", color: C.teal },
  { name: "Transporte / Bencina", type: "gasto", prioridad: "necesidades", icon: "🚗", color: C.teal },
  { name: "Salud / Farmacia", type: "gasto", prioridad: "necesidades", icon: "💊", color: C.teal },
  { name: "Hogar", type: "gasto", prioridad: "necesidades", icon: "🏠", color: C.teal },
  // Gustos
  { name: "Restaurantes / Salidas", type: "gasto", prioridad: "gustos", icon: "🍔", color: C.orange },
  { name: "Café", type: "gasto", prioridad: "gustos", icon: "☕", color: C.orange },
  { name: "Entretención", type: "gasto", prioridad: "gustos", icon: "🎬", color: C.orange },
  { name: "Ropa", type: "gasto", prioridad: "gustos", icon: "👕", color: C.orange },
  // Ingresos
  { name: "Sueldo", type: "ingreso", prioridad: "obligaciones", icon: "💰", color: C.green },
  { name: "Otros ingresos", type: "ingreso", prioridad: "obligaciones", icon: "🎁", color: C.green },
];
