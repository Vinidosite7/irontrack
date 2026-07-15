"use client";
import { useState, useEffect, useRef } from "react";
import { loadRemote, saveRemote } from "../lib/storage";

// ============ DESIGN TOKENS ============
const T = {
  bg: "#0a0c10",
  card: "rgba(20,24,31,0.85)",
  cardSolid: "#14181f",
  cardSoft: "#1c212a",
  border: "#262c36",
  accent: "#F5A524",
  accent2: "#FFD27A",
  accentSoft: "rgba(245,165,36,0.12)",
  text: "#EDEBE6",
  muted: "#8b919c",
  green: "#4ade80",
  greenSoft: "rgba(74,222,128,0.12)",
  red: "#f87171",
  redSoft: "rgba(248,113,113,0.12)",
  radius: 16,
};

const font = {
  display: "'Oswald', 'Arial Narrow', sans-serif",
  body: "'Inter', -apple-system, sans-serif",
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const EMPTY = {
  workouts: [], logs: {}, diet: [], dietChecks: {}, journal: [], freeFoods: {}, cardio: {},
  profile: {
    name: "", age: "", sex: "M", startWeight: "", goalWeight: "", height: "",
    trainTime: "", trainWeek: "", cardioWeek: "", kcalTarget: "", protTarget: "", carbTarget: "", fatTarget: "", restTime: "90",
    weights: [], medidas: { braco: "", peito: "", cintura: "", quadril: "", coxa: "", panturrilha: "" },
  },
  lastOpen: null,
};

// ============ BANCO DE EXERCÍCIOS ============
const EXDB = {
  Peito: ["Supino reto", "Supino inclinado", "Supino declinado", "Supino com halteres", "Crucifixo", "Cross-over", "Peck deck", "Flexão"],
  Tríceps: ["Tríceps corda", "Tríceps testa", "Tríceps francês", "Paralelas", "Tríceps banco", "Tríceps coice", "Tríceps barra reta"],
  Costas: ["Puxada frente", "Puxada supinada", "Remada curvada", "Remada baixa", "Remada unilateral", "Barra fixa", "Levantamento terra", "Pullover"],
  Bíceps: ["Rosca direta", "Rosca alternada", "Rosca martelo", "Rosca scott", "Rosca concentrada", "Rosca 21"],
  Ombro: ["Desenvolvimento militar", "Desenvolvimento halteres", "Elevação lateral", "Elevação frontal", "Crucifixo inverso", "Encolhimento", "Face pull"],
  Perna: ["Agachamento livre", "Leg press", "Hack machine", "Cadeira extensora", "Mesa flexora", "Stiff", "Afundo", "Panturrilha em pé", "Panturrilha sentado"],
  Glúteo: ["Hip thrust", "Elevação pélvica", "Cadeira abdutora", "Coice na polia", "Búlgaro"],
  Abdômen: ["Prancha", "Abdominal supra", "Abdominal infra", "Abdominal oblíquo", "Roda abdominal", "Elevação de pernas"],
  Cardio: ["Esteira", "Bike", "Escada", "Corda", "HIIT"],
};

const PHRASES = [
  "Disciplina vence motivação. Todo santo dia. 🔥",
  "O ferro não mente. Bora pagar o preço! 🏋️",
  "Constância é o melhor anabolizante natural. 💪",
  "Ninguém vai levantar o peso por você. Bora!",
  "Shape se constrói na cozinha e na academia. 🍗",
  "Meio treino = meio resultado. Fecha os 100%!",
  "Proteína em dia, shape em construção. 💯",
  "Quem treina quando não quer, vence quem só treina quando quer.",
  "O corpo alcança o que a mente acredita. ⚡",
  "Mais uma refeição batida = mais um tijolo no shape. 🧱",
];
const randPhrase = () => PHRASES[Math.floor(Math.random() * PHRASES.length)];

// ============ STORAGE (Supabase + cache local em lib/storage.js) ============
function mergeData(p) {
  if (!p) return EMPTY;
  return {
    ...EMPTY, ...p,
    profile: { ...EMPTY.profile, ...(p.profile || {}), medidas: { ...EMPTY.profile.medidas, ...((p.profile || {}).medidas || {}) } },
  };
}

// ============ CÁLCULOS ============
const currentWeight = (p) => {
  const ws = (p.weights || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  return ws.length ? Number(ws[ws.length - 1].peso) : null;
};
const calcIMC = (peso, alturaCm) => (peso && alturaCm ? peso / Math.pow(alturaCm / 100, 2) : null);
const imcClass = (imc) => imc == null ? "" : imc < 18.5 ? "Abaixo do peso" : imc < 25 ? "Peso normal" : imc < 30 ? "Sobrepeso" : "Obesidade";
const calcTMB = (p, peso) => {
  const h = Number(p.height), a = Number(p.age);
  if (!peso || !h || !a) return null;
  return Math.round(10 * peso + 6.25 * h - 5 * a + (p.sex === "F" ? -161 : 5));
};
const activityFactor = (p) => {
  const t = Number(p.trainWeek) || 0;
  const c = (Number(p.cardioWeek) || 0) / 60; // horas de cardio/semana
  const sessions = t + c;
  if (sessions <= 0.5) return 1.2;
  if (sessions <= 3) return 1.375;
  if (sessions <= 5) return 1.55;
  if (sessions <= 7) return 1.725;
  return 1.9;
};
const exDoneToday = (data, exId) => (data.logs[exId] || []).some((h) => h.date === todayStr());
const workoutProgress = (data, w) => !w.exercises.length ? 0 : w.exercises.filter((e) => exDoneToday(data, e.id)).length / w.exercises.length;

function calcStreak(data) {
  const days = new Set(Object.values(data.logs).flat().map((h) => h.date));
  const iso = (x) => x.toISOString().slice(0, 10);
  const d = new Date();
  if (!days.has(iso(d))) d.setDate(d.getDate() - 1); // hoje ainda não treinou? conta a partir de ontem
  let streak = 0;
  while (days.has(iso(d))) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((t, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = i === 2 ? 1175 : 880;
      g.gain.setValueAtTime(0.001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.18);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2);
    });
  } catch (e) {}
}

// soma macros de uma lista de itens; se kcal vazio, calcula por 4P/4C/9G
function sumItems(items) {
  const acc = { kcal: 0, prot: 0, carb: 0, fat: 0 };
  items.forEach((it) => {
    const pr = Number(it.prot) || 0, cb = Number(it.carb) || 0, ft = Number(it.fat) || 0;
    acc.kcal += Number(it.kcal) || (pr || cb || ft ? Math.round(4 * pr + 4 * cb + 9 * ft) : 0);
    acc.prot += pr; acc.carb += cb; acc.fat += ft;
  });
  return acc;
}

function consumedToday(data) {
  const today = todayStr();
  const checks = data.dietChecks[today] || {};
  const meals = data.diet.filter((m) => checks[m.id]).flatMap((m) => m.items);
  return sumItems([...meals, ...(data.freeFoods[today] || [])]);
}
function planTotals(data) {
  return sumItems(data.diet.flatMap((m) => m.items));
}
// kcal queimadas em cardio hoje (se não informar kcal, estima 7 kcal/min moderado)
function cardioKcalToday(data) {
  return (data.cardio[todayStr()] || []).reduce((a, c) => a + (Number(c.kcal) || Math.round((Number(c.min) || 0) * 7)), 0);
}

function notifyUser(title, body) {
  try {
    if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body });
  } catch (e) {}
}

// ============ UI PRIMITIVES ============
const S = {
  input: {
    background: T.cardSoft, border: `1px solid ${T.border}`, borderRadius: 12,
    color: T.text, padding: "11px 13px", fontSize: 14, fontFamily: font.body,
    outline: "none", width: "100%", boxSizing: "border-box", transition: "border-color .2s, box-shadow .2s",
  },
  btnGhost: {
    background: "transparent", color: T.muted, border: `1px solid ${T.border}`,
    borderRadius: 12, padding: "9px 14px", fontWeight: 600, fontSize: 13,
    cursor: "pointer", fontFamily: font.body,
  },
  label: {
    fontSize: 10.5, color: T.muted, textTransform: "uppercase",
    letterSpacing: 1.4, fontWeight: 700, fontFamily: font.body,
  },
};

// Botão shimmer (estilo Aceternity)
function BtnShimmer({ children, onClick, style, green, disabled }) {
  return (
    <button className={green ? "btn-shimmer btn-green" : "btn-shimmer"} onClick={onClick} style={style} disabled={disabled}>
      {children}
    </button>
  );
}

// Card com borda em gradiente animado (estilo Aceternity border gradient)
function ACard({ children, style, hot }) {
  return (
    <div className={hot ? "acard acard-hot" : "acard"} style={style}>
      <div className="acard-inner">{children}</div>
    </div>
  );
}

// Card comum com hover lift
function Card({ children, style, onClick, className }) {
  return (
    <div className={`card ${className || ""}`} style={style} onClick={onClick}>
      {children}
    </div>
  );
}

function SectionTitle({ children, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
      <h2 style={{ fontFamily: font.display, fontSize: 23, textTransform: "uppercase", letterSpacing: 2, margin: 0, fontWeight: 600 }}>
        {children}
      </h2>
      {action}
    </div>
  );
}

function ProgressBar({ pct, height = 8 }) {
  const done = pct >= 1;
  return (
    <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 20, height, overflow: "hidden", width: "100%" }}>
      <div style={{
        width: `${Math.round(clamp(pct, 0, 1) * 100)}%`, height: "100%", borderRadius: 20,
        background: done ? `linear-gradient(90deg, ${T.green}, #86efac)` : `linear-gradient(90deg, ${T.accent}, ${T.accent2})`,
        boxShadow: done ? `0 0 12px rgba(74,222,128,0.5)` : `0 0 12px rgba(245,165,36,0.4)`,
        transition: "width .5s cubic-bezier(.4,0,.2,1), background .4s",
      }} />
    </div>
  );
}

