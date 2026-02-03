# Video-Skript: VoiceOS Vorstellung (2-3 Minuten)

## Zeitplan

| Abschnitt | Dauer | Kumuliert |
|-----------|-------|-----------|
| Intro & Problemstellung | 30s | 0:30 |
| Live-Demo | 60s | 1:30 |
| Architektur-Überblick | 30s | 2:00 |
| Besondere Features | 30s | 2:30 |
| Abschluss | 15s | 2:45 |

---

## 1. Intro & Problemstellung (30 Sekunden)

**Vorstellung:**
> "Hi, ich bin Max. Ich zeige euch heute VoiceOS - eine Desktop-App, die ich für die JARVIS Challenge entwickelt habe."

**Das Problem:**
> "Wir alle kennen das: Man sitzt im Meeting, hat eine Idee, und bis man die E-Mail getippt hat, ist der Gedanke halb vergessen. Oder man möchte schnell eine To-Do erstellen, aber muss erst die richtige App öffnen, Felder ausfüllen..."

**Die Lösung:**
> "VoiceOS löst das: Einfach sprechen, und die App macht daraus eine fertige E-Mail, Meeting-Notiz, oder To-Do - angepasst an meinen Kontext."

---

## 2. Live-Demo (60 Sekunden)

### Demo 1: Einfache E-Mail (20s)

**Action:** Drücke `Cmd+Shift+Space`, sprich:
> "Schreib eine E-Mail an Thomas, dass wir das Meeting auf nächsten Donnerstag verschieben müssen wegen eines Kundentermins."

**Zeigen:**
- Die Aufnahme-Animation
- Das Transkript erscheint
- Die formatierte E-Mail wird generiert
- Klick auf "Kopieren"

**Sagen:**
> "Mit einem Hotkey aktiviere ich die App, spreche meinen Gedanken, und bekomme sofort eine professionell formulierte E-Mail."

### Demo 2: Knowledge Base (20s)

**Action:** Drücke Hotkey, sprich:
> "Merke: Thomas arbeitet bei der Firma Siemens und ist mein Ansprechpartner für das Projekt Alpha."

**Zeigen:**
- Bestätigung erscheint
- Eventuell kurz in Settings die Knowledge Base zeigen

**Sagen:**
> "Die App hat eine Knowledge Base. Alles was ich ihr sage zu merken, fließt automatisch in zukünftige Outputs ein. Wenn ich jetzt wieder eine E-Mail an Thomas diktiere, weiß die App wer er ist."

### Demo 3: Meeting-Modus (20s)

**Action:** Meeting-Modus kurz zeigen

**Sagen:**
> "Für längere Aufnahmen gibt es den Meeting-Modus. Er transkribiert in Echtzeit und generiert am Ende strukturierte Meeting-Notizen mit Entscheidungen und Action Items."

---

## 3. Architektur-Überblick (30 Sekunden)

**Zeigen:** Entweder Architektur-Diagramm oder Code kurz einblenden

**Sagen:**
> "Technisch basiert VoiceOS auf Electron und Next.js. Die Voice-Pipeline hat drei Stufen:
> 1. Aufnahme mit der Web Audio API
> 2. Transkription über Groq Whisper - extrem schnell
> 3. Enrichment über Google Gemini, das den Text in strukturierte Outputs verwandelt.
>
> Der Hotkey ist global registriert, sodass ich die App aus jedem Programm heraus aktivieren kann."

---

## 4. Besondere Features (30 Sekunden)

**Sagen:**
> "Einige Highlights:
> - **Personalisierung**: Die App passt sich an meinen Job, meine Branche und meinen Schreibstil an
> - **Native macOS-Integration**: Kalendereinträge und Erinnerungen werden direkt in den Apple-Apps erstellt
> - **Sprachbefehle**: 'Merke', 'Was weiß ich über', 'Vergiss' - natürliche Kommandos ohne Wartezeit
> - **Offline-Verlauf**: Alle meine Outputs bleiben lokal gespeichert"

---

## 5. Abschluss (15 Sekunden)

**Sagen:**
> "VoiceOS ist mein Ansatz, Voice-First produktiv zu machen - nicht als Spielerei, sondern als echtes Werkzeug im Arbeitsalltag. Danke fürs Zuschauen!"

---

## Tipps für die Aufnahme

1. **Umgebung**: Ruhiger Raum, gutes Mikrofon
2. **Bildschirm**: Aufnahme mit OBS oder QuickTime, 1080p
3. **Geschwindigkeit**: Nicht hetzen, lieber etwas kürzen
4. **Demo vorbereiten**: Die Beispiel-Prompts vorher testen
5. **Backup**: Falls die API langsam ist, vorbereitete Screenshots haben
6. **Natürlich sprechen**: Kein Ablesen, lieber frei formulieren

## Checkliste vor Aufnahme

- [ ] API Keys funktionieren (Groq + Gemini)
- [ ] App startet ohne Fehler
- [ ] Mikrofon ist richtig eingestellt
- [ ] Knowledge Base ist leer oder hat relevante Demo-Daten
- [ ] Bildschirmaufnahme läuft
- [ ] Handy auf stumm

## Alternative Sprachbefehle für Demo

Falls einer nicht gut klappt:

**E-Mail:**
- "Schreib eine kurze E-Mail an das Team, dass ich heute im Homeoffice bin"
- "Formuliere eine Absage für das Meeting morgen, ich bin krank"

**To-Do:**
- "Erstell eine To-Do Liste für die Woche: Präsentation vorbereiten, Bericht abschließen, mit Marketing abstimmen"

**Notiz:**
- "Notiz zum Kundengespräch: Kunde möchte Liefertermin um zwei Wochen vorziehen, Budget steht"

**Knowledge:**
- "Merke: Mein Chef heißt Dr. Schmidt und bevorzugt kurze, sachliche E-Mails"
- "Was weiß ich über das Projekt Alpha?"
