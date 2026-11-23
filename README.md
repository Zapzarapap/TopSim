# TOPSIM Spielwiese

Entscheidungsformular für TOPSIM „Mastering Business Operations“ (Unternehmen 1, Copy Classic, Markt 1). Jede Eingabe zeigt sofort ihre Wirkung: Periodenüberschuss, Kapazitätsauslastung, acht Ampeln und Planwerte für TOPSIM.

- `index.html` ist eine einzelne Seite ohne Build-Schritt und läuft direkt im Browser bzw. über GitHub Pages.
- Die Rechnung ist identisch mit Block 3 des Excel-Planungstools (`TOPSIM_Planung_P{n}.xlsx`). Geprüft wurde das an 15 Szenarien mit je 157 Werten.
- Neue Periode: Die Excel per Prompt 2 aktualisieren, dann auf der Seite „Excel laden“ wählen. Die Seite liest das neueste Blatt `P{n}_Plan_P{n+1}`.
- Die Nachfrage ist eine Schätzung. Die Preiselastizität und weitere Annahmen stehen im Blatt `Regeln` bzw. im Annahmen-Kasten der Excel.
