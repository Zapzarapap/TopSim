#!/usr/bin/env python3
"""Liest einen TOPSIM-Sammelbericht (PDF) und schreibt die Berichtswerte als JSON.

Aufruf:  python3 tools/parse_sammelbericht.py Sammelbericht.pdf > berichte.json

Jeder Schlüssel (z. B. "t15_kasse") bekommt eine Liste von Werten in der Spaltenreihenfolge
des Berichts. Die Schlüssel sind dieselben, die das Modell in model.js liest.
Benötigt pdftotext (poppler-utils).
"""
import json
import re
import subprocess
import sys

NUM = re.compile(r"(?<![\w.,])-?\d{1,3}(?:\.\d{3})+(?:,\d+)?(?![\d])|(?<![\w.,])-?\d+(?:,\d+)?(?![\d.])")


def num(s):
    return float(s.replace(".", "").replace(",", "."))


def nums(text):
    out = []
    for m in NUM.finditer(text):
        v = num(m.group(0))
        out.append(int(v) if v == int(v) and "," not in m.group(0) else v)
    return out


def sections(txt):
    """Teilt den Text in Abschnitte je TNB-Bericht (Seitenwechsel werden zusammengefügt)."""
    sec = {}
    cur = None
    for line in txt.splitlines():
        m = re.search(r"TNB(\d\d):", line)
        if m:
            cur = "t" + m.group(1)
            sec.setdefault(cur, [])
            continue
        if cur and not re.search(r"Copyright \(c\) by Topsim|Mastering Business Operations", line):
            s = re.sub(r"\s+", " ", line).strip()
            if s:
                sec[cur].append(s)
    return sec


