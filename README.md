# TOPSIM Spielwiese

Planungstool für TOPSIM „Mastering Business Operations“ (Unternehmen 1, Copy Classic, Markt 1). Oben im Kopf lässt sich die Periode umschalten: gelaufene Perioden als Rückblick (Formular = echte Entscheidungen, Vergleich mit dem Ist), die neueste als Planung. Direktlink: `#p1`, `#p2`.

Läuft über GitHub Pages ohne Build-Schritt. Lokal nur über einen Webserver (`python3 -m http.server`), nicht per Doppelklick.

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html`, `app.js` | Oberfläche: Formular wie in TOPSIM, Kennzahlen, Hinweise, Reiter, Rechenweg-Panel |
| `modell.js` | Rechenmodell. Jede Größe wird mit Rechenweg, Quelle und Verlässlichkeit abgelegt |
| `daten/stand_p1.json` | Stand Ende P1 (Ausgangslage P2), jeder Wert mit Fundstelle im Bericht |
| `daten/stand_p0.json` | Stand Ende P0 (nur für den Backtest) |
| `daten/perioden.json` | je Periode: Wirtschaftsnachrichten, Entscheidungen, Ist-Werte |
| `tools/pruefen.mjs` | Backtest P1 und Plan P2 auf der Konsole |

## Verlässlichkeit

- grün: Spielregel aus dem Handbuch, Wirtschaftsnachricht oder Ist-Wert
- gelb: aus den Berichten abgeleitet (Fluktuation, Fehlzeiten, Produktivität, Nacharbeit, Wertanalyse, Umweltpunkte)
- rot: Schätzung, vor allem Nachfrage und Verhalten der Konkurrenz
- Eine Größe ist so unsicher wie ihre unsicherste Zutat.

## Neue Periode einpflegen (n = Periode des neuen Sammelberichts)

1. `daten/stand_p{n}.json` aus dem Sammelbericht anlegen (Aufbau wie `stand_p1.json`).
2. In `daten/perioden.json` bei Periode n die Ist-Werte und bei n+1 Wirtschaftsnachrichten und die Vorbelegung des Formulars ergänzen.
3. Die neueste Periode in `perioden.json` wird automatisch zur Planperiode; Backtest in `app.js` auf Periode n umstellen.
4. `node tools/pruefen.mjs`: Bilanzprobe muss 0 sein, Backtest-Abweichungen klären.
