// Prüft das Modell: Backtest P1 (aus Stand Ende P0 mit den echten P1-Entscheidungen) und Plan P2.
// Aufruf: node tools/pruefen.mjs
import fs from 'fs';
import * as M from '../modell.js';
const lade = f => JSON.parse(fs.readFileSync(new URL('../daten/' + f, import.meta.url)));
const s0 = lade('stand_p0.json'), s1 = lade('stand_p1.json'), per = lade('perioden.json');
export function backtest(s0, p1) {
  const A = { ...M.standardAnnahmen(s0, p1.nachrichten), absatz_fix: p1.ist.absatz };
  const r = M.rechne(s0, p1.nachrichten, p1.entscheidung, A);
  return { r, A };
}
const { r } = backtest(s0, per[1]);
const ist = per[1].ist;
const zeilen = [['absatz','absatz'],['fert','fertigung'],['kap_anl','kap_anl'],['fe_end','pers_end_fe'],['fe_fluk','fluk_fe'],['fe_fehl','fehl'],['fe_einsetzbar','einsetzbar'],['produktivitaet','produktivitaet'],['ausl_anl','ausl_anl'],['ausl_pers','ausl_pers'],['p_ek_end','pers_ek'],['p_vw_end','pers_vw'],['umw_ind','umw_ind'],
 ['umsatz','umsatz'],['k_es','k_es'],['k_bs','k_bs'],['k_lohn','k_lohn'],['k_eek','k_eek'],['k_pnk','k_pnk'],['k_pens','k_pens'],['k_afa_anl','k_afa_anl'],['k_afa_umw','k_afa_umw'],['k_fix','k_fix'],['k_ih','k_ih'],['k_umw','k_umw'],['k_nach','k_nach'],['k_lager','k_lager'],['k_werb','k_werb'],['k_fue','k_fue'],['k_transp','k_transp'],
 ['hk_stk','hk_stk'],['bestv','bestv'],['be','be'],['zinsen','zinsen'],['steuern','steuern'],['pue','pue'],['kasse','kasse'],['bi_ford','ford'],['es_end_wert','es_wert'],['bi_masch','maschinen'],['bi_ek','ek'],['bi_aktiva','bilanzsumme'],['ez_sum','ez_sum'],['az_sum','az_sum'],['az_pers','az_pers'],['az_mat','az_mat'],['ocf','ocf'],['ekr','ekr'],['pq','pq']];
console.log('Backtest P1 (Stand Ende P0 + echte Entscheidungen P1, Absatz = Ist):');
zeilen.forEach(([k,i]) => { const m = r.v(k), x = ist[i]; console.log(`${r.E[k].t.padEnd(44)} ${M.fz(m,2).padStart(12)} ${M.fz(x,2).padStart(12)} ${M.fz(m-x,2).padStart(9)}`); });
console.log('Bilanzprobe', r.v('bi_diff').toFixed(6));
const A2 = M.standardAnnahmen(s1, per[2].nachrichten);
const sz = M.szenarien(s1, per[2].nachrichten, per[2].entscheidung, A2);
console.log('\nAnnahmen P2', A2, '\nMarkt', sz.basis.ms);
for (const [n, x] of Object.entries(sz)) console.log(n, 'Nachfrage', x.v('nachfrage'), 'Absatz', x.v('absatz'), 'PÜ', x.v('pue').toFixed(2), 'Kasse', x.v('kasse').toFixed(2), 'AuslA', x.v('ausl_anl').toFixed(2), 'AuslP', x.v('ausl_pers').toFixed(2), 'diff', x.v('bi_diff').toExponential(1));
