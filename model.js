// TOPSIM-Planungsmodell (Unternehmen 1, Copy Classic, Markt 1)
// Läuft im Browser (index.html) und in Node (tools/check.mjs).
//
// Begriffe
//   B  Berichtswerte einer Periode (Schlüssel wie "t15_kasse", Werte als Liste in Berichtsspalten)
//   F  Entscheidungsformular der Planperiode
//   A  Annahmen (aus den Berichten kalibriert, im Tool änderbar)
//   Q  Wirtschaftsnachrichten / Periodenparameter der Planperiode
//   R  feste Spielregeln aus dem Teilnehmerhandbuch (S. = Seite)

export const R = {
  mio: 1e6,
  band: 0.05,            // reaktionsarmer Preisbereich ±5 % (S. 10)
  e_in: -0.8,            // Preiselastizität im reaktionsarmen Bereich (Schätzung)
  e_out: -2.5,           // Preiselastizität außerhalb (Schätzung)
  werbe_stk: 2000,       // +1 MEUR Werbung ≈ +2.000 Stück (S. 12)
  vertr_stk: 200,        // +10 Vertriebler ≈ +2.000 Stück (S. 13)
  transport: 25,         // EUR je Stück Inland (S. 13)
  mf_kosten: 0.1,        // Marktforschungsbericht MEUR (S. 15)
  zahl_sofort: 0.8,      // 80 % Einzahlung sofort (S. 30)
  staffel1: 0, staffel2: 30000, staffel3: 50000, staffel4: 70000, // Einkaufsstaffel (S. 17)
  lager_es: 50, lager_fe: 100, // Lagerkosten EUR/Einheit (S. 17)
  max_anl: 9,
  preis_A: 20, preis_B: 25, preis_C: 30, nd_A: 10, nd_B: 10, nd_C: 15,
  kap_A: 14000, kap_B: 18000, kap_C: 22000, fix_A: 0.3, fix_B: 2, fix_C: 2.5,
  umw_A: 100, umw_B: 105, umw_C: 110, rest_A: 0.2, rest_B: 0.25, rest_C: 0.3, // S. 20–21
  ues_anl: 0.1, sprungfix: 2.5, ih_verw: 1, // Überstunden 10 %, Zusatzschicht 2,5 MEUR (S. 22)
  umw_norm: 100, nd_umwelt: 10,             // S. 22–23
  grundprod: 50, ues_pers: 0.1, ues_zuschlag: 0.25, // S. 28
  einst_k: 12500, entl_k: 10000, pnk_min: 37, pension: 0.05, sp_schwelle: 0.1, // S. 26–27
  afa_geb: 0.25, geb_ek: 0.05, geb_fe: 0.7, geb_fue: 0.05, geb_vt: 0.05, geb_vw: 0.15, // Gebäude-AfA nach TNB08
  steuer: 0.45, kasse_min: 0.1, aktien: 500000, // S. 30–33
  po_ref: 2.5, // Prozessoptimierung: 2,5 MEUR ≈ Index 1,04 (S. 29)
  pq_w_abs: 0.5, pq_w_ekr: 0.25, pq_w_ocf: 0.25,
  // Ampel-Schwellen
  a_ausl_gelb: 1, a_ausl_unter: 0.9, a_es_end: 0.5, a_fe_end: 0.15, a_kasse_max: 2,
  a_ekq_gelb: 0.4, a_ekq_rot: 0.3, a_umw_rot: 92.5,
};

