# VoiceOS - Voice-First Desktop Assistant

Eine Desktop-Anwendung, die gesprochene Eingaben in strukturierte, kontextbezogene Outputs transformiert.

## Das Problem

Im modernen Arbeitsalltag verbringen wir viel Zeit mit repetitiven Schreibaufgaben: E-Mails formulieren, Meeting-Notizen erstellen, To-Dos festhalten. Gleichzeitig ist Sprache unser natürlichstes Kommunikationsmittel - deutlich schneller als Tippen.

VoiceOS schließt diese Lücke: Sprechen Sie Ihre Gedanken aus, und die App verwandelt sie in professionellen, formatiertem Output - angepasst an Ihren Kontext und Arbeitsstil.

## Features

- **Hotkey-Aktivierung**: `Cmd+Shift+Space` aktiviert die App sofort aus jedem Workflow
- **Voice-Pipeline**: Aufnahme → Transkription (Groq Whisper) → Enrichment (Google Gemini)
- **Intelligente Output-Typen**: E-Mail, Meeting-Notes, To-Do, Notizen, Zusammenfassung, u.v.m.
- **Meeting-Modus**: Lange Aufnahmen mit automatischer Chunk-Verarbeitung
- **Knowledge Base**: Persönliches Wissen merken und automatisch in Outputs einbeziehen
- **macOS-Integration**: Direkte Erstellung von Kalendereinträgen, Erinnerungen und Notizen
- **Personalisierung**: Anpassung an Job, Branche, Formalitätsgrad und Schreibstil

## Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Global       │  │ Tray Menu    │  │ Native           │  │
│  │ Hotkeys      │  │ & Window     │  │ Integrations     │  │
│  │ (Cmd+Shift+  │  │ Management   │  │ (Calendar,       │  │
│  │  Space)      │  │              │  │  Reminders)      │  │
│  └──────┬───────┘  └──────────────┘  └──────────────────┘  │
│         │                                                    │
│         │ IPC Bridge (contextBridge)                        │
└─────────┼───────────────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────────────┐
│                   Next.js Renderer Process                   │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    Voice Pipeline                       │ │
│  │                                                         │ │
│  │  ┌─────────┐    ┌─────────────┐    ┌────────────────┐  │ │
│  │  │ Record  │───►│ Transcribe  │───►│ Enrich/Generate│  │ │
│  │  │ (Web    │    │ (Groq       │    │ (Gemini API)   │  │ │
│  │  │  Audio) │    │  Whisper)   │    │                │  │ │
│  │  └─────────┘    └─────────────┘    └────────────────┘  │ │
│  │       │                                     │           │ │
│  │       ▼                                     ▼           │ │
│  │  Waveform &                          Knowledge Base     │ │
│  │  Silence Detection                   Context Injection  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ Zustand Stores  │  │ Shortcut        │                   │
│  │ (State Mgmt)    │  │ Detection       │                   │
│  │                 │  │ ("merke: ...")  │                   │
│  └─────────────────┘  └─────────────────┘                   │
└──────────────────────────────────────────────────────────────┘
```

### Technologie-Stack

| Komponente | Technologie |
|------------|-------------|
| Desktop Runtime | Electron 40 |
| Frontend | Next.js 16 + React 19 |
| State Management | Zustand |
| Transkription | Groq Whisper API |
| Text-Generierung | Google Gemini API |
| Styling | TailwindCSS 4 |
| Build | Electron Vite |
| Sprache | TypeScript |

## Setup

### Voraussetzungen

- Node.js 20+
- pnpm
- macOS (für native Integrationen) oder Windows/Linux (ohne native Integrationen)

### Installation

```bash
# Repository klonen
git clone <repo-url>
cd everlast

# Dependencies installieren
pnpm install

# Environment-Variablen konfigurieren
cp .env.example .env.local
```

### Environment-Variablen

```env
# Groq API für Transkription (Whisper)
GROQ_API_KEY=your_groq_api_key

# Google Gemini API für Text-Generierung
GEMINI_API_KEY=your_gemini_api_key
```

### Entwicklung

```bash
# App im Development-Modus starten
pnpm dev
```

### Production Build

```bash
# macOS App bauen
pnpm build:mac

# Windows App bauen
pnpm build:win
```

## Verwendung

1. **App starten** - Die App läuft im Hintergrund mit Tray-Icon
2. **Hotkey drücken** - `Cmd+Shift+Space` (macOS) oder `Ctrl+Shift+Space` (Windows)
3. **Sprechen** - z.B. "Schreib eine E-Mail an Thomas, dass das Meeting auf Donnerstag verschoben wird"
4. **Ergebnis erhalten** - Formatierte E-Mail mit Copy, Export und Integrations-Optionen

### Sprachbefehle

- `"Merke: Hans arbeitet bei Siemens"` → Speichert in Knowledge Base
- `"Was weiß ich über Hans?"` → Sucht in Knowledge Base


### Hotkeys

| Hotkey | Aktion |
|--------|--------|
| `Cmd+Shift+Space` | Aktivieren & Aufnahme starten |
| `Escape` | Aufnahme stoppen |
| `Cmd+C` | Output kopieren |

## Design-Entscheidungen

### Warum Electron?

- **Electron**: Ermöglicht globale Hotkeys, Tray-Integration und native macOS-APIs (AppleScript)

### Warum Groq Whisper + Gemini?

- **Groq Whisper**: Extrem schnelle Transkription (unter 1 Sekunde für kurze Aufnahmen), exzellente deutsche Spracherkennung
- **Google Gemini**: Starke kontextuelle Verarbeitung, gute Instruction-Following, kostengünstig
- **Trennung**: Ermöglicht unabhängige Skalierung und Austausch einzelner Komponenten

### Warum Knowledge Base?

- **Kontext ist alles**: Eine E-Mail an "Thomas" ist nur nützlich, wenn die App weiß, wer Thomas ist
- **Lernende App**: Je mehr Kontext, desto bessere Outputs
- **Duplikat-Erkennung**: Automatische Bereinigung verhindert Redundanzen

### Warum Voice Shortcuts?

- **Schnelligkeit**: Direktbefehle wie "Merke: ..." umgehen die AI-Generierung
- **Natürlichkeit**: Sprachliche Befehle fühlen sich natürlicher an als UI-Buttons
- **Flexibilität**: Patterns sind leicht erweiterbar

### Immutable State Pattern

- **Zustand mit Immutability**: Alle State-Updates erzeugen neue Objekte statt Mutationen
- **Vorteile**: Einfacheres Debugging, zuverlässige React-Updates, bessere Testbarkeit

## Projektstruktur

```
├── app/                    # Next.js App Router
│   ├── api/               # API Routes (transcribe, generate)
│   └── page.tsx           # Main UI
├── components/            # React Components
│   ├── meeting/          # Meeting-Modus UI
│   ├── onboarding/       # Onboarding Wizard
│   └── ...
├── electron/              # Electron Main Process
│   ├── main.ts           # App Entry, Hotkeys, IPC
│   └── preload.ts        # Context Bridge
├── lib/                   # Shared Logic
│   ├── ai/               # Gemini Client
│   ├── audio/            # Recording, Processing
│   ├── knowledge/        # Knowledge Base
│   └── transcription/    # Groq Queue
├── stores/                # Zustand State Management
└── types/                 # TypeScript Interfaces
```

## Lizenz

MIT
