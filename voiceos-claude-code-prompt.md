# Claude Code Prompt: VoiceOS - Voice Intelligence Desktop App

## Kontext

Du bist ein erfahrener Software-Architekt und Planer. Ich möchte eine Desktop-Anwendung namens **VoiceOS** entwickeln, die bei einem Wettbewerb unter die Top 3 kommen soll. Die App soll Spracheingaben intelligent verarbeiten und mit einem persönlichen Wissenskontext anreichern.

## ⚠️ WICHTIG: Design-Philosophie

**Die UI muss MODERN, MINIMALISTISCH und AUFGERÄUMT sein!**

Orientiere dich an:
- **Linear** (clean, viel Whitespace, subtle Animationen)
- **Raycast** (schnell, fokussiert, keyboard-first)
- **Arc Browser** (modern, elegant, innovativ)
- **Notion** (aufgeräumt, klare Hierarchie)

**Design-Prinzipien:**
- Weniger ist mehr – nur das Nötigste zeigen
- Viel Whitespace, Luft zum Atmen
- Subtle Animationen (keine überladenen Effekte)
- Monochrom mit einem Akzent-Farbton
- Klare Typografie-Hierarchie
- Glassmorphism / Blur-Effekte dezent einsetzen
- Dark Mode als Default (optional Light Mode)
- Keine visuellen Ablenkungen
- Fokus auf Content, nicht auf Chrome

---

## Projekt-Ziel

Entwickle eine Desktop-Anwendung, die:
1. Spracheingaben aufnimmt und transkribiert
2. Den Inhalt intelligent analysiert und den passenden Output-Typ erkennt
3. Relevante Informationen automatisch in einer Knowledge Base speichert
4. Gespeichertes Wissen bei späteren Anfragen kontextbezogen nutzt
5. Visuell beeindruckt durch einen Live Knowledge Graph

---

## Kern-Features

### 1. Dual-Mode System: Privat & Beruflich
- Zwei komplett getrennte Kontexte/Knowledge Bases
- Unterschiedliche Schreibstile pro Modus
- Einfaches Umschalten per UI-Toggle oder Voice-Command
- Getrennte Embeddings und Einstellungen

### 2. Smart Output Detection
Die App erkennt automatisch den Aufgabentyp und generiert passenden Output:

| Erkannter Typ | Output-Format |
|---------------|---------------|
| E-Mail | Vollständige E-Mail mit Betreff, Anrede, Inhalt, Grußformel |
| Meeting-Notiz | Strukturierte Notiz mit Datum, Teilnehmer, Punkte, Action Items |
| Aufgabe/Todo | Task mit Titel, Beschreibung, Deadline, Priorität |
| Frage | Direkte Antwort basierend auf Knowledge Base |
| Idee/Brainstorm | Strukturierte Ideensammlung |
| Zusammenfassung | Kompakte Summary |
| Code-Anfrage | Code-Snippet mit Erklärung |

### 3. Intelligente Knowledge Base mit Relevanz-Filterung

**Automatisches Speichern von:**
- Projekt-Informationen (Namen, Technologien, Budgets)
- Personen & Kontakte (Namen, Rollen, Beziehungen)
- Termine & Deadlines
- Entscheidungen & Fakten
- Präferenzen & wiederkehrende Muster

**Automatisches Ignorieren von:**
- Smalltalk ("Wie ist das Wetter?")
- Einmal-Anfragen ohne Kontext-Wert
- Redundante/bereits bekannte Informationen

**Relevanz-Scoring:**
- Jeder Eintrag bekommt einen Relevanz-Score
- Score basiert auf: Häufigkeit der Nutzung, Aktualität, Verknüpfungen
- Alte/ungenutzte Einträge werden herabgestuft

### 4. 🌟 KILLER-FEATURE: Live Knowledge Graph Visualisierung

**Echtzeit-Visualisierung während des Sprechens:**
- Neue Entitäten erscheinen als Nodes
- Verbindungen werden automatisch erkannt und gezeichnet
- Animierte Übergänge wenn neue Informationen hinzukommen
- Verschiedene Node-Typen: Personen, Projekte, Technologien, Termine, etc.
- Farbkodierung nach Kategorie
- Click auf Node zeigt Details

