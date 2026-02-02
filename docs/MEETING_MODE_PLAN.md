# Meeting Recording Mode - Implementierungsplan

## Übersicht

Meeting Recording Mode erweitert VoiceOS um die Fähigkeit, lange Meetings (30-60+ Minuten) aufzunehmen, live zu transkribieren und automatisch Meeting-Notizen zu generieren.

## Kern-Features

1. **Lange Aufnahmen** - Bis zu 120 Minuten
2. **Live-Transkription** - Chunks alle 30 Sekunden mit 5s Overlap
3. **Hintergrund-Aufnahme** - Läuft bei minimiertem Fenster weiter
4. **Speaker-Erkennung** - Heuristische Live-Erkennung + Post-Processing
5. **Automatische Meeting-Notizen** - Am Ende via Gemini generiert

---

## Architektur

```
┌─────────────────────────────────────────────────────────────────┐
│                     ELECTRON MAIN PROCESS                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  MeetingRecordingService                                  │  │
│  │  ├── AudioCaptureManager (Mikrofon + System Audio)        │  │
│  │  ├── ChunkedAudioProcessor (30s Chunks, 5s Overlap)       │  │
│  │  ├── FileStreamManager (Inkrementelle WAV-Speicherung)    │  │
│  │  └── BackgroundTranscriptionQueue                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │ IPC                               │
└──────────────────────────────┼───────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────┐
│                     RENDERER PROCESS (Next.js)                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  MeetingStore   │  │ TranscriptStore │  │  Meeting UI     │  │
│  │  (Zustand)      │  │  (Zustand)      │  │  Components     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementierungs-Phasen

### Phase 1: Types & Store-Infrastruktur (2-3 Stunden)
- `types/meeting.ts` - Alle Meeting-bezogenen Types
- `stores/meeting-store.ts` - Zustand Store für Meeting-State
- `stores/transcript-store.ts` - Transkript-Verwaltung
- App Settings erweitern

### Phase 2: Audio-Chunking & Memory Management (4-6 Stunden)
- `lib/audio/audio-chunk-manager.ts` - Chunk-Verwaltung mit Disk-Persistenz
- `lib/audio/meeting-recorder.ts` - Erweiterter Recorder für lange Aufnahmen
- Memory-Budget: Max 10 Chunks (~200MB) im RAM, Rest auf Disk

### Phase 3: Chunked Transkription (3-4 Stunden)
- `app/api/meeting/transcribe-chunk/route.ts` - API für Chunk-Transkription
- `lib/ai/meeting-transcription.ts` - Queue mit Rate-Limiting
- Kontext-Übergabe zwischen Chunks für bessere Kontinuität

### Phase 4: Live UI Komponenten (3-4 Stunden)
- `components/meeting/meeting-mode.tsx` - Haupt-Container
- `components/meeting/live-transcript.tsx` - Scrollbare Live-Anzeige
- `components/meeting/meeting-controls.tsx` - Start/Stop/Pause
- `components/meeting/speaker-timeline.tsx` - Sprecher-Visualisierung

### Phase 5: Meeting-Notizen Generierung (2-3 Stunden)
- `lib/ai/meeting-notes-generator.ts` - Gemini-basierte Notizen
- `app/api/meeting/generate-notes/route.ts` - API Endpoint
- Strukturierte Ausgabe: Zusammenfassung, Action Items, Entscheidungen

### Phase 6: Electron Integration (2-3 Stunden)
- `electron/main.ts` erweitern für Background Recording
- `electron/preload.ts` Meeting-APIs exponieren
- PowerSaveBlocker für unterbrechungsfreie Aufnahme

### Phase 7: Integration (1-2 Stunden)
- `app/page.tsx` - Meeting-Mode vs. Voice-Mode Switch
- Titlebar Meeting-Indikator
- Settings-Seite erweitern

### Phase 8: Speaker Diarization (Optional, 2-3 Stunden)
- Heuristische Erkennung (Pausen-basiert) für Live-Anzeige
- Post-Processing mit besserer Genauigkeit nach Meeting-Ende

---

## Technische Details

### Chunk-Parameter
| Parameter | Wert | Begründung |
|-----------|------|------------|
| Chunk-Dauer | 30s | Optimal für Whisper-Qualität |
| Overlap | 5s | Verhindert Wort-Abschnitte |
| Sample Rate | 16kHz | Whisper-optimal |
| Format | WAV | Verlustfrei, einfaches Chunking |

### Speicher-Budget (60 Min Meeting)
| Komponente | Größe |
|------------|-------|
| Audio (Roh) | ~115 MB |
| Transkript | ~500 KB |
| Waveform | ~2 MB |
| Total RAM | < 300 MB |

### Rate Limiting (Groq API)
- Max 60 Requests/Minute (Free Tier)
- Bei 30s Chunks: ~2 Chunks/Minute = safe
- Exponential Backoff bei 429 Errors
- Fallback: Lokale Whisper-Transkription

---

## Neue Dateien

```
types/meeting.ts
stores/meeting-store.ts
stores/transcript-store.ts
lib/audio/audio-chunk-manager.ts
lib/audio/meeting-recorder.ts
lib/meeting/rate-limiter.ts
lib/meeting/speaker-heuristic.ts
lib/ai/meeting-transcription.ts
lib/ai/meeting-notes-generator.ts
app/api/meeting/transcribe-chunk/route.ts
app/api/meeting/generate-notes/route.ts
components/meeting/meeting-mode.tsx
components/meeting/live-transcript.tsx
components/meeting/meeting-controls.tsx
components/meeting/meeting-timer.tsx
components/meeting/meeting-status.tsx
components/meeting/speaker-timeline.tsx
components/meeting/meeting-notes.tsx
components/meeting/meeting-history.tsx
components/meeting/index.ts
```

---

## Speicherpfad-Struktur

```
userData/
└── meetings/
    └── {meetingId}/
        ├── audio.wav           # Vollständige Aufnahme
        ├── chunks/             # Temporäre Chunks
        ├── transcript.json     # Vollständiges Transkript
        ├── metadata.json       # Meeting-Metadaten
        └── notes.md            # Generierte Notizen
```

---

## Risiken & Mitigationen

| Risiko | Mitigation |
|--------|-----------|
| Memory-Überlauf | AudioChunkManager mit Disk-Persistenz, max 10 Chunks in RAM |
| Groq Rate Limits | Intelligente Queue, Exponential Backoff, lokaler Fallback |
| Netzwerkunterbrechung | Lokale Audio-Speicherung, nachträgliche Transkription |
| Inkonsistente Transkription | Kontext-Prompt mit Ende des vorherigen Chunks, 5s Overlap |

---

## Geschätzte Komplexität

| Phase | Zeit |
|-------|------|
| Phase 1: Types & Store | 2-3h |
| Phase 2: Audio Chunking | 4-6h |
| Phase 3: Transkription | 3-4h |
| Phase 4: UI Komponenten | 3-4h |
| Phase 5: Meeting Notes | 2-3h |
| Phase 6: Electron | 2-3h |
| Phase 7: Integration | 1-2h |
| Phase 8: Diarization | 2-3h |
| **Gesamt** | **19-28h** |

---

## Erfolgskriterien

- [ ] Aufnahmen bis 60 Minuten ohne Memory-Probleme
- [ ] Live-Transkription mit max 5s Verzögerung
- [ ] Hintergrund-Aufnahme funktioniert zuverlässig
- [ ] Meeting-Notizen enthalten alle wichtigen Punkte
- [ ] Rate Limits werden nicht überschritten
- [ ] Bestehende Voice-Input Funktionalität bleibt intakt
