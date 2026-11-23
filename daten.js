// Laden und Prüfen der Periodendaten (data/p{n}.json). Läuft im Browser und in Node.
import * as M from './model.js';

const nz = v => (v == null || v === '' || v === '-' || isNaN(+v)) ? 0 : +v;
const g = (B, k, c = 1) => B[k] ? nz(B[k][c - 1]) : 0;

// Ergänzt je Periode Werte, die nicht direkt im Bericht stehen (Verlustvortrag, Zins langfr. Kredite)
export function bereite(files) {
  const out = [];
  let vv = 0, langSum = 0, langZins = 0;
  files.forEach((f, i) => {
    const B = { ...f.berichte };
    const n = f.periode;
    const gvst = g(B, 't11_gvst');
    vv = Math.max(0, vv - Math.max(0, gvst)) + Math.max(0, -gvst);
    const prev = i > 0 ? out[i - 1].B : null;
    const neu = g(B, 't19_lang');
    if (neu > 0) {
      const rt = prev ? M.TAB.rt.l.indexOf(prev.t01_rating?.[0]) : -1;
      const z = nz(f.nachrichten?.r_lang) + (rt >= 0 ? M.TAB.rt.y[rt] : 0);
      langZins = (langSum * langZins + neu * z) / (langSum + neu); langSum += neu;
    }
    B.x_periode = [n]; B.x_verlustvortrag = [vv]; if (langSum > 0) B.x_r_lang = [langZins];
    out.push({ ...f, B });
  });
  return out;
}

