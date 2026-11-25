import * as M from './modell.js';
const { fz } = M;

const PLAN = 2;                       // Planperiode
const SPEICHER = 'topsim-spielwiese-p' + PLAN;
const $ = id => document.getElementById(id);
const lade = f => fetch('daten/' + f).then(r => r.json());

const [stand, stand0, perioden] = await Promise.all([lade('stand_p1.json'), lade('stand_p0.json'), lade('perioden.json')]);
const N = perioden[PLAN].nachrichten;
const F0 = structuredClone(perioden[PLAN].entscheidung);
const A0 = M.standardAnnahmen(stand, N);
let F = structuredClone(F0), A = structuredClone(A0);
try { const s = JSON.parse(localStorage.getItem(SPEICHER) || 'null'); if (s) { F = { ...F, ...s.F }; A = { ...A, ...s.A }; } } catch (e) { /* kein Speicher */ }
const speichern = () => { try { localStorage.setItem(SPEICHER, JSON.stringify({ F, A })); } catch (e) { /* egal */ } };

let fTab = 'vertrieb', tab = 'guv', res, sz;
const dot = s => `<i class="dot d${s}"></i>`;
const dotE = e => e.s === 'ein' && e.sg === 0 ? '<i class="dot dein"></i>' : dot(e.sg);
const fv = (e, x = e.v) => {
  if (x == null) return '–';
  if (Math.abs(x) < 5e-7) x = 0;
  switch (e.u) {
    case 'MEUR': return fz(x, 2) + ' MEUR';
    case 'EUR': return fz(x, 2) + ' €';
    case '%': return fz(x, 2) + ' %';
    case 'Index': return fz(x, 3);
    case 'Punkte': return fz(x, 2);
    case 'MA': return fz(x, Number.isInteger(x) ? 0 : 1) + ' MA';
    case 'Stück': case 'Einheiten': return fz(x, 0) + ' Stk';
    case 'Stück/MA': return fz(x, 2) + ' Stk/MA';
    default: return fz(x, Math.abs(x) < 10 && !Number.isInteger(x) ? 3 : 0);
  }
};
const sgn = (x, d = 2) => (x > 0 ? '+' : x < 0 ? '−' : '±') + fz(Math.abs(x), d);

// =============================================================================================
// Formular
// =============================================================================================
const FELDER = {
  vertrieb: ['Vertrieb und Produktentwicklung', [
    ['Preis/Werbung', [['preis', 'Preis Markt 1', 'EUR', 10, 'preis'], ['werbung', 'Werbung Markt 1', 'MEUR', 0.5, 'werbung']]],
    ['Vertrieb', [['vertrieb', 'Vertrieb (Anz. Personen)', 'Endbestand', 1, 'vertrieb']]],
    ['Corporate Identity', [['ci', 'Corporate Identity', 'MEUR', 0.5, 'ci']]],
    ['Produktentwicklung', [['tech', 'Mitarbeiterendbestand Technologie', 'Personen', 1], ['oeko', 'Ökologie', 'MEUR', 0.25], ['wa', 'Wertanalyse', 'MEUR', 0.25]]],
    ['Sonstige Märkte – Copy Classic', [['ga', 'Großabnehmer', `Stück (max. ${fz(N.ga_max)} à ${fz(N.ga_preis)} €)`, 500], ['aus_preis', 'Ausschreibung (Gebot)', 'EUR/Stück, Lieferung P3', 10]]],
    ['Marktforschung', [['mafo', 'Marktforschungsbericht', '0,1 MEUR', 'check']]],
  ]],
  fertigung: ['Einkauf und Fertigung', [
    ['Einkauf', [['einkauf', 'Einsatzstoffe/Teile', 'Einheiten', 1000]]],
    ['Fertigung', [['fertigung', 'Fertigungsmenge', 'Stück', 500]]],
    ['Fertigungsanlagen', 'anlagen'],
    ['Desinvestitionen', 'desinv'],
    ['Umweltanlagen und Personal', [['umwelt', 'Investition in Umweltanlagen', 'MEUR', 0.5], ['po', 'Prozessoptimierung', 'MEUR', 0.5],
      ['pers_fe', 'Fertigungspersonal (Einstellungen/Entlassungen)', 'Anzahl, negativ = Entlassung', 10], ['training', 'Training pro Mitarbeiter', 'EUR', 100], ['pnk', 'Personalnebenkosten', '%', 1]]],
  ]],
  finanzen: ['Finanzen und Planwerte', [
    ['Finanzen', [['kurz', 'Kurzfristiger Kredit', 'MEUR', 1], ['lang', 'Langfristiger Kredit', 'MEUR', 1], ['wp', 'Kauf von Wertpapieren', 'MEUR', 1], ['div', 'Dividende absolut', 'MEUR', 0.5]]],
    ['Planwerte', [['plan_absatz', 'Angenommener Absatz Copy Classic Markt 1', 'Stück', 500], ['plan_ekr', 'Geplante Eigenkapitalrendite', '%', 0.5], ['plan_ocf', 'Geplanter Operativer Cashflow', 'MEUR', 0.5]]],
  ]],
  annahmen: ['Annahmen', null],
};
const VP = { preis: stand.vorperiode.preis, werbung: stand.vorperiode.werbung, vertrieb: stand.vorperiode.vertrieb, ci: stand.vorperiode.ci };

function feldHtml([k, l, u, step, vpk]) {
  if (step === 'check') return `<div class="feld"><label>${l} <span class="einh">${u}</span></label><input type="checkbox" data-f="${k}" ${F[k] ? 'checked' : ''}></div>`;
  const anders = +F[k] !== +F0[k];
  return `<div class="feld"><label for="f_${k}">${l}<br><span class="einh">${u}</span></label>
    <input type="number" id="f_${k}" data-f="${k}" step="${step}" value="${F[k]}" class="${anders ? 'geaendert' : ''}" title="TOPSIM-Vorbelegung: ${fz(F0[k], 2)}">
    ${vpk ? `<div class="vp">P1: ${fz(VP[vpk], 2)}${stand.markt[vpk] ? ` · Ø Konkurrenz P1: ${fz(avgK(vpk), 2)}` : ''}</div>` : ''}</div>`;
}
const avgK = k => { const a = stand.markt[k].slice(1); return a.reduce((s, x) => s + x, 0) / a.length; };

function formular() {
  let h = `<div class="ftabs">${Object.entries(FELDER).map(([k, [t]]) => `<button data-ftab="${k}" class="${k === fTab ? 'akt' : ''}">${t}</button>`).join('')}</div><div class="fbody">`;
  if (fTab === 'annahmen') h += annahmenHtml();
  else FELDER[fTab][1].forEach(([titel, felder]) => {
    h += `<div class="fgruppe"><h3>${titel}</h3>`;
    if (felder === 'anlagen') {
      h += `<div class="typen"><span></span><span class="kopf">Typ A</span><span class="kopf">Typ B</span><span class="kopf">Typ C</span>`;
      [['inv', 'Investition (Anz. neue Anlagen)', 1], ['rat', 'Budget Rationalisierung (MEUR)', 0.5], ['ih', 'Instandhaltung pro Anlage (MEUR)', 0.1]].forEach(([g, l, st]) => {
        h += `<span>${l}</span>` + ['A', 'B', 'C'].map(t => `<input type="number" step="${st}" min="0" data-g="${g}" data-t="${t}" value="${F[g][t]}">`).join('');
      });
      h += `</div><div class="klein" style="margin-top:4px">Preise P2: A ${fz(N.anlagen_preis.A)} · B ${fz(N.anlagen_preis.B)} · <b>C ${fz(N.anlagen_preis.C, 1)} MEUR (Sonderangebot nur P2)</b></div>`;
    } else if (felder === 'desinv') {
      h += `<div class="typen" style="grid-template-columns:1fr 60px 90px 60px"><span class="kopf" style="text-align:left">Anlage</span><span class="kopf">RLZ</span><span class="kopf">Restbuchwert</span><span class="kopf">Verkauf?</span>`;
      stand.anlagen.forEach(a => { const id = a.typ + a.nr;
        h += `<span>Typ ${a.typ} Nr. ${a.nr}</span><span style="text-align:center">${a.rlz}</span><span style="text-align:center">${fz(a.rbw, 2)}</span><input type="checkbox" data-desinv="${id}" ${F.desinv.includes(id) ? 'checked' : ''} style="justify-self:center">`; });
      h += `</div>`;
    } else h += felder.map(feldHtml).join('');
    h += `</div>`;
  });
  h += `<div class="knoepfe"><button class="knopf" id="reset">Alles auf TOPSIM-Vorbelegung</button><button class="knopf" id="planueb">Planwerte = Basis-Simulation</button></div>
    <p class="klein">Orange hinterlegt = abweichend von der Vorbelegung im TOPSIM-Formular. Eingaben bleiben in diesem Browser gespeichert.</p></div>`;
  $('formular').innerHTML = h;
}