function Stat({ label, value, accent, sub, color }) {
  return (
    <div>
      <div style={S.label}>{label}</div>
      <div style={{ fontFamily: font.display, fontSize: 26, fontWeight: 600, color: color || (accent ? T.accent : T.text), lineHeight: 1.15, marginTop: 3 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ============ VELOCÍMETRO PREMIUM ============
function WeightGauge({ start, goal, atual }) {
  const s = Number(start), g = Number(goal), a = Number(atual);
  const hasAll = s && g && a && s !== g;
  let p = 0;
  if (hasAll) p = clamp(g < s ? (s - a) / (s - g) : (a - s) / (g - s), 0, 1);

  const CX = 110, CY = 106, R = 86;
  const ARC = Math.PI * R;
  const angle = Math.PI - p * Math.PI;
  // marcador na ponta do arco de progresso
  const mx = CX + R * Math.cos(angle);
  const my = CY - R * Math.sin(angle);
  const done = p >= 1;

  // ticks a cada 10%, por dentro do arco
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const t = Math.PI - (i / 10) * Math.PI;
    const r1 = R - 13, r2 = i % 5 === 0 ? R - 23 : R - 19;
    return {
      x1: CX + r1 * Math.cos(t), y1: CY - r1 * Math.sin(t),
      x2: CX + r2 * Math.cos(t), y2: CY - r2 * Math.sin(t),
      major: i % 5 === 0,
    };
  });

  return (
    <div style={{ textAlign: "center" }}>
      <svg viewBox="0 0 220 130" style={{ width: "100%", maxWidth: 330, display: "block", margin: "0 auto" }}>
        <defs>
          <linearGradient id="ggrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F5A524" />
            <stop offset="60%" stopColor="#FFD27A" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
          <filter id="gglow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* trilho */}
        <path d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="11" strokeLinecap="round" />
        {/* arco de progresso */}
        {p > 0.01 && (
          <path
            d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`} fill="none"
            stroke={done ? T.green : "url(#ggrad)"} strokeWidth="11" strokeLinecap="round"
            strokeDasharray={`${p * ARC} ${ARC}`} filter="url(#gglow)"
            style={{ transition: "stroke-dasharray .8s cubic-bezier(.4,0,.2,1)" }}
          />
        )}
        {/* ticks */}
        {ticks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={t.major ? "rgba(237,235,230,0.4)" : "rgba(237,235,230,0.15)"} strokeWidth={t.major ? 2 : 1.2} strokeLinecap="round" />
        ))}
        {/* marcador de progresso */}
        {hasAll && (
          <g filter="url(#gglow)" style={{ transition: "all .8s" }}>
            <circle cx={mx} cy={my} r="8.5" fill={T.cardSolid} stroke={done ? T.green : T.accent} strokeWidth="3.5" />
            <circle cx={mx} cy={my} r="2.5" fill={done ? T.green : T.accent} />
          </g>
        )}
        {/* valor central dentro do SVG (escala junto, nunca desalinha) */}
        <text x={CX} y={CY - 12} textAnchor="middle" fill={T.text} fontFamily="Oswald, sans-serif" fontSize="38" fontWeight="700"
          style={{ textShadow: "0 0 20px rgba(245,165,36,0.35)" }}>
          {a || "—"}<tspan fontSize="13" fill={T.muted} fontWeight="500"> kg</tspan>
        </text>
        <text x={CX - R} y={CY + 18} fill={T.muted} fontSize="10.5" fontFamily="Inter" textAnchor="middle" fontWeight="600">{s ? `${s}` : "—"}</text>
        <text x={CX + R} y={CY + 18} fill={done ? T.green : T.accent} fontSize="10.5" fontFamily="Inter" textAnchor="middle" fontWeight="700">{g ? `${g} 🎯` : "—"}</text>
      </svg>

      <div style={{
        display: "inline-block", marginTop: 6, fontSize: 11.5, fontWeight: 700, letterSpacing: 0.5,
        padding: "4px 12px", borderRadius: 20,
        background: done ? T.greenSoft : T.accentSoft, color: done ? T.green : T.accent,
        border: `1px solid ${done ? "rgba(74,222,128,0.3)" : "rgba(245,165,36,0.3)"}`,
      }}>
        {hasAll ? (done ? "META ATINGIDA 🏆" : `${Math.round(p * 100)}% · faltam ${Math.abs(a - g).toFixed(1)}kg`) : "Configure peso e meta no Perfil"}
      </div>
    </div>
  );
}

// ============ GRÁFICO DE PESO ============
function WeightChart({ weights }) {
  const ws = (weights || []).slice().sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  if (ws.length < 2) return <div style={{ fontSize: 12, color: T.muted, textAlign: "center", padding: 16 }}>Registre o peso em pelo menos 2 dias para ver a curva.</div>;
  const vals = ws.map((w) => Number(w.peso));
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  const W = 300, H = 96, PAD = 10;
  const xy = ws.map((w, i) => [
    PAD + (i / (ws.length - 1)) * (W - 2 * PAD),
    H - PAD - ((Number(w.peso) - min) / range) * (H - 2 * PAD),
  ]);
  const line = xy.map((p) => p.join(",")).join(" ");
  const area = `${PAD},${H} ` + line + ` ${W - PAD},${H}`;
  const diff = (vals[vals.length - 1] - vals[0]).toFixed(1);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
        <defs>
          <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(245,165,36,0.25)" />
            <stop offset="100%" stopColor="rgba(245,165,36,0)" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#wfill)" />
        <polyline points={line} fill="none" stroke={T.accent} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill={T.bg} stroke={T.accent} strokeWidth="2" />)}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.muted, marginTop: 6 }}>
        <span>{fmtDate(ws[0].date)}</span>
        <span style={{ color: Number(diff) <= 0 ? T.green : T.accent, fontWeight: 700 }}>{diff > 0 ? "+" : ""}{diff}kg no período</span>
        <span>{fmtDate(ws[ws.length - 1].date)}</span>
      </div>
    </div>
  );
}

// gráfico de linha genérico (progressão de carga/volume)
function LineChart({ points, unit = "", color = T.accent }) {
  const ps = points.slice(-20);
  if (ps.length < 2) return <div style={{ fontSize: 12, color: T.muted, textAlign: "center", padding: 10 }}>Registre pelo menos 2 sessões para ver a curva.</div>;
  const vals = ps.map((p) => p.value);
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  const W = 300, H = 84, PAD = 10;
  const xy = ps.map((pt, i) => [PAD + (i / (ps.length - 1)) * (W - 2 * PAD), H - PAD - ((pt.value - min) / range) * (H - 2 * PAD)]);
  const line = xy.map((p) => p.join(",")).join(" ");
  const diff = Math.round((vals[vals.length - 1] - vals[0]) * 10) / 10;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
        <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill={T.bg} stroke={color} strokeWidth="2" />)}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.muted, marginTop: 4 }}>
        <span>{fmtDate(ps[0].date)}</span>
        <span style={{ color: diff >= 0 ? T.green : T.red, fontWeight: 700 }}>{diff >= 0 ? "+" : ""}{diff}{unit} de evolução</span>
        <span>{fmtDate(ps[ps.length - 1].date)}</span>
      </div>
    </div>
  );
}

// ============ DASH ============
function TabDash({ data, update }) {
  const [pesoInput, setPesoInput] = useState("");
  const [food, setFood] = useState("");
  const [fk, setFk] = useState("");
  const [fp, setFp] = useState("");
  const [fc, setFc] = useState("");
  const [ff, setFf] = useState("");
  const [cTipo, setCTipo] = useState("");
  const [cMin, setCMin] = useState("");
  const [cKcal, setCKcal] = useState("");
  const [dayClosed, setDayClosed] = useState(false);
  const p = data.profile;
  const atual = currentWeight(p);
  const today = todayStr();
  const checks = data.dietChecks[today] || {};

  const addWeight = () => {
    const v = Number(pesoInput);
    if (!v) return;
    update((d) => {
      const others = (d.profile.weights || []).filter((w) => w.date !== today);
      const startWeight = d.profile.startWeight || v;
      return { ...d, profile: { ...d.profile, startWeight, weights: [...others, { date: today, peso: v }] } };
    });
    setPesoInput("");
  };

  const toggleMeal = (mealId) => {
    update((d) => ({
      ...d, dietChecks: { ...d.dietChecks, [today]: { ...(d.dietChecks[today] || {}), [mealId]: !(d.dietChecks[today] || {})[mealId] } },
    }));
  };

  const addFree = () => {
    if (!food.trim()) return;
    update((d) => ({
      ...d, freeFoods: { ...d.freeFoods, [today]: [...(d.freeFoods[today] || []), { id: uid(), food: food.trim(), kcal: fk, prot: fp, carb: fc, fat: ff }] },
    }));
    setFood(""); setFk(""); setFp(""); setFc(""); setFf("");
  };
  const removeFree = (id) => {
    update((d) => ({ ...d, freeFoods: { ...d.freeFoods, [today]: (d.freeFoods[today] || []).filter((f) => f.id !== id) } }));
  };

  const addCardio = () => {
    const m = Number(cMin);
    if (!m) return;
    update((d) => ({ ...d, cardio: { ...d.cardio, [today]: [...(d.cardio[today] || []), { id: uid(), tipo: cTipo.trim(), min: m, kcal: cKcal }] } }));
    setCTipo(""); setCMin(""); setCKcal("");
  };
  const removeCardio = (id) => {
    update((d) => ({ ...d, cardio: { ...d.cardio, [today]: (d.cardio[today] || []).filter((c) => c.id !== id) } }));
  };

  // metas e consumo
  const plan = planTotals(data);
  const kcalTarget = Number(p.kcalTarget) || plan.kcal || null;
  const protTarget = Number(p.protTarget) || plan.prot || null;
  const carbTarget = Number(p.carbTarget) || plan.carb || null;
  const fatTarget = Number(p.fatTarget) || plan.fat || null;
  const cons = consumedToday(data);
  const cardioBurn = cardioKcalToday(data);
  const kcalLeft = kcalTarget != null ? kcalTarget - cons.kcal + cardioBurn : null;
  const protLeft = protTarget != null ? protTarget - cons.prot : null;
  const carbLeft = carbTarget != null ? carbTarget - cons.carb : null;
  const fatLeft = fatTarget != null ? fatTarget - cons.fat : null;
  const over = kcalLeft != null && kcalLeft < 0;
  const cardioMin = over ? Math.round(Math.abs(kcalLeft) / 8) : 0;

  // semana
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 6);
  const cutStr = cutoff.toISOString().slice(0, 10);
  const trainDays = new Set(Object.values(data.logs).flat().filter((h) => h.date >= cutStr).map((h) => h.date)).size;
  const weekDiff = (() => {
    const ws = (p.weights || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    if (ws.length < 2) return null;
    const last = ws[ws.length - 1];
    const weekAgo = ws.filter((w) => w.date <= cutStr).pop() || ws[0];
    return (Number(last.peso) - Number(weekAgo.peso)).toFixed(1);
  })();

  const todayWorkouts = data.workouts.map((w) => ({ w, pct: workoutProgress(data, w) })).filter((x) => x.pct > 0);
  const freeList = data.freeFoods[today] || [];

  // streak + visão semanal
  const streak = calcStreak(data);
  const trainedDays = new Set(Object.values(data.logs).flat().map((h) => h.date));
  const week = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(); dt.setDate(dt.getDate() - (6 - i));
    const iso = dt.toISOString().slice(0, 10);
    return { letter: "DSTQQSS"[dt.getDay()], trained: trainedDays.has(iso), isToday: iso === today };
  });

  const mealsDone = data.diet.filter((m) => checks[m.id]).length;

  const fecharDia = () => {
    const lines = [];
    data.workouts.forEach((w) => {
      const pw = workoutProgress(data, w);
      if (pw > 0) lines.push(`🏋️ ${w.name}: ${Math.round(pw * 100)}%${pw >= 1 ? " ✓" : ""}`);
    });
    const cl = data.cardio[today] || [];
    if (cl.length) lines.push(`🏃 Cardio: ${cl.map((c) => `${c.tipo || "cardio"} ${c.min}min`).join(", ")} (~${cardioBurn} kcal)`);
    if (data.diet.length) lines.push(`🍗 Dieta: ${mealsDone}/${data.diet.length} refeições · ${cons.kcal} kcal · ${cons.prot}g proteína`);
    if (kcalTarget != null) lines.push(over ? `⚠️ Estourou ${Math.abs(kcalLeft)} kcal da meta` : `✅ Fechou com ${kcalLeft} kcal de folga na meta`);
    const wToday = (p.weights || []).find((x) => x.date === today);
    if (wToday) lines.push(`⚖️ Peso: ${wToday.peso}kg`);
    if (streak > 0) lines.push(`🔥 Sequência: ${streak} dia${streak > 1 ? "s" : ""}`);
    if (!lines.length) lines.push("Dia sem registros — amanhã a gente compensa.");
    update((d) => ({
      ...d,
      journal: [
        { id: uid(), date: today, title: "Resumo do dia", notes: lines.join("\n"), auto: true },
        ...d.journal.filter((c) => !(c.auto && c.date === today)),
      ],
    }));
    setDayClosed(true);
  };

  return (
    <div>
      <SectionTitle>{p.name ? `Fala, ${p.name.split(" ")[0]} 👊` : "Dashboard"}</SectionTitle>

      {/* GAUGE */}
      <ACard hot style={{ marginBottom: 14 }}>
        <div style={{ ...S.label, marginBottom: 6 }}>Peso corporal</div>
        <WeightGauge start={p.startWeight} goal={p.goalWeight} atual={atual} />
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <input
            style={{ ...S.input, flex: 1 }} type="number" inputMode="decimal" step="0.1"
            placeholder="Peso de hoje (kg)" value={pesoInput}
            onChange={(e) => setPesoInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addWeight()}
          />
          <BtnShimmer onClick={addWeight}>Atualizar</BtnShimmer>
        </div>
      </ACard>

      {/* STREAK + SEMANA */}
      <Card style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ textAlign: "center", minWidth: 68 }}>
          <div style={{
            fontFamily: font.display, fontSize: 32, fontWeight: 700, lineHeight: 1,
            color: streak > 0 ? T.accent : T.muted,
            textShadow: streak > 0 ? "0 0 20px rgba(245,165,36,0.45)" : "none",
          }}>
            🔥{streak}
          </div>
          <div style={{ ...S.label, marginTop: 5 }}>sequência</div>
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "space-between" }}>
          {week.map((d, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: d.isToday ? T.accent : T.muted, fontWeight: 700, marginBottom: 6 }}>{d.letter}</div>
              <div style={{
                width: 22, height: 22, borderRadius: "50%", margin: "0 auto",
                background: d.trained ? T.green : "rgba(255,255,255,0.06)",
                border: d.isToday ? `2px solid ${T.accent}` : "2px solid transparent",
                boxShadow: d.trained ? "0 0 10px rgba(74,222,128,0.4)" : "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, color: "#0a0c10", fontWeight: 800,
                transition: "all .3s",
              }}>{d.trained ? "✓" : ""}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* STATS */}
      <Card style={{ marginBottom: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Stat label="Treinos / 7d" value={trainDays} sub={trainDays >= 4 ? "Constância 🔥" : "Bora subir"} />
        <Stat
          label="Kcal restantes" value={kcalLeft != null ? (over ? `${kcalLeft}` : kcalLeft) : "—"}
          color={kcalLeft == null ? T.text : over ? T.red : kcalLeft < (kcalTarget || 1) * 0.15 ? T.accent : T.green}
          sub={kcalTarget ? `meta ${kcalTarget}` : "defina no perfil"}
        />
        <Stat label="Variação 7d" value={weekDiff !== null ? `${weekDiff > 0 ? "+" : ""}${weekDiff}kg` : "—"} />
      </Card>

      {/* DIETA DO DIA + REBALANCEAMENTO */}
      <ACard style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={S.label}>Dieta de hoje</div>
          <span style={{ fontSize: 12, fontWeight: 700, color: mealsDone === data.diet.length && data.diet.length ? T.green : T.accent }}>
            {data.diet.length ? `${mealsDone}/${data.diet.length} refeições` : ""}
          </span>
        </div>

        {data.diet.length > 0 && (
          <>
            <ProgressBar pct={data.diet.length ? mealsDone / data.diet.length : 0} height={6} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, marginBottom: 4 }}>
              {data.diet.slice().sort((a, b) => (a.time || "99").localeCompare(b.time || "99")).map((m) => (
                <button
                  key={m.id} onClick={() => toggleMeal(m.id)}
                  className="chip"
                  style={{
                    background: checks[m.id] ? T.greenSoft : "rgba(255,255,255,0.04)",
                    color: checks[m.id] ? T.green : T.muted,
                    borderColor: checks[m.id] ? "rgba(74,222,128,0.35)" : T.border,
                    textDecoration: checks[m.id] ? "line-through" : "none",
                  }}
                >
                  {checks[m.id] ? "✓ " : ""}{m.time ? `${m.time} ` : ""}{m.name}
                </button>
              ))}
            </div>
          </>
        )}

        {/* HOJE COMI... */}
        <div style={{ marginTop: 14, borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
          <div style={{ ...S.label, marginBottom: 8 }}>Hoje comi... (fora do plano)</div>
          {freeList.map((f) => (
            <div key={f.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", color: T.text }}>
              <span>{f.food}</span>
              <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ color: T.muted, fontSize: 12 }}>
                  {[f.kcal && `${f.kcal}kcal`, f.prot && `${f.prot}P`, f.carb && `${f.carb}C`, f.fat && `${f.fat}G`].filter(Boolean).join(" · ")}
                </span>
                <button style={{ background: "none", border: "none", color: T.red, cursor: "pointer" }} onClick={() => removeFree(f.id)}>✕</button>
              </span>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <input style={{ ...S.input, flex: "1 1 100%" }} placeholder="Ex: 2 fatias de pizza" value={food} onChange={(e) => setFood(e.target.value)} />
            <input style={{ ...S.input, flex: "1 1 64px" }} type="number" placeholder="kcal" value={fk} onChange={(e) => setFk(e.target.value)} />
            <input style={{ ...S.input, flex: "1 1 64px" }} type="number" placeholder="prot" value={fp} onChange={(e) => setFp(e.target.value)} />
            <input style={{ ...S.input, flex: "1 1 64px" }} type="number" placeholder="carbo" value={fc} onChange={(e) => setFc(e.target.value)} />
            <input style={{ ...S.input, flex: "1 1 64px" }} type="number" placeholder="gord" value={ff} onChange={(e) => setFf(e.target.value)} />
            <BtnShimmer onClick={addFree} style={{ padding: "10px 16px" }}>+</BtnShimmer>
          </div>

          {/* BALANÇO */}
          {kcalTarget != null && (
            <div style={{
              marginTop: 12, padding: "12px 14px", borderRadius: 12, fontSize: 13, lineHeight: 1.55,
              background: over ? T.redSoft : T.greenSoft,
              border: `1px solid ${over ? "rgba(248,113,113,0.3)" : "rgba(74,222,128,0.3)"}`,
              color: over ? T.red : T.green,
            }}>
              {over ? (
                <>
                  <b>Estourou {Math.abs(kcalLeft)} kcal hoje{cardioBurn > 0 ? " (já descontando o cardio)" : ""}.</b> Pra rebalancear: ~{cardioMin} min de cardio moderado, ou enxuga a próxima refeição. Amanhã segue o plano — um dia não define o corte. 💪
                </>
              ) : (
                <>
                  <b>Ainda cabem {kcalLeft} kcal hoje{cardioBurn > 0 ? ` (+${cardioBurn} liberadas pelo cardio)` : ""}.</b>
                  {(protLeft != null || carbLeft != null || fatLeft != null) && (
                    <> Pra fechar: {[
                      protLeft != null && (protLeft > 0 ? `${protLeft}g proteína` : "proteína ✓"),
                      carbLeft != null && (carbLeft > 0 ? `${carbLeft}g carbo` : "carbo ✓"),
                      fatLeft != null && (fatLeft > 0 ? `${fatLeft}g gordura` : "gordura ✓"),
                    ].filter(Boolean).join(" · ")}.{protLeft != null && protLeft > 0 && " Prioriza a proteína."}</>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </ACard>

      {/* TREINO DE HOJE */}
      {todayWorkouts.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ ...S.label, marginBottom: 12 }}>Treino de hoje</div>
          {todayWorkouts.map(({ w, pct }) => (
            <div key={w.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                <span style={{ fontFamily: font.display, textTransform: "uppercase", letterSpacing: 0.6 }}>{w.name}</span>
                <span style={{ color: pct >= 1 ? T.green : T.accent, fontWeight: 700 }}>{Math.round(pct * 100)}%{pct >= 1 ? " ✓" : ""}</span>
              </div>
              <ProgressBar pct={pct} height={7} />
            </div>
          ))}
        </Card>
      )}

      {/* CARDIO DE HOJE */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={S.label}>Cardio de hoje</div>
          {cardioBurn > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: T.green }}>~{cardioBurn} kcal queimadas</span>}
        </div>
        {(data.cardio[today] || []).map((c) => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
            <span>🏃 {c.tipo || "Cardio"} — {c.min} min</span>
            <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ color: T.muted, fontSize: 12 }}>~{Number(c.kcal) || Math.round(c.min * 7)} kcal</span>
              <button style={{ background: "none", border: "none", color: T.red, cursor: "pointer" }} onClick={() => removeCardio(c.id)}>✕</button>
            </span>
          </div>
        ))}
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <input style={{ ...S.input, flex: "2 1 110px" }} placeholder="Ex: Esteira" value={cTipo} onChange={(e) => setCTipo(e.target.value)} />
          <input style={{ ...S.input, flex: "1 1 70px" }} type="number" placeholder="min" value={cMin} onChange={(e) => setCMin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCardio()} />
          <input style={{ ...S.input, flex: "1 1 70px" }} type="number" placeholder="kcal (opc.)" value={cKcal} onChange={(e) => setCKcal(e.target.value)} />
          <BtnShimmer onClick={addCardio} style={{ padding: "10px 16px" }}>+</BtnShimmer>
        </div>
        <p style={{ fontSize: 11, color: T.muted, marginTop: 8, marginBottom: 0 }}>Sem kcal informada, estimo ~7 kcal/min (moderado). Entra direto no saldo do dia.</p>
      </Card>

      {/* EVOLUÇÃO */}
      <Card>
        <div style={{ ...S.label, marginBottom: 12 }}>Evolução do peso</div>
        <WeightChart weights={p.weights} />
      </Card>

      <BtnShimmer onClick={fecharDia} green={dayClosed} style={{ width: "100%", marginTop: 14 }}>
        {dayClosed ? "✓ Resumo salvo no diário" : "📝 Fechar o dia — gerar resumo no diário"}
      </BtnShimmer>
    </div>
  );
}

// ============ TREINO ============
function TabTreino({ data, update, startRest }) {
  const [openDay, setOpenDay] = useState(null);
  const [newDay, setNewDay] = useState("");
  const [showAddDay, setShowAddDay] = useState(false);

  const addDay = () => {
    if (!newDay.trim()) return;
    update((d) => ({ ...d, workouts: [...d.workouts, { id: uid(), name: newDay.trim(), exercises: [] }] }));
    setNewDay(""); setShowAddDay(false);
  };
  const removeDay = (id) => {
    if (!confirm("Excluir este treino?")) return;
    update((d) => ({ ...d, workouts: d.workouts.filter((w) => w.id !== id) }));
    if (openDay === id) setOpenDay(null);
  };

  const day = data.workouts.find((w) => w.id === openDay);
  if (day) return <DayView day={day} data={data} update={update} onBack={() => setOpenDay(null)} startRest={startRest} />;

  return (
    <div>
      <SectionTitle action={<BtnShimmer onClick={() => setShowAddDay(!showAddDay)}>+ Treino</BtnShimmer>}>Meus Treinos</SectionTitle>

      {showAddDay && (
        <Card style={{ marginBottom: 14, display: "flex", gap: 8 }}>
          <input style={S.input} placeholder="Ex: Peito e Tríceps" value={newDay}
            onChange={(e) => setNewDay(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addDay()} autoFocus />
          <BtnShimmer onClick={addDay}>Criar</BtnShimmer>
        </Card>
      )}

      {data.workouts.length === 0 && !showAddDay && (
        <Card style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontFamily: font.display, fontSize: 18, textTransform: "uppercase", letterSpacing: 2, color: T.muted }}>Nenhum treino ainda</div>
          <p style={{ color: T.muted, fontSize: 13, marginTop: 8 }}>Crie sua divisão: Peito e Tríceps, Costas e Bíceps...</p>
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.workouts.map((w) => {
          const pct = workoutProgress(data, w);
          const started = pct > 0;
          return (
            <Card key={w.id} className="lift" onClick={() => setOpenDay(w.id)}
              style={{ cursor: "pointer", borderColor: pct >= 1 ? "rgba(74,222,128,0.4)" : started ? "rgba(245,165,36,0.4)" : T.border }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontFamily: font.display, fontSize: 18, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
                    {w.name}
                    {pct >= 1 && <span className="badge-green">CONCLUÍDO ✓</span>}
                  </div>
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
                    {w.exercises.length} exercício{w.exercises.length !== 1 ? "s" : ""}{started && ` · ${Math.round(pct * 100)}% hoje`}
                  </div>
                </div>
                <button style={{ ...S.btnGhost, padding: "6px 10px", color: T.red, borderColor: "transparent" }}
                  onClick={(e) => { e.stopPropagation(); removeDay(w.id); }}>✕</button>
              </div>
              {started && <div style={{ marginTop: 10 }}><ProgressBar pct={pct} height={6} /></div>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ExercisePicker({ onPick, onClose }) {
  const [group, setGroup] = useState(null);
  const [custom, setCustom] = useState("");
  const [sets, setSets] = useState(3);

  return (
    <ACard style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={S.label}>Adicionar exercício</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: T.muted }}>Séries:</span>
          <input style={{ ...S.input, width: 56, padding: "6px 8px", textAlign: "center" }} type="number" min={1} max={10}
            value={sets} onChange={(e) => setSets(e.target.value)} />
          <button style={{ ...S.btnGhost, padding: "6px 10px" }} onClick={onClose}>✕</button>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {Object.keys(EXDB).map((g) => (
          <button key={g} onClick={() => setGroup(group === g ? null : g)} className="chip"
            style={{
              background: group === g ? T.accentSoft : "rgba(255,255,255,0.04)",
              color: group === g ? T.accent : T.muted,
              borderColor: group === g ? "rgba(245,165,36,0.45)" : T.border,
            }}>{g}</button>
        ))}
      </div>

      {group && (
        <div className="fade-up" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {EXDB[group].map((name) => (
            <button key={name} onClick={() => onPick(name, Number(sets) || 3)} className="chip"
              style={{ background: T.cardSoft, color: T.text, borderColor: T.border, fontSize: 13 }}>+ {name}</button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <input style={S.input} placeholder="Ou digite um exercício personalizado..." value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && custom.trim()) { onPick(custom.trim(), Number(sets) || 3); setCustom(""); } }} />
        <BtnShimmer onClick={() => { if (custom.trim()) { onPick(custom.trim(), Number(sets) || 3); setCustom(""); } }}>+</BtnShimmer>
      </div>
    </ACard>
  );
}

function DayView({ day, data, update, onBack, startRest }) {
  const [showAdd, setShowAdd] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const pct = workoutProgress(data, day);
  const doneCount = day.exercises.filter((e) => exDoneToday(data, e.id)).length;

  const addExercise = (name, sets) => {
    update((d) => ({
      ...d, workouts: d.workouts.map((w) => w.id === day.id ? { ...w, exercises: [...w.exercises, { id: uid(), name, sets }] } : w),
    }));
  };
  const removeExercise = (exId) => {
    update((d) => ({
      ...d, workouts: d.workouts.map((w) => (w.id === day.id ? { ...w, exercises: w.exercises.filter((e) => e.id !== exId) } : w)),
    }));
  };
  const moveExercise = (exId, dir) => {
    update((d) => ({
      ...d, workouts: d.workouts.map((w) => {
        if (w.id !== day.id) return w;
        const i = w.exercises.findIndex((e) => e.id === exId);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= w.exercises.length) return w;
        const arr = w.exercises.slice();
        [arr[i], arr[j]] = [arr[j], arr[i]];
        return { ...w, exercises: arr };
      }),
    }));
  };
  const editExercise = (exId, name, sets) => {
    update((d) => ({
      ...d, workouts: d.workouts.map((w) => (w.id === day.id ? { ...w, exercises: w.exercises.map((e) => (e.id === exId ? { ...e, name, sets } : e)) } : w)),
    }));
  };
  const saveRename = () => {
    if (newName.trim()) {
      update((d) => ({ ...d, workouts: d.workouts.map((w) => (w.id === day.id ? { ...w, name: newName.trim() } : w)) }));
    }
    setRenaming(false);
  };

  return (
    <div>
      <button style={{ ...S.btnGhost, marginBottom: 14 }} onClick={onBack}>← Voltar</button>
      {renaming ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input style={S.input} value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveRename()} autoFocus />
          <BtnShimmer onClick={saveRename}>Salvar</BtnShimmer>
        </div>
      ) : (
        <SectionTitle action={
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...S.btnGhost, padding: "9px 12px" }} onClick={() => { setNewName(day.name); setRenaming(true); }}>✏️</button>
            <BtnShimmer onClick={() => setShowAdd(!showAdd)}>+ Exercício</BtnShimmer>
          </div>
        }>{day.name}</SectionTitle>
      )}

      {day.exercises.length > 0 && (
        <Card style={{ marginBottom: 14, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
            <span style={{ color: T.muted }}>Progresso de hoje</span>
            <span style={{ color: pct >= 1 ? T.green : T.accent, fontWeight: 700 }}>
              {doneCount}/{day.exercises.length} · {Math.round(pct * 100)}%{pct >= 1 && " — Treino fechado! 🔥"}
            </span>
          </div>
          <ProgressBar pct={pct} />
        </Card>
      )}

      {showAdd && <ExercisePicker onPick={addExercise} onClose={() => setShowAdd(false)} />}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {day.exercises.map((ex) => (
          <ExerciseCard key={`${ex.id}-${ex.sets}`} ex={ex} data={data} update={update} onRemove={() => removeExercise(ex.id)} startRest={startRest}
            onMove={(dir) => moveExercise(ex.id, dir)} onEdit={(name, sets) => editExercise(ex.id, name, sets)} />
        ))}
        {day.exercises.length === 0 && !showAdd && (
          <Card style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: 30 }}>Adicione os exercícios deste treino.</Card>
        )}
      </div>
    </div>
  );
}

function ExerciseCard({ ex, data, update, onRemove, startRest, onMove, onEdit }) {
  const history = (data.logs[ex.id] || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  const doneToday = exDoneToday(data, ex.id);
  const last = history.find((h) => h.date !== todayStr()) || history[0];
  const bestWeight = history.flatMap((s) => s.sets.map((st) => Number(st.peso) || 0)).reduce((a, b) => Math.max(a, b), 0);

  const [sets, setSets] = useState(() => Array.from({ length: ex.sets }, () => ({ peso: "", reps: "" })));
  const [showHist, setShowHist] = useState(false);
  const [chartMode, setChartMode] = useState("max");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSets, setEditSets] = useState(ex.sets);

  const setField = (i, field, val) => setSets((s) => s.map((st, j) => (j === i ? { ...st, [field]: val } : st)));

  const save = () => {
    const filled = sets.filter((s) => s.peso !== "" || s.reps !== "");
    if (!filled.length) return;
    const entry = { date: todayStr(), sets: filled.map((s) => ({ peso: Number(s.peso) || 0, reps: Number(s.reps) || 0 })) };
    update((d) => {
      const prev = d.logs[ex.id] || [];
      return { ...d, logs: { ...d.logs, [ex.id]: [...prev.filter((s) => s.date !== entry.date), entry] } };
    });
    if (startRest) startRest(Number(data.profile.restTime) || 90);
  };

  const todayMax = sets.map((s) => Number(s.peso) || 0).reduce((a, b) => Math.max(a, b), 0);
  const isPR = bestWeight > 0 && todayMax > bestWeight;

  return (
    <Card style={{
      borderColor: doneToday ? "rgba(74,222,128,0.45)" : T.border,
      background: doneToday ? "linear-gradient(rgba(74,222,128,0.05), rgba(74,222,128,0.02)), rgba(20,24,31,0.85)" : T.card,
      boxShadow: doneToday ? "0 0 24px rgba(74,222,128,0.12)" : undefined,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: font.display, fontSize: 16, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600, color: doneToday ? T.green : T.text }}>
            {doneToday && "✓ "}{ex.name}
            {isPR && <span className="badge-green">PR 🏆</span>}
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>
            {last
              ? `Última vez (${fmtDate(last.date)}): ${last.sets.map((s) => `${s.peso}kg×${s.reps}`).join("  ·  ")}`
              : "Primeiro registro — bora marcar território"}
            {bestWeight > 0 && <span style={{ color: T.accent }}> · Recorde: {bestWeight}kg</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          <button style={{ ...S.btnGhost, padding: "4px 8px", borderColor: "transparent", color: T.muted }}
            onClick={() => { setEditName(ex.name); setEditSets(ex.sets); setEditing(!editing); }}>✏️</button>
          <button style={{ ...S.btnGhost, padding: "4px 8px", color: T.red, borderColor: "transparent" }} onClick={onRemove}>✕</button>
        </div>
      </div>

      {editing && (
        <div className="fade-up" style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input style={{ ...S.input, flex: "2 1 140px" }} value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nome do exercício" />
          <input style={{ ...S.input, width: 64, textAlign: "center" }} type="number" min={1} max={10} value={editSets} onChange={(e) => setEditSets(e.target.value)} title="Nº de séries" />
          <button style={{ ...S.btnGhost, padding: "9px 12px" }} onClick={() => onMove(-1)} title="Mover para cima">↑</button>
          <button style={{ ...S.btnGhost, padding: "9px 12px" }} onClick={() => onMove(1)} title="Mover para baixo">↓</button>
          <BtnShimmer style={{ padding: "10px 14px" }} onClick={() => { onEdit(editName.trim() || ex.name, Number(editSets) || ex.sets); setEditing(false); }}>OK</BtnShimmer>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sets.map((s, i) => {
          const prev = last?.sets[i];
          return (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 26, fontFamily: font.display, color: T.muted, fontSize: 13, textAlign: "center" }}>{i + 1}ª</div>
              <input style={{ ...S.input, flex: 1 }} type="number" inputMode="decimal"
                placeholder={prev ? `${prev.peso} kg` : "peso (kg)"} value={s.peso} onChange={(e) => setField(i, "peso", e.target.value)} />
              <input style={{ ...S.input, flex: 1 }} type="number" inputMode="numeric"
                placeholder={prev ? `${prev.reps} reps` : "reps"} value={s.reps} onChange={(e) => setField(i, "reps", e.target.value)} />
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <BtnShimmer onClick={save} green={doneToday} style={{ flex: 1 }}>
          {doneToday ? "✓ Concluído — atualizar" : "Salvar cargas de hoje"}
        </BtnShimmer>
        {history.length > 0 && (
          <button style={S.btnGhost} onClick={() => setShowHist(!showHist)}>{showHist ? "Ocultar" : "Histórico"}</button>
        )}
      </div>

      {showHist && (
        <div className="fade-up" style={{ marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
          {history.length >= 2 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {[["max", "Carga máx"], ["vol", "Volume total"]].map(([mode, label]) => (
                  <button key={mode} className="chip" onClick={() => setChartMode(mode)}
                    style={{
                      background: chartMode === mode ? T.accentSoft : "rgba(255,255,255,0.04)",
                      color: chartMode === mode ? T.accent : T.muted,
                      borderColor: chartMode === mode ? "rgba(245,165,36,0.45)" : T.border,
                      fontSize: 11.5, padding: "6px 11px",
                    }}>{label}</button>
                ))}
              </div>
              <LineChart
                points={history.slice().sort((a, b) => a.date.localeCompare(b.date)).map((h) => ({
                  date: h.date,
                  value: chartMode === "max"
                    ? Math.max(...h.sets.map((s) => Number(s.peso) || 0))
                    : h.sets.reduce((acc, s) => acc + (Number(s.peso) || 0) * (Number(s.reps) || 0), 0),
                }))}
                unit="kg"
              />
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {history.slice(0, 10).map((h) => (
              <div key={h.date} style={{ fontSize: 12.5, color: T.muted, display: "flex", gap: 10 }}>
                <span style={{ color: T.text, minWidth: 78 }}>{fmtDate(h.date)}</span>
                <span>{h.sets.map((s) => `${s.peso}kg×${s.reps}`).join("  ·  ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ============ DIETA ============
function TabDieta({ data, update }) {
  const [showAdd, setShowAdd] = useState(false);
  const [mealName, setMealName] = useState("");
  const [mealTime, setMealTime] = useState("");
  const today = todayStr();
  const checks = data.dietChecks[today] || {};

  const addMeal = () => {
    if (!mealName.trim()) return;
    update((d) => ({ ...d, diet: [...d.diet, { id: uid(), name: mealName.trim(), time: mealTime, items: [] }] }));
    setMealName(""); setMealTime(""); setShowAdd(false);
  };
  const toggleMeal = (mealId) => {
    update((d) => ({
      ...d, dietChecks: { ...d.dietChecks, [today]: { ...(d.dietChecks[today] || {}), [mealId]: !(d.dietChecks[today] || {})[mealId] } },
    }));
  };
  const removeMeal = (id) => {
    if (!confirm("Excluir refeição?")) return;
    update((d) => ({ ...d, diet: d.diet.filter((m) => m.id !== id) }));
  };

  const totals = data.diet.reduce(
    (acc, m) => {
      const t = sumItems(m.items);
      ["kcal", "prot", "carb", "fat"].forEach((k) => { acc.plan[k] += t[k]; if (checks[m.id]) acc.done[k] += t[k]; });
      return acc;
    },
    { plan: { kcal: 0, prot: 0, carb: 0, fat: 0 }, done: { kcal: 0, prot: 0, carb: 0, fat: 0 } }
  );
  const doneCount = data.diet.filter((m) => checks[m.id]).length;
  const sorted = data.diet.slice().sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));

  return (
    <div>
      <SectionTitle action={<BtnShimmer onClick={() => setShowAdd(!showAdd)}>+ Refeição</BtnShimmer>}>Dieta de Hoje</SectionTitle>

      {data.diet.length > 0 && (
        <ACard style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 12 }}>
            <Stat label="Refeições" value={`${doneCount}/${data.diet.length}`} />
            {totals.plan.kcal > 0 && <Stat label="Kcal" value={`${totals.done.kcal}/${totals.plan.kcal}`} />}
            {totals.plan.prot > 0 && <Stat label="Proteína (g)" value={`${totals.done.prot}/${totals.plan.prot}`} accent />}
            {totals.plan.carb > 0 && <Stat label="Carbo (g)" value={`${totals.done.carb}/${totals.plan.carb}`} />}
            {totals.plan.fat > 0 && <Stat label="Gordura (g)" value={`${totals.done.fat}/${totals.plan.fat}`} />}
          </div>
          <ProgressBar pct={data.diet.length ? doneCount / data.diet.length : 0} height={6} />
        </ACard>
      )}

      {showAdd && (
        <Card style={{ marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input style={{ ...S.input, flex: "2 1 160px" }} placeholder="Ex: Almoço" value={mealName}
            onChange={(e) => setMealName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMeal()} autoFocus />
          <input style={{ ...S.input, flex: "1 0 110px" }} type="time" value={mealTime} onChange={(e) => setMealTime(e.target.value)} />
          <BtnShimmer onClick={addMeal}>Criar</BtnShimmer>
        </Card>
      )}

      {data.diet.length === 0 && !showAdd && (
        <Card style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontFamily: font.display, fontSize: 18, textTransform: "uppercase", letterSpacing: 2, color: T.muted }}>Nenhuma refeição</div>
          <p style={{ color: T.muted, fontSize: 13, marginTop: 8 }}>Monte seu plano com horários — o app te avisa na hora de comer.</p>
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sorted.map((meal) => (
          <MealCard key={meal.id} meal={meal} checked={!!checks[meal.id]} onToggle={() => toggleMeal(meal.id)} update={update} onRemove={() => removeMeal(meal.id)} />
        ))}
      </div>
    </div>
  );
}

function MealCard({ meal, checked, onToggle, update, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  const [food, setFood] = useState("");
  const [qty, setQty] = useState("");
  const [kcal, setKcal] = useState("");
  const [prot, setProt] = useState("");
  const [carb, setCarb] = useState("");
  const [fat, setFat] = useState("");

  const addItem = () => {
    if (!food.trim()) return;
    update((d) => ({
      ...d, diet: d.diet.map((m) => (m.id === meal.id ? { ...m, items: [...m.items, { id: uid(), food: food.trim(), qty: qty.trim(), kcal, prot, carb, fat }] } : m)),
    }));
    setFood(""); setQty(""); setKcal(""); setProt(""); setCarb(""); setFat("");
  };
  const removeItem = (itemId) => {
    update((d) => ({ ...d, diet: d.diet.map((m) => (m.id === meal.id ? { ...m, items: m.items.filter((i) => i.id !== itemId) } : m)) }));
  };
  const setTime = (time) => {
    update((d) => ({ ...d, diet: d.diet.map((m) => (m.id === meal.id ? { ...m, time } : m)) }));
  };

  const t = sumItems(meal.items);

  return (
    <Card style={{ borderColor: checked ? "rgba(74,222,128,0.4)" : T.border, opacity: checked ? 0.85 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onToggle}
          style={{
            width: 26, height: 26, borderRadius: 8, flexShrink: 0, cursor: "pointer",
            border: `2px solid ${checked ? T.green : T.border}`,
            background: checked ? T.greenSoft : "transparent",
            color: T.green, fontSize: 14, fontWeight: 800, lineHeight: 1,
            boxShadow: checked ? "0 0 12px rgba(74,222,128,0.35)" : "none",
          }}>{checked ? "✓" : ""}</button>
        <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
          <div style={{ fontFamily: font.display, fontSize: 16, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600, textDecoration: checked ? "line-through" : "none" }}>
            {meal.time && <span style={{ color: T.accent, marginRight: 8 }}>{meal.time}</span>}{meal.name}
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
            {meal.items.length} item{meal.items.length !== 1 ? "s" : ""}
            {t.kcal > 0 && ` · ${t.kcal} kcal`}
            {t.prot > 0 && ` · ${t.prot}P`}
            {t.carb > 0 && ` · ${t.carb}C`}
            {t.fat > 0 && ` · ${t.fat}G`}
          </div>
        </div>
        <button style={{ ...S.btnGhost, padding: "4px 8px", borderColor: "transparent", color: T.muted }} onClick={() => setExpanded(!expanded)}>{expanded ? "▲" : "▼"}</button>
        <button style={{ ...S.btnGhost, padding: "4px 8px", color: T.red, borderColor: "transparent" }} onClick={onRemove}>✕</button>
      </div>

      {expanded && (
        <div className="fade-up" style={{ marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={S.label}>Horário do aviso:</span>
            <input style={{ ...S.input, width: 120 }} type="time" value={meal.time || ""} onChange={(e) => setTime(e.target.value)} />
          </div>
          {meal.items.map((it) => (
            <div key={it.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "5px 0" }}>
              <span>{it.food} {it.qty && <span style={{ color: T.muted }}>— {it.qty}</span>}</span>
              <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ color: T.muted, fontSize: 12 }}>
                  {[it.kcal && `${it.kcal}kcal`, it.prot && `${it.prot}P`, it.carb && `${it.carb}C`, it.fat && `${it.fat}G`].filter(Boolean).join(" · ")}
                </span>
                <button style={{ background: "none", border: "none", color: T.red, cursor: "pointer", fontSize: 12 }} onClick={() => removeItem(it.id)}>✕</button>
              </span>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            <input style={{ ...S.input, flex: "2 1 130px" }} placeholder="Alimento" value={food} onChange={(e) => setFood(e.target.value)} />
            <input style={{ ...S.input, flex: "1 1 80px" }} placeholder="Qtd (ex: 150g)" value={qty} onChange={(e) => setQty(e.target.value)} />
            <input style={{ ...S.input, flex: "1 1 60px" }} type="number" placeholder="kcal" value={kcal} onChange={(e) => setKcal(e.target.value)} />
            <input style={{ ...S.input, flex: "1 1 60px" }} type="number" placeholder="prot" value={prot} onChange={(e) => setProt(e.target.value)} />
            <input style={{ ...S.input, flex: "1 1 60px" }} type="number" placeholder="carbo" value={carb} onChange={(e) => setCarb(e.target.value)} />
            <input style={{ ...S.input, flex: "1 1 60px" }} type="number" placeholder="gord" value={fat} onChange={(e) => setFat(e.target.value)} />
            <BtnShimmer onClick={addItem} style={{ padding: "10px 16px" }}>+</BtnShimmer>
          </div>
          <p style={{ fontSize: 11, color: T.muted, marginTop: 8, marginBottom: 0 }}>Dica: preenchendo só os macros (P/C/G), as kcal são calculadas automático.</p>
        </div>
      )}
    </Card>
  );
}

// ============ DIÁRIO ============
function TabDiario({ data, update }) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  const addCard = () => {
    if (!title.trim() && !notes.trim()) return;
    update((d) => ({
      ...d, journal: [{ id: uid(), date: todayStr(), title: title.trim() || "Registro do dia", notes: notes.trim() }, ...d.journal],
    }));
    setTitle(""); setNotes(""); setShowAdd(false);
  };
  const removeCard = (id) => {
    if (!confirm("Excluir card?")) return;
    update((d) => ({ ...d, journal: d.journal.filter((c) => c.id !== id) }));
  };

  return (
    <div>
      <SectionTitle action={<BtnShimmer onClick={() => setShowAdd(!showAdd)}>+ Card</BtnShimmer>}>Diário</SectionTitle>

      {showAdd && (
        <ACard style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input style={S.input} placeholder="Título — Ex: Treino A + cardio 20min" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            <textarea style={{ ...S.input, minHeight: 90, resize: "vertical" }}
              placeholder="O que foi feito hoje: treino, dieta, cardio, como se sentiu..."
              value={notes} onChange={(e) => setNotes(e.target.value)} />
            <BtnShimmer onClick={addCard}>Salvar card de hoje</BtnShimmer>
          </div>
        </ACard>
      )}

      {data.journal.length === 0 && !showAdd && (
        <Card style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontFamily: font.display, fontSize: 18, textTransform: "uppercase", letterSpacing: 2, color: T.muted }}>Diário vazio</div>
          <p style={{ color: T.muted, fontSize: 13, marginTop: 8 }}>Registre o que fez em cada dia — consistência é o jogo.</p>
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {data.journal.map((c) => (
          <Card key={c.id} className="lift" style={{ borderLeft: `3px solid ${T.accent}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ ...S.label, color: T.accent }}>{fmtDate(c.date)}</div>
                <div style={{ fontFamily: font.display, fontSize: 17, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 600, marginTop: 4 }}>{c.title}</div>
              </div>
              <button style={{ ...S.btnGhost, padding: "4px 8px", color: T.red, borderColor: "transparent" }} onClick={() => removeCard(c.id)}>✕</button>
            </div>
            {c.notes && <p style={{ fontSize: 14, marginTop: 8, marginBottom: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{c.notes}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ PERFIL ============
function PField({ label, value, onChange, type = "number", placeholder, step }) {
  return (
    <div>
      <div style={{ ...S.label, marginBottom: 6 }}>{label}</div>
      <input style={S.input} type={type} step={step} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function TabPerfil({ data, update, onLogout, userEmail }) {
  const p = data.profile;
  const [notifStatus, setNotifStatus] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");

  const setField = (field, value) => update((d) => ({ ...d, profile: { ...d.profile, [field]: value } }));
  const setMedida = (field, value) => update((d) => ({ ...d, profile: { ...d.profile, medidas: { ...d.profile.medidas, [field]: value } } }));

  const peso = currentWeight(p) || Number(p.startWeight) || null;
  const imc = calcIMC(peso, Number(p.height));
  const tmb = calcTMB(p, peso);
  const tdee = tmb ? Math.round(tmb * activityFactor(p)) : null;
  const sugKcal = tdee ? tdee - 500 : null;
  const sugProt = peso ? Math.round(peso * 2) : null;
  const sugFat = peso ? Math.round(peso * 0.8) : null;
  const sugCarb = sugKcal && sugProt && sugFat ? Math.max(0, Math.round((sugKcal - 4 * sugProt - 9 * sugFat) / 4)) : null;

  const askNotif = async () => {
    try {
      const perm = await Notification.requestPermission();
      setNotifStatus(perm);
      if (perm === "granted") notifyUser("IronTrack 💪", "Notificações ativadas! Vou te cobrar nos horários certos.");
    } catch { setNotifStatus("denied"); }
  };

  const MEDIDAS = [
    ["braco", "Braço"], ["peito", "Peitoral"], ["cintura", "Cintura"],
    ["quadril", "Quadril"], ["coxa", "Coxa"], ["panturrilha", "Panturrilha"],
  ];

  return (
    <div>
      <SectionTitle>Perfil</SectionTitle>

      {/* DADOS */}
      <Card style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ ...S.label }}>Dados pessoais</div>
        <div>
          <div style={{ ...S.label, marginBottom: 6 }}>Nome</div>
          <input style={S.input} type="text" placeholder="Seu nome" value={p.name} onChange={(e) => setField("name", e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <PField label="Idade" value={p.age} onChange={(v) => setField("age", v)} placeholder="anos" />
          <div>
            <div style={{ ...S.label, marginBottom: 6 }}>Sexo</div>
            <select style={{ ...S.input }} value={p.sex} onChange={(e) => setField("sex", e.target.value)}>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </select>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <PField label="Altura (cm)" value={p.height} onChange={(v) => setField("height", v)} placeholder="cm" />
          <PField label="Peso inicial" value={p.startWeight} onChange={(v) => setField("startWeight", v)} placeholder="kg" step="0.1" />
          <PField label="Meta (kg)" value={p.goalWeight} onChange={(v) => setField("goalWeight", v)} placeholder="kg" step="0.1" />
        </div>
      </Card>

      {/* ROTINA */}
      <Card style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={S.label}>Rotina de treino</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <PField label="Treinos / semana" value={p.trainWeek} onChange={(v) => setField("trainWeek", v)} placeholder="ex: 5" />
          <PField label="Cardio (min/sem)" value={p.cardioWeek} onChange={(v) => setField("cardioWeek", v)} placeholder="ex: 120" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <PField label="Meta kcal/dia" value={p.kcalTarget} onChange={(v) => setField("kcalTarget", v)} placeholder={sugKcal ? `sugestão: ${sugKcal}` : "kcal"} />
          <PField label="Meta proteína/dia" value={p.protTarget} onChange={(v) => setField("protTarget", v)} placeholder={sugProt ? `sugestão: ${sugProt}g` : "g"} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <PField label="Meta carbo/dia" value={p.carbTarget} onChange={(v) => setField("carbTarget", v)} placeholder={sugCarb ? `sugestão: ${sugCarb}g` : "g"} />
          <PField label="Meta gordura/dia" value={p.fatTarget} onChange={(v) => setField("fatTarget", v)} placeholder={sugFat ? `sugestão: ${sugFat}g` : "g"} />
        </div>
        <PField label="Descanso entre séries (segundos)" value={p.restTime} onChange={(v) => setField("restTime", v)} placeholder="90" />
      </Card>

      {/* SAÚDE CALCULADA */}
      <ACard hot style={{ marginBottom: 12 }}>
        <div style={{ ...S.label, marginBottom: 12 }}>Saúde calculada</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Stat label="IMC" value={imc ? imc.toFixed(1) : "—"} sub={imcClass(imc)} accent={imc && imc >= 18.5 && imc < 25 ? false : true} />
          <Stat label="TMB" value={tmb ? tmb : "—"} sub="kcal basal/dia" />
          <Stat label="Gasto total" value={tdee ? tdee : "—"} sub="kcal/dia estimado" accent />
        </div>
        {tdee && (
          <p style={{ fontSize: 12, color: T.muted, marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}>
            TMB por Mifflin-St Jeor + fator de atividade da sua rotina. Pra cutting clássico, déficit de ~500 kcal → meta de <b style={{ color: T.accent }}>{tdee - 500} kcal/dia</b> com proteína alta ({peso ? `~${Math.round(peso * 2)}g` : "2g/kg"}) pra segurar a massa. São estimativas — ajusta pela balança e espelho semana a semana.
          </p>
        )}
      </ACard>

      {/* MEDIDAS */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ ...S.label, marginBottom: 12 }}>Medidas (cm)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {MEDIDAS.map(([key, label]) => (
            <div key={key}>
              <div style={{ ...S.label, marginBottom: 6 }}>{label}</div>
              <input style={S.input} type="number" step="0.5" placeholder="cm" value={p.medidas[key]} onChange={(e) => setMedida(key, e.target.value)} />
            </div>
          ))}
        </div>
      </Card>

      {/* NOTIFICAÇÕES */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ ...S.label, marginBottom: 10 }}>Notificações</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: T.muted, flex: 1 }}>Lembrete de treino às:</span>
          <input style={{ ...S.input, width: 120 }} type="time" value={p.trainTime || ""} onChange={(e) => setField("trainTime", e.target.value)} />
        </div>
        {data.diet.length > 0 ? (
          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12, marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ ...S.label, marginBottom: 2 }}>Avisos de refeição</div>
            {data.diet.slice().sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99")).map((m) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, color: T.muted, flex: 1 }}>{m.name}</span>
                <input
                  style={{ ...S.input, width: 120 }} type="time" value={m.time || ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    update((d) => ({ ...d, diet: d.diet.map((x) => (x.id === m.id ? { ...x, time: v } : x)) }));
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: T.muted, margin: "0 0 12px" }}>Crie suas refeições na aba Dieta e os horários de aviso aparecem aqui.</p>
        )}
        <BtnShimmer onClick={askNotif} green={notifStatus === "granted"} disabled={notifStatus === "granted"} style={{ width: "100%" }}>
          {notifStatus === "granted" ? "✓ Notificações do navegador ativas" : "Ativar notificações do navegador"}
        </BtnShimmer>
        <p style={{ fontSize: 11.5, color: T.muted, marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
          Avisos de refeição e treino disparam com o app aberto (banner + notificação do navegador). Push com app fechado exige PWA com service worker, estilo TioTrack.
        </p>
      </Card>

      {/* HISTÓRICO */}
      {(p.weights || []).length > 0 && (
        <Card>
          <div style={{ ...S.label, marginBottom: 10 }}>Histórico de peso</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(p.weights || []).slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15).map((w) => (
              <div key={w.date} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: T.muted }}>{fmtDate(w.date)}</span>
                <span style={{ fontWeight: 700 }}>{w.peso} kg</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <button
        style={{ ...S.btnGhost, width: "100%", marginTop: 12, color: T.red, borderColor: "rgba(248,113,113,0.3)", padding: "12px" }}
        onClick={onLogout}
      >
        Sair da conta{userEmail ? ` (${userEmail})` : ""}
      </button>
    </div>
  );
}

// ============ ÍCONES DA NAV (SVG stroke, estilo lucide) ============
const NAV_ICONS = {
  dash: <><path d="m12 14 4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" /></>,
  treino: <><path d="M14.4 14.4 9.6 9.6" /><path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z" /><path d="m21.5 21.5-1.4-1.4" /><path d="M3.9 3.9 2.5 2.5" /><path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z" /></>,
  dieta: <><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" /></>,
  diario: <><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></>,
  perfil: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
};

// ============ APP ============
export default function IronTrack({ user, onLogout }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("dash");
  const [banner, setBanner] = useState(null);
  const notified = useRef(new Set());

  useEffect(() => {
    loadRemote(user.id).then((raw) => {
      const d = mergeData(raw);
      const today = todayStr();
      if (d.lastOpen && d.lastOpen < today) {
        const gap = Math.round((new Date(today) - new Date(d.lastOpen)) / 86400000);
        if (gap >= 2) setBanner({ title: `${gap} dias sumido! 👀`, text: "O shape não se constrói sozinho. " + randPhrase() });
      }
      const next = { ...d, lastOpen: today };
      setData(next);
      saveRemote(user.id, next);
    });
  }, []);

  const update = (fn) => {
    setData((prev) => {
      const next = fn(prev);
      saveRemote(user.id, next);
      return next;
    });
  };

  // timer de descanso entre séries
  const [rest, setRest] = useState(null);
  const startRest = (secs) => setRest({ left: secs, total: secs });
  useEffect(() => {
    if (!rest || rest.left <= 0) return;
    const id = setTimeout(() => {
      setRest((r) => {
        if (!r) return null;
        const left = r.left - 1;
        if (left <= 0) {
          beep();
          setBanner({ title: "⏱️ Descanso acabou!", text: "Próxima série — sem moleza! 🔥" });
          notifyUser("Descanso acabou! ⏱️", "Próxima série — sem moleza!");
          return null;
        }
        return { ...r, left };
      });
    }, 1000);
    return () => clearTimeout(id);
  }, [rest]);

  useEffect(() => {
    if (!data) return;
    const check = () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const today = todayStr();
      const checks = data.dietChecks[today] || {};

      data.diet.forEach((m) => {
        const key = `${today}:meal:${m.id}`;
        if (m.time && m.time === hhmm && !checks[m.id] && !notified.current.has(key)) {
          notified.current.add(key);
          const phrase = randPhrase();
          setBanner({ title: `🍗 Hora do ${m.name}!`, text: phrase });
          notifyUser(`Hora do ${m.name}! 🍗`, phrase);
        }
      });

      const p = data.profile;
      const trainKey = `${today}:train`;
      const anyLogToday = Object.values(data.logs).flat().some((h) => h.date === today);
      if (p.trainTime && p.trainTime === hhmm && !anyLogToday && !notified.current.has(trainKey)) {
        notified.current.add(trainKey);
        const phrase = randPhrase();
        setBanner({ title: "🏋️ Hora do treino!", text: phrase });
        notifyUser("Hora do treino! 🏋️", phrase);
      }
    };
    check();
    const id = setInterval(check, 20000);
    return () => clearInterval(id);
  }, [data]);

  const tabs = [
    { id: "dash", label: "Dash" },
    { id: "treino", label: "Treino" },
    { id: "dieta", label: "Dieta" },
    { id: "diario", label: "Diário" },
    { id: "perfil", label: "Perfil" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: font.body, position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;600;700&display=swap');
        @property --ga { syntax: '<angle>'; initial-value: 0deg; inherits: false; }

        input::placeholder, textarea::placeholder { color: #565b64; }
        input:focus, textarea:focus, select:focus { border-color: ${T.accent} !important; box-shadow: 0 0 0 3px rgba(245,165,36,0.12); }
        * { -webkit-tap-highlight-color: transparent; }
        input[type="time"], select { color-scheme: dark; }
        select { appearance: none; }

        /* fundo dot grid + aurora (Aceternity style) */
        .bg-fx { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
        .bg-dots {
          position: absolute; inset: 0;
          background-image: radial-gradient(circle, rgba(139,145,156,0.14) 1px, transparent 1px);
          background-size: 26px 26px;
          mask-image: radial-gradient(ellipse 90% 60% at 50% 0%, black 30%, transparent 75%);
          -webkit-mask-image: radial-gradient(ellipse 90% 60% at 50% 0%, black 30%, transparent 75%);
        }
        .bg-aurora {
          position: absolute; top: -180px; left: 50%; width: 560px; height: 420px;
          transform: translateX(-50%);
          background: radial-gradient(ellipse at center, rgba(245,165,36,0.16), rgba(245,165,36,0.05) 45%, transparent 70%);
          filter: blur(48px);
          animation: aurora 9s ease-in-out infinite alternate;
        }
        @keyframes aurora {
          from { transform: translateX(-58%) scale(1) rotate(-4deg); opacity: .8; }
          to   { transform: translateX(-42%) scale(1.15) rotate(4deg); opacity: 1; }
        }

        /* card padrão */
        .card {
          background: ${T.card}; border: 1px solid ${T.border}; border-radius: ${T.radius}px;
          padding: 16px; backdrop-filter: blur(10px);
          transition: transform .2s ease, border-color .2s, box-shadow .25s;
        }
        .lift:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(0,0,0,0.35); border-color: rgba(245,165,36,0.35); }

        /* borda em gradiente animado (Aceternity border gradient) */
        .acard { position: relative; border-radius: ${T.radius}px; padding: 1px; overflow: hidden; }
        .acard::before {
          content: ''; position: absolute; inset: -60%;
          background: conic-gradient(from var(--ga), transparent 0deg, transparent 300deg, rgba(245,165,36,0.55) 330deg, rgba(255,210,122,0.9) 345deg, rgba(245,165,36,0.55) 358deg, transparent 360deg);
          animation: spinBorder 5.5s linear infinite;
        }
        .acard-hot::before {
          background: conic-gradient(from var(--ga), transparent 0deg, transparent 280deg, rgba(245,165,36,0.7) 315deg, #FFD27A 340deg, rgba(74,222,128,0.6) 352deg, transparent 360deg);
          animation-duration: 4s;
        }
        @keyframes spinBorder { to { --ga: 360deg; } }
        .acard-inner {
          position: relative; z-index: 1;
          background: linear-gradient(180deg, rgba(24,28,36,0.98), rgba(17,21,27,0.98));
          border-radius: ${T.radius - 1}px; padding: 16px;
        }
        @media (prefers-reduced-motion: reduce) {
          .acard::before, .bg-aurora, .btn-shimmer { animation: none !important; }
        }

        /* botão shimmer (Aceternity shimmer button) */
        .btn-shimmer {
          background: linear-gradient(110deg, ${T.accent} 40%, ${T.accent2} 50%, ${T.accent} 60%);
          background-size: 220% 100%;
          animation: shimmer 3.2s linear infinite;
          color: #0a0c10; border: none; border-radius: 12px;
          padding: 11px 18px; font-weight: 800; font-size: 13px; letter-spacing: .4px;
          cursor: pointer; font-family: 'Inter', sans-serif;
          box-shadow: 0 4px 18px rgba(245,165,36,0.28);
          transition: transform .15s ease, box-shadow .2s;
        }
        .btn-shimmer:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(245,165,36,0.4); }
        .btn-shimmer:active { transform: translateY(0) scale(.98); }
        .btn-green {
          background: linear-gradient(110deg, ${T.green} 40%, #86efac 50%, ${T.green} 60%);
          background-size: 220% 100%;
          box-shadow: 0 4px 18px rgba(74,222,128,0.28);
        }
        @keyframes shimmer { to { background-position: -220% 0; } }

        .chip {
          border: 1px solid; border-radius: 20px; padding: 8px 13px;
          font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif;
          transition: all .18s ease;
        }
        .chip:hover { transform: translateY(-1px); }

        .badge-green {
          margin-left: 8px; font-size: 11px; background: ${T.greenSoft}; color: ${T.green};
          padding: 2px 8px; border-radius: 20px; letter-spacing: .5px;
          border: 1px solid rgba(74,222,128,0.3);
        }

        .fade-up { animation: fadeUp .35s cubic-bezier(.4,0,.2,1); }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideDown { from { transform: translateY(-110%); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes slideUp { from { transform: translateY(120%); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>

      <div className="bg-fx">
        <div className="bg-dots" />
        <div className="bg-aurora" />
      </div>

      {banner && (
        <div style={{
          position: "fixed", top: 12, left: 12, right: 12, zIndex: 50,
          background: "rgba(20,24,31,0.97)", border: `1px solid ${T.accent}`, borderRadius: 14,
          padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start",
          boxShadow: "0 8px 40px rgba(245,165,36,0.2), 0 8px 30px rgba(0,0,0,0.5)",
          animation: "slideDown .35s cubic-bezier(.4,0,.2,1)", maxWidth: 600, margin: "0 auto", backdropFilter: "blur(12px)",
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: font.display, fontSize: 16, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, color: T.accent }}>{banner.title}</div>
            <div style={{ fontSize: 13.5, marginTop: 4 }}>{banner.text}</div>
          </div>
          <button style={{ ...S.btnGhost, padding: "4px 10px", borderColor: "transparent" }} onClick={() => setBanner(null)}>✕</button>
        </div>
      )}

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px 104px", position: "relative", zIndex: 1 }}>
        <header style={{ marginBottom: 22, display: "flex", alignItems: "baseline", gap: 10 }}>
          <h1 style={{ fontFamily: font.display, fontSize: 28, margin: 0, textTransform: "uppercase", letterSpacing: 3, fontWeight: 700 }}>
            Iron<span style={{ color: T.accent, textShadow: "0 0 24px rgba(245,165,36,0.6)" }}>Track</span>
          </h1>
          <span style={{ fontSize: 12, color: T.muted }}>{fmtDate(todayStr())}</span>
        </header>

        {data === null ? (
          <div className="card" style={{ textAlign: "center", color: T.muted, padding: 40 }}>Carregando...</div>
        ) : (
          <div key={tab} className="fade-up">
            {tab === "dash" && <TabDash data={data} update={update} />}
            {tab === "treino" && <TabTreino data={data} update={update} startRest={startRest} />}
            {tab === "dieta" && <TabDieta data={data} update={update} />}
            {tab === "diario" && <TabDiario data={data} update={update} />}
            {tab === "perfil" && <TabPerfil data={data} update={update} onLogout={onLogout} userEmail={user?.email} />}
          </div>
        )}
      </div>

      {rest && (
        <div style={{
          position: "fixed", bottom: 92, left: 16, right: 16, zIndex: 45, maxWidth: 480, margin: "0 auto",
          background: "rgba(20,24,31,0.97)", border: "1px solid rgba(245,165,36,0.45)", borderRadius: 16,
          padding: "12px 16px", backdropFilter: "blur(14px)",
          boxShadow: "0 8px 40px rgba(245,165,36,0.18), 0 8px 30px rgba(0,0,0,0.5)",
          animation: "slideUp .3s cubic-bezier(.4,0,.2,1)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 18 }}>⏱️</span>
            <span style={{ fontFamily: font.display, fontSize: 26, fontWeight: 700, color: T.accent, minWidth: 64 }}>
              {Math.floor(rest.left / 60)}:{String(rest.left % 60).padStart(2, "0")}
            </span>
            <span style={{ fontSize: 12, color: T.muted, flex: 1 }}>descanso</span>
            <button className="chip"
              style={{ background: T.accentSoft, color: T.accent, borderColor: "rgba(245,165,36,0.4)", fontSize: 11.5, padding: "6px 11px" }}
              onClick={() => setRest((r) => r && { ...r, left: r.left + 30, total: r.total + 30 })}>+30s</button>
            <button style={{ ...S.btnGhost, padding: "6px 10px", borderColor: "transparent", color: T.muted }} onClick={() => setRest(null)}>✕</button>
          </div>
          <ProgressBar pct={Math.min(rest.left / rest.total, 0.999)} height={5} />
        </div>
      )}

      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40,
        background: "rgba(10,12,16,0.85)", backdropFilter: "blur(16px)",
        borderTop: `1px solid ${T.border}`,
        display: "flex", justifyContent: "center", gap: 2, padding: "8px 8px calc(8px + env(safe-area-inset-bottom))",
      }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              flex: 1, maxWidth: 120,
              background: tab === t.id ? T.accentSoft : "transparent",
              border: tab === t.id ? "1px solid rgba(245,165,36,0.3)" : "1px solid transparent",
              borderRadius: 12, padding: "8px 4px", cursor: "pointer",
              color: tab === t.id ? T.accent : T.muted, fontFamily: font.body, fontWeight: 700, fontSize: 11.5,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              transition: "all .2s", boxShadow: tab === t.id ? "0 0 18px rgba(245,165,36,0.15)" : "none",
            }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{NAV_ICONS[t.id]}</svg>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