// Rechenprüfungen innerhalb eines Sammelberichts (Lesefehler fallen hier auf)
export function konsistenz(B) {
  const c = [];
  const chk = (name, a, b, tol = 0.015) => c.push({ name, a, b, ok: Math.abs(a - b) <= tol });
  const has = k => B[k] != null;
  if (has('t15_bsa')) {
    chk('Bilanz: Aktiva = Passiva', g(B, 't15_bsa'), g(B, 't15_bsp'));
    chk('Bilanz: Summe Aktiva', g(B, 't15_grund') + g(B, 't15_masch') + g(B, 't15_mat') + g(B, 't15_fe') + g(B, 't15_ford') + g(B, 't15_wp') + g(B, 't15_kasse'), g(B, 't15_bsa'), 0.03);
    chk('Bilanz: Summe Passiva', g(B, 't15_ek') + g(B, 't15_pens') + g(B, 't15_lang') + g(B, 't15_kurz') + g(B, 't15_ueberz'), g(B, 't15_bsp'), 0.03);
    chk('Eigenkapital', g(B, 't15_gez') + g(B, 't15_kr') + g(B, 't15_gr') + g(B, 't15_vortrag') + g(B, 't15_pue'), g(B, 't15_ek'), 0.03);
  }
  if (has('t11_be')) {
    chk('GuV (GKV) → Betriebsergebnis', g(B, 't11_umsatz') + g(B, 't11_sonst_ertr') + g(B, 't11_bv') - g(B, 't11_mat') - g(B, 't11_pers') - g(B, 't11_afa') - g(B, 't11_sonst'), g(B, 't11_be'), 0.04);
    chk('GuV (UKV) → Betriebsergebnis', g(B, 't11_umsatz') - g(B, 't11u_hkdu') - g(B, 't11u_fe') - g(B, 't11u_vt') - g(B, 't11u_vw'), g(B, 't11_be'), 0.04);
    chk('Gewinn vor Steuern', g(B, 't11_be') + g(B, 't11_finerg'), g(B, 't11_gvst'));
    chk('Periodenüberschuss', g(B, 't11_gvst') - g(B, 't11_steuern'), g(B, 't11_pue'));
    chk('Gewinnvortrag', g(B, 't11_vortrag_vp') - g(B, 't11_div') + g(B, 't11_pue'), g(B, 't11_vortrag'));
  }
  if (has('t12_end')) {
    chk('Liquidität: Anfang + Ein − Aus = Ende', g(B, 't12_anf') + g(B, 't12_ez_sum') - g(B, 't12_az_sum'), g(B, 't12_end'));
    chk('Liquidität: Summe Einzahlungen', ['akt', 'vp', 'wp', 'zins', 'sonst', 'desinv', 'kredit', 'sm', 'ue'].reduce((s, k) => s + g(B, 't12_ez_' + k), 0), g(B, 't12_ez_sum'), 0.05);
    chk('Liquidität: Summe Auszahlungen', ['mat', 'ekvp', 'pers', 'sonst', 'tilg', 'zins', 'anl', 'wp', 'umw', 'div', 'sonst2', 'steuern', 'zins_ue'].reduce((s, k) => s + g(B, 't12_az_' + k), 0), g(B, 't12_az_sum'), 0.07);
    chk('Kasse Liquidität = Bilanz', g(B, 't12_end'), g(B, 't15_kasse'));
  }
  if (has('t05_es_end')) {
    chk('Lager Einsatzstoffe (Menge)', g(B, 't05_es_anf') + g(B, 't05_es_zug') + g(B, 't05_es_nachl') - g(B, 't05_es_abg'), g(B, 't05_es_end'), 0.5);
    chk('Lager Fertigprodukte (Menge)', g(B, 't05_fe_anf') + g(B, 't05_fe_zug') + g(B, 't05_fe_fremd') - g(B, 't05_fe_abg'), g(B, 't05_fe_end'), 0.5);
    chk('Lager Fertigprodukte = Bilanz', g(B, 't05_fe_end', 3), g(B, 't15_fe'));
    chk('Lager Einsatzstoffe = Bilanz', g(B, 't05_es_end', 3), g(B, 't15_mat'));
  }
  if (has('t06_end')) for (let j = 1; j <= 6; j++)
    chk('Personal Spalte ' + j, g(B, 't06_anf', j) + g(B, 't06_einst', j) - g(B, 't06_entl', j) - g(B, 't06_fluk', j), g(B, 't06_end', j), 0.5);
  if (has('t07_sum')) {
    const ks = ['es', 'bs', 'lohn', 'eek', 'sozial', 'pnk', 'pens', 'afa_geb', 'afa_anl', 'afa_umw', 'afa_fe', 'fix', 'ih', 'po', 'umw', 'nach', 'lager', 'werb', 'fe', 'transp'];
    chk('Kostenarten: Summe', ks.reduce((s, k) => s + g(B, 't07_' + k), 0), g(B, 't07_sum'), 0.1);
  }
  let na = 0; for (const t of M.TY) for (let k = 1; k <= 9; k++) if (B['anl_' + t + k]) { na++;
    if (!B['kap_' + t + k]) c.push({ name: `Anlage ${t}${k}: Kapazitätszeile fehlt`, a: 0, b: 1, ok: false }); }
  const anl = Object.keys(B).filter(k => /^anl_[ABC]\d$/.test(k)), kapk = Object.keys(B).filter(k => /^kap_[ABC]\d$/.test(k));
  if (B.anl_sum) chk('Anlagen: Summe Restbuchwerte', anl.reduce((s, k) => s + nz(B[k][4]), 0), g(B, 'anl_sum', 3), 0.03);
  if (B.kap_sum) chk('Anlagen: Summe verfügbare Kapazität', kapk.reduce((s, k) => s + nz(B[k][4]), 0), g(B, 'kap_sum', 3), 1);
  const fehlt = PFLICHT.filter(k => !B[k]);
  if (fehlt.length) c.push({ name: 'Pflichtwerte fehlen: ' + fehlt.join(', '), a: fehlt.length, b: 0, ok: false });
  if (!na) c.push({ name: 'Keine Anlagen gelesen', a: 0, b: 1, ok: false });
  return c;
}

export const PFLICHT = ['t06_end', 't06_anf', 't06_fluk', 't03_umw_kum', 't03_kap_ma', 't03_fehl', 't03_pers', 't01_absatz', 't05_fe_end', 't05_es_end', 't19_werbung', 't19_vertrieb',
  't10s_vmat', 't10s_fmat', 't10s_vfert', 't10s_ffert', 't01_rating', 't15_lang', 't15_kasse', 't15_ford', 't15_wp', 't15_kurz', 't15_ueberz', 't15_masch', 't15_grund',
  't15_mat', 't15_fe', 't15_ek', 't15_gez', 't15_kr', 't15_gr', 't15_pens', 't11_vortrag', 't11_pue', 't07_nach', 't03_fm', 'rat_A', 't04_wa'];