# (Schlüssel, Bericht, Regex für das Label am Zeilenanfang, n-tes Vorkommen, max. Zahlen)
SPEC = [
    # TNB01 Executive Summary
    ("t01_aktienkurs", "t01", r"Aktienkurs EUR", 0, 1),
    ("t01_umsatz", "t01", r"Umsatz Gesamt MEUR", 0, 1),
    ("t01_pue", "t01", r"Periodenüberschuss/-fehlbetrag MEUR", 0, 1),
    ("t01_absatz", "t01", r"Tatsächlicher Absatz Stück", 0, 1),
    ("t01_absatz_plan", "t01", r"Geplanter Absatz Stück", 0, 1),
    ("t01_ma", "t01", r"Marktanteil %", 0, 1),
    ("t01_fe_end", "t01", r"Lagerendbestand Copy Classic Stück", 0, 1),
    ("t01_hk", "t01", r"Herstellkosten Copy Classic EUR/Stück", 0, 1),
    ("t01_sk", "t01", r"Selbstkosten Copy Classic EUR/Stück", 0, 1),
    ("t01_be", "t01", r"Betriebsergebnis MEUR", 0, 1),
    ("t01_ek", "t01", r"Eigenkapital MEUR", 0, 1),
    ("t01_ekr", "t01", r"Eigenkapitalrendite %", 0, 1),
    ("t01_kasse", "t01", r"Kassenendbestand MEUR", 0, 1),
    ("t01_ueberz", "t01", r"Überziehungskredit MEUR", 0, 1),
    ("t01_fkq", "t01", r"Fremdkapitalquote %", 0, 1),
    # TNB02 Marktforschung (nur wenn gekauft)
    ("t02_preis", "t02", r"Preis EUR", 0, 9),
    ("t02_tech", "t02", r"Technologie Index", 0, 9),
    ("t02_oeko", "t02", r"Ökologie Index", 0, 9),
    ("t02_werbung", "t02", r"Werbung MEUR", 0, 9),
    ("t02_vertrieb", "t02", r"Vertriebsmitarbeiter Anzahl", 0, 9),
    ("t02_kz", "t02", r"Kundenzufriedenheit Index", 0, 9),
    ("t02_bek", "t02", r"Bekanntheit Index", 0, 9),
    ("t02_pot", "t02", r"Potentieller Stück", 0, 9),
    ("t02_tats", "t02", r"Tatsächlicher Stück", 0, 9),
    ("t02_ngn", "t02", r"Nicht Stück", 0, 9),
    ("t02_umsatz", "t02", r"Umsatz MEUR", 0, 9),
    ("t02_ma", "t02", r"Marktanteil %", 0, 9),
    # TNB03 Fertigung
    ("t03_fm_plan", "t03", r"Geplante Fertigungsmenge Stück", 0, 1),
    ("t03_fm", "t03", r"Tatsächliche Fertigungsmenge Stück", 0, 1),
    ("t03_ausl_anl", "t03", r"Auslastung Anlagen %", 0, 1),
    ("t03_ausl_ma", "t03", r"Auslastung Mitarbeiter %", 0, 1),
    ("anl_sum", "t03", r"Summe", 0, 4),
    ("kap_sum", "t03", r"Summe", 1, 4),
    ("t03_umw_anl", "t03", r"Umweltindex der Fertigungsanlagen Index", 0, 1),
    ("t03_umw_kum", "t03", r"Kumulierte Investitionen in Umweltanlagen MEUR", 0, 1),
    ("t03_umw_verb", "t03", r"Verbesserung der Umweltindizes Punkte", 0, 1),
    ("t03_umw_ind", "t03", r"Umweltbelastungsindikator des Unternehmens Index", 0, 1),
    ("t03_umw_abg", "t03", r"Umweltabgabe MEUR", 0, 1),
    ("t03_kap_ohne", "t03", r"Kapazität der Anlagen \(ohne Stück", 0, 2),
    ("t03_kap_mit", "t03", r"Verfügbare Fertigungskapazität Stück", 0, 2),
    ("t03_pers", "t03", r"Personalbestand Anzahl", 0, 1),
    ("t03_fehl", "t03", r"- Fehlzeiten Anzahl", 0, 1),
    ("t03_einsetzbar", "t03", r"= Einsetzbares Personal Anzahl", 0, 1),
    ("t03_neu", "t03", r"Neue Mitarbeiter %", 0, 1),
    ("t03_po", "t03", r"Prozessoptimierung MEUR", 0, 1),
    ("t03_training", "t03", r"Trainingsausgaben pro Mitarbeiter EUR", 0, 1),
    ("t03_motiv", "t03", r"Mitarbeitermotivation Index", 0, 1),
    ("t03_einarb", "t03", r"Einarbeitungsindex Index", 0, 1),
    ("t03_poi", "t03", r"× Prozessoptimierungsindex Index", 0, 1),
    ("t03_quali", "t03", r"× Personalqualifizierungsindex Index", 0, 1),
    ("t03_motivi", "t03", r"× Motivationsindex Index", 0, 1),
    ("t03_prod1", "t03", r"= Produktivitätsindex I Index", 0, 1),
    ("t03_kumfert", "t03", r"Kumulierte Fertigung bis Vorperiode Stück", 0, 1),
    ("t03_prod2", "t03", r"Produktivitätsindex II Index", 0, 1),
    ("t03_m_mit", "t03", r"Einsetzbares Personal \(inklusive Anzahl", 0, 1),
    ("t03_kap_ma", "t03", r"Fertigungskapazität pro Mitarbeiter Stück/Periode", 0, 1),
    ("t03_eingesetzt", "t03", r"Eingesetztes Personal \(inklusive Anzahl", 0, 1),
    # TNB04 F&E (Investition, Index)
    ("t04_tech", "t04", r"Copy Classic Gen\. 1", 0, 2),
    ("t04_oeko", "t04", r"Copy Classic Gen\. 1", 1, 2),
    ("t04_wa", "t04", r"Copy Classic Gen\. 1", 2, 2),
    # TNB05 Lager
    ("t05_es_end_ue", "t05", r"Lagerendbestand Einsatzstoffe Stück", 0, 1),
    ("t05_fe_end_ue", "t05", r"Lagerendbestand Fertigerzeugnisse Stück", 0, 1),
    ("t05_es_anf", "t05", r"Lageranfangsbestand", 0, 3),
    ("t05_es_zug", "t05", r"\+ Zugang von Lieferant", 0, 3),
    ("t05_es_nachl", "t05", r"\+ Nachlieferung", 0, 3),
    ("t05_es_abg", "t05", r"- Abgang an Fertigung", 0, 3),
    ("t05_es_end", "t05", r"= Lagerendbestand", 0, 3),
    ("t05_fe_anf", "t05", r"Lageranfangsbestand", 1, 3),
    ("t05_fe_zug", "t05", r"\+ Zugang von Fertigung", 0, 3),
    ("t05_fe_fremd", "t05", r"\+ Bezug Fremdfertigung", 0, 3),
    ("t05_fe_abg", "t05", r"- Abgang an Vertrieb", 0, 3),
    ("t05_fe_end", "t05", r"= Lagerendbestand", 1, 3),
    ("t05_lk_es", "t05", r"Einsatzstoffe/Teile Copy Classic MEUR", 0, 1),
    ("t05_lk_fe", "t05", r"Fertigerzeugnisse Copy Classic MEUR", 0, 1),
    # TNB06 Personal (Einkauf, Verwaltung, Fertigung, F&E, Vertrieb, Summe)
    ("t06_anf", "t06", r"Personalanfangsbestand Anzahl", 0, 6),
    ("t06_einst", "t06", r"\+ Einstellungen Anzahl", 0, 6),
    ("t06_entl", "t06", r"- Entlassungen Anzahl", 0, 6),
    ("t06_fluk", "t06", r"- Fluktuation Anzahl", 0, 6),
    ("t06_end", "t06", r"= Anzahl", 0, 6),
    ("t06_lohn", "t06", r"Löhne/Gehälter MEUR", 0, 6),
    ("t06_eek", "t06", r"Einstellungen/ MEUR", 0, 6),
    ("t06_sozial", "t06", r"Kosten Sozialplan MEUR", 0, 6),
    ("t06_pnk", "t06", r"Personalnebenkosten MEUR", 0, 6),
    ("t06_pens", "t06", r"Pensionsrückstellungen MEUR", 0, 6),
    ("t06_sum", "t06", r"Summe MEUR", 0, 6),
    ("t06_training", "t06", r"Trainingsmaßnahmen MEUR", 0, 1),
    # TNB07 Kostenartenrechnung (Summe, Gemeinkosten, Einzelkosten)
    ("t07_es", "t07", r"Einsatzstoffe/Teile", 0, 3),
    ("t07_bs", "t07", r"Betriebsstoffe", 0, 3),
    ("t07_lohn", "t07", r"Löhne/Gehälter \(\*\)", 0, 3),
    ("t07_eek", "t07", r"Einstellungen/Entlassungen/", 0, 3),
    ("t07_sozial", "t07", r"Kosten Sozialplan", 0, 3),
    ("t07_pnk", "t07", r"Personalnebenkosten", 0, 3),
    ("t07_pens", "t07", r"Pensionsrückstellungen", 0, 3),
    ("t07_afa_geb", "t07", r"Gebäude", 0, 3),
    ("t07_afa_anl", "t07", r"Fertigungsanlagen", 0, 3),
    ("t07_afa_umw", "t07", r"Umwelttechnik", 0, 3),
    ("t07_afa_fe", "t07", r"Fertigerzeugnisse", 0, 3),
    ("t07_fix", "t07", r"Sonstige fixe Kosten", 0, 3),
    ("t07_ih", "t07", r"Instandhaltung/Rationalisierung", 0, 3),
    ("t07_po", "t07", r"Prozessoptimierung", 0, 3),
    ("t07_umw", "t07", r"Umweltabgabe", 0, 3),
    ("t07_nach", "t07", r"Nacharbeit/Ausschuss", 0, 3),
    ("t07_lager", "t07", r"Lagerkosten", 0, 3),
    ("t07_werb", "t07", r"Werbung/Marktforschung/", 0, 3),
    ("t07_fe", "t07", r"Sonstige Kosten F&E", 0, 3),
    ("t07_transp", "t07", r"Transportkosten", 0, 3),
    ("t07_sum", "t07", r"Summe", 0, 3),
    # TNB09 Kostenträger
    ("t09_hk", "t09", r"= Herstellkosten", 0, 2),
    ("t09_hkdu", "t09", r"= Herstellkosten des Umsatzes", 0, 2),
    ("t09_sk", "t09", r"= Selbstkosten", 0, 2),
    ("t09s_hk", "t09", r"= Herstellkosten \(\*\)", 0, 1),
    ("t09s_hkdu", "t09", r"= Herstellkosten des Umsatzes \(\*\*\)", 0, 1),
    ("t09s_sk", "t09", r"= Selbstkosten \(\*\*\)", 0, 1),
    # TNB10 Deckungsbeitrag (Markt 1, Großabnehmer, Ausschreibung, Markt 2, Sondermarkt, Summe)
    ("t10_umsatz", "t10", r"Umsatzerlöse", 0, 6),
    ("t10_vmat", "t10", r"- Variable", 0, 6),
    ("t10_vfert", "t10", r"- Variable", 1, 6),
    ("t10_transp", "t10", r"- Transportkosten", 0, 6),
    ("t10_fmat", "t10", r"- Fixe", 0, 6),
    ("t10_ffert", "t10", r"- Fixe", 1, 6),
    ("t10_werb", "t10", r"- Werbungskosten", 0, 6),
    ("t10s_preis", "t10", r"Preis", 0, 6),
    ("t10s_vmat", "t10", r"- Variable", 2, 6),
    ("t10s_vfert", "t10", r"- Variable", 3, 6),
    ("t10s_fmat", "t10", r"- Fixe", 2, 6),
    ("t10s_ffert", "t10", r"- Fixe", 3, 6),
    # TNB11 GuV
    ("t11_umsatz", "t11", r"Umsatzerlöse", 0, 2),
    ("t11_sonst_ertr", "t11", r"\+ Sonstige Erträge", 0, 2),
    ("t11_bv", "t11", r"\+ Erhöhung/Verminderung des Bestandes an", 0, 2),
    ("t11_mat", "t11", r"- Materialaufwand", 0, 2),
    ("t11_pers", "t11", r"- Personalaufwand", 0, 2),
    ("t11_lohn", "t11", r"- Löhne/Gehälter", 0, 1),
    ("t11_eek", "t11", r"- Einstellungskosten/Entlassungskosten", 0, 1),
    ("t11_pens", "t11", r"- Pensionsrückstellungen", 0, 1),
    ("t11_sopers", "t11", r"- Sonstige Personalkosten", 0, 1),
    ("t11_afa", "t11", r"- Abschreibungen", 0, 2),
    ("t11_sonst", "t11", r"- Sonstiger Aufwand", 0, 2),
    ("t11_be", "t11", r"= Betriebsergebnis", 0, 2),
    ("t11u_hkdu", "t11", r"- Herstellkosten des Umsatzes", 0, 1),
    ("t11u_fe", "t11", r"- F&E", 0, 1),
    ("t11u_vt", "t11", r"- Vertrieb", 0, 1),
    ("t11u_vw", "t11", r"- Verwaltung", 0, 1),
    ("t11_finerg", "t11", r"- Finanzergebnis", 0, 2),
    ("t11_wp", "t11", r"\+ Erträge aus Wertpapieren", 0, 2),
    ("t11_zins", "t11", r"- Zinsen für kurz- und langfristige Kredite", 0, 2),
    ("t11_zins_ue", "t11", r"- Zinsen für Überziehungskredit", 0, 2),
    ("t11_gvst", "t11", r"= Gewinn vor Steuern", 0, 2),
    ("t11_steuern", "t11", r"- Steuern auf Einkommen und Ertrag", 0, 2),
    ("t11_pue", "t11", r"= Periodenüberschuss/-fehlbetrag", 0, 2),
    ("t11_vortrag_vp", "t11", r"Gewinn-/Verlustvortrag der Vorperiode", 0, 1),
    ("t11_div", "t11", r"- Ausschüttung Dividende", 0, 1),
    ("t11_verbl", "t11", r"= Verbleibender Gewinn-/Verlustvortrag", 0, 1),
    ("t11_vortrag", "t11", r"= Gewinn-/Verlustvortrag", 0, 1),
    # TNB12 Liquidität
    ("t12_anf", "t12", r"Kassenanfangsbestand", 0, 1),
    ("t12_ez_akt", "t12", r"Einzahlungen aus Umsatz Aktuelle Periode", 0, 1),
    ("t12_ez_vp", "t12", r"Einzahlungen aus Umsatz Vorperiode", 0, 1),
    ("t12_ez_wp", "t12", r"Verkauf von Wertpapieren", 0, 1),
    ("t12_ez_zins", "t12", r"Zinserträge", 0, 1),
    ("t12_ez_sonst", "t12", r"Sonstige Einzahlungen/Kapitalerhöhung", 0, 1),
    ("t12_ez_desinv", "t12", r"Desinvestitionen Fertigungsanlagen", 0, 1),
    ("t12_ez_kredit", "t12", r"Aufnahme kurzfristige und langfristige Kredite", 0, 1),
    ("t12_ez_sm", "t12", r"Erlös Sondermarkt", 0, 1),
    ("t12_ez_ue", "t12", r"Überziehungskredit", 0, 1),
    ("t12_ez_sum", "t12", r"Summe Einzahlungen", 0, 1),
    ("t12_az_mat", "t12", r"Einsatzstoffe, Betriebsstoffe, Fertigerzeugnisse", 0, 1),
    ("t12_az_ekvp", "t12", r"Einkauf Vorperiode", 0, 1),
    ("t12_az_pers", "t12", r"Personalkosten \(ohne BAV\)", 0, 1),
    ("t12_az_sonst", "t12", r"Sonstige Aufwendungen", 0, 1),
    ("t12_az_tilg", "t12", r"Rückzahlung kurzfristige Kredite & Überziehungskredit", 0, 1),
    ("t12_az_zins", "t12", r"Zinsaufwand kurzfristige und langfristige Kredite", 0, 1),
    ("t12_az_anl", "t12", r"Kauf von Fertigungsanlagen", 0, 1),
    ("t12_az_wp", "t12", r"Kauf von Wertpapieren", 0, 1),
    ("t12_az_umw", "t12", r"Kauf von Umweltanlagen", 0, 1),
    ("t12_az_div", "t12", r"Auszahlung Dividende", 0, 1),
    ("t12_az_sonst2", "t12", r"Sonstige Auszahlungen", 0, 1),
    ("t12_az_steuern", "t12", r"Steuern auf Einkommen und Ertrag", 0, 1),
    ("t12_az_zins_ue", "t12", r"Zinszahlung Überziehungskredit", 0, 1),
    ("t12_az_sum", "t12", r"Summe Auszahlungen", 0, 1),
    ("t12_end", "t12", r"Kassenendbestand", 0, 1),
    # TNB14 Cashflow
    ("t14_tcf", "t14", r"Traditioneller Cashflow", 0, 1),
    ("t14_ocf", "t14", r"A\. Operativer Cashflow", 0, 1),
    ("t14_fcf", "t14", r"Free Cashflow", 0, 1),
    # TNB17
    ("t17_zinsaend", "t17", r"Änderung Fremdkapitalzins \(\*\) \+/- %", 0, 1),
    ("t17_pq", "t17", r"Planungsqualität Index", 0, 1),
    ("t17_kurs", "t17", r"Aktienkurs EUR", 0, 1),
    ("t17_uw", "t17", r"Unternehmenswert MEUR", 0, 1),
    ("t17_se", "t17", r"Shareholder Earnings Kumuliert MEUR", 0, 1),
    # TNB18
    ("t18_ekq", "t18", r"Eigenkapitalquote %", 0, 1),
    # TNB19 Entscheidungsprotokoll (Wert der Periode)
    ("t19_preis", "t19", r"Preis Markt 1 Copy Classic EUR", 0, 1),
    ("t19_werbung", "t19", r"Werbung Markt 1 Copy Classic MEUR", 0, 1),
    ("t19_vertrieb", "t19", r"Vertrieb Personalendbestand Markt 1 Anzahl", 0, 1),
    ("t19_ci", "t19", r"Corporate Identity MEUR", 0, 1),
    ("t19_tech", "t19", r"Technologie Personalendbestand Copy Classic Anzahl", 0, 1),
    ("t19_oeko", "t19", r"Ökologie Copy Classic MEUR", 0, 1),
    ("t19_wa", "t19", r"Wertanalyse Copy Classic MEUR", 0, 1),
    ("t19_ga", "t19", r"Großabnehmer Copy Classic Stück", 0, 1),
    ("t19_aus", "t19", r"Ausschreibung Copy Classic EUR/Stück", 0, 1),
    ("t19_einkauf", "t19", r"Einsatzstoffe/Teile Copy Classic Einheit", 0, 1),
    ("t19_fm", "t19", r"Fertigungsmenge Copy Classic Stück", 0, 1),
    ("t19_inv_A", "t19", r"Investition \(Anz\. neue Anlagen\) Typ A", 0, 1),
    ("t19_inv_B", "t19", r"Investition \(Anz\. neue Anlagen\) Typ B", 0, 1),
    ("t19_inv_C", "t19", r"Investition \(Anz\. neue Anlagen\) Typ C", 0, 1),
    ("t19_des", "t19", r"Desinvestitionen Anlage Nr\.", 0, 9),
    ("t19_ih_A", "t19", r"Instandhaltung pro Typ A MEUR", 0, 1),
    ("t19_ih_B", "t19", r"Instandhaltung pro Typ B MEUR", 0, 1),
    ("t19_ih_C", "t19", r"Instandhaltung pro Typ C MEUR", 0, 1),
    ("t19_rat_A", "t19", r"Budget Rationalisierung Typ A MEUR", 0, 1),
    ("t19_rat_B", "t19", r"Budget Rationalisierung Typ B MEUR", 0, 1),
    ("t19_rat_C", "t19", r"Budget Rationalisierung Typ C MEUR", 0, 1),
    ("t19_umw", "t19", r"Investition in Umweltanlagen MEUR", 0, 1),
    ("t19_po", "t19", r"Prozessoptimierung MEUR", 0, 1),
    ("t19_pers", "t19", r"Einstellungen/Entlassungen Anzahl", 0, 1),
    ("t19_training", "t19", r"Training pro Mitarbeiter EUR", 0, 1),
    ("t19_pnk", "t19", r"Personalnebenkosten %", 0, 1),
    ("t19_kurz", "t19", r"Kurzfristiger Kredit MEUR", 0, 1),
    ("t19_lang", "t19", r"Langfristiger Kredit MEUR", 0, 1),
    ("t19_wp", "t19", r"Kauf von Wertpapieren MEUR", 0, 1),
    ("t19_div", "t19", r"Dividende absolut MEUR", 0, 1),
    ("t19_pl_absatz", "t19", r"Geplanter Absatz Copy Classic Markt 1 Stück", 0, 1),
    ("t19_pl_ekr", "t19", r"Geplante Eigenkapitalrendite %", 0, 1),
    ("t19_pl_ocf", "t19", r"Geplanter Operativer Cashflow MEUR", 0, 1),
]