function annahmenHtml() {
  const gruppen = [
    ['Nachfrage und Konkurrenz', ['absatz_fix', 'wachstum', 'wachstum_pess', 'wachstum_opt', 'konk_preis', 'konk_preis_spanne', 'konk_werbung', 'konk_vertrieb', 'eigenfaktor', 'spillover']],
    ['Personal und Produktivität', ['fluk_fe', 'fehl', 'motiv', 'quali', 'lern', 'fluk_ek', 'fluk_vw', 'fluk_fue', 'fluk_vt']],
    ['Material und Fertigung', ['wa_index', 'nacharbeit']],
  ];
  let h = `<p class="klein" style="margin-top:10px">Hier stehen alle Werte, die nicht im Formular stehen, aber das Ergebnis beeinflussen. Vorschläge kommen aus den Berichten und Wirtschaftsnachrichten. Prozentwerte als Dezimalzahl (0,08 = 8 %).</p>`;
  gruppen.forEach(([t, ks]) => {
    h += `<div class="fgruppe ann"><h3>${t}</h3>`;
    ks.forEach(k => { const [l, u, s, hw] = M.ANNAHMEN[k]; const anders = String(A[k]) !== String(A0[k]);
      h += `<div class="feld"><i class="dot ${s === 'ein' ? 'dein' : 'd' + M.STUFE[s]}"></i><label for="a_${k}">${l} <span class="einh">${u}</span></label>
        <input type="number" step="any" id="a_${k}" data-a="${k}" value="${A[k] === '' ? '' : +(+A[k]).toFixed(5)}" class="${anders ? 'geaendert' : ''}" placeholder="Modell">
        <div class="hinw">${hw}${A0[k] !== '' ? ` · Vorschlag: ${+(+A0[k]).toFixed(4)}` : ''}</div></div>`; });
    h += `</div>`;
  });
  h += `<div class="knoepfe"><button class="knopf" id="areset">Annahmen auf Vorschlag</button></div>`;
  return h;
}

$('formular').addEventListener('input', ev => {
  const el = ev.target;
  if (el.dataset.f) { F[el.dataset.f] = el.type === 'checkbox' ? el.checked : (el.value === '' ? 0 : +el.value); el.classList.toggle('geaendert', el.type !== 'checkbox' && +F[el.dataset.f] !== +F0[el.dataset.f]); }
  else if (el.dataset.g) F[el.dataset.g][el.dataset.t] = el.value === '' ? 0 : +el.value;
  else if (el.dataset.desinv) { const id = el.dataset.desinv; F.desinv = F.desinv.filter(x => x !== id); if (el.checked) F.desinv.push(id); }
  else if (el.dataset.a) { const k = el.dataset.a; A[k] = el.value === '' ? (k === 'absatz_fix' ? '' : A0[k]) : +el.value; el.classList.toggle('geaendert', String(A[k]) !== String(A0[k])); }
  else return;
  speichern(); rechnen();
});
$('formular').addEventListener('click', ev => {
  const t = ev.target;
  if (t.dataset.ftab) { fTab = t.dataset.ftab; formular(); }
  else if (t.id === 'reset') { if (confirm('Alle Eingaben auf die TOPSIM-Vorbelegung zurücksetzen?')) { F = structuredClone(F0); speichern(); formular(); rechnen(); } }
  else if (t.id === 'areset') { A = structuredClone(A0); speichern(); formular(); rechnen(); }
  else if (t.id === 'planueb') { planUebernehmen(); }
});
function planUebernehmen() {
  const b = sz.basis;
  F.plan_absatz = Math.round((b.v('absatz') + b.v('ga_lief')) / 100) * 100; F.plan_ekr = +b.v('ekr').toFixed(2); F.plan_ocf = +b.v('ocf').toFixed(2);
  speichern(); formular(); rechnen();
}

// =============================================================================================
// Rechnen und Anzeigen
// =============================================================================================
function rechnen() {
  sz = M.szenarien(stand, N, F, A); res = sz.basis;
  kacheln(); hinweise(); tabs();
}

function kacheln() {
  const K = [
    ['absatz', 'Absatz Markt 1'], ['umsatz', 'Umsatz'], ['be', 'Betriebsergebnis'], ['pue', 'Periodenüberschuss'], ['kasse', 'Kasse Ende P2'],
    ['ekr', 'EK-Rendite'], ['ocf', 'Operativer Cashflow'], ['ausl_anl', 'Auslastung Anlagen'], ['ausl_pers', 'Auslastung Personal'], ['pq', 'Planungsqualität'],
  ];
  $('kacheln').innerHTML = K.map(([k, l]) => {
    const e = res.E[k], p = sz.pess.v(k), o = sz.opt.v(k);
    const spanne = Math.abs(o - p) > 1e-6 ? `pess. ${fv(e, p)} · opt. ${fv(e, o)}` : 'in allen Szenarien gleich';
    let cls = '';
    if (k === 'ausl_pers' || k === 'ausl_anl') cls = e.v > 100.0001 ? 'warn' : e.v >= 95 ? 'ok' : 'mittel';
    if (k === 'kasse') cls = res.v('ueberz') > 0 ? 'warn' : '';
    if (k === 'pue') cls = e.v < 0 ? 'warn' : '';
    return `<div class="kachel ${cls}" data-rw="${k}"><div class="l">${dotE(e)}${l}</div><div class="w">${fv(e)}</div><div class="s">${spanne}</div></div>`;
  }).join('');
}