// Backtest: Periode n mit den tatsächlichen Entscheidungen nachrechnen und mit dem Ist vergleichen.
// absatzIst = true: tatsächlicher Absatz vorgegeben (prüft die Rechenlogik). false: Absatz aus dem Nachfragemodell.
export function backtest(P, i, absatzIst = true) {
  const cur = P[i], B = cur.B;
  const start = i === 0 ? M.vorperiode(B) : P[i - 1].B;
  if (i === 0) { start.x_verlustvortrag = [0]; }
  const A = { ...M.kalibriere(i === 0 ? B : P[i - 1].B), rating_an: i === 0 ? 'Nein' : 'Ja' };
  if (absatzIst) A.absatz_manuell = g(B, 't02_tats') || g(B, 't01_absatz');
  const F = M.formAus(B);
  const Q = cur.nachrichten || (i > 0 ? P[i - 1].prognose : {});
  const r = M.modell(start, F, A, Q);
  const zeilen = [
    ['Absatz Markt 1', 'Stück', r.absatz, g(B, 't01_absatz'), 0],
    ['Fertigung', 'Stück', r.fert_ist, g(B, 't03_fm'), 0],
    ['Kapazität Anlagen', 'Stück', r.kap, g(B, 't03_kap_ohne'), 0],
    ['Einsetzbares Personal', 'MA', r.einsetzbar, g(B, 't03_einsetzbar'), 0],
    ['Umsatz', 'MEUR', r.umsatz, g(B, 't11_umsatz'), 2],
    ...[['k_es', 't07_es'], ['k_bs', 't07_bs'], ['k_lohn', 't07_lohn'], ['k_eek', 't07_eek'], ['k_sp', 't07_sozial'], ['k_pnk', 't07_pnk'], ['k_pens', 't07_pens'],
      ['k_afa_anl', 't07_afa_anl'], ['k_afa_umw', 't07_afa_umw'], ['k_fix', 't07_fix'], ['k_ih', 't07_ih'], ['k_po', 't07_po'], ['k_umw', 't07_umw'], ['k_nach', 't07_nach'],
      ['k_lager', 't07_lager'], ['k_werb', 't07_werb'], ['k_fue', 't07_fe'], ['k_transp', 't07_transp']]
      .map(([k, t]) => [M.KOSTEN.find(x => x[0] === k)[1], 'MEUR', r[k], g(B, t), 2]),
    ['Herstellkosten je Stück', 'EUR', r.hk_stk, g(B, 't09s_hk'), 2],
    ['Selbstkosten je Stück', 'EUR', r.sk_stk, g(B, 't09s_sk'), 2],
    ['Betriebsergebnis', 'MEUR', r.be, g(B, 't11_be'), 2],
    ['Zinsen Kredite', 'MEUR', r.zins_kl, g(B, 't11_zins'), 2],
    ['Steuern', 'MEUR', r.steuern, g(B, 't11_steuern'), 2],
    ['Periodenüberschuss', 'MEUR', r.pue, g(B, 't11_pue'), 2],
    ['Kassenendbestand', 'MEUR', r.kasse, g(B, 't15_kasse'), 2],
    ['Überziehungskredit', 'MEUR', r.ueberz, g(B, 't15_ueberz'), 2],
    ['Forderungen', 'MEUR', r.bi_ford, g(B, 't15_ford'), 2],
    ['Lager Einsatzstoffe', 'MEUR', r.es_end_val, g(B, 't15_mat'), 2],
    ['Lager Fertigprodukte', 'MEUR', r.fe_end_val, g(B, 't15_fe'), 2],
    ['Maschinen', 'MEUR', r.bi_masch, g(B, 't15_masch'), 2],
    ['Eigenkapital', 'MEUR', r.bi_ek, g(B, 't15_ek'), 2],
    ['Bilanzsumme', 'MEUR', r.bi_akt, g(B, 't15_bsa'), 2],
    ['Einzahlungen aus Umsatz akt. Periode', 'MEUR', r.ez_akt, g(B, 't12_ez_akt'), 2],
    ['Einzahlungen gesamt', 'MEUR', r.ez_sum, g(B, 't12_ez_sum'), 2],
    ['Auszahlungen Material', 'MEUR', r.az_mat, g(B, 't12_az_mat'), 2],
    ['Auszahlungen Personal', 'MEUR', r.az_pers, g(B, 't12_az_pers'), 2],
    ['Auszahlungen gesamt', 'MEUR', r.az_sum, g(B, 't12_az_sum'), 2],
    ['Traditioneller Cashflow', 'MEUR', r.cf_trad, g(B, 't14_tcf'), 2],
    ['Operativer Cashflow', 'MEUR', r.ocf, g(B, 't14_ocf'), 2],
    ['Free Cashflow', 'MEUR', r.fcf, g(B, 't14_fcf'), 2],
    ['DB I', 'MEUR', r.db1, g(B, 't10_umsatz') - g(B, 't10_vmat') - g(B, 't10_vfert') - g(B, 't10_transp'), 2],
    ['Herstellkosten des Umsatzes', 'MEUR', r.hkdu, g(B, 't11u_hkdu'), 2],
    ['EK-Rendite', '%', r.ekr * 100, g(B, 't01_ekr'), 2],
  ];
  return { r, zeilen, inSample: i === 0 };
}