export const TAB = {
  ih: { x: [0.1, 0.5, 0.7, 1, 1.5, 3, 4], y: [0.5, 0.7, 0.8, 0.95, 0.97, 0.99, 1] },          // Instandhaltung → Verfügbarkeit (S. 22)
  ua: { x: [85, 90, 92.5, 95, 98, 100], y: [5, 2.5, 1.5, 1, 0.5, 0] },                          // Umweltabgabe (S. 23)
  sp: { x: [0, 0.1, 0.2, 0.4], y: [0, 15000, 20000, 25000] },                                   // Sozialplan (S. 27)
  pe: { x: [50, 100, 150, 200, 250, 300, 350], y: [10, 15, 18, 20.5, 23, 24.3, 25.5] },         // Personal Einkauf je Umsatz (S. 26, abgelesen)
  pv: { x: [50, 75, 100, 150, 200, 250, 300, 350], y: [150, 185, 200, 225, 250, 265, 275, 285] }, // Personal Verwaltung (S. 26, abgelesen)
  rt: { l: ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D'], y: [-0.04, -0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03, 0.04, 0.05] }, // S. 32
};

export const TY = ['A', 'B', 'C'];
const n = v => (v == null || v === '' || isNaN(+v)) ? 0 : +v;
const rnd = x => Math.sign(x) * Math.round(Math.abs(x) + 1e-9);
const interp = (x, t) => { const X = t.x, Y = t.y, m = X.length; if (x <= X[0]) return Y[0]; if (x >= X[m - 1]) return Y[m - 1];
  let i = 0; while (!(x >= X[i] && x < X[i + 1])) i++; return Y[i] + (x - X[i]) * (Y[i + 1] - Y[i]) / (X[i + 1] - X[i]); };
const step = (x, t) => { let i = 0; for (let j = 0; j < t.x.length; j++) if (x >= t.x[j]) i = j; return t.y[i]; };
const getters = B => {
  const raw = (k, c = 1) => { const a = B[k]; return a && a[c - 1] != null && a[c - 1] !== '' && a[c - 1] !== '-' ? a[c - 1] : null; };
  const b = (k, c = 1) => { const v = raw(k, c); return v == null || typeof v === 'string' ? 0 : +v; };
  return { raw, b };
};

// Prozessoptimierung: Produktivitätsgewinn je Budget. Handbuch: 2,5 MEUR ≈ +4 %.
// Darüber halber Grenznutzen (Schätzung). A.po_wirk = Gewinn bei 2,5 MEUR.
export function poKurve(mio, wirk) {
  const x = Math.max(0, n(mio)), w = n(wirk);
  return x <= R.po_ref ? w * x / R.po_ref : w + 0.5 * w * (x - R.po_ref) / R.po_ref;
}

// ---------------------------------------------------------------------------------------------
// Kalibrierung: Annahmen aus den Ist-Berichten einer Periode
// ---------------------------------------------------------------------------------------------
export function kalibriere(B) {
  const { raw, b } = getters(B);
  const ums = b('t01_umsatz') || b('t11_umsatz');
  const anf = j => b('t06_anf', j), fl = j => b('t06_fluk', j);
  const q = j => anf(j) === 0 ? 0 : fl(j) / anf(j);
  const fm = b('t03_fm');
  return {
    absatz_manuell: null,
    unsicherheit: 0.10,
    fluk_ek: q(1), fluk_vw: q(2), fluk_fe: q(3), fluk_fue: q(4), fluk_vt: q(5),
    fehl: b('t03_pers') === 0 ? 0 : b('t03_fehl') / b('t03_pers'),
    prod: b('t03_kap_ma') || R.grundprod,
    po_wirk: 0.04,
    prod_aend: 0,
    nach: fm === 0 ? 0 : b('t07_nach') * R.mio / fm,
    umw_pkt: b('t03_umw_kum') === 0 ? 1.2 : (b('t03_umw_ind') - b('t03_umw_anl')) / b('t03_umw_kum'),
    rat_A: raw('rat_A') ?? 1, rat_B: raw('rat_B') ?? 1, rat_C: raw('rat_C') ?? 1,
    wa_idx: raw('t04_wa', 2) ?? 1,
    k_ek: ums === 0 ? 1 : b('t06_end', 1) / interp(ums, TAB.pe),
    k_vw: ums === 0 ? 1 : b('t06_end', 2) / interp(ums, TAB.pv),
    vv: raw('x_verlustvortrag') ?? 0,
    r_lang_alt: raw('x_r_lang'),
    rating_an: 'Ja',
  };
}

// Herkunft je Annahme (für die Anzeige)
export const ANNAHMEN = {
  absatz_manuell: ['Absatz manuell (leer = Modell)', 'Stück', 500, 'Eingabe'],
  unsicherheit: ['Unsicherheit Nachfrage ±', 'Anteil', 0.01, 'Schätzung'],
  prod: ['Produktivität je MA (Basis)', 'Stück', 0.1, 'Bericht TNB03'],
  po_wirk: ['Wirkung Prozessoptimierung bei 2,5 MEUR', 'Anteil', 0.005, 'Handbuch S. 29'],
  prod_aend: ['Sonstige Produktivitätsänderung', 'Anteil', 0.005, 'Schätzung (Training, Einarbeitung, Motivation, Lernkurve)'],
  fehl: ['Fehlzeitenquote Fertigung', 'Anteil', 0.005, 'Bericht TNB03'],
  fluk_fe: ['Fluktuation Fertigung', 'Anteil', 0.005, 'Bericht TNB06'],
  fluk_ek: ['Fluktuation Einkauf', 'Anteil', 0.005, 'Bericht TNB06'],
  fluk_vw: ['Fluktuation Verwaltung', 'Anteil', 0.005, 'Bericht TNB06'],
  fluk_fue: ['Fluktuation F&E', 'Anteil', 0.005, 'Bericht TNB06'],
  fluk_vt: ['Fluktuation Vertrieb', 'Anteil', 0.005, 'Bericht TNB06'],
  rat_A: ['Rationalisierungsfaktor Typ A', 'Faktor', 0.01, 'Bericht TNB03'],
  rat_B: ['Rationalisierungsfaktor Typ B', 'Faktor', 0.01, 'Bericht TNB03'],
  rat_C: ['Rationalisierungsfaktor Typ C', 'Faktor', 0.01, 'Bericht TNB03'],
  wa_idx: ['Wertanalyseindex', 'Index', 0.01, 'Bericht TNB04'],
  nach: ['Nacharbeit je Stück', 'EUR', 1, 'Bericht TNB07'],
  umw_pkt: ['Umweltpunkte je MEUR Umweltanlagen', 'Punkte', 0.01, 'Bericht TNB03'],
  k_ek: ['Faktor Personalbedarf Einkauf', 'Faktor', 0.01, 'Bericht TNB06 / Handbuch S. 26'],
  k_vw: ['Faktor Personalbedarf Verwaltung', 'Faktor', 0.01, 'Bericht TNB06 / Handbuch S. 26'],
  vv: ['Steuerlicher Verlustvortrag', 'MEUR', 0.1, 'Berichte'],
  r_lang_alt: ['Zinssatz bestehender langfr. Kredite (leer = aktuell)', 'Anteil', 0.005, 'Berichte'],
  rating_an: ['Ratingeffekt auf Zinsen', '', null, 'Handbuch S. 32'],
};

// Entscheidungen einer Periode aus TNB19 (Vorbelegung des Formulars)
export function formAus(B) {
  const { raw, b } = getters(B);
  const F = { preis: b('t19_preis'), werbung: b('t19_werbung'), vertrieb: b('t19_vertrieb'), ci: b('t19_ci'), mf: raw('t19_mf') || 'Ja',
    tech: b('t19_tech'), oeko: b('t19_oeko'), wa: b('t19_wa'), ga: b('t19_ga'), aus: b('t19_aus'), einkauf: b('t19_einkauf'), fm: b('t19_fm'),
    po: b('t19_po'), training: b('t19_training'), umwelt: b('t19_umw'), pnk: b('t19_pnk'), pers: b('t19_pers'),
    kurz: b('t19_kurz'), lang: b('t19_lang'), wp: b('t19_wp'), div: b('t19_div') };
  TY.forEach(t => { F['inv_' + t] = b('t19_inv_' + t); F['ih_' + t] = b('t19_ih_' + t); F['rat_' + t] = b('t19_rat_' + t);
    for (let i = 1; i <= 3; i++) F['des' + i + '_' + t] = null; });
  return F;
}

export function planwerteAus(B) {
  const { b } = getters(B);
  return { absatz: b('t19_pl_absatz'), ekr: b('t19_pl_ekr') / 100, ocf: b('t19_pl_ocf') };
}

// ---------------------------------------------------------------------------------------------
// Rechnung einer Planperiode
// ---------------------------------------------------------------------------------------------
export function modell(B, F, A, Q) {
  const { raw, b } = getters(B), T = TAB, mio = R.mio;
  const r = { anl: [] };
  const inv = {}, ih = {}, rat = {};
  TY.forEach(t => { inv[t] = n(F['inv_' + t]); ih[t] = n(F['ih_' + t]); rat[t] = n(F['rat_' + t]); });
  // Personal Fertigung
  const anf3 = b('t06_end', 3), pers = n(F.pers);
  const fluk3 = rnd(anf3 * n(A.fluk_fe)), end3 = Math.max(0, anf3 + Math.max(0, pers) - Math.max(0, -pers) - fluk3);
  r.pers_end = end3; r.fehl = rnd(end3 * n(A.fehl)); r.einsetzbar = end3 - r.fehl;
  r.po_eff = poKurve(F.po, A.po_wirk) - poKurve(b('t03_po'), A.po_wirk);
  r.prod = n(A.prod) * (1 + r.po_eff) * (1 + n(A.prod_aend));
  r.pers_kap = r.einsetzbar * r.prod; r.pers_kap_ues = r.pers_kap * (1 + R.ues_pers);
  // Anlagen
  let kap = 0, kapN = 0, afa = 0, ao = 0, rest = 0, fix = 0, rbwE = 0; const umw = [];
  TY.forEach(t => {
    let nvp = 0; for (let k = 1; k <= 9; k++) if (raw('anl_' + t + k, 2) != null) nvp++;
    const ihf = interp(ih[t], T.ih); let na = 0, nd = 0;
    for (let k = 1; k <= 9; k++) {
      const vp = raw('anl_' + t + k, 2) != null;
      const de = vp && [1, 2, 3].some(i => F['des' + i + '_' + t] != null && F['des' + i + '_' + t] !== '' && n(F['des' + i + '_' + t]) === k);
      const neu = !vp && k > nvp && k <= nvp + inv[t];
      const akt = de ? false : (vp || neu);
      const rbw = b('anl_' + t + k, 5);
      if (de) { const re = rbw * b('anl_' + t + k, 7) / 100; rest += re; ao += rbw - re; nd++; }
      if (!akt) continue;
      na++;
      const norm = neu ? R['kap_' + t] : b('kap_' + t + k, 1); kapN += norm;
      const kapk = norm * ihf * n(A['rat_' + t]); kap += kapk;
      const uw = neu ? R['umw_' + t] : b('kap_' + t + k, 6); umw.push(uw);
      const a = neu ? R['preis_' + t] / R['nd_' + t] : Math.min(b('anl_' + t + k, 4), rbw); afa += a;
      const rbwN = (neu ? R['preis_' + t] : rbw) - a; rbwE += rbwN;
      const fx = neu ? R['fix_' + t] : b('anl_' + t + k, 6); fix += fx;
      r.anl.push({ t, neu, bp: neu ? 0 : b('anl_' + t + k, 1), bw: neu ? R['preis_' + t] : b('anl_' + t + k, 2),
        rlz: neu ? R['nd_' + t] - 1 : Math.max(0, b('anl_' + t + k, 3) - 1), afa: a, rbw: rbwN, fix: fx,
        rp: neu ? R['rest_' + t] * 100 : b('anl_' + t + k, 7), norm, ih: ih[t], ihf, rat: n(A['rat_' + t]), kap: kapk, umw: uw });
    }
    r['n_' + t] = na; r['n_vp_' + t] = nvp; r['n_des_' + t] = nd; r['ih_fak_' + t] = ihf;
  });
  Object.assign(r, { kap_norm: kapN, kap, kap_ues: kap * (1 + R.ues_anl), fm_plan: n(F.fm), afa_anl: afa, ao_afa: ao, resterloes: rest, fix_anl: fix, rbw_end: rbwE });
  r.ausl_anl = kap === 0 ? 0 : r.fm_plan / kap;
  r.fert_max = Math.floor(Math.min(r.kap_ues, r.pers_kap_ues) + 1e-9);
  r.fert_ist = Math.min(r.fm_plan, r.fert_max); r.fert_fehl = r.fm_plan - r.fert_ist;
  r.zusatzschicht = (r.fert_ist > kap || r.fert_ist > r.pers_kap) ? R.sprungfix : 0;
  r.ih_anl = TY.reduce((s, t) => s + ih[t] * r['n_' + t], 0); r.rat_k = TY.reduce((s, t) => s + rat[t], 0);
  r.inv_anl = TY.reduce((s, t) => s + inv[t] * R['preis_' + t], 0);
  r.umw_anl = umw.length ? umw.reduce((s, x) => s + x, 0) / umw.length : 0;
  r.umw_kum = b('t03_umw_kum') + n(F.umwelt); r.umw_verb = r.umw_kum * n(A.umw_pkt); r.umw_ind = r.umw_anl + r.umw_verb;
  r.umw_abg = interp(r.umw_ind, T.ua); r.afa_umw = r.umw_kum / R.nd_umwelt; r.afa_geb = R.afa_geb;
  // Nachfrage und Absatz
  r.abs_vp = raw('t02_pot', 1) == null ? b('t01_absatz') : b('t02_pot', 1); r.mf_fehlt = raw('t02_pot', 1) == null;
  r.preis = n(F.preis); r.bpreis = n(Q.bpreis); r.wachstum = n(Q.wachstum);
  r.dev = r.bpreis === 0 ? 0 : r.preis / r.bpreis - 1;
  r.dev_in = Math.max(-R.band, Math.min(R.band, r.dev)); r.dev_out = r.dev - r.dev_in;
  r.preiseffekt = Math.max(0, 1 + R.e_in * r.dev_in + R.e_out * r.dev_out);
  r.werbeeffekt = (n(F.werbung) - b('t19_werbung')) * R.werbe_stk; r.vertriebseffekt = (n(F.vertrieb) - b('t19_vertrieb')) * R.vertr_stk;
  r.nachfrage_modell = Math.max(0, rnd(r.abs_vp * (1 + r.wachstum) * r.preiseffekt + r.werbeeffekt + r.vertriebseffekt));
  r.nachfrage = (A.absatz_manuell == null || A.absatz_manuell === '') ? r.nachfrage_modell : n(A.absatz_manuell);
  r.fe_anf_qty = b('t05_fe_end', 1); r.fe_anf_val = b('t05_fe_end', 3);
  r.verfuegbar = r.fe_anf_qty + r.fert_ist;
  r.aus_lief = Math.min(n(Q.aus_menge), r.verfuegbar);
  r.ga_max = Q.ga_max == null || Q.ga_max === '' ? Infinity : n(Q.ga_max);
  r.ga_lief = Math.min(n(F.ga), r.ga_max, r.verfuegbar - r.aus_lief);
  r.absatz = Math.max(0, Math.min(r.nachfrage, r.verfuegbar - r.aus_lief - r.ga_lief)); r.ngn = r.nachfrage - r.absatz;
  r.umsatz_m1 = r.absatz * r.preis / mio; r.umsatz_ga = r.ga_lief * n(Q.ga_preis) / mio; r.umsatz_aus = r.aus_lief * n(Q.aus_preis) / mio;
  r.umsatz = r.umsatz_m1 + r.umsatz_ga + r.umsatz_aus;
  // Einsatzstoffe
  r.es_anf = b('t05_es_end', 1); r.es_anf_val = b('t05_es_end', 3);
  r.bedarf = n(A.wa_idx) === 0 ? r.fert_ist : rnd(r.fert_ist / n(A.wa_idx));
  r.einkauf = n(F.einkauf);
  const st = [R.staffel1, R.staffel2, R.staffel3, R.staffel4], ep = [Q.ep1, Q.ep2, Q.ep3, Q.ep4].map(n);
  let si = 0; st.forEach((s, i) => { if (r.einkauf >= s) si = i; });
  r.ek_preis = r.einkauf > 0 ? ep[si] : 0; r.es_zug_val = r.einkauf * r.ek_preis / mio;
  r.nachl = Math.max(0, r.bedarf - r.es_anf - r.einkauf); r.nachl_val = r.nachl * n(Q.nachl) / mio;
  let sj = 0; st.forEach((s, i) => { if (r.nachl + r.einkauf >= s) sj = i; }); r.nachl_mehr = r.nachl * (n(Q.nachl) - ep[sj]) / mio;
  const esq = r.es_anf + r.einkauf + r.nachl;
  r.es_avg = esq === 0 ? 0 : (r.es_anf_val + r.es_zug_val + r.nachl_val) * mio / esq;
  r.es_abg_val = r.bedarf * r.es_avg / mio; r.es_end = esq - r.bedarf;
  r.es_end_val = r.es_anf_val + r.es_zug_val + r.nachl_val - r.es_abg_val;
  r.lk_es = r.es_end * R.lager_es / mio; r.bs = r.fert_ist * n(Q.betriebsstoff) / mio;
  // Personal je Kostenstelle (Einkauf, Verwaltung, Fertigung, F&E, Vertrieb)
  r.benoetigt = r.prod === 0 ? 0 : r.fert_ist / r.prod; r.ot_ma = Math.max(0, r.benoetigt - r.einsetzbar);
  const fq = [A.fluk_ek, A.fluk_vw, A.fluk_fe, A.fluk_fue, A.fluk_vt].map(n);
  const P = [];
  for (let j = 1; j <= 5; j++) {
    const anf = b('t06_end', j), fl = rnd(anf * fq[j - 1]);
    const ziel = j === 1 ? rnd(n(A.k_ek) * interp(r.umsatz, T.pe)) : j === 2 ? rnd(n(A.k_vw) * interp(r.umsatz, T.pv)) : j === 3 ? end3 : j === 4 ? n(F.tech) : n(F.vertrieb);
    const einst = j === 3 ? Math.max(0, pers) : Math.max(0, ziel - (anf - fl));
    const entl = j === 3 ? Math.max(0, -pers) : Math.max(0, (anf - fl) - ziel);
    const geh = n(Q[['geh_ek', 'geh_vw', 'geh_fe', 'geh_fue', 'geh_vt'][j - 1]]);
    const lohn = ziel * geh / mio, ot = j === 3 ? r.ot_ma * geh * (1 + R.ues_zuschlag) / mio : 0;
    const eek = (einst * R.einst_k + entl * R.entl_k) / mio;
    const sp = anf === 0 ? 0 : Math.max(0, entl - rnd(anf * R.sp_schwelle)) * step(entl / anf, T.sp) / mio;
    const tr = j === 3 ? ziel * n(F.training) / mio : 0;
    const pnk = (lohn + ot) * n(F.pnk) / 100, pens = (lohn + ot) * R.pension;
    P.push({ anf, fl, end: ziel, einst, entl, geh, lohn, ot, eek, sp, tr, pnk, pens, sum: lohn + ot + eek + sp + tr + pnk + pens });
  }
  const S = k => P.reduce((s, p) => s + p[k], 0);
  r.P = P; r.pers_kosten = S('sum'); r.pers_einst = S('einst'); r.pers_entl = S('entl'); r.pers_gesamt = S('end');
  r.neu_quote = end3 === 0 ? 0 : Math.max(0, pers) / end3;
  r.fe_abg = r.absatz + r.ga_lief + r.aus_lief; r.fe_end = r.fe_anf_qty + r.fert_ist - r.fe_abg; r.lk_fe = r.fe_end * R.lager_fe / mio;
  // Kosten
  const mf = F.mf === 'Ja' ? R.mf_kosten : 0;
  Object.assign(r, { k_es: r.es_abg_val, k_bs: r.bs, k_lohn: S('lohn') + S('ot'), k_eek: S('eek') + S('tr'), k_sp: S('sp'), k_pnk: S('pnk'), k_pens: S('pens'),
    k_afa_geb: r.afa_geb, k_afa_anl: afa + ao, k_afa_umw: r.afa_umw, k_fix: fix, k_ih: r.ih_anl + r.rat_k + R.ih_verw, k_po: n(F.po), k_umw: r.umw_abg,
    k_nach: r.fert_ist * n(A.nach) / mio, k_lager: r.lk_es + r.lk_fe, k_werb: n(F.werbung) + n(F.ci) + mf, k_fue: n(F.oeko) + n(F.wa),
    k_transp: r.absatz * R.transport / mio, k_schicht: r.zusatzschicht });
  r.k_sum = KOSTEN.reduce((s, [k]) => s + r[k], 0);
  const lohnE = Math.min(r.benoetigt, r.einsetzbar) * P[2].geh / mio + P[2].ot;
  const feE = lohnE * (1 + n(F.pnk) / 100 + R.pension) + r.k_nach;
  const E = [r.k_es + r.k_bs, feE, r.k_fue, n(F.werbung) + r.k_transp, 0];
  const G = [P[0].sum + r.afa_geb * R.geb_ek + r.lk_es,
    P[2].sum - (feE - r.k_nach) + r.afa_geb * R.geb_fe + r.k_afa_anl + r.k_afa_umw + fix + r.ih_anl + r.rat_k + r.k_po + r.k_umw + r.k_schicht,
    P[3].sum + r.afa_geb * R.geb_fue, P[4].sum + r.afa_geb * R.geb_vt + r.lk_fe + n(F.ci) + mf, P[1].sum + r.afa_geb * R.geb_vw + R.ih_verw];
  r.E = E; r.G = G;
  const KS = E.map((e, i) => e + G[i]);
  r.hk = KS[0] + KS[1]; r.hk_stk = r.fert_ist === 0 ? 0 : r.hk * mio / r.fert_ist;
  const den = r.fe_anf_qty + r.fert_ist;
  r.hkdu_stk = den === 0 ? 0 : (r.fe_anf_val + r.hk) * mio / den; r.hkdu = r.fe_abg * r.hkdu_stk / mio;
  r.fe_end_val = r.fe_anf_val + r.hk - r.hkdu; r.bestv = r.fe_end_val - r.fe_anf_val;
  r.kost_fue = KS[2]; r.kost_vt = KS[3]; r.kost_vw = KS[4]; r.sk = r.hkdu + KS[2] + KS[3] + KS[4];
  r.sk_stk = r.fe_abg === 0 ? 0 : r.sk * mio / r.fe_abg;
  const tot = ['t10s_vmat', 't10s_fmat', 't10s_vfert', 't10s_ffert'].reduce((s, k) => s + b(k), 0), sh = den === 0 ? 0 : r.fe_abg / den;
  const comp = (k, pr) => den === 0 ? 0 : ((tot === 0 ? 0 : r.fe_anf_val * b(k) / tot) + pr) * sh;
  r.db1 = r.umsatz - comp('t10s_vmat', E[0]) - comp('t10s_vfert', E[1]) - r.k_transp;
  r.db2 = r.db1 - comp('t10s_fmat', G[0]) - comp('t10s_ffert', G[1]); r.db3 = r.db2 - n(F.werbung); r.db4 = r.db3 - E[2]; r.db5 = r.db4 - G[2] - G[3] - G[4];
  // GuV
  r.g_mat = r.k_es + r.k_bs; r.g_pers = r.k_lohn + r.k_eek + r.k_sp + r.k_pnk + r.k_pens; r.g_afa = r.k_afa_geb + r.k_afa_anl + r.k_afa_umw;
  r.g_sonst = r.k_fix + r.k_ih + r.k_po + r.k_umw + r.k_nach + r.k_lager + r.k_werb + r.k_fue + r.k_transp + r.k_schicht;
  r.be = r.umsatz + r.bestv - r.g_mat - r.g_pers - r.g_afa - r.g_sonst;
  r.be_ukv = r.umsatz - r.hkdu - r.kost_fue - r.kost_vt - r.kost_vw;
  const rtI = T.rt.l.indexOf(raw('t01_rating'));
  r.zinsaend = A.rating_an === 'Ja' && rtI >= 0 ? T.rt.y[rtI] : 0;
  r.r_kurz = n(Q.r_kurz) + r.zinsaend; r.r_lang = n(Q.r_lang) + r.zinsaend; r.r_ue = n(Q.r_ue) + r.zinsaend;
  r.r_lang_alt = (A.r_lang_alt == null || A.r_lang_alt === '') ? n(Q.r_lang) : n(A.r_lang_alt);
  r.wp_ertr = n(F.wp) * n(Q.r_wp);
  r.zins_kl = n(F.kurz) * r.r_kurz + b('t15_lang') * r.r_lang_alt + n(F.lang) * r.r_lang;
  r.egt_vor = r.be + r.wp_ertr - r.zins_kl;
  // Liquidität (Überziehungskredit geschlossen gelöst: Zinsen und Steuern hängen vom Kredit ab)
  const t = R.steuer, km = R.kasse_min, vv = n(A.vv);
  r.div = Math.min(n(F.div), Math.max(0, b('t11_vortrag')));
  r.l_anf = b('t15_kasse');
  r.ez = r.umsatz_m1 * R.zahl_sofort + r.umsatz_ga + r.umsatz_aus + b('t15_ford') + b('t15_wp') + r.wp_ertr + r.resterloes + n(F.kurz) + n(F.lang);
  r.az = r.es_zug_val + r.nachl_val + r.bs + (r.g_pers - r.k_pens) + r.g_sonst + b('t15_kurz') + b('t15_ueberz') + r.zins_kl + r.inv_anl + n(F.wp) + n(F.umwelt) + r.div;
  const c1 = r.l_anf + r.ez - r.az, c0 = c1 - Math.max(0, r.egt_vor - vv) * t;
  const oa = (km - c1 + t * (r.egt_vor - vv)) / (1 - r.r_ue + t * r.r_ue), ob = (km - c1) / (1 - r.r_ue);
  r.ueberz = c0 >= km ? 0 : (r.egt_vor - vv - r.r_ue * oa > 0 ? oa : ob);
  r.zins_ue = r.ueberz * r.r_ue; r.egt = r.egt_vor - r.zins_ue;
  r.vv_genutzt = Math.min(vv, Math.max(0, r.egt)); r.vv_neu = vv - r.vv_genutzt + Math.max(0, -r.egt);
  r.steuern = Math.max(0, r.egt - vv) * t; r.pue = r.egt - r.steuern;
  r.kasse = c1 + r.ueberz - r.steuern - r.zins_ue;
  r.kreditbedarf = r.ueberz > 0 ? (km - c0) / (1 - r.r_kurz * (1 - (r.egt_vor - vv > 0 ? t : 0))) : 0;
  // Bilanz und Kennzahlen
  r.bi_grund = b('t15_grund') - r.afa_geb;
  r.bi_masch = b('t15_masch') + r.inv_anl + n(F.umwelt) - afa - r.afa_umw - ao - rest;
  r.bi_ford = r.umsatz_m1 * (1 - R.zahl_sofort);
  r.bi_akt = r.bi_grund + r.bi_masch + r.es_end_val + r.fe_end_val + r.bi_ford + n(F.wp) + r.kasse;
  r.vortrag_neu = b('t11_vortrag') - r.div + r.pue;
  r.bi_ek = b('t15_gez') + b('t15_kr') + b('t15_gr') + r.vortrag_neu;
  r.bi_pens = b('t15_pens') + r.k_pens; r.bi_lang = b('t15_lang') + n(F.lang);
  r.bi_pas = r.bi_ek + r.bi_pens + r.bi_lang + n(F.kurz) + r.ueberz;
  r.bi_diff = r.bi_akt - r.bi_pas;
  r.ekr = b('t15_ek') === 0 ? 0 : r.pue / b('t15_ek');
  r.ocf = r.pue + r.g_afa + r.k_pens + (b('t15_mat') - r.es_end_val) + (b('t15_fe') - r.fe_end_val) + (b('t15_ford') - r.bi_ford);
  r.ekq = r.bi_akt === 0 ? 0 : r.bi_ek / r.bi_akt; r.ausl_pers = r.pers_kap === 0 ? 0 : r.fm_plan / r.pers_kap;
  r.ek_vp = b('t15_ek'); r.pue_vp = b('t11_pue'); r.vortrag_vp = b('t11_vortrag');
  return r;
}

export const KOSTEN = [['k_es', 'Einsatzstoffe/Teile'], ['k_bs', 'Betriebsstoffe'], ['k_lohn', 'Löhne/Gehälter'], ['k_eek', 'Einst./Entl./Training'], ['k_sp', 'Sozialplan'],
  ['k_pnk', 'Personalnebenkosten'], ['k_pens', 'Pensionsrückstellungen'], ['k_afa_geb', 'AfA Gebäude'], ['k_afa_anl', 'AfA Fertigungsanlagen'], ['k_afa_umw', 'AfA Umwelttechnik'],
  ['k_fix', 'Sonstige fixe Kosten'], ['k_ih', 'Instandhaltung/Rationalisierung'], ['k_po', 'Prozessoptimierung'], ['k_umw', 'Umweltabgabe'], ['k_nach', 'Nacharbeit/Ausschuss'],
  ['k_lager', 'Lagerkosten'], ['k_werb', 'Werbung/MaFo/CI'], ['k_fue', 'Sonstige Kosten F&E'], ['k_transp', 'Transportkosten'], ['k_schicht', 'Zusatzschicht']];

// ---------------------------------------------------------------------------------------------
// Folgezustand: Ergebnis einer Planperiode als Berichtswerte (für den Ausblick auf die Periode danach)
// ---------------------------------------------------------------------------------------------
export function folgezustand(B, F, A, Q, r) {
  const { raw, b } = getters(B);
  const N = {};
  const cnt = {};
  r.anl.forEach(a => { cnt[a.t] = (cnt[a.t] || 0) + 1; const k = a.t + cnt[a.t];
    N['anl_' + k] = [a.neu ? (b('x_periode') + 1) : a.bp, a.bw, a.rlz, Math.min(a.afa, a.rbw), a.rbw, a.fix, a.rp];
    N['kap_' + k] = [a.norm, a.ih, a.ihf, a.rat, a.kap, a.umw]; });
  TY.forEach(t => { N['rat_' + t] = [n(A['rat_' + t])]; });
  N.t06_end = [...r.P.map(p => p.end), r.pers_gesamt];
  N.t06_anf = r.P.map(p => p.anf); N.t06_fluk = r.P.map(p => p.fl);
  N.t03_umw_kum = [r.umw_kum]; N.t03_umw_anl = [r.umw_anl]; N.t03_umw_ind = [r.umw_ind];
  N.t03_kap_ma = [r.prod]; N.t03_pers = [r.pers_end]; N.t03_fehl = [r.fehl]; N.t03_fm = [r.fert_ist]; N.t03_po = [n(F.po)];
  N.t07_nach = [r.k_nach]; N.t04_wa = [n(F.wa), n(A.wa_idx)];
  N.t01_absatz = [r.absatz]; N.t01_umsatz = [r.umsatz]; N.t02_pot = [r.nachfrage];
  N.t19_werbung = [n(F.werbung)]; N.t19_vertrieb = [n(F.vertrieb)];
  N.t05_fe_end = [r.fe_end, r.fe_end === 0 ? 0 : r.fe_end_val * R.mio / r.fe_end, r.fe_end_val];
  N.t05_es_end = [r.es_end, r.es_avg, r.es_end_val];
  N.t10s_vmat = [r.E[0]]; N.t10s_vfert = [r.E[1]]; N.t10s_fmat = [r.G[0]]; N.t10s_ffert = [r.G[1]];
  N.t01_rating = [raw('t01_rating')];
  N.t15_kasse = [r.kasse]; N.t15_ford = [r.bi_ford]; N.t15_wp = [n(F.wp)]; N.t15_kurz = [n(F.kurz)]; N.t15_ueberz = [r.ueberz];
  N.t15_lang = [r.bi_lang]; N.t15_masch = [r.bi_masch]; N.t15_grund = [r.bi_grund]; N.t15_mat = [r.es_end_val]; N.t15_fe = [r.fe_end_val];
  N.t15_ek = [r.bi_ek]; N.t15_gez = [b('t15_gez')]; N.t15_kr = [b('t15_kr')]; N.t15_gr = [b('t15_gr')]; N.t15_pens = [r.bi_pens];
  N.t11_vortrag = [r.vortrag_neu]; N.t11_pue = [r.pue];
  N.x_verlustvortrag = [r.vv_neu]; N.x_periode = [b('x_periode') + 1];
  N.x_r_lang = [r.bi_lang === 0 ? n(Q.r_lang) : (b('t15_lang') * r.r_lang_alt + n(F.lang) * r.r_lang) / r.bi_lang];
  return N;
}

// Ausgangszustand vor Periode 0 aus den Vorperioden-Spalten des P0-Berichts (nur für den Backtest P0)
export function vorperiode(B) {
  const { raw, b } = getters(B);
  const V = {};
  Object.keys(B).forEach(k => {
    if (/^anl_[ABC]\d$/.test(k)) { const a = B[k]; V[k] = [a[0] - 1, a[1], a[2] + 1, a[3], a[4] + a[3], a[5], a[6]]; }
    if (/^kap_[ABC]\d$/.test(k)) V[k] = B[k].slice();
  });
  TY.forEach(t => { V['rat_' + t] = [raw('rat_' + t) ?? 1]; });
  V.t06_end = B.t06_anf.slice();
  V.t03_umw_kum = [b('t03_umw_kum') - b('t19_umw')];
  V.t03_po = [0];
  V.t05_es_end = B.t05_es_anf.slice(); V.t05_fe_end = B.t05_fe_anf.slice();
  ['t10s_vmat', 't10s_vfert', 't10s_fmat', 't10s_ffert', 't19_werbung', 't19_vertrieb', 't01_absatz'].forEach(k => { V[k] = B[k] && B[k].slice(); });
  V.t01_rating = [null];
  ['kasse', 'ford', 'wp', 'kurz', 'ueberz', 'lang', 'masch', 'grund', 'mat', 'fe', 'ek', 'gez', 'kr', 'gr', 'pens'].forEach(k => { V['t15_' + k] = [b('t15_' + k, 2)]; });
  V.t11_vortrag = [b('t11_vortrag_vp')]; V.t11_pue = [b('t15_pue', 2)];
  V.x_periode = [-1];
  return V;
}

// ---------------------------------------------------------------------------------------------
// Szenarien, Empfindlichkeit, Ausblick
// ---------------------------------------------------------------------------------------------
export function szenarien(B, F, A, Q) {
  const basis = modell(B, F, A, Q);
  const u = n(A.unsicherheit), d = basis.nachfrage;
  const mit = f => modell(B, F, { ...A, absatz_manuell: Math.max(0, Math.round(d * f)) }, Q);
  return { pess: mit(1 - u), basis, opt: mit(1 + u) };
}

export function ausblick(B, F, A, Q, r) {
  const N = folgezustand(B, F, A, Q, r);
  const F2 = { ...F };
  TY.forEach(t => { F2['inv_' + t] = 0; for (let i = 1; i <= 3; i++) F2['des' + i + '_' + t] = null; });
  return { B: N, F: F2, r: modell(N, F2, { ...A, absatz_manuell: null, r_lang_alt: N.x_r_lang[0] }, Q) };
}

// Planungsqualität nach TNB17 (Gewichte 50/25/25). Formel für Punkte je Abweichung ist geschätzt.
export function planungsqualitaet(plan, ist) {
  const pa = plan.absatz === 0 ? 0 : Math.abs(ist.absatz - plan.absatz) / plan.absatz;
  const pe = Math.abs(ist.ekr - plan.ekr) * 100, po = Math.abs(ist.ocf - plan.ocf);
  const pk = x => Math.max(0, 100 - x);
  return { abs: pk(pa * 100), ekr: pk(pe), ocf: pk(po), gesamt: R.pq_w_abs * pk(pa * 100) + R.pq_w_ekr * pk(pe) + R.pq_w_ocf * pk(po) };
}