function hinweise() {
  const H = [], v = res.v, add = (c, t) => H.push([c, t]);
  const verfM1 = v('verfuegbar') - v('ga_lief');
  if (v('fert') < +F.fertigung) add('rot', `Fertigung ${fz(F.fertigung)} geht nicht: Maximum mit Überstunden ${fz(v('fert'))} Stück. Mehr Personal oder Anlagen nötig.`);
  if (v('k_schicht') > 0) add('rot', `Auslastung über 100 % → Zusatzschicht 2,50 MEUR, mehr Nacharbeit, Überstundenzuschlag. Anlagen ${fz(v('ausl_anl'), 1)} %, Personal ${fz(v('ausl_pers'), 1)} %.`);
  if (v('ueberz') > 0) add('rot', `Kasse reicht nicht: automatischer Überziehungskredit ${M.fm(v('ueberz'))} zu ${fz(v('zins_ueberz'), 1)} %. Ein kurzfristiger Kredit kostet nur ${fz(v('zins_kurz'), 1)} %.`);
  if (sz.pess.v('ungedeckt') > 0) add('gelb', `Nachfrage übersteigt das Angebot schon im pessimistischen Fall (${fz(sz.pess.v('nachfrage'))} vs. ${fz(verfM1)} Stück; Basis ${fz(v('nachfrage'))}). Ungedeckte Nachfrage geht zu 80 % an die Konkurrenz und kann die Kundenzufriedenheit senken. Optionen: Preis erhöhen (Basis-Nachfrage = Angebot bei ca. ${fz(M.preisFuerMenge(stand, N, F, A, verfM1))} €), Fertigung/Kapazität ausbauen.`);
  else if (v('ungedeckt') > 0) add('gelb', `Im Basis-Szenario bleiben ${fz(v('ungedeckt'))} Stück Nachfrage ungedeckt.`);
  if (sz.opt.v('fe_lager_end') > 0 && v('fe_lager_end') > 0) add('gelb', `Lagerendbestand ${fz(v('fe_lager_end'))} Fertiggeräte (100 €/Stück Lagerkosten, Altgeräte senken die Kundenzufriedenheit).`);
  if (v('es_nachl') > 0) add('gelb', `${fz(v('es_nachl'))} Einheiten Einsatzstoffe werden automatisch nachgeliefert (${fz(N.es_preise[0] * 1.2)} € statt ${fz(v('es_preis'))} €). Besser mehr bestellen.`);
  const naechst = [30000, 50000, 70000].find(s => s > +F.einkauf);
  if (naechst && v('es_bedarf') + 3000 > naechst) add('info', `Einkauf: Ab ${fz(naechst)} Einheiten gilt die nächste Preisstaffel. Der Bedarf liegt bei ${fz(v('es_bedarf'))}; Restbestand fließt in die nächste Periode.`);
  if (v('es_end') > 15000) add('gelb', `Hoher Endbestand Einsatzstoffe: ${fz(v('es_end'))} Einheiten (${fz(v('es_end') * 50 / 1e6, 2)} MEUR Lagerkosten, Kapitalbindung ${M.fm(v('es_end_wert'))}).`);
  if (v('ausl_pers') < 92) add('gelb', `Personalauslastung nur ${fz(v('ausl_pers'), 1)} % (Handbuch: ca. 98 % gilt als motivationsförderlich).`);
  if (v('kasse') > 10 && v('ueberz') === 0) add('info', `Kasse Ende P2 ${M.fm(v('kasse'))}: Liquidität wird nicht gebraucht. Optionen: Wertpapiere (Zins ${fz(N.zins_wp * 100, 1)} %, Schätzung), Dividende (max. ${M.fm(stand.bilanz.gewinnvortrag[0])}), Investitionen.`);
  if (+F.kurz > 0 && sz.pess.v('kasse') - +F.kurz > 1) add('info', `Der kurzfristige Kredit (${M.fm(+F.kurz)}) wäre laut Rechnung auch im pessimistischen Fall nicht nötig und kostet ${M.fm(res.v('zinsen'))} Zinsen.`);
  if (v('umw_ind') < 100) add('info', `Umweltindikator ${fz(v('umw_ind'), 2)} → Abgabe ${M.fm(v('k_umw'))}. Neue Anlagen (B 105, C 110) oder Verkauf der alten A1 (83) heben den Anlagenschnitt.`);
  const pa = Math.abs((v('absatz') + v('ga_lief')) / (+F.plan_absatz || 1) - 1), pe = Math.abs(v('ekr') - +F.plan_ekr), po = Math.abs(v('ocf') - +F.plan_ocf);
  if (pa > 0.02 || pe > 1 || po > 1) add('gelb', `Planwerte weichen von der Basis-Simulation ab (Absatz ${fz(+F.plan_absatz)} vs. ${fz(v('absatz') + v('ga_lief'))}, EKR ${fz(+F.plan_ekr, 1)} vs. ${fz(v('ekr'), 1)} %, OCF ${fz(+F.plan_ocf, 1)} vs. ${fz(v('ocf'), 1)} MEUR). Erwartete Planungsqualität ${fz(v('pq'), 1)} Punkte. Knopf „Planwerte = Basis-Simulation“ links.`);
  if (+F.aus_preis > 0) add('info', `Ausschreibung: Gebot ${fz(+F.aus_preis)} € wirkt erst in P3 (Lieferung 3.000 Stück und Zahlung). Siehe Reiter „Ausschreibung P3“.`);
  if (+F.tech < 35) add('gelb', 'Weniger F&E-Personal: Technologieindex kann sinken. Wir liegen schon jetzt mit 102,45 hinter U3–U6 (102,80). Wirkung auf die Nachfrage ist im Modell nicht enthalten.');
  if (+F.preis > stand.vorperiode.preis) add('info', `Preiserhöhung um ${fz(+F.preis - stand.vorperiode.preis)} €: Laut Handbuch bevorzugen Kunden konstante Preise (Kundenzufriedenheit). Das Modell rechnet nur die Preiselastizität.`);
  if (!H.length) add('gruen', 'Keine Auffälligkeiten.');
  const ic = { rot: '⛔', gelb: '⚠️', info: 'ℹ️', gruen: '✓' };
  $('hinweise').innerHTML = H.map(([c, t]) => `<li class="${c}"><span>${ic[c]}</span><span>${t}</span></li>`).join('');
}

// =============================================================================================
// Reiter
// =============================================================================================
const TABS = [['guv', 'GuV'], ['liq', 'Liquidität'], ['bilanz', 'Bilanz'], ['kosten', 'Kosten'], ['kap', 'Kapazität & Personal'], ['nachfrage', 'Nachfrage'],
  ['wirkung', 'Wirkung je Entscheidung'], ['plan', 'Planwerte'], ['aus', 'Ausschreibung P3'], ['backtest', 'Backtest P1'], ['news', 'Wirtschaftsnachrichten']];
function tabs() {
  $('tabs').innerHTML = TABS.map(([k, l]) => `<button data-tab="${k}" class="${k === tab ? 'akt' : ''}">${l}</button>`).join('');
  $('tabinhalt').innerHTML = ({ guv, liq, bilanz, kosten, kap, nachfrage: nachfrageTab, wirkung, plan, aus, backtest, news })[tab]();
}
$('tabs').addEventListener('click', ev => { if (ev.target.dataset.tab) { tab = ev.target.dataset.tab; tabs(); } });

// Tabelle mit klickbaren Zeilen; Spalten pess / Basis / opt
function tabelle(zeilen, opt = {}) {
  const sc = opt.szen !== false;
  let h = `<table><tr><th>${opt.titel || 'Position'}</th>${sc ? '<th>pessimistisch</th><th>Basis</th><th>optimistisch</th>' : '<th>Wert</th>'}${opt.vp ? '<th>Ist P1</th>' : ''}</tr>`;
  zeilen.forEach(z => {
    if (typeof z === 'string') { h += `<tr class="zwischen"><td colspan="${(sc ? 4 : 2) + (opt.vp ? 1 : 0)}">${z}</td></tr>`; return; }
    const [k, l, cls, vz] = z, e = res.E[k]; if (!e) return;
    const w = x => fv(e, vz ? -x : x);
    h += `<tr class="klick ${cls || ''}" data-rw="${k}"><td>${dotE(e)}${l || e.t}</td>${sc ? `<td>${w(sz.pess.v(k))}</td><td><b>${w(e.v)}</b></td><td>${w(sz.opt.v(k))}</td>` : `<td>${w(e.v)}</td>`}${opt.vp ? `<td class="klein">${opt.vp[k] != null ? fv(e, opt.vp[k]) : ''}</td>` : ''}</tr>`;
  });
  return h + '</table>';
}
const IST1 = perioden[1].ist;
const vp1 = { umsatz: IST1.umsatz, bestv: IST1.bestv, g_mat: IST1.k_es + IST1.k_bs, g_pers: 59.50, g_afa: 7.30, g_sonst: 25.76, be: IST1.be, zinsen: IST1.zinsen, gvst: IST1.gvst, steuern: IST1.steuern, pue: IST1.pue, ekr: IST1.ekr, ocf: IST1.ocf,
  kasse: IST1.kasse, ez_sum: IST1.ez_sum, az_sum: IST1.az_sum, az_pers: IST1.az_pers, az_mat: IST1.az_mat, bi_ford: IST1.ford, es_end_wert: IST1.es_wert, fe_end_wert: 0, bi_masch: IST1.maschinen, bi_ek: IST1.ek, bi_aktiva: IST1.bilanzsumme, bi_grund: 7.5,
  absatz: IST1.absatz, umsatz_m1: IST1.umsatz, fert: IST1.fertigung, hk_stk: IST1.hk_stk };
