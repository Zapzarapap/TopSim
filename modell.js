// TOPSIM Spielwiese – Rechenmodell (Unternehmen 1, Copy Classic, Markt 1)
// Läuft im Browser (index.html) und in Node (tools/pruefen.mjs).
//
// Jede berechnete Größe wird mit def() abgelegt: Wert, Rechenweg mit eingesetzten Zahlen, Quelle,
// Verlässlichkeit und die Größen, aus denen sie entsteht. Die Oberfläche zeigt genau diese Einträge an.
//
// Verlässlichkeit (Feld s):
//   'ein'     Eingabe im Entscheidungsformular
//   'ist'     Ist-Wert aus dem Sammelbericht
//   'regel'   Spielregel aus dem Handbuch oder Wert aus den Wirtschaftsnachrichten
//   'kalib'   aus den bisherigen Berichten abgeleitet, kann sich etwas ändern
//   'schaetz' Schätzung, vor allem Nachfrage und Verhalten der Konkurrenz
// Eine Größe ist so unsicher wie ihre unsicherste Zutat (Feld sg, wird am Ende berechnet).

export const STUFE = { ein: 0, ist: 0, regel: 0, kalib: 1, schaetz: 2 };

// Spielregeln aus dem Teilnehmerhandbuch (S. = Seite)
export const R = {
  transport: [25, 'Handbuch S. 13: 25 EUR Verpackung/Transport je Stück im Inland'],
  mafo: [0.1, 'Handbuch S. 15: Marktforschungsbericht 100.000 EUR'],
  zahl_sofort: [0.8, 'Handbuch S. 30: 80 % der Umsatzerlöse Markt 1 sofort, 20 % in der Folgeperiode; Großabnehmer/Ausschreibung 100 % sofort'],
  staffel: [[0, 30000, 50000, 70000], 'Handbuch S. 17: Preisstaffel Einsatzstoffe (bis <30.000 / <50.000 / <70.000 / ab 70.000)'],
  nachl: [0.2, 'Handbuch S. 17: Fehlmengen werden automatisch mit 20 % Aufschlag nachgeliefert (P0: 650 × 1,2 = 780 EUR)'],
  lager_es: [50, 'Handbuch S. 17: Lagerkosten Einsatzstoffe 50 EUR/Einheit (auf den Endbestand)'],
  lager_fe: [100, 'Handbuch S. 17: Lagerkosten Fertigprodukte 100 EUR/Stück (auf den Endbestand)'],
  max_anl: [9, 'Handbuch S. 20: max. 9 Anlagen je Typ'],
  anl: [{ A: { nd: 10, kap: 14000, fix: 0.3, umw: 100, rest: 0.2 }, B: { nd: 10, kap: 18000, fix: 2.0, umw: 105, rest: 0.25 }, C: { nd: 15, kap: 22000, fix: 2.5, umw: 110, rest: 0.3 } },
    'Handbuch S. 20–21: Nutzungsdauer, Kapazität, sonstige Fixkosten, Umweltindex, Resterlös bei Verkauf'],
  ueberstunden: [0.1, 'Handbuch S. 22/28: Überstunden max. +10 % (Anlagen und Personal)'],
  zusatzschicht: [2.5, 'Handbuch S. 22/28: Überstunden bei Anlagen oder Personal → 2,5 MEUR sprungfixe Kosten'],
  ue_zuschlag: [0.25, 'Handbuch S. 28: Überstundenzuschlag 25 % auf die Löhne der Überstundenzeit'],
  grundprod: [50, 'Handbuch S. 28: Grundproduktivität 50 Geräte je Fertigungsmitarbeiter und Periode'],
  pension: [0.05, 'Handbuch S. 27: Pensionsrückstellung 5 % der Lohn- und Gehaltssumme'],
  pnk_min: [37, 'Handbuch S. 26: Personalnebenkosten mindestens 37 %'],
  sp_schwelle: [0.1, 'Handbuch S. 27: Sozialplan ab mehr als 10 % Entlassungen je Abteilung'],
  afa_geb: [0.25, 'Handbuch S. 35: Abschreibung Gebäude 0,25 MEUR je Periode'],
  geb: [{ ek: 0.05, fe: 0.70, fue: 0.05, vt: 0.05, vw: 0.15 }, 'Handbuch S. 35: Verteilung Gebäude-AfA auf Kostenstellen'],
  ih_verw: [1.0, 'Handbuch S. 35: Wartungsverträge Verwaltung 1 MEUR je Periode'],
  nd_umwelt: [10, 'Handbuch S. 23: Umweltanlagen werden über 10 Perioden abgeschrieben'],
  steuer: [0.45, 'Handbuch S. 33: 45 % Steuern auf den Gewinn vor Steuern'],
  kasse_min: [0.1, 'Handbuch S. 31: Mindestkasse 0,1 MEUR, sonst automatischer Überziehungskredit'],
  po_ref: [[2.5, 0.04], 'Handbuch S. 28–29: 2,5 MEUR Prozessoptimierung ≈ Index 1,04'],
};
const r = k => R[k][0];

