# SatoshiPulse: Interaktive Spaltenzuordnung & Korrektur des BTC-Bestands

## Problemursache
Der Nutzer hat eine eigene Excel-Tabelle als CSV mit 24 Käufen importiert. Die tatsächliche Gesamtsumme beträgt **0.3136 BTC**, in der App wurde jedoch ein Gesamtbestand von **24.3136 BTC** berechnet – exakt 24 BTC (also 1.0 BTC pro Zeile) zu viel.
Dies tritt auf, wenn in einer Excel-Tabelle eine Zähl- oder Mengenspalte wie `Anzahl` (Wert `1`) oder eine Stückzahlspalte fälschlicherweise als BTC-Menge erkannt wurde, während der eigentliche BTC-Teilbetrag in einer anderen Spalte (z. B. `BTC`, `Betrag`, `Menge (BTC)`) lag.

Der Nutzer möchte vor dem Import die Spalten einsehen und manuell prüfen bzw. zuweisen können, um sicherzustellen, dass exakt die richtige Mengenspalte ausgewählt wird.

---

## Vorgeschlagene Änderungen

### 1. Interaktive Spalten-Zuordnung & Live-Vorschau im CSV-Import (`CsvImportModal.tsx`)
- **Schrittweise oder aufklappbare Spaltenprüfung vor dem Import:**
  - Automatische Vorbelegung der Spalten anhand intelligenter Heuristiken (bevorzugt Spalten mit Dezimalwerten / `btc` im Header gegenüber reinen Zählspalten wie `Anzahl = 1`).
  - **Manuelle Dropdown-Auswahl** für alle relevanten Felder:
    - **BTC-Menge / Betrag** *(Pflichtfeld)*
    - **Kaufdatum** *(Pflichtfeld)*
    - **Uhrzeit** *(optional)*
    - **Typ (Kauf / Verkauf)** *(optional oder manuell auf "Kauf" fixierbar)*
    - **Kurs / Preis pro BTC** *(optional, falls Gesamtbetrag vorhanden)*
    - **Gesamtbetrag (EUR/USD)** *(optional, falls Kurs vorhanden)*
    - **Gebühr** *(optional)*
  - **Werte-Vorschau pro Spalte:** Direkt unter jedem Dropdown werden die ersten 3 Werte aus der CSV angezeigt (z. B. `0.01306 BTC`, `0.01050 BTC` statt `1`, `1`), sodass auf einen Blick ersichtlich ist, welche Spalte die echten BTC-Mengen enthält.
  - **Live-Berechnung der Gesamtsumme:** Ein prominenter Infokasten zeigt noch vor dem Import die berechnete Summe:
    `Berechneter Gesamtbestand: X.XXXX BTC aus Y Transaktionen`. Bei richtiger Spaltenwahl sieht der Nutzer sofort die korrekten **0.3136 BTC**!

### 2. Verbesserter Parser & Spalten-Erkennung (`src/utils/csvParser.ts`)
- Erweiterung der Parser-Logik um eine Trennung zwischen Rohzeilen-Extraktion (`extractCsvHeadersAndPreview`) und konfigurierbarem Zeilen-Mapping (`parseBitcoinCsvWithMapping`).
- Schutz vor falschen Ganzzahl-Matches: Spalten wie `Anzahl`, `Stück`, `Pos`, `Nr.` werden bei Vorhandensein von Dezimal-BTC-Spalten nicht als primäre Mengenspalte priorisiert.
- Unterstützung flexibler Kommaschreibweisen für deutsche Excel-Exporte (`0,01306` oder `0.01306`).

### 3. Bereinigung & Ersetzen des fehlerhaften Bestands (`PortfolioView.tsx`)
- **Option zum vollständigen Überschreiben / Bereinigen:**
  - Im Import-Modal wird explizit die Option angeboten:
    *„Bestehende Transaktionen vollständig durch die korrigierten Daten ersetzen (Empfohlen: setzt den Bestand von 24.31 auf 0.31 BTC zurück)“*.
  - Schnelle Ein-Klick-Möglichkeit in der Transaktionsliste, um den aktuellen fehlerhaften Datensatz zurückzusetzen oder direkt neu zu importieren.
- **Automatische Neuberechnung der Kennzahlen:**
  - Sofortige Aktualisierung des Portfoliowerts (bei ~90.000 $/BTC ca. 28.000 $ statt >2.000.000 $).
  - Aktualisierung der KI-Bestandsanalyse auf Basis des tatsächlichen Bestands von 0.3136 BTC.

---

## Verifizierungsplan

### Manuelle & UI-Tests
1. **CSV-Upload mit Spaltenauswahl:**
   - Test-CSV mit Spalten `Nr;Datum;Anzahl;Menge_BTC;Kurs;Gesamt` hochladen.
   - Prüfen, dass die Spaltenauswahl erscheint und die Vorschau für `Anzahl` (1) vs. `Menge_BTC` (0.01306...) anzeigt.
   - Verifizieren, dass die Live-Gesamtsumme oben exakt 0.3136 BTC anzeigt, sobald `Menge_BTC` gewählt ist.
2. **Import-Bestätigung & Überschreiben:**
   - Mit dem Modus „Transaktionen ersetzen“ bestätigen.
   - Verifizieren, dass in der Transaktionstabelle und im Dashboard exakt 0.3136 BTC und der reale Portfoliowert angezeigt werden.
   - Verifizieren, dass das deutsche Kaufdatum (TT.MM.JJJJ) erhalten bleibt.
3. **Build & Lint:**
   - Ausführen von `compile_applet` und `lint_applet` zur Fehlerfreiheit.