['k_es', 'k_bs', 'k_lohn', 'k_eek', 'k_pnk', 'k_pens', 'k_afa_geb', 'k_afa_anl', 'k_afa_umw', 'k_fix', 'k_ih', 'k_po', 'k_umw', 'k_nach', 'k_lager', 'k_werb', 'k_fue', 'k_transp', 'k_schicht'].forEach(k => { vp1[k] = IST1[k]; });
vp1.k_sozial = 0;

function guv() {
  return `<p class="klein">Gesamtkostenverfahren wie TNB11. Jede Zeile anklicken für den Rechenweg. Spalten: Nachfrage-Szenarien (die Kosten ändern sich nur, wenn sich der Absatz ändert).</p>` + tabelle([
    ['absatz', 'Absatz Markt 1 (Stück)'], ['ga_lief', 'Lieferung Großabnehmer (Stück)'], 'Erträge',
    ['umsatz_m1'], ['umsatz_ga'], ['umsatz', 'Umsatzerlöse', 'summe'], ['bestv'], 'Aufwand',
    ['g_mat'], ['g_pers'], ['g_afa'], ['g_sonst'], ['be', 'Betriebsergebnis', 'summe'],
    ['wp_ertrag'], ['zinsen', 'Zinsen Kredite'], ['zins_ue', 'Zinsen Überziehung'], ['gvst', 'Gewinn vor Steuern', 'summe'], ['steuern', 'Steuern'], ['pue', 'Periodenüberschuss', 'summe'],
    'Kennzahlen', ['ekr'], ['ur'], ['hk_stk'], ['sk_stk'],
  ], { vp: vp1 });
}
function liq() {
  return `<p class="klein">Liquiditätsrechnung wie TNB12. Der kurzfristige Kredit aus P1 (27 MEUR) wird in P2 automatisch zurückgezahlt.</p>` + tabelle([
    'Einzahlungen', ['ez_akt'], ['ez_vp'], ['wp_ertrag'], ['ez_desinv'], ['ez_kredit'], ['ueberz'], ['ez_sum', 'Summe Einzahlungen', 'summe'],
    'Auszahlungen', ['az_mat'], ['az_pers'], ['az_sonst'], ['az_tilg'], ['zinsen'], ['az_inv'], ['F_wp', 'Kauf Wertpapiere'], ['az_div'], ['steuern'], ['zins_ue'], ['az_sum', 'Summe Auszahlungen', 'summe'],
    ['kasse', 'Kassenendbestand', 'summe'],
  ], { vp: vp1 }) + `<p class="klein">Kassenanfangsbestand: ${M.fm(stand.bilanz.kasse[0])} (TNB15 P1).</p>`;
}
function bilanz() {
  return `<div class="zwei"><div><h2>Aktiva</h2>${tabelle([['bi_grund'], ['bi_masch'], ['es_end_wert'], ['fe_end_wert'], ['bi_ford'], ['F_wp', 'Wertpapiere'], ['kasse'], ['bi_aktiva', 'Bilanzsumme', 'summe']], { vp: vp1 })}</div>
    <div><h2>Passiva und Kennzahlen</h2>${tabelle([['bi_ek', 'Eigenkapital'], ['bi_fk', 'Fremdkapital inkl. Pensionen'], ['ekq'], ['ocf'], ['bi_diff']])}</div></div>`;
}
function kosten() {
  return `<p class="klein">Kostenarten wie TNB07. Rechte Spalte: Ist P1 zum Vergleich.</p>` + tabelle([
    'Material', ['k_es'], ['k_bs'], 'Personal', ['k_lohn'], ['k_eek'], ['k_sozial'], ['k_pnk'], ['k_pens'], 'Abschreibungen', ['k_afa_geb'], ['k_afa_anl'], ['k_afa_umw'],
    'Sonstige', ['k_fix'], ['k_ih'], ['k_po'], ['k_umw'], ['k_nach'], ['k_lager'], ['k_werb'], ['k_fue'], ['k_transp'], ['k_schicht'],
    'Je Stück', ['hk', 'Herstellkosten gesamt'], ['hk_stk'], ['sk_stk'],
  ], { vp: vp1 });
}
function kap() {
  const v = res.v, max = Math.max(sz.opt.v('nachfrage'), v('kap_anl_ue'), v('kap_pers_ue'), +F.fertigung) * 1.05;
  const bar = (l, a, b, farbe, txt, k) => `<div class="zeile"${k ? ` data-rw="${k}" style="cursor:pointer"` : ''}><span>${l}</span><div class="spur"><div class="b" style="left:${a / max * 100}%;width:${Math.max(0.4, (b - a) / max * 100)}%;background:${farbe}"></div></div><span class="wert">${txt}</span></div>`;
  let h = `<h2>Engpass: Nachfrage gegen Kapazität</h2><div class="balken">
    ${bar('Nachfrage (pess.–opt.)', sz.pess.v('nachfrage'), sz.opt.v('nachfrage'), '#e3a3a0', `${fz(sz.pess.v('nachfrage') / 1000, 1)}–${fz(sz.opt.v('nachfrage') / 1000, 1)} T`, 'nachfrage_modell')}
    ${bar('Nachfrage Basis', 0, v('nachfrage'), '#c8382e', fz(v('nachfrage')), 'nachfrage_modell')}
    ${bar('Anlagen (mit Überstunden)', 0, v('kap_anl_ue'), '#b9d3ea', fz(v('kap_anl_ue')), 'kap_anl_ue')}
    ${bar('Anlagen (normal)', 0, v('kap_anl'), '#0b5fa5', fz(v('kap_anl')), 'kap_anl')}
    ${bar('Personal (mit Überstunden)', 0, v('kap_pers_ue'), '#c9e3d3', fz(v('kap_pers_ue')), 'kap_pers_ue')}
    ${bar('Personal (normal)', 0, v('kap_pers'), '#2e8b57', fz(v('kap_pers')), 'kap_pers')}
    ${bar('Fertigung geplant', 0, +F.fertigung, '#e08a00', fz(+F.fertigung), 'fert')}
    ${bar('Verfügbar für Markt 1', 0, v('verfuegbar') - v('ga_lief'), '#6b7684', fz(v('verfuegbar') - v('ga_lief')), 'absatz')}
  </div>`;
  const brauch = m => Math.ceil(m / (res.v('produktivitaet') * (1 - A.fehl)));
  h += `<div class="hinweisbox">Für 100 % Personalauslastung bei ${fz(+F.fertigung)} Stück braucht ihr rechnerisch ${fz(brauch(+F.fertigung))} Fertigungsmitarbeiter am Periodenende (bei ${fz(res.v('produktivitaet'), 2)} Stück/MA und ${fz(A.fehl * 100, 1)} % Fehlzeiten). Aktuell geplant: ${fz(v('fe_end'))}.
    Für 98 % (motivationsförderlich laut Handbuch): ${fz(brauch(+F.fertigung / 0.98))} MA.</div>`;
  h += `<div class="zwei"><div><h2>Fertigungspersonal</h2>${tabelle([['fe_anf'], ['F_pers_fe', 'Einstellungen/Entlassungen'], ['fe_fluk'], ['fe_end'], ['fe_fehl'], ['fe_einsetzbar'], ['fe_neuquote'], ['idx_einarb'], ['idx_po'], ['A_motiv', 'Motivationsindex'], ['produktivitaet'], ['kap_pers'], ['ausl_pers'], ['fe_ot']], { szen: false })}</div>
    <div><h2>Anlagen</h2>${tabelle(res.anlagen.filter(a => !a.weg).map(a => ['anl_' + a.typ + a.nr]).concat([['kap_anl'], ['ausl_anl'], ['k_schicht'], ['umw_anl'], ['umw_verb'], ['umw_ind'], ['k_umw']]), { szen: false })}
    ${res.anlagen.some(a => a.weg) ? `<p class="klein">Verkauft: ${res.anlagen.filter(a => a.weg).map(a => `${a.typ}${a.nr} (Resterlös ${M.fm(a.resterloes)})`).join(', ')}</p>` : ''}</div></div>`;
  h += `<h2 style="margin-top:14px">Personal aller Abteilungen</h2><table><tr><th>Abteilung</th><th>Anfang</th><th>Fluktuation</th><th>Einst.</th><th>Entl.</th><th>Ende</th><th>Gehalt</th><th>Personalkosten</th></tr>
    ${[['ek', 'Einkauf'], ['vw', 'Verwaltung'], ['fe', 'Fertigung'], ['fue', 'F&E'], ['vt', 'Vertrieb']].map(([j, nm]) => { const p = res.PZ[j];
      return `<tr class="klick" data-rw="p_${j}_end"><td>${dotE(res.E['p_' + j + '_end'])}${nm}</td><td>${fz(p.anf)}</td><td>${fz(p.fl)}</td><td>${fz(p.einst)}</td><td>${fz(p.entl)}</td><td><b>${fz(p.ziel)}</b></td><td>${fz(p.geh)} €</td><td>${fz(p.sum, 2)}</td></tr>`; }).join('')}</table>`;
  return h;
}

