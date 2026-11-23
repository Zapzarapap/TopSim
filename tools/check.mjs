// Prüft die Periodendaten und rechnet den Backtest.
// Aufruf: node tools/check.mjs            (alle Perioden)
//         node tools/check.mjs 2          (nur Periode 2)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as D from '../daten.js';
import * as M from '../model.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const idx = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const files = idx.perioden.map(n => JSON.parse(fs.readFileSync(path.join(dir, `p${n}.json`), 'utf8')));
const P = D.bereite(files);
const nur = process.argv[2] != null ? +process.argv[2] : null;
let fehler = 0;
const f2 = (x, d = 2) => x == null ? '–' : x.toFixed(d);

P.forEach((p, i) => {
  if (nur != null && p.periode !== nur) return;
  console.log(`\n=== Periode ${p.periode} ===`);
  const c = D.konsistenz(p.B);
  c.forEach(x => { if (!x.ok) fehler++; console.log(`${x.ok ? 'ok  ' : 'FEHL'} ${x.name}${x.ok ? '' : `: ${f2(x.a)} vs ${f2(x.b)}`}`); });
  if (!p.nachrichten && i === 0) console.log('WARN keine Nachrichten für Periode', p.periode);
  if (!p.prognose) console.log('WARN keine Prognose (Wirtschaftsnachrichten) für Periode', p.periode + 1);
  const bt = D.backtest(P, i, true);
  console.log(`\nBacktest Periode ${p.periode} mit Ist-Absatz${bt.inSample ? ' (in-sample: kalibriert auf derselben Periode)' : ''}:`);
  let gross = 0;
  bt.zeilen.forEach(([l, u, m, ist, d]) => {
    const dv = m - ist, tol = u === 'MEUR' ? 0.05 : u === 'EUR' ? 5 : u === '%' ? 0.2 : 1;
    const flag = Math.abs(dv) > tol ? '  <<' : '';
    if (flag) gross++;
    console.log(`${l.padEnd(32)} ${f2(m, d).padStart(11)} ${f2(ist, d).padStart(11)} ${f2(dv, d).padStart(9)}${flag}`);
  });
  if (i > 0) {
    const bn = D.backtest(P, i, false);
    console.log(`Nachfragemodell: geschätzt ${bn.r.nachfrage}, tatsächlich ${p.B.t01_absatz?.[0]} (Abweichung ${(100 * (bn.r.nachfrage / p.B.t01_absatz?.[0] - 1)).toFixed(1)} %)`);
  }
  console.log(`${gross} Positionen mit größerer Abweichung`);
});
const last = P[P.length - 1];
const r = M.modell(last.B, M.formAus(last.B), M.kalibriere(last.B), last.prognose || {});
console.log(`\nPlan P${last.periode + 1} mit Vorbelegung: PÜ ${f2(r.pue)} MEUR, Kasse ${f2(r.kasse)} MEUR, Bilanzdifferenz ${r.bi_diff.toExponential(1)}`);
console.log(fehler ? `\n${fehler} Prüfungen fehlgeschlagen` : '\nAlle Prüfungen bestanden');
process.exit(fehler ? 1 : 0);