**Beispiel-Flow:**
```
User sagt: "Das Projekt Alpha nutzt SAP S4HANA, 
            Ansprechpartnerin ist Frau Weber, 
            Budget liegt bei 80.000 Euro"

→ Graph zeigt LIVE:
  - Node "Projekt Alpha" erscheint (zentral)
  - Node "SAP S4HANA" erscheint, verbindet sich mit Alpha
  - Node "Frau Weber" erscheint, verbindet sich mit Alpha
  - Node "80.000€" erscheint, verbindet sich mit Alpha
```

### 5. 🌟 KILLER-FEATURE: Smart Suggestions während des Sprechens

**Proaktive Kontext-Einblendung:**
- Während der User spricht, sucht die App in Echtzeit nach relevantem Kontext
- Zeigt Sidebar mit gefundenen Informationen
- Keine manuelle Suche nötig

**Beispiel:**
```
User beginnt: "Ich muss Frau Weber noch wegen..."

→ App zeigt sofort:
  ┌─────────────────────────────┐
  │ 📎 Kontext zu "Frau Weber": │
  │ • Projekt Alpha             │
  │ • Letzte Erwähnung: 12.01.  │
  │ • Rolle: Ansprechpartnerin  │
  │ • Offenes Thema: Kick-off   │
  └─────────────────────────────┘
```

### 6. 🌟 KILLER-FEATURE: Output-Varianten zur Auswahl

**Drei Varianten für jeden Output:**
- **Kurz & Direkt:** Minimalistisch, auf den Punkt
- **Standard:** Ausgewogen, professionell
- **Ausführlich:** Mit allen Details und Kontext

User kann:
- Eine Variante auswählen
- Per Voice anpassen ("Mach es formeller")
- Neu generieren lassen

### 7. Voice-Shortcut Commands

Schnelle Aktionen durch Keyword-Erkennung:

| Keyword | Aktion |
|---------|--------|
| "Merke: ..." | Speichert Information ohne Output |
| "Mail an [Person]: ..." | Startet E-Mail-Modus |
| "Aufgabe: ..." | Erstellt Todo |
| "Was weiß ich über [X]?" | Knowledge-Abruf |
| "Fasse zusammen: ..." | Summary-Modus |
| "Vergiss [X]" | Löscht aus Knowledge Base |
| "Wechsel zu privat/beruflich" | Kontext-Switch |

### 8. Hotkey-Aktivierung

- Globaler Hotkey (z.B. `Cmd+Shift+Space` / `Ctrl+Shift+Space`)
- Modifier für verschiedene Modi:
  - Standard-Hotkey → Smart Mode (Auto-Detect)
  - Hotkey + Alt → Nur speichern (kein Output)
  - Hotkey + Shift → Nur abfragen (kein Speichern)

---

## Tech-Stack

### Frontend & Desktop Runtime
- **Electron** (mit Electron Forge oder Electron Builder)
- **Next.js 14+** (App Router) – als Renderer
- **React 18** mit TypeScript (strict mode)
- **Tailwind CSS** für Styling
- **Framer Motion** für smooth Animationen
- **Radix UI** oder **shadcn/ui** für accessible, unstyled Komponenten

### UI/Design System
- **Inter** oder **Geist** Font (modern, clean)
- Custom Design Tokens (Colors, Spacing, Typography)
- CSS Variables für Theming
- Subtle Glassmorphism mit `backdrop-blur`
- Smooth Transitions (150-300ms ease-out)

### Knowledge Graph Visualisierung
- **React Flow** für Graph-Rendering (customizable, performant)
- Custom minimalistisch gestylte Nodes
- Subtle Animationen bei neuen Nodes
- Force-directed Layout mit sanften Übergängen

### Voice Processing
- **Whisper** via Groq API (extrem schnell, ~0.3s Latenz)
- Web Audio API für Aufnahme
- Optional: Lokale Keyword-Detection für schnellere Reaktion

### LLM Integration
- **Gemini Flash 2.0** für schnelle Tasks (Output-Generierung)
- **Claude API** als Fallback für komplexe Analyse (optional)
- Smart Routing basierend auf Task-Komplexität

### Datenbank & Vector Storage
- **LanceDB** (embedded, Rust-native) für lokale Vector-Suche
- **Convex** für Cloud-Sync und Backup (optional)
- Lokale Embeddings mit `all-MiniLM-L6-v2` oder `nomic-embed-text`

### Backend (Electron Main Process)
- Globale Hotkey-Registrierung (`globalShortcut`)
- System Tray Integration
- IPC zwischen Main und Renderer Process
- Lokale Datei-Persistenz mit `electron-store`
- Auto-Updater für Distribution