function nachfrageTab() {
  const ms = res.ms, mk = stand.markt, nb = res.nb;
  if (!ms) return '<p>Keine Marktdaten.</p>';
  let h = `<div class="warnbox"><b>Hier ist die größte Unsicherheit.</b> Die Nachfrage hängt davon ab, was die Konkurrenz in P2 macht, und das kann niemand vorhersagen. Das Modell ist eine begründete Schätzung, keine Spielregel.</div>
  <h2>1. Wie das Modell entsteht</h2>
  <p>Der Marktforschungsbericht P1 (TNB02) zeigt für alle 6 Unternehmen Preis, Werbung, Vertrieb und den <i>potentiellen</i> Absatz (Nachfrage ohne Lieferengpässe). Daraus wird per Regression geschätzt, wie stark Preis, Werbung und Vertrieb die Nachfrage verschieben:</p>
  <div class="formel">ln(Nachfrage) = ${fz(ms.c, 3)} ${ms.e < 0 ? '−' : '+'} ${fz(Math.abs(ms.e), 2)} × ln(Preis / Ø-Preis) + ${fz(ms.w, 4)} × (Werbung − Ø) + ${fz(ms.v, 5)} × (Vertrieb − Ø)</div>
  <ul>
    <li><b>Preis:</b> 1 % teurer als der Marktdurchschnitt ≈ ${fz(-ms.e, 1)} % weniger Nachfrage. Das ist deutlich stärker als „reaktionsarm“ klingt.</li>
    <li><b>Werbung:</b> +1 MEUR über dem Schnitt ≈ +${fz(ms.w_stk)} Stück (Handbuch: ca. +2.000).</li>
    <li><b>Vertrieb:</b> +1 Mitarbeiter über dem Schnitt ≈ +${fz(ms.v_stk)} Stück (Handbuch: ca. +200).</li>
  </ul>
  <p class="klein">Dass Werbung und Vertrieb fast genau die Handbuchwerte treffen, spricht dafür, dass die Schätzung brauchbar ist. Aber: nur 6 Datenpunkte, und Technologie, Ökologie, Bekanntheit und Kundenzufriedenheit stecken nur indirekt drin (im „Eigenfaktor“).</p>
  <table><tr><th>Unternehmen</th><th>Preis</th><th>Werbung</th><th>Vertrieb</th><th>Technologie</th><th>potentieller Absatz</th><th>Modell</th><th>Abweichung</th><th>tatsächlich</th></tr>
  ${mk.firmen.map((u, i) => `<tr${i === 0 ? ' style="font-weight:600"' : ''}><td>${u}</td><td>${fz(mk.preis[i])}</td><td>${fz(mk.werbung[i], 1)}</td><td>${fz(mk.vertrieb[i])}</td><td>${fz(mk.technologie[i], 2)}</td><td>${fz(mk.potentiell[i])}</td><td>${fz(ms.fit[i])}</td><td>${sgn(ms.rest[i] * 100, 1)} %</td><td>${fz(mk.tatsaechlich[i])}</td></tr>`).join('')}
  <tr class="summe"><td>Markt</td><td>${fz(ms.pq)}</td><td>${fz(ms.wq, 2)}</td><td>${fz(ms.vq, 1)}</td><td></td><td>${fz(ms.summe)}</td><td></td><td></td><td>${fz(mk.tatsaechlich.reduce((s, x) => s + x, 0))}</td></tr></table>
  <p class="klein">U1 hat in P1 ${fz(mk.tatsaechlich[0])} verkauft, obwohl die eigene Nachfrage nur ${fz(mk.potentiell[0])} war: Die ${fz(mk.tatsaechlich[0] - mk.potentiell[0])} Stück kamen von U2/U3, die nicht liefern konnten. Darauf kann man nicht planen (Annahme „Spillover“ = 0).</p>
  <h2>2. Rechnung für P2</h2>
  ${tabelle([['A_wachstum', 'Marktwachstum (Wirtschaftsnachrichten 6–10 %)'], ['A_konk_preis', 'Ø-Preis Konkurrenz P2 (Annahme)'], ['M_konkpreis'], ['F_preis', 'Unser Preis'], ['F_werbung', 'Unsere Werbung'], ['A_konk_werbung'], ['F_vertrieb', 'Unser Vertrieb'], ['A_konk_vertrieb'], ['A_eigenfaktor'], ['nachfrage_modell'], ['nachfrage_pess'], ['nachfrage_opt'], ['absatz'], ['ungedeckt']], { szen: false })}
  <h2 style="margin-top:14px">3. Preis gegen Nachfrage (Basis, alles andere wie eingegeben)</h2>`;
  const preise = []; for (let p = 2900; p <= 3400; p += 50) preise.push(p);
  const verfM1 = res.v('verfuegbar') - res.v('ga_lief');
  h += `<table><tr><th>Preis</th><th>Nachfrage pess.</th><th>Basis</th><th>opt.</th><th>Absatz Basis</th><th>Umsatz Markt 1</th><th>PÜ (Basis)</th></tr>` + preise.map(p => {
    const F2 = { ...F, preis: p }, r2 = M.rechne(stand, N, F2, A), d = s => M.nachfrage(stand, A, F2, res.ms, s).N;
    return `<tr${p === +F.preis ? ' style="font-weight:600;background:#fff6e0"' : ''}><td>${fz(p)} €</td><td>${fz(d('pess'))}</td><td>${fz(d('basis'))}</td><td>${fz(d('opt'))}</td><td>${fz(r2.v('absatz'))}</td><td>${fz(r2.v('umsatz_m1'), 2)}</td><td>${fz(r2.v('pue'), 2)}</td></tr>`;
  }).join('') + `</table><p class="klein">Verfügbar für Markt 1 bei eurer Fertigung: ${fz(verfM1)} Stück. Basis-Nachfrage = Angebot bei ca. ${fz(M.preisFuerMenge(stand, N, F, A, verfM1))} €. Nicht eingerechnet: Preiserhöhungen senken die Kundenzufriedenheit (Handbuch S. 15), Preissprünge über ±5 % zum Markt verlassen den reaktionsarmen Bereich.</p>`;
  return h;
}