// Berichtswerte der Periode unter den Schlüsseln des Modellergebnisses (exakt wie im Sammelbericht)
export function istWerte(B) {
  const o = {}, put = (k, t, f = 1) => { const v = g(B, t); if (v != null && !isNaN(v)) o[k] = v * f; };
  [['absatz', 't01_absatz'], ['fert_ist', 't03_fm'], ['kap', 't03_kap_ohne'], ['einsetzbar', 't03_einsetzbar'], ['umsatz', 't11_umsatz'],
    ['k_es', 't07_es'], ['k_bs', 't07_bs'], ['k_lohn', 't07_lohn'], ['k_eek', 't07_eek'], ['k_sp', 't07_sozial'], ['k_pnk', 't07_pnk'], ['k_pens', 't07_pens'],
    ['k_afa_anl', 't07_afa_anl'], ['k_afa_umw', 't07_afa_umw'], ['k_fix', 't07_fix'], ['k_ih', 't07_ih'], ['k_po', 't07_po'], ['k_umw', 't07_umw'], ['k_nach', 't07_nach'],
    ['k_lager', 't07_lager'], ['k_werb', 't07_werb'], ['k_fue', 't07_fe'], ['k_transp', 't07_transp'], ['hk_stk', 't09s_hk'], ['sk_stk', 't09s_sk'], ['be', 't11_be'],
    ['zins_kl', 't11_zins'], ['steuern', 't11_steuern'], ['pue', 't11_pue'], ['kasse', 't15_kasse'], ['ueberz', 't15_ueberz'], ['bi_ford', 't15_ford'], ['es_end_val', 't15_mat'],
    ['fe_end_val', 't15_fe'], ['bi_masch', 't15_masch'], ['bi_ek', 't15_ek'], ['bi_akt', 't15_bsa'], ['ez_akt', 't12_ez_akt'], ['ez_sum', 't12_ez_sum'], ['az_mat', 't12_az_mat'],
    ['az_pers', 't12_az_pers'], ['az_sum', 't12_az_sum'], ['cf_trad', 't14_tcf'], ['ocf', 't14_ocf'], ['fcf', 't14_fcf'], ['hkdu', 't11u_hkdu']].forEach(([k, t]) => put(k, t));
  put('ekr', 't01_ekr', 0.01); put('db1', 't10_umsatz');
  if (o.db1 != null) o.db1 = g(B, 't10_umsatz') - g(B, 't10_vmat') - g(B, 't10_vfert') - g(B, 't10_transp');
  return o;
}