# Bilanz: links Aktiva, rechts Passiva auf derselben Zeile (aktuelle Periode, Vorperiode)
BILANZ_L = [("t15_av", r"Anlagevermögen"), ("t15_grund", r"Grundstücke und"), ("t15_masch", r"Maschinen und"),
            ("t15_uv", r"Umlaufvermögen"), ("t15_mat", r"Materialien"), ("t15_fe", r"Fertige Erzeugnisse"),
            ("t15_ford", r"Forderungen aus"), ("t15_wp", r"Wertpapiere"), ("t15_kasse", r"Kassenbestand"),
            ("t15_bsa", r"Bilanzsumme")]
BILANZ_R = [("t15_ek", r"Eigenkapital", 0), ("t15_gez", r"Gezeichnetes Kapital", 0), ("t15_kr", r"Kapitalrücklage", 0),
            ("t15_gr", r"Gewinnrücklage", 0), ("t15_vortrag", r"Gewinn-/", 0), ("t15_pue", r"Periodenüberschuss/-", 0),
            ("t15_pens_g", r"Pensionsrückstellungen", 0), ("t15_pens", r"Pensionsrückstellungen", 1),
            ("t15_verb", r"Verbindlichkeiten", 0), ("t15_lang", r"Restlaufzeit über 10", 0),
            ("t15_kurz", r"Restlaufzeit unter 1", 0), ("t15_ueberz", r"Überziehungskredit", 0)]