export const TAB = {
  ih: { x: [0.1, 0.5, 0.7, 1, 1.5, 3, 4], y: [0.5, 0.7, 0.8, 0.95, 0.97, 0.99, 1], q: 'Handbuch S. 22: Instandhaltung je Anlage → Verfügbarkeitsgrad (dazwischen linear)' },
  ua: { x: [85, 90, 92.5, 95, 98, 100], y: [5, 2.5, 1.5, 1, 0.5, 0], q: 'Handbuch S. 23: Umweltindex → Abgabe (dazwischen linear; bestätigt mit P1: 94,45 → 1,11 MEUR)' },
  sp: { x: [0, 0.1, 0.2, 0.4], y: [0, 15000, 20000, 25000], q: 'Handbuch S. 27: Sozialplankosten je Entlassung' },
  pe: { x: [50, 100, 150, 200, 250, 300, 350], y: [10, 15, 18, 20.5, 23, 24.3, 25.5], q: 'Handbuch S. 26: Personalbedarf Einkauf je Umsatz (aus der Grafik abgelesen)' },
  pv: { x: [50, 75, 100, 150, 200, 250, 300, 350], y: [150, 185, 200, 225, 250, 265, 275, 285], q: 'Handbuch S. 26: Personalbedarf Verwaltung je Umsatz (aus der Grafik abgelesen)' },
  rt: { l: ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D'], y: [-0.04, -0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03, 0.04, 0.05], q: 'Handbuch S. 32: Rating der Vorperiode → Zinsänderung' },
};

// Aus mehreren Berichten abgeleitete Zusammenhänge (nicht im Handbuch beziffert)
export const KAL = {
  einarb: { schwelle: 0.0586, steigung: 0.466, q: 'P0: 5,86 % neue MA → Index 1,000; P1: 8,22 % → 0,989. Darüber linear fortgeschrieben (2 Datenpunkte).' },
  umwelt: { a: 1.3128, b: 0.737, q: 'Verbesserung = 1,313 × (kumulierte Umweltinvestition)^0,737. Exakt durch P0 (1,5 MEUR → 1,77 Punkte) und P1 (3,0 MEUR → 2,95 Punkte), also abnehmender Nutzen.' },
  pq_ocf: { k: 2.4, q: 'TNB17 P1: 12,48 MEUR Abweichung → 70,09 Punkte, also etwa 2,4 Punkte Abzug je MEUR (1 Datenpunkt)' },
};

const n = v => (v == null || v === '' || isNaN(+v)) ? 0 : +v;
const rnd = x => Math.round(x + 1e-9);
export const interp = (x, t) => { const X = t.x, Y = t.y, m = X.length; if (x <= X[0]) return Y[0]; if (x >= X[m - 1]) return Y[m - 1];
  let i = 0; while (!(x >= X[i] && x < X[i + 1])) i++; return Y[i] + (x - X[i]) * (Y[i + 1] - Y[i]) / (X[i + 1] - X[i]); };
const stufe = (x, t) => { let i = 0; t.x.forEach((v, j) => { if (x >= v) i = j; }); return t.y[i]; };

// Zahlenformat
export const fz = (x, d = 0) => (x == null || isNaN(x)) ? '–' : (+x).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fm = x => fz(x, 2) + ' MEUR';
export const fp = (x, d = 1) => fz(x * 100, d) + ' %';
const fe = x => fz(x, 0) + ' €';
const fs = x => fz(x, 0) + ' Stk';

const W = x => Array.isArray(x) ? x[0] : x;      // Wert aus [wert, quelle]
const Q = x => Array.isArray(x) ? x[1] : '';     // Quelle aus [wert, quelle]

// ---------------------------------------------------------------------------------------------
// Nachfragemodell, geschätzt aus dem Marktforschungsbericht (Querschnitt der 6 Unternehmen)
//   ln(potentieller Absatz) = c + e · ln(Preis / Ø-Preis) + w · (Werbung − Ø) + v · (Vertrieb − Ø)
// ---------------------------------------------------------------------------------------------
function loese(X, y) { // kleinste Quadrate über Normalgleichungen
  const k = X[0].length, A = Array.from({ length: k }, () => Array(k + 1).fill(0));
  X.forEach((row, i) => { for (let a = 0; a < k; a++) { for (let b = 0; b < k; b++) A[a][b] += row[a] * row[b]; A[a][k] += row[a] * y[i]; } });
  for (let c = 0; c < k; c++) { let p = c; for (let z = c + 1; z < k; z++) if (Math.abs(A[z][c]) > Math.abs(A[p][c])) p = z;
    [A[c], A[p]] = [A[p], A[c]]; if (Math.abs(A[c][c]) < 1e-12) return null;
    for (let z = 0; z < k; z++) if (z !== c) { const f = A[z][c] / A[c][c]; for (let b = c; b <= k; b++) A[z][b] -= f * A[c][b]; } }
  return A.map((row, i) => row[k] / A[i][i]);
}

export function marktschaetzung(markt) {
  const m = markt.preis.length, mean = a => a.reduce((s, x) => s + x, 0) / a.length;
  const pq = mean(markt.preis), wq = mean(markt.werbung), vq = mean(markt.vertrieb);
  const X = markt.preis.map((p, i) => [1, Math.log(p / pq), markt.werbung[i] - wq, markt.vertrieb[i] - vq]);
  const y = markt.potentiell.map(Math.log);
  const b = loese(X, y);
  if (!b) return null;
  const fit = X.map(x => Math.exp(x.reduce((s, xi, j) => s + xi * b[j], 0)));
  const ym = Math.exp(mean(y));
  return { c: b[0], e: b[1], w: b[2], v: b[3], pq, wq, vq, fit, rest: markt.potentiell.map((p, i) => p / fit[i] - 1),
    w_stk: b[2] * ym, v_stk: b[3] * ym, summe: markt.potentiell.reduce((s, x) => s + x, 0), n: m };
}

// Nachfrage U1 für gegebene Annahmen (ohne Lieferengpässe der Konkurrenz)
export function nachfrage(stand, A, F, ms, szen = 'basis') {
  const g = szen === 'pess' ? n(A.wachstum_pess) : szen === 'opt' ? n(A.wachstum_opt) : n(A.wachstum);
  const kp = n(A.konk_preis) * (szen === 'pess' ? 1 - n(A.konk_preis_spanne) : szen === 'opt' ? 1 + n(A.konk_preis_spanne) : 1);
  const p = n(F.preis), kw = n(A.konk_werbung), kv = n(A.konk_vertrieb);
  const pq = (p + 5 * kp) / 6, wq = (n(F.werbung) + 5 * kw) / 6, vq = (n(F.vertrieb) + 5 * kv) / 6;
  const ln = ms.c + Math.log(1 + g) + ms.e * Math.log(p / pq) + ms.w * (n(F.werbung) - wq) + ms.v * (n(F.vertrieb) - vq);
  const eigen = n(A.eigenfaktor);
  const N = Math.exp(ln) * (1 + eigen);
  return { g, kp, pq, wq, vq, ln, roh: Math.exp(ln), eigen, N: Math.max(0, rnd(N + n(A.spillover))) };
}

// ---------------------------------------------------------------------------------------------
// Annahmen: Vorschlagswerte aus dem Stand und den Wirtschaftsnachrichten
// ---------------------------------------------------------------------------------------------
export function standardAnnahmen(stand, N) {
  const fl = stand.fluktuation, ft = stand.fertigung, mk = stand.markt;
  const k = arr => arr.slice(1); const avg = a => a.reduce((s, x) => s + x, 0) / a.length;
  const ms = marktschaetzung(mk);
  const nach = ft.nacharbeit[0] * 1e6 / ft.nacharbeit[1], nachVp = ft.nacharbeit_vp[0] * 1e6 / ft.nacharbeit_vp[1];
  const wa = W(ft.wa_index), waVp = W(ft.wa_index_vp);
  return {
    absatz_fix: '',
    wachstum: N.wachstum[1], wachstum_pess: N.wachstum[0], wachstum_opt: N.wachstum[2],
    konk_preis: Math.round(avg(k(mk.preis)) * 1.02), konk_preis_spanne: 0.02,
    konk_werbung: +avg(k(mk.werbung)).toFixed(2), konk_vertrieb: Math.round(avg(k(mk.vertrieb))),
    eigenfaktor: ms ? +ms.rest[0].toFixed(4) : 0,
    spillover: 0,
    fluk_ek: fl.ek[0] / fl.ek[1], fluk_vw: fl.vw[0] / fl.vw[1], fluk_fe: fl.fe[0] / fl.fe[1], fluk_fue: fl.fue[0] / fl.fue[1], fluk_vt: fl.vt[0] / fl.vt[1],
    fehl: ft.fehlzeiten[0] / ft.fehlzeiten[1],
    motiv: W(ft.motivationsindex), quali: 1.0, lern: 1.0,
    wa_index: +(wa + Math.max(0, wa - waVp)).toFixed(3),
    nacharbeit: +(nach * Math.sqrt(Math.max(1, nach / nachVp))).toFixed(2),
  };
}

export const ANNAHMEN = {
  absatz_fix: ['Absatz Markt 1 fest vorgeben (leer = Nachfragemodell)', 'Stück', 'ein', 'Überschreibt das Nachfragemodell. Nützlich, um mit eurer eigenen Schätzung zu rechnen.'],
  wachstum: ['Marktwachstum Basis', '%', 'regel', 'Wirtschaftsnachrichten'],
  wachstum_pess: ['Marktwachstum pessimistisch', '%', 'regel', 'Wirtschaftsnachrichten (untere Grenze)'],
  wachstum_opt: ['Marktwachstum optimistisch', '%', 'regel', 'Wirtschaftsnachrichten (obere Grenze)'],
  konk_preis: ['Ø-Preis der 5 Konkurrenten in P2', 'EUR', 'schaetz', 'Schätzung: Ø P1 der Konkurrenz (3.088 €) + 2 % „normaler Preisanstieg“ (Lebenshaltungskosten +2 %). Nicht vorhersehbar!'],
  konk_preis_spanne: ['Spanne Konkurrenzpreis für die Szenarien ±', '%', 'schaetz', 'pessimistisch: Konkurrenz erhöht weniger, optimistisch: mehr'],
  konk_werbung: ['Ø-Werbung der Konkurrenz', 'MEUR', 'schaetz', 'Annahme: wie P1 (TNB02)'],
  konk_vertrieb: ['Ø-Vertriebsmitarbeiter der Konkurrenz', 'Anzahl', 'schaetz', 'Annahme: wie P1 (TNB02)'],
  eigenfaktor: ['Eigenfaktor U1 (was das Modell bei uns nicht erklärt)', '%', 'kalib', 'Abweichung unseres potentiellen Absatzes P1 von der Modellkurve: Bekanntheit, Kundenzufriedenheit, Technologie'],
  spillover: ['Zusatznachfrage durch Lieferengpässe der Konkurrenz', 'Stück', 'schaetz', 'Handbuch S. 14: 80 % ungedeckter Nachfrage gehen an die anderen. P1 bekamen wir so ca. +1.500 Stück. Nicht planbar, daher Standard 0.'],
  fluk_fe: ['Fluktuation Fertigung', '%', 'kalib', 'Rate der Vorperiode (TNB06)'],
  fluk_ek: ['Fluktuation Einkauf', '%', 'kalib', 'Rate der Vorperiode (TNB06)'],
  fluk_vw: ['Fluktuation Verwaltung', '%', 'kalib', 'Rate der Vorperiode (TNB06)'],
  fluk_fue: ['Fluktuation F&E', '%', 'kalib', 'Rate der Vorperiode (TNB06)'],
  fluk_vt: ['Fluktuation Vertrieb', '%', 'kalib', 'Rate der Vorperiode (TNB06)'],
  fehl: ['Fehlzeitenquote Fertigung', '%', 'kalib', 'Quote der Vorperiode (TNB03). Hängt von Motivation, PNK, Training, Umwelt, Einstellungen ab.'],
  motiv: ['Motivationsindex (Produktivitätsfaktor)', 'Index', 'kalib', 'Wert der Vorperiode (TNB03). Motivation wirkt verzögert.'],
  quali: ['Personalqualifizierungsindex', 'Index', 'kalib', 'Bei 1.000 €/MA Training bisher immer 1,000. Wirkung anderer Trainingsbudgets ist nicht bekannt.'],
  lern: ['Produktivitätsindex II (Lernkurve)', 'Index', 'kalib', 'Bisher 1,000. Steigt mit der kumulierten Fertigung, Größe unbekannt → vorsichtig 1,000.'],
  wa_index: ['Wertanalyseindex P2', 'Index', 'kalib', 'Letzter Index + letzte Veränderung (P0 1,00 → P1 1,02 bei je 1,0 MEUR). Bedarf Einsatzstoffe = Fertigung / Index.'],
  nacharbeit: ['Nacharbeit je Stück', 'EUR', 'kalib', 'P1-Wert, mit halbem Anstieg der Vorperiode fortgeschrieben (Technologie, Ökologie, Wertanalyse steigen → mehr Nacharbeit)'],
};

// ---------------------------------------------------------------------------------------------
// Rechnung einer Periode
//   stand: Stand Ende Vorperiode   N: Wirtschaftsnachrichten   F: Entscheidungen   A: Annahmen
// ---------------------------------------------------------------------------------------------
export function rechne(stand, N, F, A, opt = {}) {
  const E = {};
  const def = (k, t, u, v, o = {}) => { E[k] = { k, t, u, v, f: o.f || '', s: o.s || 'regel', q: o.q || '', d: o.d || [], n: o.n || '' }; return v; };
  const V = k => E[k].v;
  const B = stand.bilanz, L = stand.lager, P = stand.personal, ft = stand.fertigung;
  const per = stand.periode + 1;
  const ms = marktschaetzung(stand.markt);

  // --- Eingaben als Einträge (damit sie im Rechenweg verlinkt werden können)
  const ein = (k, t, u, v) => def('F_' + k, t, u, n(v), { s: 'ein', q: 'Entscheidungsformular P' + per });
  ein('preis', 'Preis Markt 1', 'EUR', F.preis); ein('werbung', 'Werbung Markt 1', 'MEUR', F.werbung); ein('vertrieb', 'Vertrieb (Endbestand)', 'MA', F.vertrieb);
  ein('ci', 'Corporate Identity', 'MEUR', F.ci); ein('tech', 'F&E Technologie (Endbestand)', 'MA', F.tech); ein('oeko', 'Ökologie', 'MEUR', F.oeko); ein('wa', 'Wertanalyse', 'MEUR', F.wa);
  ein('ga', 'Großabnehmer', 'Stück', F.ga); ein('einkauf', 'Einkauf Einsatzstoffe', 'Einheiten', F.einkauf); ein('fertigung', 'Fertigungsmenge', 'Stück', F.fertigung);
  ein('umwelt', 'Investition Umweltanlagen', 'MEUR', F.umwelt); ein('po', 'Prozessoptimierung', 'MEUR', F.po); ein('pers_fe', 'Einstellungen/Entlassungen Fertigung', 'MA', F.pers_fe);
  ein('training', 'Training je Mitarbeiter', 'EUR', F.training); ein('pnk', 'Personalnebenkosten', '%', F.pnk); ein('kurz', 'Kurzfristiger Kredit', 'MEUR', F.kurz);
  ein('lang', 'Langfristiger Kredit', 'MEUR', F.lang); ein('wp', 'Kauf von Wertpapieren', 'MEUR', F.wp); ein('div', 'Dividende', 'MEUR', F.div);
  def('F_mafo', 'Marktforschungsbericht', '', F.mafo ? 1 : 0, { s: 'ein', f: F.mafo ? 'Ja' : 'Nein' });
  const ann = (k, v) => { const a = ANNAHMEN[k]; return def('A_' + k, a[0], a[1], a[1] === '%' ? n(v) * 100 : n(v), { s: a[2], q: 'Annahme (im Reiter „Annahmen“ änderbar)', n: a[3] }); };
  Object.keys(ANNAHMEN).forEach(k => { if (k !== 'absatz_fix') ann(k, A[k]); });

  // =========================== PERSONAL FERTIGUNG UND PRODUKTIVITÄT ===========================
  const anfFe = W(P.fe), pfe = n(F.pers_fe);
  def('fe_anf', 'Fertigungspersonal Anfang', 'MA', anfFe, { s: 'ist', q: Q(P.fe) });
  const flFe = def('fe_fluk', 'Fluktuation Fertigung', 'MA', rnd(anfFe * n(A.fluk_fe)), { s: 'kalib', d: ['fe_anf', 'A_fluk_fe'],
    f: `${fz(anfFe)} × ${fp(A.fluk_fe, 2)} = ${fz(anfFe * n(A.fluk_fe), 1)} → gerundet`, n: 'Fluktuation hängt u. a. von Personalnebenkosten und Motivation ab.' });
  const endFe = def('fe_end', 'Fertigungspersonal Ende', 'MA', Math.max(0, anfFe + pfe - flFe), { d: ['fe_anf', 'F_pers_fe', 'fe_fluk'],
    f: `${fz(anfFe)} ${pfe >= 0 ? '+' : '−'} ${fz(Math.abs(pfe))} (Einst./Entl.) − ${fz(flFe)} (Fluktuation)` });
  const fehl = def('fe_fehl', 'Fehlzeiten', 'MA', rnd(endFe * n(A.fehl)), { s: 'kalib', d: ['fe_end', 'A_fehl'], f: `${fz(endFe)} × ${fp(A.fehl, 2)} → gerundet` });
  const einsetzbar = def('fe_einsetzbar', 'Einsetzbares Personal', 'MA', endFe - fehl, { d: ['fe_end', 'fe_fehl'], f: `${fz(endFe)} − ${fz(fehl)}`, q: 'TNB03: Personalbestand − Fehlzeiten' });
  const neuQ = anfFe === 0 ? 0 : Math.max(0, pfe) / anfFe;
  def('fe_neuquote', 'Anteil neuer Mitarbeiter', '%', neuQ * 100, { d: ['F_pers_fe', 'fe_anf'], f: `${fz(Math.max(0, pfe))} / ${fz(anfFe)} = ${fp(neuQ, 2)}`, q: 'TNB03: Neue Mitarbeiter in % des Anfangsbestands' });
  const einarb = def('idx_einarb', 'Einarbeitungsindex', 'Index', 1 - KAL.einarb.steigung * Math.max(0, neuQ - KAL.einarb.schwelle), { s: 'kalib', d: ['fe_neuquote'],
    f: `1 − ${fz(KAL.einarb.steigung, 3)} × max(0; ${fp(neuQ, 2)} − ${fp(KAL.einarb.schwelle, 2)})`, q: KAL.einarb.q });
  const [poRef, poIdx] = r('po_ref');
  const poi = def('idx_po', 'Prozessoptimierungsindex', 'Index', 1 + poIdx * Math.min(n(F.po), poRef) / poRef + 0.5 * poIdx * Math.max(0, n(F.po) - poRef) / poRef, { s: n(F.po) > 0 ? 'schaetz' : 'regel', d: ['F_po'],
    f: `1 + 0,04 × ${fz(n(F.po), 2)} / 2,5${n(F.po) > poRef ? ' (über 2,5 MEUR halbe Wirkung angenommen)' : ''}`, q: R.po_ref[1], n: 'Ob der Index nur in der Periode der Ausgabe wirkt oder dauerhaft bleibt, ist nicht bekannt. Prozessoptimierung erhöht laut Handbuch auch die Fehlzeiten (nicht eingerechnet).' });
  const prod = def('produktivitaet', 'Produktivität je Mitarbeiter', 'Stück/MA', r('grundprod') * poi * einarb * n(A.quali) * n(A.motiv) * n(A.lern),
    { s: 'kalib', d: ['idx_po', 'idx_einarb', 'A_quali', 'A_motiv', 'A_lern'], q: 'Handbuch S. 29: Grundproduktivität × Produktivitätsindex I (PO × Einarbeitung × Qualifizierung × Motivation) × Index II',
      f: `50 × ${fz(poi, 3)} × ${fz(einarb, 3)} × ${fz(n(A.quali), 3)} × ${fz(n(A.motiv), 3)} × ${fz(n(A.lern), 3)}`, n: 'Probe P1: 50 × 1 × 0,989 × 1 × 1,013 × 1 = 50,09 = TNB03.' });
  const kapPers = def('kap_pers', 'Personalkapazität (ohne Überstunden)', 'Stück', einsetzbar * prod, { s: 'kalib', d: ['fe_einsetzbar', 'produktivitaet'], f: `${fz(einsetzbar)} × ${fz(prod, 2)}` });

  // =========================== ANLAGEN ===========================
  const RA = r('anl');
  const anlagen = [];
  let nrMax = { A: 0, B: 0, C: 0 };
  stand.anlagen.forEach(a => { nrMax[a.typ] = Math.max(nrMax[a.typ], a.nr); });
  const desinv = new Set((F.desinv || []).map(String));
  stand.anlagen.forEach(a => anlagen.push({ ...a, neu: false, weg: desinv.has(a.typ + a.nr) }));
  ['A', 'B', 'C'].forEach(t => { for (let i = 0; i < n((F.inv || {})[t]); i++) {
    const preis = n(N.anlagen_preis[t]);
    anlagen.push({ typ: t, nr: ++nrMax[t], bp: per, bw: preis, rlz: RA[t].nd, afa: preis / RA[t].nd, rbw: preis, fix: RA[t].fix, norm: RA[t].kap, umw: RA[t].umw, neu: true, weg: false, q: 'Neukauf P' + per + ': ' + R.anl[1] + (t === 'C' && preis !== 30 ? ' (Sonderpreis laut Wirtschaftsnachrichten)' : '') });
  } });
  let kapAnl = 0, afaAnl = 0, fix = 0, ihK = 0, rest = 0, aoAfa = 0, invAnl = 0, umwSum = 0, nAkt = 0, rbwEnd = 0;
  const kapD = [];
  anlagen.forEach(a => {
    const id = a.typ + a.nr, ih = n((F.ih || {})[a.typ]);
    if (a.weg) {
      const re = a.rbw * RA[a.typ].rest; rest += re; aoAfa += a.rbw - re;
      a.resterloes = re; a.kap = 0;
      return;
    }
    nAkt++;
    const vg = interp(ih, TAB.ih), rat = n((stand.rationalisierung || {})[a.typ]) || 1;
    a.ih = ih; a.vg = vg; a.rat = rat; a.kap = a.norm * vg * rat;
    a.afaP = a.neu ? a.afa : Math.min(a.afa, a.rbw); a.rbwE = a.rbw - a.afaP; a.rlzE = Math.max(0, a.rlz - 1);
    def('anl_' + id, `Anlage ${a.typ} Nr. ${a.nr}${a.neu ? ' (neu)' : ''}: verfügbare Kapazität`, 'Stück', a.kap, { s: 'regel', q: a.q + ' · ' + TAB.ih.q,
      f: `${fz(a.norm)} (normal) × ${fz(vg * 100, 1)} % (Verfügbarkeit bei ${fz(ih, 2)} MEUR Instandhaltung) × ${fz(rat, 2)} (Rationalisierung)` });
    kapD.push('anl_' + id);
    kapAnl += a.kap; afaAnl += a.afaP; fix += a.fix; ihK += ih; umwSum += a.umw; rbwEnd += a.rbwE;
    if (a.neu) invAnl += a.bw;
  });
  def('kap_anl', 'Anlagenkapazität (ohne Überstunden)', 'Stück', kapAnl, { d: kapD, f: kapD.map(k => fz(V(k))).join(' + ') || '0', q: 'TNB03: Summe verfügbare Kapazität' });
  const fert = n(F.fertigung);
  def('kap_anl_ue', 'Anlagenkapazität mit Überstunden', 'Stück', kapAnl * (1 + r('ueberstunden')), { d: ['kap_anl'], f: `${fz(kapAnl)} × 1,10`, q: R.ueberstunden[1] });
  def('kap_pers_ue', 'Personalkapazität mit Überstunden', 'Stück', kapPers * (1 + r('ueberstunden')), { s: 'kalib', d: ['kap_pers'], f: `${fz(kapPers)} × 1,10`, q: R.ueberstunden[1] });
  const fertMax = Math.floor(Math.min(V('kap_anl_ue'), V('kap_pers_ue')) + 1e-9);
  const fertIst = def('fert', 'Tatsächliche Fertigung', 'Stück', Math.min(fert, fertMax), { s: fert > fertMax ? 'kalib' : 'ein', d: fert > fertMax ? ['F_fertigung', 'kap_anl_ue', 'kap_pers_ue'] : ['F_fertigung'],
    f: `min(${fz(fert)} geplant; ${fz(fertMax)} max. mit Überstunden)`, n: fert > fertMax ? `Achtung: ${fz(fert - fertMax)} Stück können nicht gefertigt werden.` : '' });
  def('ausl_anl', 'Auslastung Anlagen', '%', kapAnl === 0 ? 0 : fertIst / kapAnl * 100, { d: ['fert', 'kap_anl'], f: `${fz(fertIst)} / ${fz(kapAnl)}`, q: 'TNB03: Fertigung / Kapazität ohne Überstunden' });
  def('ausl_pers', 'Auslastung Personal', '%', kapPers === 0 ? 0 : fertIst / kapPers * 100, { s: 'kalib', d: ['fert', 'kap_pers'], f: `${fz(fertIst)} / ${fz(kapPers)}`, q: 'TNB03: Fertigung / (einsetzbares Personal × Produktivität)', n: 'Probe P1: 40.500 / (835 × 50,09) = 96,84 % = TNB03.' });
  const schicht = (fertIst > kapAnl + 0.5 || fertIst > kapPers + 0.5) ? r('zusatzschicht') : 0;
  def('k_schicht', 'Zusatzschicht', 'MEUR', schicht, { s: 'kalib', d: ['ausl_anl', 'ausl_pers'], q: R.zusatzschicht[1], f: schicht ? 'Auslastung über 100 % → 2,50 MEUR' : 'keine Überstunden → 0' });
  const benoetigt = prod === 0 ? 0 : fertIst / prod, otMa = Math.max(0, benoetigt - einsetzbar);
  def('fe_ot', 'Überstunden in Mitarbeiter-Äquivalenten', 'MA', otMa, { s: 'kalib', d: ['fert', 'produktivitaet', 'fe_einsetzbar'], f: `max(0; ${fz(fertIst)} / ${fz(prod, 2)} − ${fz(einsetzbar)})` });

  // Umwelt
  const umwKum = def('umw_kum', 'Kumulierte Umweltinvestitionen', 'MEUR', n(ft.umwelt_kum[0]) + n(F.umwelt), { d: ['F_umwelt'], f: `${fz(ft.umwelt_kum[0], 2)} (bisher) + ${fz(n(F.umwelt), 2)}`, q: Q(ft.umwelt_kum) });
  const umwAnl = def('umw_anl', 'Umweltindex der Anlagen (Ø)', 'Index', nAkt ? umwSum / nAkt : 0, { d: kapD,
    f: anlagen.filter(a => !a.weg).map(a => fz(a.umw)).join(' + ') + ` = ${fz(umwSum)} / ${nAkt}`, q: 'Handbuch S. 22: Durchschnitt der Umweltindizes der eingesetzten Anlagen' });
  const umwVerb = def('umw_verb', 'Verbesserung durch Umwelttechnik', 'Punkte', KAL.umwelt.a * Math.pow(umwKum, KAL.umwelt.b), { s: 'kalib', d: ['umw_kum'],
    f: `1,313 × ${fz(umwKum, 2)}^0,737`, q: KAL.umwelt.q });
  const umwInd = def('umw_ind', 'Umweltbelastungsindikator', 'Index', umwAnl + umwVerb, { s: 'kalib', d: ['umw_anl', 'umw_verb'], f: `${fz(umwAnl, 2)} + ${fz(umwVerb, 2)}`, n: 'Probe P1: 91,50 + 2,95 = 94,45 = TNB03.' });
  def('k_umw', 'Umweltabgabe', 'MEUR', interp(umwInd, TAB.ua), { s: 'kalib', d: ['umw_ind'], q: TAB.ua.q, f: `Tabelle bei Index ${fz(umwInd, 2)}` });

  // =========================== NACHFRAGE UND ABSATZ ===========================
  const mf = ms || { c: Math.log(W(stand.vorperiode.potentiell) || 1), e: -2.5, w: 0, v: 0 };
  const nb = nachfrage(stand, A, F, mf, 'basis');
  def('M_konkpreis', 'Ø-Marktpreis P' + per + ' (alle 6, inkl. uns)', 'EUR', nb.pq, { s: 'schaetz', d: ['F_preis', 'A_konk_preis'], f: `(${fz(n(F.preis))} + 5 × ${fz(nb.kp)}) / 6` });
  def('M_elast', 'Preiselastizität (aus Marktdaten P' + stand.periode + ')', '', mf.e, { s: 'kalib', q: 'Regression über die 6 Unternehmen im TNB02 (Reiter Nachfrage)', f: `${fz(mf.e, 2)}: 1 % teurer als der Markt ≈ ${fz(-mf.e, 1)} % weniger Nachfrage` });
  def('M_werbe', 'Wirkung Werbung (aus Marktdaten)', 'Stück/MEUR', ms ? ms.w_stk : 0, { s: 'kalib', q: 'Regression TNB02. Handbuch S. 12 sagt ca. +2.000 Stück je MEUR.', f: ms ? `ca. ${fz(ms.w_stk)} Stück je MEUR mehr als der Marktdurchschnitt` : '' });
  def('M_vertr', 'Wirkung Vertrieb (aus Marktdaten)', 'Stück/MA', ms ? ms.v_stk : 0, { s: 'kalib', q: 'Regression TNB02. Handbuch S. 13 sagt ca. +200 Stück je Mitarbeiter.', f: ms ? `ca. ${fz(ms.v_stk)} Stück je Mitarbeiter mehr als der Marktdurchschnitt` : '' });
  const nachfrageM = def('nachfrage_modell', 'Nachfrage Markt 1 (Modell, Basis)', 'Stück', nb.N, { s: 'schaetz',
    d: ['A_wachstum', 'M_konkpreis', 'M_elast', 'M_werbe', 'M_vertr', 'F_preis', 'F_werbung', 'F_vertrieb', 'A_konk_werbung', 'A_konk_vertrieb', 'A_eigenfaktor', 'A_spillover'],
    q: 'Eigene Schätzung aus TNB02 + Wirtschaftsnachrichten',
    f: `exp( ${fz(mf.c, 3)} [Ø-Firma P${stand.periode}] + ln(1 + ${fp(nb.g)}) [Wachstum] ${mf.e * Math.log(n(F.preis) / nb.pq) >= 0 ? '+' : '−'} ${fz(Math.abs(mf.e * Math.log(n(F.preis) / nb.pq)), 3)} [Preis ${fz(n(F.preis))} vs. Ø ${fz(nb.pq)}] ${mf.w * (n(F.werbung) - nb.wq) >= 0 ? '+' : '−'} ${fz(Math.abs(mf.w * (n(F.werbung) - nb.wq)), 3)} [Werbung] ${mf.v * (n(F.vertrieb) - nb.vq) >= 0 ? '+' : '−'} ${fz(Math.abs(mf.v * (n(F.vertrieb) - nb.vq)), 3)} [Vertrieb] ) × (1 ${nb.eigen >= 0 ? '+' : '−'} ${fp(Math.abs(nb.eigen))}) [Eigenfaktor] + ${fz(n(A.spillover))} [Spillover] = ${fz(nb.N)}`,
    n: 'Nicht enthalten: Kundenzufriedenheit (sinkt bei Preiserhöhung), Bekanntheit/CI, Technologie- und Ökologieabstand zur Konkurrenz, Lieferengpässe der anderen.' });
  const np = nachfrage(stand, A, F, mf, 'pess').N, no = nachfrage(stand, A, F, mf, 'opt').N;
  def('nachfrage_pess', 'Nachfrage pessimistisch', 'Stück', np, { s: 'schaetz', d: ['nachfrage_modell', 'A_wachstum_pess', 'A_konk_preis_spanne'], f: `Wachstum ${fp(n(A.wachstum_pess))}, Konkurrenzpreis ${fz(nb.kp * (1 - n(A.konk_preis_spanne)))} €` });
  def('nachfrage_opt', 'Nachfrage optimistisch', 'Stück', no, { s: 'schaetz', d: ['nachfrage_modell', 'A_wachstum_opt', 'A_konk_preis_spanne'], f: `Wachstum ${fp(n(A.wachstum_opt))}, Konkurrenzpreis ${fz(nb.kp * (1 + n(A.konk_preis_spanne)))} €` });
  const fix_ = A.absatz_fix !== '' && A.absatz_fix != null;
  const nachfrageV = def('nachfrage', 'Nachfrage Markt 1', 'Stück', fix_ ? n(A.absatz_fix) : (opt.szenario === 'pess' ? np : opt.szenario === 'opt' ? no : nachfrageM),
    { s: fix_ ? 'ein' : 'schaetz', d: fix_ ? [] : ['nachfrage_modell'], f: fix_ ? 'fest vorgegeben (Annahme)' : opt.szenario ? 'Szenario ' + opt.szenario : 'Basis-Szenario' });
  const feAnf = def('fe_lager_anf', 'Fertigprodukte Lager Anfang', 'Stück', W(L.fe_menge), { s: 'ist', q: Q(L.fe_menge) });
  const verf = def('verfuegbar', 'Verfügbare Geräte', 'Stück', feAnf + fertIst, { d: ['fe_lager_anf', 'fert'], f: `${fz(feAnf)} + ${fz(fertIst)}` });
  const gaL = def('ga_lief', 'Lieferung Großabnehmer', 'Stück', Math.max(0, Math.min(n(F.ga), n(N.ga_max), verf)), { d: ['F_ga', 'verfuegbar'],
    f: `min(${fz(n(F.ga))} Zusage; ${fz(n(N.ga_max))} max.; ${fz(verf)} verfügbar)`, q: 'Handbuch S. 14: Großabnehmer hat Vorrang vor Markt 1, keine Transportkosten, 100 % Zahlung sofort' });
  // Absatz: hängt nur dann von der Nachfrageschätzung ab, wenn die Menge nicht knapp ist
  const fuerM1 = verf - gaL;
  const knapp = !fix_ && np >= fuerM1;
  const absatz = def('absatz', 'Absatz Markt 1', 'Stück', Math.max(0, Math.min(nachfrageV, fuerM1)), { s: knapp ? 'kalib' : undefined,
    d: knapp ? ['verfuegbar', 'ga_lief'] : ['nachfrage', 'verfuegbar', 'ga_lief'], f: `min(${fz(nachfrageV)} Nachfrage; ${fz(fuerM1)} verfügbar nach Großabnehmer)`,
    n: knapp ? 'Selbst die pessimistische Nachfrage übersteigt die verfügbare Menge: Der Absatz ist durch die Fertigung begrenzt und damit ziemlich sicher.' : 'Die verfügbare Menge reicht für die Nachfrage: Der Absatz hängt direkt an der Nachfrageschätzung.' });
  def('ungedeckt', 'Nicht gedeckte Nachfrage', 'Stück', Math.max(0, nachfrageV - fuerM1), { s: 'schaetz', d: ['nachfrage', 'absatz'], f: `${fz(nachfrageV)} − ${fz(absatz)}`,
    n: 'Lieferunfähigkeit verärgert Kunden (Kundenzufriedenheit sinkt in der Folgeperiode) und 80 % davon gehen an die Konkurrenz.' });
  const uM1 = def('umsatz_m1', 'Umsatz Markt 1', 'MEUR', absatz * n(F.preis) / 1e6, { d: ['absatz', 'F_preis'], f: `${fz(absatz)} × ${fe(n(F.preis))}` });
  const uGa = def('umsatz_ga', 'Umsatz Großabnehmer', 'MEUR', gaL * n(N.ga_preis) / 1e6, { d: ['ga_lief'], f: `${fz(gaL)} × ${fe(n(N.ga_preis))}`, q: N.quelle });
  const umsatz = def('umsatz', 'Umsatzerlöse', 'MEUR', uM1 + uGa, { d: ['umsatz_m1', 'umsatz_ga'], f: `${fz(uM1, 2)} + ${fz(uGa, 2)}` });
  const feAbg = absatz + gaL;
  const feEnd = def('fe_lager_end', 'Fertigprodukte Lager Ende', 'Stück', verf - feAbg, { d: ['verfuegbar', 'absatz', 'ga_lief'], f: `${fz(verf)} − ${fz(absatz)} − ${fz(gaL)}` });

  // =========================== MATERIAL ===========================
  const bedarf = def('es_bedarf', 'Bedarf Einsatzstoffe', 'Einheiten', Math.round(fertIst / n(A.wa_index)), { s: 'kalib', d: ['fert', 'A_wa_index'], q: 'Handbuch S. 17: Bedarf = Fertigung × 100 / Wertanalyseindex',
    f: `${fz(fertIst)} / ${fz(n(A.wa_index), 3)}`, n: 'Probe P1: 40.500 / 1,02 = 39.706 = TNB05.' });
  const esAnf = W(L.es_menge), esAnfW = W(L.es_wert);
  def('es_anf', 'Einsatzstoffe Lager Anfang', 'Einheiten', esAnf, { s: 'ist', q: Q(L.es_menge) + ', Wert ' + fm(esAnfW) });
  const ek = n(F.einkauf), st = r('staffel'); let si = 0; st.forEach((s, i) => { if (ek >= s) si = i; });
  const ekPreis = def('es_preis', 'Einkaufspreis je Einheit', 'EUR', ek > 0 ? N.es_preise[si] : 0, { d: ['F_einkauf'], q: R.staffel[1] + ' · Preise: ' + N.quelle,
    f: `Bestellung ${fz(ek)} → Staffel ${si + 1}: ${N.es_preise.map(fz).join(' / ')} €`, n: si < 3 ? `Nächste Staffel ab ${fz(st[si + 1])} Einheiten: ${fz(N.es_preise[si + 1])} € je Einheit.` : '' });
  const esZug = def('es_zugang', 'Einkauf Einsatzstoffe (Wert)', 'MEUR', ek * ekPreis / 1e6, { d: ['F_einkauf', 'es_preis'], f: `${fz(ek)} × ${fe(ekPreis)}` });
  const nachl = def('es_nachl', 'Automatische Nachlieferung', 'Einheiten', Math.max(0, bedarf - esAnf - ek), { d: ['es_bedarf', 'es_anf', 'F_einkauf'], f: `max(0; ${fz(bedarf)} − ${fz(esAnf)} − ${fz(ek)})` });
  const nachlP = N.es_preise[0] * (1 + r('nachl'));
  const nachlW = def('es_nachl_wert', 'Nachlieferung (Wert)', 'MEUR', nachl * nachlP / 1e6, { d: ['es_nachl'], q: R.nachl[1], f: `${fz(nachl)} × ${fe(nachlP)} (${fz(N.es_preise[0])} € + 20 %)`,
    n: nachl > 0 ? `Mehrkosten gegenüber rechtzeitiger Bestellung: ca. ${fm(nachl * (nachlP - N.es_preise[(() => { let j = 0; st.forEach((s, i) => { if (ek + nachl >= s) j = i; }); return j; })()]) / 1e6)}.` : '' });
  const esMenge = esAnf + ek + nachl, esWertGes = esAnfW + esZug + nachlW;
  const esAvg = esMenge === 0 ? 0 : esWertGes * 1e6 / esMenge;
  const kEs = def('k_es', 'Verbrauch Einsatzstoffe', 'MEUR', bedarf * esAvg / 1e6, { s: 'kalib', d: ['es_bedarf', 'es_anf', 'es_zugang', 'es_nachl_wert'], q: 'Handbuch S. 18: Bewertung zum Durchschnittspreis (Mischkalkulation)',
    f: `${fz(bedarf)} × ${fz(esAvg, 2)} € (Ø aus (${fz(esAnfW, 2)} + ${fz(esZug, 2)} + ${fz(nachlW, 2)}) MEUR / ${fz(esMenge)})` });
  const esEnd = def('es_end', 'Einsatzstoffe Lager Ende', 'Einheiten', esMenge - bedarf, { s: 'kalib', d: ['es_anf', 'F_einkauf', 'es_nachl', 'es_bedarf'], f: `${fz(esAnf)} + ${fz(ek)} + ${fz(nachl)} − ${fz(bedarf)}` });
  const esEndW = def('es_end_wert', 'Einsatzstoffe Lager Ende (Wert)', 'MEUR', esWertGes - kEs, { s: 'kalib', d: ['es_end', 'k_es'], f: `${fz(esEnd)} × ${fz(esAvg, 2)} €` });
  const kBs = def('k_bs', 'Betriebsstoffe', 'MEUR', fertIst * n(N.betriebsstoff) / 1e6, { d: ['fert'], q: N.betriebsstoff_text || N.quelle, f: `${fz(fertIst)} × ${fe(n(N.betriebsstoff))}` });

  // =========================== PERSONAL ALLER ABTEILUNGEN ===========================
  const ab = [['ek', 'Einkauf'], ['vw', 'Verwaltung'], ['fe', 'Fertigung'], ['fue', 'F&E'], ['vt', 'Vertrieb']];
  const uVp = W(stand.umsatz);
  const PZ = {};
  ab.forEach(([j, name]) => {
    const anf = W(P[j]);
    const fl = j === 'fe' ? flFe : rnd(anf * n(A['fluk_' + j]));
    let ziel, fZiel, sZiel = 'ein', dZiel = [];
    if (j === 'ek' || j === 'vw') {
      const t = j === 'ek' ? TAB.pe : TAB.pv;
      ziel = rnd(anf * interp(umsatz, t) / interp(uVp, t)); sZiel = 'kalib'; dZiel = ['umsatz'];
      fZiel = `${fz(anf)} × Kurve(${fz(umsatz, 1)} MEUR) / Kurve(${fz(uVp, 1)} MEUR) = ${fz(anf)} × ${fz(interp(umsatz, t), 1)} / ${fz(interp(uVp, t), 1)}`;
    } else if (j === 'fe') { ziel = endFe; fZiel = 'siehe Fertigungspersonal'; dZiel = ['fe_end']; sZiel = 'kalib'; }
    else { ziel = n(j === 'fue' ? F.tech : F.vertrieb); fZiel = 'Endbestand laut Formular'; dZiel = [j === 'fue' ? 'F_tech' : 'F_vertrieb']; }
    const einst = j === 'fe' ? Math.max(0, pfe) : Math.max(0, ziel - (anf - fl));
    const entl = j === 'fe' ? Math.max(0, -pfe) : Math.max(0, (anf - fl) - ziel);
    const geh = n(N.gehalt[j]);
    def(`p_${j}_end`, `Personal ${name} Ende`, 'MA', ziel, { s: sZiel, d: dZiel, f: fZiel, q: j === 'ek' || j === 'vw' ? (j === 'ek' ? TAB.pe.q : TAB.pv.q) + '; an den Ist-Bestand der Vorperiode angepasst' : '',
      n: j === 'ek' ? 'Bei höherem Technologieindex braucht der Einkauf zusätzlich Personal (Handbuch S. 25), nicht eingerechnet.' : '' });
    def(`p_${j}_bew`, `Einstellungen/Entlassungen ${name}`, 'MA', einst - entl, { s: j === 'fe' ? 'ein' : 'kalib', d: [`p_${j}_end`],
      f: `Anfang ${fz(anf)} − Fluktuation ${fz(fl)} (${fp(n(A['fluk_' + j]), 1)}) → Ziel ${fz(ziel)}: ${fz(einst)} Einstellungen, ${fz(entl)} Entlassungen` });
    const lohn = ziel * geh / 1e6;
    const ot = j === 'fe' ? otMa * geh * (1 + r('ue_zuschlag')) / 1e6 : 0;
    const eek = (einst * n(N.einstellung) + entl * n(N.entlassung)) / 1e6;
    const quote = anf === 0 ? 0 : entl / anf;
    const sp = quote > r('sp_schwelle') ? Math.max(0, entl - Math.floor(anf * r('sp_schwelle'))) * stufe(quote, TAB.sp) / 1e6 : 0;
    const tr = j === 'fe' ? ziel * n(F.training) / 1e6 : 0;
    const pnk = lohn * n(F.pnk) / 100, pens = lohn * r('pension');
    PZ[j] = { anf, fl, ziel, einst, entl, geh, lohn, ot, eek, sp, tr, pnk, pens, sum: lohn + ot + eek + sp + tr + pnk + pens };
  });
  const S = k => ab.reduce((s, [j]) => s + PZ[j][k], 0);
  const pdeps = ab.map(([j]) => `p_${j}_end`);
  const kLohn = def('k_lohn', 'Löhne und Gehälter', 'MEUR', S('lohn') + S('ot'), { d: [...pdeps, 'fe_ot'], q: 'Endbestand × Gehalt (Wirtschaftsnachrichten); Fertigung zzgl. Überstunden',
    f: ab.map(([j, nm]) => `${nm} ${fz(PZ[j].ziel)} × ${fz(PZ[j].geh / 1000, 0)} T€`).join(' + ') + (S('ot') > 0 ? ` + Überstunden ${fz(S('ot'), 2)} (${fz(otMa, 1)} MA × Lohn × 1,25)` : ''),
    n: 'Probe P1: Fertigung 874 × 31.000 = 27,09 MEUR = TNB06. Überstundenzuschlag laut Handbuch; ob darauf auch PNK fällig sind, ist nicht bekannt (hier: nein).' });
  const kEek = def('k_eek', 'Einstellungen/Entlassungen/Training', 'MEUR', S('eek') + S('tr'), { d: ab.map(([j]) => `p_${j}_bew`).concat(['F_training']),
    q: `Einstellung ${fe(n(N.einstellung))} (${N.quelle}), Entlassung ${fe(n(N.entlassung))} (Handbuch S. 26), Training × Endbestand Fertigung`,
    f: `${fz(S('einst'))} Einst. × ${fz(n(N.einstellung))} € + ${fz(S('entl'))} Entl. × ${fz(n(N.entlassung))} € + ${fz(PZ.fe.ziel)} × ${fz(n(F.training))} € Training` });
  const kSp = def('k_sozial', 'Sozialplan', 'MEUR', S('sp'), { d: ab.map(([j]) => `p_${j}_bew`), q: TAB.sp.q, f: S('sp') > 0 ? 'Entlassungen über 10 % des Anfangsbestands' : 'keine Entlassungen über 10 % → 0' });
  const kPnk = def('k_pnk', 'Personalnebenkosten', 'MEUR', S('pnk'), { d: ['k_lohn', 'F_pnk'], f: `${fz(S('lohn'), 2)} × ${fz(n(F.pnk))} %`, q: 'Handbuch S. 26', n: n(F.pnk) < r('pnk_min') ? 'Unter dem gesetzlichen Minimum von 37 %!' : 'Höhere PNK senken Fluktuation, Fehlzeiten und Nacharbeit (nicht beziffert).' });
  const kPens = def('k_pens', 'Pensionsrückstellungen', 'MEUR', S('pens'), { d: ['k_lohn'], f: `${fz(S('lohn'), 2)} × 5 %`, q: R.pension[1] });
  const pers = def('g_pers', 'Personalaufwand', 'MEUR', kLohn + kEek + kSp + kPnk + kPens, { d: ['k_lohn', 'k_eek', 'k_sozial', 'k_pnk', 'k_pens'], f: [kLohn, kEek, kSp, kPnk, kPens].map(x => fz(x, 2)).join(' + ') });

  // =========================== SONSTIGE KOSTEN ===========================
  def('k_afa_geb', 'Abschreibung Gebäude', 'MEUR', r('afa_geb'), { q: R.afa_geb[1], f: '0,25 je Periode' });
  def('k_afa_anl', 'Abschreibung Fertigungsanlagen', 'MEUR', afaAnl + aoAfa, { d: kapD.concat(['F_inv']), q: 'Handbuch S. 19/21: linear; Verkauf: Restbuchwert − Resterlös als Abschreibung',
    f: anlagen.filter(a => !a.weg).map(a => `${a.typ}${a.nr} ${fz(a.afaP, 2)}`).join(' + ') + (aoAfa > 0 ? ` + Verkaufsverlust ${fz(aoAfa, 2)}` : ''),
    n: 'Vollständig abgeschriebene Anlagen haben keine AfA mehr, produzieren aber weiter (Handbuch S. 19).' });
  def('F_inv', 'Anlagenkäufe', '', invAnl, { s: 'ein', f: ['A', 'B', 'C'].map(t => `${t}: ${n((F.inv || {})[t])}`).join(', ') });
  def('k_afa_umw', 'Abschreibung Umwelttechnik', 'MEUR', umwKum / r('nd_umwelt'), { d: ['umw_kum'], q: R.nd_umwelt[1], f: `${fz(umwKum, 2)} / 10`, n: 'Probe P1: 3,0 / 10 = 0,30 = TNB07.' });
  def('k_fix', 'Sonstige fixe Kosten Anlagen', 'MEUR', fix, { d: kapD, q: 'TNB03 bzw. Handbuch S. 20', f: anlagen.filter(a => !a.weg).map(a => `${a.typ}${a.nr} ${fz(a.fix, 2)}`).join(' + ') });
  const ratB = ['A', 'B', 'C'].reduce((s, t) => s + n((F.rat || {})[t]), 0);
  def('k_ih', 'Instandhaltung/Rationalisierung', 'MEUR', ihK + ratB + r('ih_verw'), { d: kapD, q: 'Instandhaltung je Anlage + Rationalisierungsbudget + 1 MEUR Verwaltung (Handbuch S. 35)',
    f: `${fz(ihK, 2)} (Anlagen) + ${fz(ratB, 2)} (Rationalisierung) + 1,00 (Verwaltung)`, n: ratB > 0 ? 'Wie stark das Rationalisierungsbudget den Faktor erhöht, ist nicht bekannt – die Kapazität rechnet weiter mit dem bisherigen Faktor!' : '' });
  def('k_po', 'Prozessoptimierung', 'MEUR', n(F.po), { d: ['F_po'], f: 'laut Formular' });
  const kNach = def('k_nach', 'Nacharbeit/Ausschuss', 'MEUR', fertIst * n(A.nacharbeit) / 1e6, { s: 'kalib', d: ['fert', 'A_nacharbeit'], f: `${fz(fertIst)} × ${fz(n(A.nacharbeit), 2)} €`,
    n: 'Steigt mit Technologie, Ökologie, Wertanalyse und Überauslastung; sinkt mit PNK und Motivation (Handbuch S. 24).' });
  const lkEs = esEnd * r('lager_es') / 1e6, lkFe = feEnd * r('lager_fe') / 1e6;
  def('k_lager', 'Lagerkosten', 'MEUR', lkEs + lkFe, { s: 'kalib', d: ['es_end', 'fe_lager_end'], q: 'Handbuch S. 17 (auf den Endbestand; Probe P1: 5.294 × 50 € = 0,26)',
    f: `${fz(esEnd)} × 50 € + ${fz(feEnd)} × 100 €` });
  const kWerb = def('k_werb', 'Werbung/Marktforschung/CI', 'MEUR', n(F.werbung) + n(F.ci) + (F.mafo ? r('mafo') : 0), { d: ['F_werbung', 'F_ci', 'F_mafo'], f: `${fz(n(F.werbung), 2)} + ${fz(n(F.ci), 2)} + ${F.mafo ? '0,10' : '0'}` });
  def('k_fue', 'Sonstige Kosten F&E', 'MEUR', n(F.oeko) + n(F.wa), { d: ['F_oeko', 'F_wa'], f: `Ökologie ${fz(n(F.oeko), 2)} + Wertanalyse ${fz(n(F.wa), 2)}` });
  const kTr = def('k_transp', 'Transportkosten', 'MEUR', absatz * r('transport') / 1e6, { d: ['absatz'], q: R.transport[1], f: `${fz(absatz)} × 25 € (Großabnehmer frei)` });
  const sonst = def('g_sonst', 'Sonstiger Aufwand', 'MEUR', ['k_fix', 'k_ih', 'k_po', 'k_umw', 'k_nach', 'k_lager', 'k_werb', 'k_fue', 'k_transp', 'k_schicht'].reduce((s, k) => s + V(k), 0),
    { d: ['k_fix', 'k_ih', 'k_po', 'k_umw', 'k_nach', 'k_lager', 'k_werb', 'k_fue', 'k_transp', 'k_schicht'], f: 'Summe der Positionen' });
  const mat = def('g_mat', 'Materialaufwand', 'MEUR', kEs + kBs, { d: ['k_es', 'k_bs'], f: `${fz(kEs, 2)} + ${fz(kBs, 2)}` });
  const afa = def('g_afa', 'Abschreibungen', 'MEUR', V('k_afa_geb') + V('k_afa_anl') + V('k_afa_umw'), { d: ['k_afa_geb', 'k_afa_anl', 'k_afa_umw'], f: `${fz(V('k_afa_geb'), 2)} + ${fz(V('k_afa_anl'), 2)} + ${fz(V('k_afa_umw'), 2)}` });

  // =========================== HERSTELLKOSTEN UND LAGERBEWERTUNG ===========================
  const g = r('geb');
  const ks = j => PZ[j].sum;
  const kostFue = ks('fue') + r('afa_geb') * g.fue, kostVt = ks('vt') + r('afa_geb') * g.vt + n(F.ci) + (F.mafo ? r('mafo') : 0) + lkFe, kostVw = ks('vw') + r('afa_geb') * g.vw + r('ih_verw');
  const kGes = mat + pers + afa + sonst;
  const hk = def('hk', 'Herstellkosten der Fertigung', 'MEUR', kGes - kostFue - kostVt - kostVw - n(F.werbung) - V('k_fue') - kTr,
    { d: ['g_mat', 'g_pers', 'g_afa', 'g_sonst'], q: 'TNB09: Kosten der Stellen Einkauf + Fertigung (Gesamtkosten ohne F&E, Vertrieb, Verwaltung, Werbung, F&E-Einzelkosten, Transport)',
      f: `${fz(kGes, 2)} − F&E ${fz(kostFue, 2)} − Vertrieb ${fz(kostVt, 2)} − Verwaltung ${fz(kostVw, 2)} − Werbung ${fz(n(F.werbung), 2)} − F&E-Einzel ${fz(V('k_fue'), 2)} − Transport ${fz(kTr, 2)}`, n: 'Probe P1: 115,96 − 31,33 = 84,63 = TNB09.' });
  def('hk_stk', 'Herstellkosten je Stück', 'EUR', fertIst === 0 ? 0 : hk * 1e6 / fertIst, { d: ['hk', 'fert'], f: `${fz(hk, 2)} MEUR / ${fz(fertIst)}` });
  const feAnfW = W(L.fe_wert), feAvg = (feAnf + fertIst) === 0 ? 0 : (feAnfW + hk) * 1e6 / (feAnf + fertIst);
  const feEndW = def('fe_end_wert', 'Fertigprodukte Lager Ende (Wert)', 'MEUR', feEnd * feAvg / 1e6, { d: ['fe_lager_end', 'hk'], q: 'Handbuch S. 18: Mischkalkulation', f: `${fz(feEnd)} × ${fz(feAvg, 2)} €` });
  const bestv = def('bestv', 'Bestandsveränderung Fertigprodukte', 'MEUR', feEndW - feAnfW, { d: ['fe_end_wert'], f: `${fz(feEndW, 2)} − ${fz(feAnfW, 2)} (Anfang)` });
  def('sk_stk', 'Selbstkosten je verkauftem Stück', 'EUR', feAbg === 0 ? 0 : (kGes - bestv) * 1e6 / feAbg, { d: ['g_mat', 'g_pers', 'g_afa', 'g_sonst', 'bestv'], f: `(${fz(kGes, 2)} − ${fz(bestv, 2)}) MEUR / ${fz(feAbg)}` });

  // =========================== GuV ===========================
  const be = def('be', 'Betriebsergebnis', 'MEUR', umsatz + bestv - mat - pers - afa - sonst, { d: ['umsatz', 'bestv', 'g_mat', 'g_pers', 'g_afa', 'g_sonst'],
    q: 'TNB11 Gesamtkostenverfahren', f: `${fz(umsatz, 2)} ${bestv >= 0 ? '+' : '−'} ${fz(Math.abs(bestv), 2)} − ${fz(mat, 2)} − ${fz(pers, 2)} − ${fz(afa, 2)} − ${fz(sonst, 2)}` });
  const rt = TAB.rt.l.indexOf(W(stand.rating)), rz = rt >= 0 ? TAB.rt.y[rt] : 0;
  const zk = def('zins_kurz', 'Zinssatz kurzfristig', '%', (n(N.zins.kurz) + rz) * 100, { q: `${N.zins_text || N.quelle}; Rating ${W(stand.rating)} → ${fz(rz * 100, 1)} %-Punkte (${TAB.rt.q})`, f: `${fp(n(N.zins.kurz))} ${rz < 0 ? '−' : '+'} ${fz(Math.abs(rz) * 100, 1)} %-Punkte` }) / 100;
  const zl = (n(N.zins.lang) + rz), zu = (n(N.zins.ueberz) + rz);
  def('zins_lang', 'Zinssatz langfristig (neu)', '%', zl * 100, { f: `${fp(n(N.zins.lang))} ${rz < 0 ? '−' : '+'} ${fz(Math.abs(rz) * 100, 1)} %-Punkte`, q: 'wird bei Aufnahme für 10 Perioden fixiert' });
  def('zins_ueberz', 'Zinssatz Überziehung', '%', zu * 100, { f: `${fp(n(N.zins.ueberz))} ${rz < 0 ? '−' : '+'} ${fz(Math.abs(rz) * 100, 1)} %-Punkte` });
  const zins = def('zinsen', 'Zinsen kurz- und langfristige Kredite', 'MEUR', n(F.kurz) * zk + W(B.kredit_lang) * W(B.zins_lang) + n(F.lang) * zl, { d: ['F_kurz', 'F_lang', 'zins_kurz', 'zins_lang'],
    f: `${fz(n(F.kurz), 2)} × ${fp(zk)} + ${fz(n(F.lang), 2)} × ${fp(zl)}${W(B.kredit_lang) ? ` + bestehend ${fz(W(B.kredit_lang), 2)} × ${fp(W(B.zins_lang))}` : ''}`, q: 'Handbuch S. 30–31: Zinsen in der laufenden Periode; Kredit der Vorperiode wurde dort schon verzinst' });
  const wpE = def('wp_ertrag', 'Zinserträge Wertpapiere', 'MEUR', n(F.wp) * n(N.zins_wp), { s: n(F.wp) > 0 ? 'schaetz' : 'regel', d: ['F_wp'], f: `${fz(n(F.wp), 2)} × ${fp(n(N.zins_wp))}`, q: N.zins_wp_text || N.quelle });

  // =========================== LIQUIDITÄT (mit automatischem Überziehungskredit) ===========================
  const ezVp = W(B.forderungen) + W(B.wertpapiere);
  const ezOhne = uM1 * r('zahl_sofort') + uGa + ezVp + wpE + rest + n(F.kurz) + n(F.lang);
  const azMat = esZug + nachlW + kBs, azPers = pers - kPens;
  const tilg = W(B.kredit_kurz) + W(B.ueberziehung);
  const invUmw = n(F.umwelt);
  const divMax = Math.max(0, W(B.gewinnvortrag)), div = Math.min(n(F.div), divMax);
  const azOhne = azMat + azPers + sonst + tilg + zins + invAnl + n(F.wp) + invUmw + div;
  const gvst0 = be + wpE - zins;
  const vv = W(B.verlustvortrag);
  const steuerVon = x => Math.max(0, x - vv) * r('steuer');
  const kasse0 = W(B.kasse) + ezOhne - azOhne;
  let ue = 0;
  for (let i = 0; i < 50; i++) { const ende = kasse0 + ue - ue * zu - steuerVon(gvst0 - ue * zu); const fehlt = r('kasse_min') - ende; if (fehlt <= 1e-9) break; ue += fehlt / (1 - zu * (1 - r('steuer'))); }
  const zinsUe = ue * zu, gvst = gvst0 - zinsUe, steuern = steuerVon(gvst), pue = gvst - steuern, kasse = kasse0 + ue - zinsUe - steuern;
  def('ueberz', 'Überziehungskredit (automatisch)', 'MEUR', ue, { d: ['kasse_vor'], q: R.kasse_min[1], f: ue > 0 ? `nötig, damit die Kasse 0,10 MEUR erreicht (Zins ${fp(zu)} darauf)` : 'Kasse reicht → 0' });
  def('zins_ue', 'Zinsen Überziehungskredit', 'MEUR', zinsUe, { d: ['ueberz', 'zins_ueberz'], f: `${fz(ue, 2)} × ${fp(zu)}` });
  def('fin', 'Finanzergebnis', 'MEUR', wpE - zins - zinsUe, { d: ['wp_ertrag', 'zinsen', 'zins_ue'], f: `${fz(wpE, 2)} − ${fz(zins, 2)} − ${fz(zinsUe, 2)}` });
  def('gvst', 'Gewinn vor Steuern', 'MEUR', gvst, { d: ['be', 'fin'], f: `${fz(be, 2)} + (${fz(wpE - zins - zinsUe, 2)})` });
  def('steuern', 'Steuern (45 %)', 'MEUR', steuern, { d: ['gvst'], q: R.steuer[1], f: `max(0; ${fz(gvst, 2)}${vv ? ' − Verlustvortrag ' + fz(vv, 2) : ''}) × 45 %` });
  def('pue', 'Periodenüberschuss', 'MEUR', pue, { d: ['gvst', 'steuern'], f: `${fz(gvst, 2)} − ${fz(steuern, 2)}` });

  def('ez_akt', 'Einzahlungen Umsatz dieser Periode', 'MEUR', uM1 * r('zahl_sofort') + uGa, { d: ['umsatz_m1', 'umsatz_ga'], q: R.zahl_sofort[1], f: `${fz(uM1, 2)} × 80 % + ${fz(uGa, 2)} × 100 %` });
  def('ez_vp', 'Einzahlungen aus Vorperiode', 'MEUR', ezVp, { s: 'ist', q: 'TNB15 Vorperiode: Forderungen + Wertpapiere', f: `${fz(W(B.forderungen), 2)} + ${fz(W(B.wertpapiere), 2)}` });
  def('ez_desinv', 'Resterlös Anlagenverkauf', 'MEUR', rest, { d: [], q: 'Handbuch S. 21', f: rest ? 'Restbuchwert × 20/25/30 %' : 'kein Verkauf' });
  def('ez_kredit', 'Aufnahme Kredite', 'MEUR', n(F.kurz) + n(F.lang), { d: ['F_kurz', 'F_lang'], f: `${fz(n(F.kurz), 2)} + ${fz(n(F.lang), 2)}` });
  const ezSum = def('ez_sum', 'Summe Einzahlungen', 'MEUR', ezOhne + ue, { d: ['ez_akt', 'ez_vp', 'wp_ertrag', 'ez_desinv', 'ez_kredit', 'ueberz'], f: 'Summe' });
  def('az_mat', 'Auszahlungen Material', 'MEUR', azMat, { d: ['es_zugang', 'es_nachl_wert', 'k_bs'], q: 'Lieferant: 100 % sofort (TNB12)', f: `${fz(esZug, 2)} + ${fz(nachlW, 2)} + ${fz(kBs, 2)}` });
  def('az_pers', 'Auszahlungen Personal (ohne Pensionen)', 'MEUR', azPers, { d: ['g_pers', 'k_pens'], f: `${fz(pers, 2)} − ${fz(kPens, 2)}`, q: 'Pensionsrückstellungen fließen nicht ab' });
  def('az_sonst', 'Sonstige Aufwendungen', 'MEUR', sonst, { d: ['g_sonst'], f: 'wie GuV' });
  def('az_tilg', 'Tilgung kurzfristiger Kredit + Überziehung Vorperiode', 'MEUR', tilg, { s: 'ist', q: 'Handbuch S. 30–31: automatisch in der Folgeperiode zurückgezahlt; ' + Q(B.kredit_kurz), f: `${fz(W(B.kredit_kurz), 2)} + ${fz(W(B.ueberziehung), 2)}` });
  def('az_inv', 'Kauf Anlagen + Umweltanlagen', 'MEUR', invAnl + invUmw, { d: ['F_inv', 'F_umwelt'], f: `${fz(invAnl, 2)} + ${fz(invUmw, 2)}` });
  def('az_div', 'Dividende', 'MEUR', div, { d: ['F_div'], q: `max. Gewinnvortrag ${fm(divMax)} (Handbuch S. 33)`, f: fz(div, 2) });
  def('kasse_vor', 'Kasse vor Steuern und Überziehung', 'MEUR', kasse0, { d: ['ez_akt', 'ez_vp', 'wp_ertrag', 'ez_desinv', 'ez_kredit', 'az_mat', 'az_pers', 'az_sonst', 'az_tilg', 'zinsen', 'az_inv', 'az_div', 'F_wp'],
    f: `${fz(W(B.kasse), 2)} (Anfang) + ${fz(ezOhne, 2)} (Einz.) − ${fz(azOhne, 2)} (Ausz.)` });
  const azSum = def('az_sum', 'Summe Auszahlungen', 'MEUR', azOhne + steuern + zinsUe, { d: ['az_mat', 'az_pers', 'az_sonst', 'az_tilg', 'zinsen', 'az_inv', 'F_wp', 'az_div', 'steuern', 'zins_ue'], f: 'Summe' });
  def('kasse', 'Kassenendbestand', 'MEUR', kasse, { d: ['kasse_vor', 'ueberz', 'zins_ue', 'steuern'], q: 'TNB12', f: `${fz(W(B.kasse), 2)} + ${fz(ezSum, 2)} − ${fz(azSum, 2)}` });

  // =========================== BILANZ UND KENNZAHLEN ===========================
  const ford = def('bi_ford', 'Forderungen', 'MEUR', uM1 * (1 - r('zahl_sofort')), { d: ['umsatz_m1'], f: `${fz(uM1, 2)} × 20 %` });
  const grund = def('bi_grund', 'Grundstücke und Bauten', 'MEUR', W(B.grundstuecke) - r('afa_geb'), { d: ['k_afa_geb'], f: `${fz(W(B.grundstuecke), 2)} − 0,25` });
  const masch = def('bi_masch', 'Maschinen und Ausstattung', 'MEUR', W(B.maschinen) + invAnl + invUmw - V('k_afa_anl') - V('k_afa_umw') - rest,
    { d: ['az_inv', 'k_afa_anl', 'k_afa_umw', 'ez_desinv'], f: `${fz(W(B.maschinen), 2)} + ${fz(invAnl + invUmw, 2)} − ${fz(V('k_afa_anl') + V('k_afa_umw'), 2)} − ${fz(rest, 2)}` });
  const aktiva = def('bi_aktiva', 'Bilanzsumme', 'MEUR', grund + masch + esEndW + feEndW + ford + n(F.wp) + kasse, { d: ['bi_grund', 'bi_masch', 'es_end_wert', 'fe_end_wert', 'bi_ford', 'F_wp', 'kasse'],
    f: [grund, masch, esEndW, feEndW, ford, n(F.wp), kasse].map(x => fz(x, 2)).join(' + ') });
  const vortrag = W(B.gewinnvortrag) - div;
  const ekNeu = def('bi_ek', 'Eigenkapital', 'MEUR', W(B.gez_kapital) + W(B.kapitalruecklage) + W(B.gewinnruecklage) + vortrag + pue, { d: ['pue', 'az_div'],
    f: `${fz(W(B.gez_kapital) + W(B.kapitalruecklage) + W(B.gewinnruecklage), 2)} (Kapital + Rücklagen) + ${fz(vortrag, 2)} (Vortrag nach Dividende) + ${fz(pue, 2)} (PÜ)` });
  const pensB = W(B.pensionen) + kPens, fk = pensB + W(B.kredit_lang) + n(F.lang) + n(F.kurz) + ue;
  def('bi_fk', 'Fremdkapital (inkl. Pensionen)', 'MEUR', fk, { d: ['k_pens', 'F_kurz', 'F_lang', 'ueberz'], f: `Pensionen ${fz(pensB, 2)} + Kredite ${fz(W(B.kredit_lang) + n(F.lang) + n(F.kurz), 2)} + Überziehung ${fz(ue, 2)}` });
  def('bi_diff', 'Bilanzprobe Aktiva − Passiva', 'MEUR', aktiva - ekNeu - fk, { d: ['bi_aktiva', 'bi_ek', 'bi_fk'], f: 'muss 0 sein' });
  const ekr = def('ekr', 'Eigenkapitalrendite', '%', pue / W(B.eigenkapital) * 100, { d: ['pue'], q: 'TNB18: PÜ / Eigenkapital der Vorperiode (Probe P1: 5,88 / 31,27 = 18,80 %)', f: `${fz(pue, 2)} / ${fz(W(B.eigenkapital), 2)}` });
  const ocf = def('ocf', 'Operativer Cashflow', 'MEUR', pue + afa + kPens + (esAnfW - esEndW) + (feAnfW - feEndW) + (W(B.forderungen) - ford),
    { d: ['pue', 'g_afa', 'k_pens', 'es_end_wert', 'fe_end_wert', 'bi_ford'], q: 'TNB14',
      f: `${fz(pue, 2)} (PÜ) + ${fz(afa, 2)} (AfA) + ${fz(kPens, 2)} (Pensionen) + ${fz(esAnfW - esEndW, 2)} (Δ Material) + ${fz(feAnfW - feEndW, 2)} (Δ Fertigprodukte) + ${fz(W(B.forderungen) - ford, 2)} (Δ Forderungen)` });
  def('ekq', 'Eigenkapitalquote', '%', aktiva === 0 ? 0 : ekNeu / aktiva * 100, { d: ['bi_ek', 'bi_aktiva'], f: `${fz(ekNeu, 2)} / ${fz(aktiva, 2)}` });
  def('ur', 'Umsatzrendite', '%', umsatz === 0 ? 0 : pue / umsatz * 100, { d: ['pue', 'umsatz'], f: `${fz(pue, 2)} / ${fz(umsatz, 2)}` });

  // Planungsqualität (TNB17)
  const pa = n(F.plan_absatz), paAbw = pa === 0 ? 1 : Math.abs(absatz + gaL - pa) / pa;
  const pkt = { abs: Math.max(0, 100 - paAbw * 100), ekr: Math.max(0, 100 - Math.abs(ekr - n(F.plan_ekr))), ocf: Math.max(0, 100 - KAL.pq_ocf.k * Math.abs(ocf - n(F.plan_ocf))) };
  def('pq', 'Planungsqualität (erwartet)', 'Punkte', 0.5 * pkt.abs + 0.25 * pkt.ekr + 0.25 * pkt.ocf, { s: 'kalib', d: ['absatz', 'ekr', 'ocf'],
    q: 'TNB17: Gewichte 50/25/25. Absatz: 100 − Abweichung in %; EKR: 100 − Abweichung in %-Punkten (beides geprüft mit P1). OCF: ' + KAL.pq_ocf.q,
    f: `0,5 × ${fz(pkt.abs, 1)} + 0,25 × ${fz(pkt.ekr, 1)} + 0,25 × ${fz(pkt.ocf, 1)}  (Plan: ${fz(pa)} Stk / ${fz(n(F.plan_ekr), 1)} % / ${fz(n(F.plan_ocf), 1)} MEUR)` });

  // Verlässlichkeit über alle Zutaten (schlechteste Stufe)
  const memo = {};
  const sg = (k, weg = new Set()) => { if (memo[k] != null) return memo[k]; const e = E[k]; if (!e || weg.has(k)) return 0; weg.add(k);
    let m = STUFE[e.s] ?? 0; e.d.forEach(d => { m = Math.max(m, sg(d, weg)); }); weg.delete(k); return (memo[k] = m); };
  Object.keys(E).forEach(k => { E[k].sg = sg(k); });

  return { E, v: k => E[k] ? E[k].v : null, anlagen, PZ, ms, nb, knapp };
}

// Szenarien: Nachfrage pessimistisch / Basis / optimistisch
export function szenarien(stand, N, F, A) {
  return { pess: rechne(stand, N, F, A, { szenario: 'pess' }), basis: rechne(stand, N, F, A), opt: rechne(stand, N, F, A, { szenario: 'opt' }) };
}

// Preis, bei dem die Basis-Nachfrage genau die verfügbare Menge trifft
export function preisFuerMenge(stand, N, F, A, menge) {
  const ms = marktschaetzung(stand.markt); if (!ms) return null;
  let lo = 1500, hi = 6000;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; const d = nachfrage(stand, A, { ...F, preis: m }, ms).N; if (d > menge) lo = m; else hi = m; }
  return Math.round(hi);
}