---

## Architektur-Anforderungen

### Daten-Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   [Hotkey] → [Audio Capture] → [Whisper API] → [Transkript]    │
│                                                                 │
│                              ↓                                  │
│                                                                 │
│              ┌───────────────────────────────┐                  │
│              │      Intent Classifier        │                  │
│              │  (Keyword + LLM Detection)    │                  │
│              └───────────────┬───────────────┘                  │
│                              │                                  │
│         ┌────────────────────┼────────────────────┐             │
│         ↓                    ↓                    ↓             │
│   ┌──────────┐        ┌──────────┐        ┌──────────┐         │
│   │ SPEICHERN│        │GENERIEREN│        │ ABFRAGEN │         │
│   │ "Merke"  │        │ Mail,    │        │ "Was     │         │
│   │          │        │ Todo,etc │        │  weiß"   │         │
│   └────┬─────┘        └────┬─────┘        └────┬─────┘         │
│        │                   │                   │                │
│        ↓                   ↓                   ↓                │
│   ┌─────────────────────────────────────────────────┐          │
│   │              Knowledge Base (LanceDB)           │          │
│   │                                                 │          │
│   │  [Privat-Kontext]    |    [Beruflich-Kontext]  │          │
│   │                                                 │          │
│   └─────────────────────────────────────────────────┘          │
│                              │                                  │
│                              ↓                                  │
│              ┌───────────────────────────────┐                  │
│              │     LLM Processing Layer      │                  │
│              │  (Gemini Flash / Claude API)  │                  │
│              └───────────────┬───────────────┘                  │
│                              │                                  │
│                              ↓                                  │
│              ┌───────────────────────────────┐                  │
│              │         UI Output             │                  │
│              │  - 3 Varianten                │                  │
│              │  - Knowledge Graph Update     │                  │
│              │  - Copy/Paste Actions         │                  │
│              └───────────────────────────────┘                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### UI-Komponenten (Minimalistisch!)

1. **Main Window**
   - Frameless Window mit custom Titlebar
   - Floating, Always-on-Top (togglebar)
   - Rounded Corners (12-16px)
   - Subtle Shadow + Border
   - Maximale Breite: ~600px (fokussiert, nicht überladen)
   - Dark glassmorphism Background

2. **Voice Recording State**
   ```
   ┌──────────────────────────────────────────┐
   │                                          │
   │              ◉                           │
   │         Recording...                     │
   │                                          │
   │     ░░░░░░░░░░░░░░░░░░░░  2.4s          │
   │     (minimale Waveform)                  │
   │                                          │
   │         [Esc to cancel]                  │
   │                                          │
   └──────────────────────────────────────────┘
   ```
   - Pulsierender Dot (subtle)
   - Minimale Waveform (nicht übertrieben)
   - Nur Timer + Escape-Hint

3. **Knowledge Graph Panel**
   ```
   ┌──────────────────────────────────────────┐
   │  Knowledge                    [+] [⚙]   │
   │──────────────────────────────────────────│
   │                                          │
   │         ┌───────┐                        │
   │         │Project│                        │
   │         │ Alpha │                        │
   │         └───┬───┘                        │
   │      ┌──────┼──────┐                     │
   │      │      │      │                     │
   │   ┌──┴──┐┌──┴──┐┌──┴──┐                 │
   │   │ SAP ││Weber││ 80k │                 │
   │   └─────┘└─────┘└─────┘                 │
   │                                          │
   └──────────────────────────────────────────┘
   ```
   - Monochrome Nodes mit subtle Borders
   - Akzentfarbe nur für neue/aktive Nodes
   - Smooth Zoom/Pan
   - Minimal Labels

4. **Output Panel**
   ```
   ┌──────────────────────────────────────────┐
   │  Output                                  │
   │──────────────────────────────────────────│
   │                                          │
   │  ┌─ Kurz ─┐  ┌─ Standard ─┐  ┌─ Lang ─┐ │
   │  │   ●    │  │            │  │        │ │
   │  └────────┘  └────────────┘  └────────┘ │
   │                                          │
   │  ─────────────────────────────────────── │
   │                                          │
   │  Betreff: Kick-off Meeting Projekt Alpha │
   │                                          │
   │  Sehr geehrte Frau Weber,                │
   │                                          │
   │  ich möchte gerne...                     │
   │                                          │
   │  ─────────────────────────────────────── │
   │                                          │
   │      [Copy]  [Edit]  [↻ Regenerate]      │
   │                                          │
   └──────────────────────────────────────────┘
   ```
   - Tab-Style Varianten-Auswahl (nicht 3 nebeneinander)
   - Ghost Buttons
   - Subtle Dividers
   - Monospace für Output-Text optional

