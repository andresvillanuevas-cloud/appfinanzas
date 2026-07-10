import { C } from "./theme";

// Categorías comunes para partir (Chile). Se siembran automáticamente la
// primera vez que una cuenta no tiene ninguna categoría. Color por grupo,
// igual que las prioridades: obligaciones=azul, necesidades=teal,
// gustos=naranja, ingresos=verde.
export const DEFAULT_CATEGORIES = [
  // Obligaciones (fijos)
  { name: "Arriendo / Dividendo", type: "gasto", prioridad: "obligaciones", icon: "🏠", color: C.blue },
  { name: "Gastos comunes", type: "gasto", prioridad: "obligaciones", icon: "🏢", color: C.blue },
  { name: "Luz", type: "gasto", prioridad: "obligaciones", icon: "💡", color: C.blue },
  { name: "Agua", type: "gasto", prioridad: "obligaciones", icon: "💧", color: C.blue },
  { name: "Gas", type: "gasto", prioridad: "obligaciones", icon: "🔥", color: C.blue },
  { name: "Internet / Wifi", type: "gasto", prioridad: "obligaciones", icon: "📶", color: C.blue },
  { name: "Plan celular", type: "gasto", prioridad: "obligaciones", icon: "📱", color: C.blue },
  { name: "Seguros", type: "gasto", prioridad: "obligaciones", icon: "🛡️", color: C.blue },
  { name: "Créditos y cuotas (CAE, consumo)", type: "gasto", prioridad: "obligaciones", icon: "📄", color: C.blue },
  { name: "Impuestos (permiso circulación, etc.)", type: "gasto", prioridad: "obligaciones", icon: "🧾", color: C.blue },

  // Necesidades (variables pero esenciales)
  { name: "Supermercado", type: "gasto", prioridad: "necesidades", icon: "🛒", color: C.teal },
  { name: "Bencina / Combustible", type: "gasto", prioridad: "necesidades", icon: "⛽", color: C.teal },
  { name: "Transporte (metro, micro, Uber/Didi)", type: "gasto", prioridad: "necesidades", icon: "🚌", color: C.teal },
  { name: "Farmacia / Salud", type: "gasto", prioridad: "necesidades", icon: "💊", color: C.teal },
  { name: "Mantención auto", type: "gasto", prioridad: "necesidades", icon: "🔧", color: C.teal },
  { name: "Peluquería / Cuidado personal", type: "gasto", prioridad: "necesidades", icon: "💇", color: C.teal },
  { name: "Artículos del hogar", type: "gasto", prioridad: "necesidades", icon: "🧺", color: C.teal },
  { name: "Mascotas (comida, vet)", type: "gasto", prioridad: "necesidades", icon: "🐾", color: C.teal },
  { name: "Educación / Cursos", type: "gasto", prioridad: "necesidades", icon: "📚", color: C.teal },

  // Gustos (discrecional)
  { name: "Comidas fuera / Delivery", type: "gasto", prioridad: "gustos", icon: "🍔", color: C.orange },
  { name: "Cafés", type: "gasto", prioridad: "gustos", icon: "☕", color: C.orange },
  { name: "Gimnasio", type: "gasto", prioridad: "gustos", icon: "🏋️", color: C.orange },
  { name: "Entretención (cine, streaming, salidas)", type: "gasto", prioridad: "gustos", icon: "🎬", color: C.orange },
  { name: "Ropa", type: "gasto", prioridad: "gustos", icon: "👕", color: C.orange },
  { name: "Tecnología / Gadgets", type: "gasto", prioridad: "gustos", icon: "💻", color: C.orange },
  { name: "Viajes", type: "gasto", prioridad: "gustos", icon: "✈️", color: C.orange },
  { name: "Hobbies", type: "gasto", prioridad: "gustos", icon: "🏃", color: C.orange },
  { name: "Regalos", type: "gasto", prioridad: "gustos", icon: "🎁", color: C.orange },
  { name: "Suscripciones", type: "gasto", prioridad: "gustos", icon: "🔁", color: C.orange },

  // Ingresos
  { name: "Sueldo", type: "ingreso", prioridad: "obligaciones", icon: "💰", color: C.green },
  { name: "Mesada", type: "ingreso", prioridad: "obligaciones", icon: "🪙", color: C.green },
  { name: "Negocios personales", type: "ingreso", prioridad: "obligaciones", icon: "💼", color: C.green },
  { name: "Otros", type: "ingreso", prioridad: "obligaciones", icon: "💵", color: C.green },
];
