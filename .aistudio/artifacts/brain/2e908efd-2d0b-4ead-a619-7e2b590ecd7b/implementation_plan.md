# SatoshiPulse: Korrektur der Kaufdatumserkennung & automatisches Datums-Update

Der Nutzer hat festgestellt, dass importierte Transaktionen in der App das Datum des Imports anstelle des tatsächlichen Kaufdatums aus der Bitvavo-CSV anzeigen. Ziel dieses Plans ist es, den Datums-Parser plattform- und browserunabhängig abzusichern, bestehende Transaktionen beim Re-Import automatisch mit dem echten Kaufdatum zu aktualisieren und die Datumsanzeige in der Transaktionstabelle auf das deutsche Format (`TT.MM.JJJJ [HH:mm]`) umzustellen.

---

## 1. Ursachenanalyse der falschen Datumsangabe

1. **Browser-Inkompatibilität bei `new Date("YYYY-MM-DD HH:mm:ss")`**:
   - In Safari (macOS / iOS / WebKit) und bestimmten Browser-Engines liefert `new Date("2024-03-05 09:12:00")` ein ungültiges Datum (`Invalid Date` / `NaN`).
   - Der bisherige Parser fiel bei `isNaN(ts)` stillschweigend auf `new Date().toISOString().split('T')[0]` zurück – das exakte Datum des heutigen Imports.
2. **Europäische & getrennte Datumsspalten**:
   - Bitvavo und deutsche Excel-Exporte nutzen teils `DD-MM-YYYY`, `DD.MM.YYYY`, `DD/MM/YYYY` oder getrennte Spalten `Date` und `Time`.
   - UTF-8 BOM-Zeichen (`\uFEFF`) am Dateianfang können zudem Spaltennamen wie `\uFEFFDate` verfälschen.
3. **Duplikat-Sperre beim Re-Import**:
   - Bisher verhinderte die Duplikatprüfung das Aktualisieren vorhandener Einträge, sodass fälschlicherweise datierte Einträge nicht überschrieben werden konnten.

---

## 2. Geplante Änderungen & Architektur

### A. Robuster, browserunabhängiger Datums-Parser (`src/utils/csvParser.ts`)
- **BOM-Entfernung**: Bereinigung von Byte Order Marks (`\uFEFF`) am Header und in Token.
- **Mehrstufiger Datums- & Zeit-Parser**:
  - Zerlegung von Datums- und Uhrzeitkomponenten mittels dedizierter Regex statt nativer Browser-`Date`-Konstruktor-Raten:
    - ISO: `YYYY-MM-DD` mit optionaler Uhrzeit `HH:mm[:ss]`
    - Deutsches Format: `DD.MM.YYYY` mit optionaler Uhrzeit `HH:mm[:ss]`
    - Europäischer Schrägstrich: `DD/MM/YYYY` mit optionaler Uhrzeit
    - Bindestrich-Format: `DD-MM-YYYY` mit optionaler Uhrzeit
    - Timestamp (Sekunden oder Millisekunden)
  - Zusammensetzen eines validen ISO-Zeitstempels (`YYYY-MM-DDTHH:mm:ssZ`) und exaktem Unix-Millisekunden-Zeitstempel.
  - Wenn eine Zeitspalte vorliegt, wird diese exakt mit Stunde, Minute und Sekunde eingepflegt.

### B. Automatisches Datums-Update beim Re-Import (`src/components/CsvImportModal.tsx`)
- Erkennung bereits importierter Transaktionen anhand von Order-ID oder exakter Übereinstimmung von Betrag, Kaufpreis und Typ.
- Bereitstellung einer klaren Option im Import-Dialog:
  - **Option 1**: *"Bestehende Transaktionen mit echtem Kaufdatum aktualisieren"* (nutzt die Antworten des Nutzers).
  - **Option 2**: *"Nur neue Transaktionen hinzufügen"*.
  - **Option 3**: *"Bisherige Transaktionen komplett durch diese CSV ersetzen"*.
- Anzeige einer Vorher-Nachher-Vorschau mit dem erkannten Kaufdatum (z. B. `12.11.2023, 10:14 Uhr`).

### C. Persistenz in Firebase & LocalStorage (`src/components/PortfolioView.tsx`)
- Aktualisierung der Datums- und Zeitstempelfelder in Firestore (`users/{uid}/transactions/{id}`) und im LocalStorage.
- Chronologische Neusortierung aller Bestände nach dem echten Kaufdatum für eine lückenlose steuerliche und zeitliche Bilanzierung.
- Bereitstellung eines manuellen Bearbeitungs-Modus (Datum per Date-Picker anpassen), falls einzelne Einträge korrigiert werden sollen.

### D. Darstellung im deutschen Datumsformat (`src/components/PortfolioView.tsx`)
- Formatierungsfunktion `formatGermanDate(dateStr, timeStr?)`:
  - Ausgabe: `TT.MM.JJJJ` (z. B. `12.11.2023`) oder `TT.MM.JJJJ, HH:mm Uhr` (z. B. `12.11.2023, 10:14 Uhr`).
  - Ersetzung der bisherigen rohen ISO-Ausgabe (`YYYY-MM-DD`) in der Tabelle und im Portfolio-Audit.

---

## 3. Test- & Validierungsplan
1. Import der Bitvavo-Sample-Daten und Überprüfung, dass das historische Kaufdatum (z. B. `12.11.2023`) statt des heutigen Tages angezeigt wird.
2. Re-Import-Test: Aktualisierung bestehender Transaktionen ohne Duplikat-Fehler.
3. Plattform-Check: Sicherstellen, dass Safari, Chrome und Firefox identische Zeitstempel parsen.
4. Überprüfung der Firestore-Synchronisierung und fehlerfreie Kompilierung (`compile_applet`).