5. **Context Sidebar (Slide-in)**
   ```
   ┌─────────────────────┐
   │  Relevant Context   │
   │─────────────────────│
   │                     │
   │  ○ Frau Weber       │
   │    Project Alpha    │
   │    Ansprechpartner  │
   │                     │
   │  ○ Budget: 80k      │
   │    Erwähnt: 2x      │
   │                     │
   │  ○ Deadline         │
   │    März 2025        │
   │                     │
   └─────────────────────┘
   ```
   - Slide-in von rechts
   - Transparent/Blur Background
   - Kompakte Darstellung
   - Auto-hide wenn nicht relevant

6. **Settings (Modal)**
   - Clean Modal mit Sections
   - Toggle Switches statt Checkboxen
   - Input Fields mit subtle Borders
   - Keine überladenen Formulare

### Design Tokens (Beispiel)

```css
:root {
  /* Colors - Dark Theme */
  --bg-primary: #0a0a0b;
  --bg-secondary: #141415;
  --bg-elevated: #1c1c1e;
  --bg-glass: rgba(28, 28, 30, 0.8);
  
  --text-primary: #ffffff;
  --text-secondary: #a1a1a6;
  --text-tertiary: #6e6e73;
  
  --accent: #6366f1;  /* Indigo als Akzent */
  --accent-subtle: rgba(99, 102, 241, 0.15);
  
  --border: rgba(255, 255, 255, 0.08);
  --border-focus: rgba(255, 255, 255, 0.2);
  
  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  
  /* Radii */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  
  /* Transitions */
  --transition-fast: 150ms ease-out;
  --transition-normal: 250ms ease-out;
}
```

---

## Aufgabe für dich

1. **Analysiere** diese Anforderungen auf Vollständigkeit und technische Machbarkeit
2. **Erstelle** eine detaillierte Projektstruktur (Ordner, Dateien)
3. **Definiere** die Datenmodelle (TypeScript Interfaces)
4. **Plane** die Implementierung in sinnvolle Phasen/Milestones
5. **Identifiziere** potenzielle Risiken und schlage Lösungen vor
6. **Erstelle** einen Zeitplan für die Umsetzung

---

## Constraints

- Die App muss als Desktop-Anwendung laufen (Electron)
- Next.js muss die Basis bilden (Wettbewerbs-Anforderung)
- Hotkey-Aktivierung ist Pflicht
- Privacy-First: Lokale Datenspeicherung bevorzugt
- Performance: Schnelle Reaktionszeiten (<2s von Sprache zu Output)
- **UI muss minimalistisch und modern sein – keine überladenen Interfaces!**
- Dark Mode als primäres Theme

---

## Qualitätskriterien für Top 3

- **Innovation:** Features die andere nicht haben (Live Graph, Smart Suggestions)
- **Technische Exzellenz:** Saubere Architektur, moderne Tools
- **UX:** Intuitiv, schnell, visuell ansprechend
- **Demo-Effekt:** Im 2-3 Min Video muss der Wow-Moment klar sein
- **Praktischer Nutzen:** Nicht nur Demo, sondern echtes Tool

---

## Starte mit:

1. Projektstruktur erstellen (Electron + Next.js Setup)
2. Design System / UI Foundation aufsetzen
3. Architektur-Dokumentation
4. Datenmodelle definieren
5. Implementierungsplan mit Phasen

---

## UI Inspiration & Referenzen

**DO (So soll es aussehen):**
- Linear.app – Clean, fast, keyboard-first
- Raycast – Minimalistisches Launcher-Design  
- Craft.do – Elegante Typografie
- Things 3 – Aufgeräumt, fokussiert
- Warp Terminal – Modern, dark, subtle gradients

**DON'T (Das vermeiden):**
- Überladene Dashboards mit zu vielen Elementen
- Bunte Icons überall
- Borders und Boxen um alles
- Große, plumpe Buttons
- Mehr als 2 Schriftgrößen gleichzeitig sichtbar
- Aggressive Farben / zu viel Kontrast

---

Bitte sei gründlich und denke an Edge Cases. Frage nach wenn etwas unklar ist.