function wirkung() {
  const v0 = res;
  const T = [
    ['Preis +50 €', { preis: +F.preis + 50 }, 'Kundenzufriedenheit sinkt bei Preiserhöhungen (nicht gerechnet).'],
    ['Preis −50 €', { preis: +F.preis - 50 }, 'Lohnt nur, wenn die Menge auch gefertigt werden kann.'],
    ['Werbung +1 MEUR', { werbung: +F.werbung + 1 }, 'Wirkt laut Handbuch auch in Folgeperioden nach (nicht gerechnet).'],
    ['Vertrieb +10 MA', { vertrieb: +F.vertrieb + 10 }, ''],
    ['Corporate Identity +1 MEUR', { ci: +F.ci + 1 }, 'Nur Kosten gerechnet. Wirkung auf Bekanntheit/Absatz ist langfristig und nicht bezifferbar (Handbuch empfiehlt ca. 3 MEUR).'],
    ['F&E-Technologie +5 MA', { tech: +F.tech + 5 }, 'Nur Kosten gerechnet. Höherer Technologieindex verbessert den Marktanteil, erhöht aber Nacharbeit.'],
    ['Fertigung +1.000 Stück', { fertigung: +F.fertigung + 1000 }, ''],
    ['Fertigungspersonal +20', { pers_fe: +F.pers_fe + 20 }, 'Viele Neueinstellungen senken Einarbeitungs- und Motivationsindex.'],
    ['Einkauf +10.000 Einheiten', { einkauf: +F.einkauf + 10000 }, 'Rest bleibt auf Lager (50 €/Einheit, bindet Kapital), wird in P3 verbraucht.'],
    ['Anlage C kaufen (Sonderpreis)', { inv: { ...F.inv, C: (+F.inv.C || 0) + 1 }, ih: { ...F.ih, C: F.ih.C || F.ih.A } }, 'Kapazität nützt nur mit genug Personal. Läuft 15 Perioden. Instandhaltung wie Typ A angesetzt.'],
    ['Anlage A1 verkaufen', { desinv: [...new Set([...F.desinv, 'A1'])] }, 'Spart Fixkosten und Instandhaltung, erhöht den Umweltschnitt, kostet 7.760 Kapazität.'],
    ['Großabnehmer +1.000 Stück', { ga: Math.min(N.ga_max, +F.ga + 1000) }, 'Hat Vorrang vor Markt 1. Lohnt nur, wenn die Geräte sonst nicht verkauft würden.'],
    ['Umweltanlagen +1 MEUR', { umwelt: +F.umwelt + 1 }, 'Senkt die Umweltabgabe, wirkt positiv auf Kundenzufriedenheit und Fehlzeiten (nicht gerechnet).'],
    ['Prozessoptimierung +1 MEUR', { po: +F.po + 1 }, 'Wirkung geschätzt (Handbuch: 2,5 MEUR ≈ +4 %). Erhöht laut Handbuch die Fehlzeiten.'],
    ['Training +200 €/MA', { training: +F.training + 200 }, 'Nur Kosten gerechnet. Wirkung auf Produktivität/Fehlzeiten nicht bekannt.'],
    ['Personalnebenkosten +2 %-Punkte', { pnk: +F.pnk + 2 }, 'Nur Kosten gerechnet. Senkt Fluktuation, Fehlzeiten und Nacharbeit (nicht beziffert).'],
    ['Kurzfristiger Kredit +5 MEUR', { kurz: +F.kurz + 5 }, ''],
    ['Wertpapiere +5 MEUR', { wp: +F.wp + 5 }, 'Zinssatz geschätzt.'],
    ['Paket: Anlage C + 150 MA + Fertigung 46.000 + Einkauf 50.000', { inv: { ...F.inv, C: (+F.inv.C || 0) + 1 }, ih: { ...F.ih, C: F.ih.C || F.ih.A }, pers_fe: +F.pers_fe + 150, fertigung: 46000, einkauf: 50000 }, 'Beispiel für Kapazitätsausbau. Viele Neueinstellungen senken die Produktivität (Einarbeitung); Motivation durch schnelles Wachstum nicht gerechnet.'],
  ];
  let h = `<p class="klein">Jede Zeile ändert genau eine Eingabe gegenüber eurem aktuellen Formular und zeigt die Veränderung im Basis-Szenario. Rechts steht, was das Modell dabei <b>nicht</b> berücksichtigt.</p>
  <table><tr><th>Änderung</th><th>Δ Absatz</th><th>Δ Umsatz</th><th>Δ Betriebsergebnis</th><th>Δ PÜ</th><th>Δ Kasse</th><th>Ausl. Anlagen</th><th>Ausl. Personal</th><th style="text-align:left">nicht im Modell</th></tr>`;
  T.forEach(([l, d, nicht]) => {
    const r2 = M.rechne(stand, N, { ...F, ...d }, A), D = k => r2.v(k) - v0.v(k), c = x => x > 0.005 ? 'pos' : x < -0.005 ? 'neg' : '';
    h += `<tr><td>${l}</td><td class="${c(D('absatz'))}">${sgn(D('absatz'), 0)}</td><td class="${c(D('umsatz'))}">${sgn(D('umsatz'))}</td><td class="${c(D('be'))}">${sgn(D('be'))}</td><td class="${c(D('pue'))}"><b>${sgn(D('pue'))}</b></td><td class="${c(D('kasse'))}">${sgn(D('kasse'))}</td><td>${fz(r2.v('ausl_anl'), 1)} %</td><td>${fz(r2.v('ausl_pers'), 1)} %</td><td class="klein" style="text-align:left">${nicht}</td></tr>`;
  });
  return h + '</table>';
}

function plan() {
  const b = sz.basis, rows = [['Absatz (Markt 1 + Großabnehmer)', 'absatz', b.v('absatz') + b.v('ga_lief'), sz.pess.v('absatz') + sz.pess.v('ga_lief'), sz.opt.v('absatz') + sz.opt.v('ga_lief'), +F.plan_absatz, 0],
    ['Eigenkapitalrendite (%)', 'ekr', b.v('ekr'), sz.pess.v('ekr'), sz.opt.v('ekr'), +F.plan_ekr, 2], ['Operativer Cashflow (MEUR)', 'ocf', b.v('ocf'), sz.pess.v('ocf'), sz.opt.v('ocf'), +F.plan_ocf, 2]];
  return `<p>Die Planwerte gehen in die <b>Planungsqualität</b> (TNB17) ein: 50 % Absatz, 25 % EK-Rendite, 25 % operativer Cashflow. Sie beeinflusst Rating und Aktienkurs. Am besten trägt man die Werte der Basis-Simulation ein.</p>
  <table><tr><th>Planwert</th><th>pessimistisch</th><th>Basis</th><th>optimistisch</th><th>euer Planwert</th></tr>
  ${rows.map(([l, k, bv, pv, ov, ein, d]) => `<tr class="klick" data-rw="${k}"><td>${l}</td><td>${fz(pv, d)}</td><td><b>${fz(bv, d)}</b></td><td>${fz(ov, d)}</td><td>${fz(ein, d)}</td></tr>`).join('')}</table>
  <p>Erwartete Planungsqualität mit euren Planwerten: <b>${fz(b.v('pq'), 1)} Punkte</b> (P1: 86,33). <button class="knopf voll" id="planueb2">Planwerte = Basis übernehmen</button></p>
  <div class="hinweisbox">Wenn der Absatz durch die Fertigung begrenzt ist (wie bei der aktuellen Vorbelegung), ist der Absatz-Planwert fast sicher. Unsicher bleiben dann vor allem Kosten in Personal und Material, also EKR und OCF in kleinem Umfang.</div>
  <h2 style="margin-top:12px">Auslastungsziele (bewertete Aufgabe)</h2>
  <p>Erwartete Auslastung Anlagen <b>${fz(b.v('ausl_anl'), 2)} %</b>, Personal <b>${fz(b.v('ausl_pers'), 2)} %</b>. Die Anlagenauslastung ist eine reine Spielregel-Rechnung (Fertigung / Kapazität) und damit exakt, solange ihr die Fertigung vorgebt. Die Personalauslastung hängt an Fluktuation, Fehlzeiten und Produktivität. Im Backtest P1 lag das Modell dort ${fz(Math.abs(bt().r.v('ausl_pers') - IST1.ausl_pers), 1)} %-Punkte daneben (Reiter „Backtest P1“).</p>`;
}
document.addEventListener('click', ev => { if (ev.target.id === 'planueb2') planUebernehmen(); });