def value_tokens(rest, maxn):
    toks = []
    for t in rest.split(" "):
        if re.fullmatch(r"Ja|Nein|AAA|AA|A|BBB|BB|B|CCC|CC|C|D", t):
            toks.append(t)
        elif re.fullmatch(r"-?\d{1,3}(\.\d{3})+(,\d+)?|-?\d+(,\d+)?", t):
            v = num(t)
            toks.append(int(v) if "," not in t and v == int(v) else v)
        elif t == "-" and toks is not None:
            toks.append("-")
    return toks[:maxn]


def find(lines, label, nth):
    rx = re.compile(r"^" + label + r"(?= |$)")
    k = 0
    for ln in lines:
        m = rx.match(ln)
        if m and re.search(r"\d|\bJa\b|\bNein\b", ln[m.end():]):
            if k == nth:
                return ln[m.end():].strip()
            k += 1
    return None


def parse(txt):
    S = sections(txt)
    B = {}
    for key, sec, label, nth, maxn in SPEC:
        lines = S.get(sec, [])
        rest = find(lines, label, nth)
        if rest is None:
            continue
        vals = value_tokens(rest, maxn)
        if vals:
            B[key] = vals
    # Zahlen, die in Labels stehen, sauber abschneiden (z. B. "Typ A")
    # TNB01 Rating
    for ln in S.get("t01", []):
        m = re.match(r"Rating Bonitätsstufe (\S+)", ln)
        if m:
            B["t01_rating"] = [m.group(1)]
    for ln in S.get("t17", []):
        m = re.match(r"Kreditrating Aktuelle Periode Stufe (\S+)", ln)
        if m:
            B["t17_rating"] = [m.group(1)]
    for ln in S.get("t19", []):
        m = re.match(r"Marktforschungsbericht (Ja|Nein)$", ln)
        if m:
            B["t19_mf"] = [m.group(1)]
    # TNB03 Anlagen und Kapazitäten
    cnt_a, cnt_k = {}, {}
    for ln in S.get("t03", []):
        m = re.match(r"^Typ ([ABC]) Anlage(?: Nr\.)?(?: (\d))? (.*)$", ln)
        if m:
            t, rest = m.group(1), m.group(3)
            v = value_tokens(rest, 7)
            if len(v) == 7:  # Anlagentabelle
                cnt_a[t] = cnt_a.get(t, 0) + 1
                B[f"anl_{t}{cnt_a[t]}"] = v
            elif len(v) == 6:  # Kapazitätstabelle
                cnt_k[t] = cnt_k.get(t, 0) + 1
                B[f"kap_{t}{cnt_k[t]}"] = v
            continue
        m = re.match(r"^Typ ([ABC]) (-?\d+,\d+)$", ln)
        if m:
            B["rat_" + m.group(1)] = [num(m.group(2))]
    # TNB15 Bilanz
    lines15 = S.get("t15", [])
    for key, lab in BILANZ_L:
        for ln in lines15:
            m = re.match(r"^" + lab + r" (-?[\d.,]+) (-?[\d.,]+)", ln)
            if m:
                B[key] = [num(m.group(1)), num(m.group(2))]
                break
    for key, lab, nth in BILANZ_R:
        k = 0
        for ln in lines15:
            m = re.search(r"(?:^|[\d,] )" + lab + r" (-?[\d.,]+) (-?[\d.,]+)$", ln)
            if m:
                if k == nth:
                    B[key] = [num(m.group(1)), num(m.group(2))]
                    break
                k += 1
    for ln in lines15:
        m = re.match(r"^Bilanzsumme .* (-?[\d.,]+) (-?[\d.,]+)$", ln)
        if m:
            B["t15_bsp"] = [num(m.group(1)), num(m.group(2))]
    return B


def main():
    pdf = sys.argv[1]
    txt = subprocess.run(["pdftotext", "-layout", pdf, "-"], capture_output=True, text=True, check=True).stdout
    print(json.dumps(parse(txt), ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
