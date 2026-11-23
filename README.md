# TOPSIM Spielwiese

Planungstool für TOPSIM „Mastering Business Operations“ (Unternehmen 1, Copy Classic, Markt 1). Jede Eingabe im Entscheidungsformular zeigt sofort ihre Wirkung auf Ergebnis, Kasse, Kapazität und Bilanz, dazu drei Nachfrage-Szenarien, die Wirkung jeder einzelnen Entscheidung und einen Ausblick auf die Periode danach.

Läuft über GitHub Pages, ohne Build-Schritt. Lokal geht es nur über einen Webserver (z. B. `python3 -m http.server`), nicht per Doppelklick auf die Datei.

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Oberfläche |
| `model.js` | Planungsrechnung: Spielregeln (mit Handbuchseite), Kalibrierung, Szenarien, Ausblick |
| `daten.js` | Laden der Perioden, Rechenprüfungen der Berichte, Backtest |
| `data/p{n}.json` | Sammelbericht Periode n als Zahlen, gültige Wirtschaftsnachrichten, Prognose für n+1 |
| `tools/parse_sammelbericht.py` | liest einen Sammelbericht (PDF) aus |
| `tools/neue_periode.py` | legt `data/p{n}.json` an |
| `tools/check.mjs` | prüft alle Perioden und rechnet den Backtest |

## Neue Periode einpflegen

1. `python3 tools/neue_periode.py <n> Sammelbericht_Periode_n.pdf prognose.json`
   (`prognose.json` = Wirtschaftsnachrichten für n+1, Schlüssel wie `prognose` in `data/p0.json`)
2. `node tools/check.mjs` – alle Rechenprüfungen müssen bestehen. Der Backtest zeigt, wie genau das Modell Periode n getroffen hat.
3. Größere Abweichungen im Backtest klären (Modell oder Annahme anpassen), dann committen und pushen.

Neue Entscheidungsbereiche (z. B. Markt 2, neues Produkt) brauchen eine Erweiterung von `model.js` und `index.html`.

## Was das Modell kann und was nicht

- **Exakt nach Spielregeln:** Kosten, Personal, Anlagen, Lager, GuV, Liquidität mit Überziehungskredit, Steuern, Bilanz. Der Backtest P0 trifft alle Positionen auf 0,01 MEUR.
- **Aus den Berichten kalibriert:** Fluktuation, Fehlzeiten, Produktivität, Nacharbeit, Rationalisierungs- und Wertanalyseindex.
- **Geschätzt:** die Nachfrage (Handbuchanker für Werbung und Vertrieb, Preiselastizität geschätzt) und die Wirkung von Training, Rationalisierungsbudget, Technologie, Ökologie und CI. Deshalb gibt es die Szenarien ±Unsicherheit und den Reiter „Wirkung je Entscheidung“, der für jedes Feld sagt, was gerechnet wird und was nicht.
