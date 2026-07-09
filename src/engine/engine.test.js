import { describe, it, expect } from "vitest";
import {
  computeBalances,
  computeMonthStats,
  registerCardPurchase,
  buildCardPayment,
  buildCreditPayment,
  buildLinePayment,
  buildPulseAdjustment,
  confirmScheduled,
  validateDebtPayment,
  validateLinePayment,
  monthKey,
  addMonths,
} from "./engine.js";

// ---------- fixtures ----------
const banco = { id: "banco", name: "Banco", type: "banco", initial: 500000, line: 200000 };
const efectivo = { id: "efe", name: "Efectivo", type: "efectivo", initial: 50000 };
const tarjeta = { id: "tc", name: "Visa", type: "tarjeta", cupo: 1000000 };
const credito = { id: "cred", name: "Consumo", type: "credito", cuotaValue: 100000, cuotasRestantes: 10 };

const CUENTAS = [banco, efectivo, tarjeta, credito];

describe("helpers de meses", () => {
  it("monthKey formatea YYYY-MM", () => {
    expect(monthKey(new Date(2026, 0, 15))).toBe("2026-01");
    expect(monthKey(new Date(2026, 11, 1))).toBe("2026-12");
  });
  it("addMonths cruza años", () => {
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });
});

describe("Regla 1 — saldo = inicial + confirmados/cuadrados; pendiente NUNCA toca saldo", () => {
  it("gasto confirmado baja saldo", () => {
    const e = computeBalances(CUENTAS, [
      { kind: "gasto", accountId: "banco", amount: 100000, month: "2026-07", status: "confirmado" },
    ]);
    expect(e.bal.banco).toBe(400000);
  });
  it("movimiento pendiente no toca saldo", () => {
    const e = computeBalances(CUENTAS, [
      { kind: "gasto", accountId: "banco", amount: 100000, month: "2026-07", status: "pendiente" },
      { kind: "ingreso", accountId: "banco", amount: 999999, month: "2026-07", status: "pendiente" },
    ]);
    expect(e.bal.banco).toBe(500000);
  });
  it("movimiento cuadrado sí toca saldo (Pulso)", () => {
    const e = computeBalances(CUENTAS, [
      { kind: "gasto", accountId: "banco", amount: 30000, month: "2026-07", status: "cuadrado" },
    ]);
    expect(e.bal.banco).toBe(470000);
  });
});

describe("Regla 2 — gasto reduce cuenta y consume presupuesto de su mes", () => {
  it("gasto cuenta en monthStats de su mes y no en otros", () => {
    const movs = [
      { kind: "gasto", accountId: "banco", amount: 40000, month: "2026-07", status: "confirmado" },
    ];
    expect(computeMonthStats(movs, "2026-07").gas).toBe(40000);
    expect(computeMonthStats(movs, "2026-08").gas).toBe(0);
  });
  it("ingreso cuenta como ingreso del mes", () => {
    const movs = [
      { kind: "ingreso", accountId: "banco", amount: 1500000, month: "2026-07", status: "confirmado" },
    ];
    expect(computeMonthStats(movs, "2026-07").ing).toBe(1500000);
  });
});

describe("Regla 3 — transferencia mueve dinero, NO es gasto, NO consume presupuesto", () => {
  it("mueve entre cuentas sin alterar el total", () => {
    const movs = [
      { kind: "transferencia", fromId: "banco", toId: "efe", amount: 100000, month: "2026-07", status: "confirmado" },
    ];
    const e = computeBalances(CUENTAS, movs);
    expect(e.bal.banco).toBe(400000);
    expect(e.bal.efe).toBe(150000);
    expect(e.totalDinero).toBe(550000); // igual que antes de la transferencia
  });
  it("no aparece como gasto del mes", () => {
    const movs = [
      { kind: "transferencia", fromId: "banco", toId: "efe", amount: 100000, month: "2026-07", status: "confirmado" },
    ];
    expect(computeMonthStats(movs, "2026-07").gas).toBe(0);
  });
});