function aus() {
  const b = res, gebot = +F.aus_preis;
  const es = N.es_preise[1] / A.wa_index, lohnStk = N.gehalt.fe * (1 + F.pnk / 100 + 0.05) / b.v('produktivitaet');
  const varK = es + N.betriebsstoff + lohnStk + +A.nacharbeit;
  const hk = b.v('hk_stk');
  return `<p>${N.ausschreibung_text}. Transportkosten trägt bei Ausschreibungen der Kunde (Handbuch S. 14).</p>
  <div class="warnbox">Ob ihr den Zuschlag bekommt, hängt nur von den Geboten der anderen ab: nicht vorhersagbar. Bei gleichem Preis entscheidet die Produktqualität (unser Technologieindex 102,45 ist der niedrigste im Markt).</div>
  <table><tr><th>Größe (Schätzung für P3, Preise P2)</th><th>je Stück</th><th>3.000 Stück</th></tr>
  <tr><td>Einsatzstoffe (${fz(N.es_preise[1])} € / WA-Index ${fz(A.wa_index, 2)})</td><td>${fz(es, 0)} €</td><td>${fz(es * 3000 / 1e6, 2)} MEUR</td></tr>
  <tr><td>Betriebsstoffe</td><td>${fz(N.betriebsstoff)} €</td><td>${fz(N.betriebsstoff * 3000 / 1e6, 2)} MEUR</td></tr>
  <tr><td>Fertigungslohn inkl. PNK und Pension (${fz(N.gehalt.fe)} € × ${fz(1 + F.pnk / 100 + 0.05, 2)} / ${fz(b.v('produktivitaet'), 1)} Stk)</td><td>${fz(lohnStk, 0)} €</td><td>${fz(lohnStk * 3000 / 1e6, 2)} MEUR</td></tr>
  <tr><td>Nacharbeit</td><td>${fz(+A.nacharbeit, 0)} €</td><td>${fz(A.nacharbeit * 3000 / 1e6, 2)} MEUR</td></tr>
  <tr class="summe"><td>Variable Kosten (Untergrenze, wenn Kapazität frei ist)</td><td>${fz(varK, 0)} €</td><td>${fz(varK * 3000 / 1e6, 2)} MEUR</td></tr>
  <tr><td>Herstellkosten je Stück P2 (inkl. Fixkosten, Basis)</td><td>${fz(hk, 0)} €</td><td></td></tr>
  <tr><td>Selbstkosten je Stück P2 (Basis)</td><td>${fz(b.v('sk_stk'), 0)} €</td><td></td></tr>
  ${gebot > 0 ? `<tr class="summe"><td>Euer Gebot ${fz(gebot)} € → Deckungsbeitrag über variable Kosten</td><td>${fz(gebot - varK, 0)} €</td><td>${fz((gebot - varK) * 3000 / 1e6, 2)} MEUR</td></tr>` : ''}
  </table>
  <p class="klein">Zum Vergleich: Großabnehmer zahlt in P2 ${fz(N.ga_preis)} €, Markt 1 rund ${fz(+F.preis)} € (minus 25 € Transport). Wichtig für P3: Die 3.000 Stück haben Vorrang vor Markt 1. Ohne zusätzliche Kapazität fehlen sie dort. Ein Gebot nahe den variablen Kosten lohnt nur, wenn in P3 freie Kapazität da ist.</p>`;
}

let _bt;
function bt() { if (!_bt) { const p1 = perioden[1]; const A1 = { ...M.standardAnnahmen(stand0, p1.nachrichten), absatz_fix: p1.ist.absatz }; _bt = { r: M.rechne(stand0, p1.nachrichten, p1.entscheidung, A1), A: A1 }; } return _bt; }
function backtest() {
  const { r } = bt(), I = IST1;
  const Z = [['absatz', 'absatz', 'vorgegeben (Ist)'], ['fert', 'fertigung'], ['kap_anl', 'kap_anl'], ['fe_fluk', 'fluk_fe', 'Fluktuationsrate P0 (6,0 %) statt P1 (5,6 %)'], ['fe_end', 'pers_end_fe'], ['fe_fehl', 'fehl', 'Fehlzeitenquote P0 (5,5 %) statt 4,5 %'],
    ['fe_einsetzbar', 'einsetzbar'], ['produktivitaet', 'produktivitaet', 'Motivationsindex war Ende P0 noch 1,000; P1 dann 1,013'], ['ausl_anl', 'ausl_anl'], ['ausl_pers', 'ausl_pers', 'Folge von Fehlzeiten und Produktivität'], ['p_ek_end', 'pers_ek'], ['p_vw_end', 'pers_vw'], ['umw_ind', 'umw_ind'],
    ['umsatz', 'umsatz'], ['k_es', 'k_es', 'Wertanalyseindex: aus P0 nicht absehbar, dass er auf 1,02 steigt'], ['k_lohn', 'k_lohn', 'Personalbestand 3 MA daneben'], ['k_eek', 'k_eek'], ['k_pnk', 'k_pnk'], ['k_pens', 'k_pens'], ['k_afa_anl', 'k_afa_anl'], ['k_afa_umw', 'k_afa_umw'], ['k_fix', 'k_fix'], ['k_ih', 'k_ih'],
    ['k_umw', 'k_umw'], ['k_nach', 'k_nach', 'Nacharbeit je Stück stieg von 30,75 € auf 34,57 €'], ['k_lager', 'k_lager', 'Folge des Einsatzstoffverbrauchs'], ['k_werb', 'k_werb'], ['k_fue', 'k_fue'], ['k_transp', 'k_transp'], ['hk_stk', 'hk_stk'],
    ['be', 'be'], ['zinsen', 'zinsen'], ['steuern', 'steuern'], ['pue', 'pue'], ['kasse', 'kasse'], ['bi_ford', 'ford'], ['es_end_wert', 'es_wert'], ['bi_masch', 'maschinen'], ['bi_ek', 'ek'], ['bi_aktiva', 'bilanzsumme'], ['ocf', 'ocf'], ['ekr', 'ekr'], ['pq', 'pq']];
  return `<p>So wird geprüft, ob man dem Modell trauen kann: Es startet mit dem <b>Stand Ende P0</b>, bekommt eure <b>echten Entscheidungen aus P1</b> und nur das Wissen, das Ende P0 da war. Einzige Ausnahme: der Absatz wird auf den Ist-Wert 45.500 gesetzt, weil die Nachfrage nicht rückwirkend prüfbar ist (das Nachfragemodell braucht die P1-Marktdaten selbst).</p>
  <div class="hinweisbox"><b>Ergebnis:</b> Betriebsergebnis ${sgn(r.v('be') - I.be)} MEUR, Periodenüberschuss ${sgn(r.v('pue') - I.pue)} MEUR, Kasse ${sgn(r.v('kasse') - I.kasse)} MEUR daneben. Die Abweichungen stammen alle aus den gelben „abgeleiteten“ Werten (Fluktuation, Fehlzeiten, Produktivität, Wertanalyse, Nacharbeit). Alle grünen Spielregel-Positionen treffen auf 0,01 MEUR genau.</div>
  <table><tr><th>Position</th><th>Modell</th><th>Ist P1</th><th>Abweichung</th><th style="text-align:left">Grund</th></tr>
  ${Z.map(([k, i, g]) => { const e = r.E[k], d = e.v - I[i], gross = Math.abs(d) > (e.u === 'MEUR' ? 0.03 : e.u === '%' ? 0.1 : e.u === 'EUR' ? 2 : 0.5);
    return `<tr><td>${dot(e.sg)}${e.t}</td><td>${fv(e)}</td><td>${fv(e, I[i])}</td><td class="${gross ? 'neg' : ''}">${sgn(d, e.u === 'MEUR' || e.u === '%' || e.u === 'EUR' || e.u === 'Stück/MA' ? 2 : e.u === 'Index' ? 2 : 0)}</td><td class="klein" style="text-align:left">${g || ''}</td></tr>`; }).join('')}</table>
  <p class="klein">Für P2 sind die gelben Werte bereits auf die P1-Ist-Werte aktualisiert (Annahmen-Reiter links). Die Bilanz des Modells geht immer exakt auf (Probe: Aktiva − Passiva = ${fz(r.v('bi_diff'), 6)}).</p>`;
}