describe("Regla 4 — compra TC genera N cuotas, una por mes; no toca dinero real", () => {
  it("compra en 3 cuotas genera 3 movimientos en meses consecutivos", () => {
    const cuotas = registerCardPurchase({
      cardId: "tc", merchant: "Notebook", categoryId: "catX",
      total: 300000, cuotas: 3, firstMonth: "2026-07",
    });
    expect(cuotas).toHaveLength(3);
    expect(cuotas.map((c) => c.month)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(cuotas.map((c) => c.cuotaIndex)).toEqual([1, 2, 3]);
    expect(cuotas.every((c) => c.kind === "cuotaTC")).toBe(true);
    expect(cuotas.every((c) => c.purchaseGroup === cuotas[0].purchaseGroup)).toBe(true);
  });
  it("cada cuota consume presupuesto EN SU MES", () => {
    const cuotas = registerCardPurchase({
      cardId: "tc", total: 300000, cuotas: 3, firstMonth: "2026-07",
    });
    expect(computeMonthStats(cuotas, "2026-07").gas).toBe(100000);
    expect(computeMonthStats(cuotas, "2026-08").gas).toBe(100000);
    expect(computeMonthStats(cuotas, "2026-09").gas).toBe(100000);
  });
  it("sube el por-facturar de la tarjeta y NO toca dinero real", () => {
    const cuotas = registerCardPurchase({
      cardId: "tc", total: 300000, cuotas: 3, firstMonth: "2026-07",
    });
    const e = computeBalances(CUENTAS, cuotas);
    expect(e.cardUsed.tc).toBe(300000);
    expect(e.bal.banco).toBe(500000);
    expect(e.bal.efe).toBe(50000);
    expect(e.totalDinero).toBe(550000);
  });
});

describe("Regla 5 — pago de tarjeta: baja por-facturar y saldo origen, NO es gasto", () => {
  it("baja cardUsed y saldo origen sin crear gasto del mes", () => {
    const cuotas = registerCardPurchase({
      cardId: "tc", total: 300000, cuotas: 3, firstMonth: "2026-07",
    });
    const pago = buildCardPayment({ cardId: "tc", fromId: "banco", amount: 100000, month: "2026-07" });
    const e = computeBalances(CUENTAS, [...cuotas, pago]);
    expect(e.cardUsed.tc).toBe(200000);
    expect(e.bal.banco).toBe(400000);
    // anti-duplicación: el gasto del mes sigue siendo SOLO la cuota
    expect(computeMonthStats([...cuotas, pago], "2026-07").gas).toBe(100000);
  });
});

describe("Regla 6 — pago de crédito: baja deuda, mueve dinero real, NO es gasto", () => {
  it("baja debt y saldo origen sin crear gasto", () => {
    const pago = buildCreditPayment({ creditId: "cred", fromId: "banco", amount: 100000, month: "2026-07" });
    const e = computeBalances(CUENTAS, [pago]);
    expect(e.debt.cred).toBe(900000); // 10 cuotas de 100.000 − 1 pago
    expect(e.bal.banco).toBe(400000);
    expect(computeMonthStats([pago], "2026-07").gas).toBe(0);
  });
});

describe("Regla 7 — patrimonio: cupo de tarjeta NO es dinero real", () => {
  it("patrimonio = saldos − deuda crédito; el cupo no suma", () => {
    const e = computeBalances(CUENTAS, []);
    // 500.000 + 50.000 − 1.000.000 (deuda crédito) = −450.000; cupo 1.000.000 ignorado
    expect(e.patrimonio).toBe(-450000);
  });
  it("la línea usada (saldo negativo) resta del patrimonio", () => {
    const e = computeBalances(CUENTAS, [
      { kind: "gasto", accountId: "banco", amount: 600000, month: "2026-07", status: "confirmado" },
    ]);
    expect(e.bal.banco).toBe(-100000); // usó 100.000 de línea
    expect(e.lineUsed.banco).toBe(100000);
    expect(e.patrimonio).toBe(-450000 - 600000);
  });
});

describe("Regla 8 — línea de crédito bancaria", () => {
  it("avail = saldo real + línea libre", () => {
    const e = computeBalances(CUENTAS, []);
    expect(e.avail.banco).toBe(700000); // 500.000 + línea 200.000
    expect(e.avail.efe).toBe(50000); // sin línea
  });
  it("pagar TC puede usar línea: saldo queda negativo hasta -line y no más", () => {
    const e = computeBalances(CUENTAS, []);
    // pagar 700.000 (todo el avail) es válido y usa 200.000 de línea
    const ok = validateDebtPayment(e, "banco", 700000);
    expect(ok.ok).toBe(true);
    expect(ok.usaLinea).toBe(true);
    expect(ok.lineaUsada).toBe(200000);
    // pagar 700.001 excede saldo + línea → rechazado
    expect(validateDebtPayment(e, "banco", 700001)).toEqual({ ok: false, reason: "excede-saldo-mas-linea" });

    // al ejecutar el pago máximo, el saldo queda exactamente en -line
    const pago = buildCardPayment({ cardId: "tc", fromId: "banco", amount: 700000, month: "2026-07" });
    const e2 = computeBalances(CUENTAS, [pago]);
    expect(e2.bal.banco).toBe(-200000);
    expect(e2.lineUsed.banco).toBe(200000);
    // línea agotada: avail = saldo (−200.000) + línea libre (0) → no se puede pagar nada más
    expect(e2.avail.banco).toBe(-200000);
    expect(validateDebtPayment(e2, "banco", 1).ok).toBe(false);
  });
  it("pagar la línea SOLO acepta dinero real de otra cuenta", () => {
    // banco quedó con línea usada de 100.000
    const movs = [
      { kind: "gasto", accountId: "banco", amount: 600000, month: "2026-07", status: "confirmado" },
    ];
    const e = computeBalances(CUENTAS, movs);
    expect(e.lineUsed.banco).toBe(100000);
    // efectivo solo tiene 50.000 reales → pagar 100.000 desde efectivo se rechaza
    expect(validateLinePayment(e, "banco", "efe", 100000)).toEqual({ ok: false, reason: "origen-sin-saldo-real" });
    // pagar 50.000 con dinero real sí
    expect(validateLinePayment(e, "banco", "efe", 50000)).toEqual({ ok: true });
    // nunca línea con línea (misma cuenta)
    expect(validateLinePayment(e, "banco", "banco", 50000)).toEqual({ ok: false, reason: "misma-cuenta" });
    // no más que la línea usada
    const e3 = computeBalances([{ ...efectivo, initial: 999999999 }, banco], movs);
    expect(validateLinePayment(e3, "banco", "efe", 100001)).toEqual({ ok: false, reason: "supera-linea-usada" });

    // el pago de línea sube el saldo negativo hacia 0 y baja el origen
    const pago = buildLinePayment({ bankId: "banco", fromId: "efe", amount: 50000, month: "2026-07" });
    const e2 = computeBalances(CUENTAS, [...movs, pago]);
    expect(e2.bal.banco).toBe(-50000);
    expect(e2.bal.efe).toBe(0);
    // y NO es gasto
    expect(computeMonthStats([pago], "2026-07").gas).toBe(0);
  });
});

describe("Regla 9 — compra en curso: solo cuotas futuras + remanente en primera creada", () => {
  it("compra en curso 4/12 crea exactamente 9 cuotas (4..12)", () => {
    const cuotas = registerCardPurchase({
      cardId: "tc", total: 1200000, cuotas: 12, firstMonth: "2026-07", startIndex: 4,
    });
    expect(cuotas).toHaveLength(9);
    expect(cuotas[0].cuotaIndex).toBe(4);
    expect(cuotas.at(-1).cuotaIndex).toBe(12);
    expect(cuotas[0].month).toBe("2026-07");
    expect(cuotas.at(-1).month).toBe("2027-03"); // 9 meses consecutivos
  });
  it("remanente de 5.000/3 = 1.667+1.667+1.666, ajuste en la primera cuota creada", () => {
    const cuotas = registerCardPurchase({
      cardId: "tc", total: 5000, cuotas: 3, firstMonth: "2026-07",
    });
    const amounts = cuotas.map((c) => c.amount);
    expect(amounts.reduce((a, b) => a + b, 0)).toBe(5000); // nunca se pierde un peso
    expect([...amounts].sort()).toEqual([1666, 1667, 1667]);
    // el ajuste de redondeo va en la primera cuota creada
    expect(amounts[0]).toBe(1666);
  });
  it("en compra en curso el remanente también cae en la primera cuota CREADA", () => {
    const cuotas = registerCardPurchase({
      cardId: "tc", total: 5000, cuotas: 3, firstMonth: "2026-07", startIndex: 2,
    });
    expect(cuotas).toHaveLength(2);
    expect(cuotas[0].amount).toBe(1666); // per 1.667 + rem −1
    expect(cuotas[1].amount).toBe(1667);
  });
});

describe("Regla 10 — Pulso: la diferencia SIEMPRE es movimiento trazable", () => {
  it("diferencia negativa → gasto cuadrado que ajusta el saldo", () => {
    const adj = buildPulseAdjustment({ accountId: "banco", diff: -15000, categoryId: "catX", month: "2026-07" });
    expect(adj.kind).toBe("gasto");
    expect(adj.status).toBe("cuadrado");
    expect(adj.amount).toBe(15000);
    const e = computeBalances(CUENTAS, [adj]);
    expect(e.bal.banco).toBe(485000);
  });
  it("diferencia positiva → ingreso cuadrado", () => {
    const adj = buildPulseAdjustment({ accountId: "banco", diff: 8000, month: "2026-07" });
    expect(adj.kind).toBe("ingreso");
    expect(adj.status).toBe("cuadrado");
    const e = computeBalances(CUENTAS, [adj]);
    expect(e.bal.banco).toBe(508000);
  });
  it("diferencia cero → no genera movimiento", () => {
    expect(buildPulseAdjustment({ accountId: "banco", diff: 0 })).toBeNull();
  });
});

describe("Regla 11 — programados no tocan saldo hasta confirmarse", () => {
  it("un programado no es movimiento; al confirmarlo recién impacta", () => {
    const sch = { id: "s1", name: "Arriendo", kind: "gasto", amount: 450000, accountId: "banco", day: 5 };
    // antes de confirmar: nada cambia (scheduled no entra al motor)
    const antes = computeBalances(CUENTAS, []);
    expect(antes.bal.banco).toBe(500000);
    // al confirmar se crea el movimiento confirmado y recién ahí baja el saldo
    const mov = confirmScheduled(sch, "2026-07");
    expect(mov.status).toBe("confirmado");
    expect(mov.kind).toBe("gasto");
    const despues = computeBalances(CUENTAS, [mov]);
    expect(despues.bal.banco).toBe(50000);
  });
});

describe("orden de procesamiento — el resultado no depende del orden del array", () => {
  it("pago TC listado ANTES que sus cuotas (orden desc, como llega de la DB) reduce igual el por-facturar", () => {
    const cuotas = registerCardPurchase({
      cardId: "tc", total: 300000, cuotas: 3, firstMonth: "2026-07",
    }); // ts crecientes
    const pago = { ...buildCardPayment({ cardId: "tc", fromId: "banco", amount: 100000, month: "2026-07" }), ts: Date.now() + 999 };
    const asc = computeBalances(CUENTAS, [...cuotas, pago]);
    const desc = computeBalances(CUENTAS, [pago, ...cuotas]); // pago primero en el array
    expect(desc.cardUsed.tc).toBe(200000);
    expect(desc.cardUsed.tc).toBe(asc.cardUsed.tc);
    expect(desc.bal.banco).toBe(asc.bal.banco);
  });
});

describe("integración — escenario real del dueño", () => {
  it("deuda TC en curso + pago con línea + pago de línea cuadran", () => {
    // 1) compra en curso: 900.000 en 12 cuotas, ya facturadas 3 (próxima: 4)
    const cuotas = registerCardPurchase({
      cardId: "tc", total: 900000, cuotas: 12, firstMonth: "2026-07", startIndex: 4,
    });
    expect(cuotas).toHaveLength(9);
    const porFacturar = cuotas.reduce((s, c) => s + c.amount, 0);
    expect(porFacturar).toBe(675000); // 9/12 de 900.000

    // 2) pagar 550.000 de la TC desde el banco (saldo 500.000 + línea 200.000)
    let movs = [...cuotas];
    const e1 = computeBalances(CUENTAS, movs);
    const v = validateDebtPayment(e1, "banco", 550000);
    expect(v).toMatchObject({ ok: true, usaLinea: true, lineaUsada: 50000 });
    movs.push(buildCardPayment({ cardId: "tc", fromId: "banco", amount: 550000, month: "2026-07" }));

    const e2 = computeBalances(CUENTAS, movs);
    expect(e2.bal.banco).toBe(-50000);
    expect(e2.lineUsed.banco).toBe(50000);
    expect(e2.cardUsed.tc).toBe(125000);

    // 3) pagar la línea usada con dinero real del efectivo
    const v2 = validateLinePayment(e2, "banco", "efe", 50000);
    expect(v2.ok).toBe(true);
    movs.push(buildLinePayment({ bankId: "banco", fromId: "efe", amount: 50000, month: "2026-07" }));

    const e3 = computeBalances(CUENTAS, movs);
    expect(e3.bal.banco).toBe(0);
    expect(e3.bal.efe).toBe(0);
    expect(e3.lineUsed.banco).toBe(0);

    // el gasto del mes es SOLO la cuota TC de julio (anti-duplicación)
    expect(computeMonthStats(movs, "2026-07").gas).toBe(cuotas[0].amount);
  });
});