function news() {
  const z = [['Marktwachstum', N.wachstum_text, `Szenarien ${N.wachstum.map(x => fz(x * 100) + ' %').join(' / ')}`],
    ['Einsatzstoffe', 'Preissteigerung ca. 3 %', `Staffel ${N.es_preise.map(fz).join(' / ')} €; Nachlieferung ${fz(N.es_preise[0] * 1.2)} €`],
    ['Löhne', N.gehalt_text, Object.entries(N.gehalt).map(([k, x]) => `${k.toUpperCase()} ${fz(x / 1000)} T€`).join(', ')],
    ['Einstellungskosten', 'steigen auf 14.000 EUR', 'je Einstellung, auch für Ersatz der Fluktuation'],
    ['Zinsen', N.zins_text, `kurz ${fz(res.v('zins_kurz'), 1)} %, lang ${fz(res.v('zins_lang'), 1)} %, Überziehung ${fz(res.v('zins_ueberz'), 1)} % (inkl. Ratingeffekt BBB: −1 %-Punkt)`],
    ['Wertpapiere', N.zins_wp_text, fz(N.zins_wp * 100, 1) + ' % (Schätzung)'],
    ['Betriebsstoffe', N.betriebsstoff_text, fz(N.betriebsstoff) + ' €/Stück'],
    ['Großabnehmer', 'MEGRO nimmt bis 8.000 Stück', `${fz(N.ga_preis)} €/Stück, Zahlung sofort, kein Transport`],
    ['Ausschreibung', N.ausschreibung_text, 'Reiter „Ausschreibung P3“'],
    ['Sonderangebot', N.anlagen_text, 'Formular: Fertigungsanlagen → Typ C'],
    ['Konjunktur', N.konj_text, 'nur indirekt (Lebenshaltung +2 % → Annahme Konkurrenzpreis +2 %)']];
  return `<table><tr><th>Thema</th><th style="text-align:left">Wirtschaftsnachricht P2</th><th style="text-align:left">so im Modell</th></tr>${z.map(([a, b, c]) => `<tr><td>${a}</td><td style="text-align:left">${b}</td><td style="text-align:left">${c}</td></tr>`).join('')}</table>`;
}

// =============================================================================================
// Rechenweg-Panel
// =============================================================================================
let pfad = [];
const SN = ['Spielregel / Ist-Wert', 'aus Berichten abgeleitet', 'Schätzung'];
const SE = { ein: 'Eingabe im Formular', ist: 'Ist-Wert aus dem Bericht', regel: 'Spielregel / Wirtschaftsnachricht', kalib: 'aus Berichten abgeleitet', schaetz: 'Schätzung' };
function zeigeRw(k, neu = true) {
  const e = res.E[k]; if (!e) return;
  if (neu) pfad = [k]; else if (pfad[pfad.length - 1] !== k) { const i = pfad.indexOf(k); pfad = i >= 0 ? pfad.slice(0, i + 1) : [...pfad, k]; }
  $('rwtitel').textContent = e.t;
  const p = sz.pess.E[k], o = sz.opt.E[k];
  let h = pfad.length > 1 ? `<div class="pfad">${pfad.map((x, i) => i < pfad.length - 1 ? `<a data-rwp="${x}">${res.E[x].t}</a>` : res.E[x].t).join(' › ')}</div>` : '';
  h += `<div class="rw-wert">${fv(e)}</div>`;
  if (p && o && Math.abs(p.v - o.v) > 1e-9) h += `<div class="klein">pessimistisch ${fv(e, p.v)} · optimistisch ${fv(e, o.v)}</div>`;
  h += `<div style="margin-top:8px"><span class="badge">${e.s === 'ein' ? '<i class="dot dein"></i>' : dot(M.STUFE[e.s])}Dieser Schritt: ${SE[e.s]}</span><span class="badge">${dot(e.sg)}Gesamt: ${SN[e.sg]}</span></div>`;
  if (e.f) h += `<div class="rw-abschnitt"><h4>Rechnung</h4><div class="formel">${e.f}</div></div>`;
  if (e.q) h += `<div class="rw-abschnitt"><h4>Quelle / Regel</h4><div>${e.q}</div></div>`;
  if (e.n) h += `<div class="rw-abschnitt"><h4>Hinweis</h4><div>${e.n}</div></div>`;
  if (e.d.length) h += `<div class="rw-abschnitt"><h4>Setzt sich zusammen aus</h4><table>${e.d.filter(d => res.E[d]).map(d => { const x = res.E[d];
    return `<tr class="klick" data-rwz="${d}"><td>${dotE(x)}${x.t}</td><td>${fv(x)}</td></tr>`; }).join('')}</table></div>`;
  const genutzt = Object.values(res.E).filter(x => x.d.includes(k));
  if (genutzt.length) h += `<div class="rw-abschnitt"><h4>Fließt ein in</h4><div class="klein">${genutzt.slice(0, 12).map(x => `<a data-rwz="${x.k}" style="color:var(--blau);cursor:pointer">${x.t}</a>`).join(' · ')}</div></div>`;
  $('rwbody').innerHTML = h;
  $('rw').classList.add('offen'); $('rwhg').classList.add('offen');
}
const zu = () => { $('rw').classList.remove('offen'); $('rwhg').classList.remove('offen'); };
$('rwzu').onclick = zu; $('rwhg').onclick = zu;
document.addEventListener('keydown', ev => { if (ev.key === 'Escape') zu(); });
document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-rw],[data-rwz],[data-rwp]'); if (!t) return;
  if (t.dataset.rw) zeigeRw(t.dataset.rw, true);
  else if (t.dataset.rwz) { pfad.push(t.dataset.rwz); zeigeRw(t.dataset.rwz, false); }
  else zeigeRw(t.dataset.rwp, false);
});

formular();
rechnen();
