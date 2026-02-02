/**
 * DOCX Generator Service
 * Generates professional Word documents for meeting protocols
 */

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  Packer,
  convertInchesToTwip,
  LevelFormat,
} from 'docx'
import { saveAs } from 'file-saver'
import type { Meeting, TranscriptionSegment, Speaker } from '@/types/meeting'
import type {
  ExportConfig,
  ExportParticipant,
  ExportAgendaItem,
  ExportContentOptions,
} from '@/types/export'
import { MEETING_TYPE_LABELS } from '@/types/export'

export interface ExportData {
  readonly config: ExportConfig
  readonly participants: readonly ExportParticipant[]
  readonly agenda: readonly ExportAgendaItem[]
  readonly contentOptions: ExportContentOptions
  readonly meeting: Meeting
}

export interface DocxGeneratorEvents {
  onProgress: (progress: number, stage: string) => void
  onComplete: (filename: string) => void
  onError: (error: Error) => void
}

// Premium color palette - Matching VoiceOS warm design
const COLORS = {
  // Primary warm gold/amber - matching app accent
  primary: 'B8885C', // Warm gold
  primaryLight: 'D4A574', // Light gold

  // Neutral warm tones for text
  text: '2C2825', // Warm dark for main text
  textSecondary: '5C5650', // Secondary text
  textMuted: '8A847C', // Muted/tertiary text
  textLight: 'C4BFB8', // Very light text

  // Status colors - warm palette
  success: '7CB97A', // Soft green
  warning: 'E5A84B', // Warm amber
  error: 'D97667', // Warm red

  // Borders and dividers
  border: 'E8E4DE', // Warm light border
  borderAccent: 'D4A574', // Accent border
}

/**
 * Format date in German locale
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Format time in German locale
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format duration in human-readable format
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours} Std. ${minutes} Min.`
  }
  return `${minutes} Minuten`
}

/**
 * Create a premium styled section heading with accent line
 */
function createSectionHeading(text: string): Paragraph[] {
  return [
    new Paragraph({
      spacing: { before: 500, after: 0 },
      children: [],
    }),
    new Paragraph({
      spacing: { before: 0, after: 180 },
      children: [
        new TextRun({
          text: text.toUpperCase(),
          bold: true,
          color: COLORS.primary,
          size: 24,
          font: 'Helvetica Neue',
          characterSpacing: 40,
        }),
      ],
    }),
    new Paragraph({
      border: {
        bottom: {
          color: COLORS.borderAccent,
          space: 1,
          size: 12,
          style: BorderStyle.SINGLE,
        },
      },
      spacing: { after: 300 },
    }),
  ]
}

/**
 * Create a styled heading (legacy support)
 */
function createHeading(text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel]): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        color: COLORS.primary,
        size: level === HeadingLevel.HEADING_1 ? 24 : 22,
        font: 'Helvetica Neue',
        characterSpacing: 30,
      }),
    ],
    spacing: {
      before: 500,
      after: 200,
    },
  })
}

/**
 * Create a premium horizontal divider with centered accent dot
 */
function createDivider(): Paragraph[] {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 100 },
      children: [
        new TextRun({
          text: '─────────  ',
          color: COLORS.border,
          size: 20,
        }),
        new TextRun({
          text: '◆',
          color: COLORS.primary,
          size: 16,
        }),
        new TextRun({
          text: '  ─────────',
          color: COLORS.border,
          size: 20,
        }),
      ],
    }),
  ]
}

/**
 * Create a simple subtle divider line
 */
function createSubtleDivider(): Paragraph {
  return new Paragraph({
    border: {
      bottom: {
        color: COLORS.border,
        space: 1,
        size: 4,
        style: BorderStyle.SINGLE,
      },
    },
    spacing: {
      before: 150,
      after: 150,
    },
  })
}

/**
 * Create premium info grid (key-value pairs in elegant layout)
 */
function createInfoTable(rows: readonly { label: string; value: string }[]): Table {
  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: rows.map(
      (row) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              margins: {
                top: convertInchesToTwip(0.08),
                bottom: convertInchesToTwip(0.08),
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: row.label.toUpperCase(),
                      bold: false,
                      color: COLORS.textMuted,
                      size: 18,
                      font: 'Helvetica Neue',
                      characterSpacing: 20,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 75, type: WidthType.PERCENTAGE },
              margins: {
                top: convertInchesToTwip(0.08),
                bottom: convertInchesToTwip(0.08),
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: row.value,
                      color: COLORS.text,
                      size: 22,
                      font: 'Georgia',
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
    ),
  })
}

/**
 * Create premium participants table with elegant borders (white background)
 */
function createParticipantsTable(participants: readonly ExportParticipant[]): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        margins: {
          top: convertInchesToTwip(0.12),
          bottom: convertInchesToTwip(0.12),
          left: convertInchesToTwip(0.15),
          right: convertInchesToTwip(0.15),
        },
        borders: {
          top: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          bottom: { color: COLORS.primary, size: 12, style: BorderStyle.SINGLE },
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'TEILNEHMER',
                bold: true,
                color: COLORS.textSecondary,
                size: 18,
                font: 'Helvetica Neue',
                characterSpacing: 30,
              }),
            ],
          }),
        ],
      }),
      new TableCell({
        margins: {
          top: convertInchesToTwip(0.12),
          bottom: convertInchesToTwip(0.12),
          left: convertInchesToTwip(0.15),
          right: convertInchesToTwip(0.15),
        },
        borders: {
          top: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          bottom: { color: COLORS.primary, size: 12, style: BorderStyle.SINGLE },
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'ROLLE / POSITION',
                bold: true,
                color: COLORS.textSecondary,
                size: 18,
                font: 'Helvetica Neue',
                characterSpacing: 30,
              }),
            ],
          }),
        ],
      }),
    ],
  })

  const dataRows = participants.map(
    (participant) =>
      new TableRow({
        children: [
          new TableCell({
            margins: {
              top: convertInchesToTwip(0.1),
              bottom: convertInchesToTwip(0.1),
              left: convertInchesToTwip(0.15),
              right: convertInchesToTwip(0.15),
            },
            borders: {
              top: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              bottom: { color: COLORS.border, size: 4, style: BorderStyle.SINGLE },
            },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: participant.name,
                    color: COLORS.text,
                    size: 22,
                    font: 'Georgia',
                  }),
                  ...(participant.isOrganizer
                    ? [
                        new TextRun({
                          text: '  ★',
                          color: COLORS.primary,
                          size: 18,
                        }),
                      ]
                    : []),
                ],
              }),
            ],
          }),
          new TableCell({
            margins: {
              top: convertInchesToTwip(0.1),
              bottom: convertInchesToTwip(0.1),
              left: convertInchesToTwip(0.15),
              right: convertInchesToTwip(0.15),
            },
            borders: {
              top: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              bottom: { color: COLORS.border, size: 4, style: BorderStyle.SINGLE },
            },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: participant.role || '—',
                    color: participant.role ? COLORS.text : COLORS.textLight,
                    size: 22,
                    font: 'Georgia',
                  }),
                ],
              }),
            ],
          }),
        ],
      })
  )

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
    },
    rows: [headerRow, ...dataRows],
  })
}

/**
 * Get priority styling
 */
function getPriorityStyle(priority?: string): { color: string; label: string } {
  switch (priority?.toLowerCase()) {
    case 'high':
    case 'hoch':
      return { color: COLORS.error, label: '● Hoch' }
    case 'medium':
    case 'mittel':
      return { color: COLORS.warning, label: '● Mittel' }
    case 'low':
    case 'niedrig':
      return { color: COLORS.success, label: '● Niedrig' }
    default:
      return { color: COLORS.textMuted, label: '—' }
  }
}

/**
 * Create premium action items table with visual priority indicators
 */
function createActionItemsTable(
  actionItems: readonly { task: string; assignee?: string; dueDate?: string; priority?: string }[]
): Table {
  const headerCellMargins = {
    top: convertInchesToTwip(0.12),
    bottom: convertInchesToTwip(0.12),
    left: convertInchesToTwip(0.12),
    right: convertInchesToTwip(0.12),
  }
  const headerCellBorders = {
    top: { style: BorderStyle.NONE },
    left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE },
    bottom: { color: COLORS.primary, size: 12, style: BorderStyle.SINGLE },
  }

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        margins: headerCellMargins,
        borders: headerCellBorders,
        width: { size: 45, type: WidthType.PERCENTAGE },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'AUFGABE',
                bold: true,
                color: COLORS.textSecondary,
                size: 17,
                font: 'Helvetica Neue',
                characterSpacing: 25,
              }),
            ],
          }),
        ],
      }),
      new TableCell({
        margins: headerCellMargins,
        borders: headerCellBorders,
        width: { size: 22, type: WidthType.PERCENTAGE },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'VERANTWORTLICH',
                bold: true,
                color: COLORS.textSecondary,
                size: 17,
                font: 'Helvetica Neue',
                characterSpacing: 25,
              }),
            ],
          }),
        ],
      }),
      new TableCell({
        margins: headerCellMargins,
        borders: headerCellBorders,
        width: { size: 18, type: WidthType.PERCENTAGE },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'FÄLLIG',
                bold: true,
                color: COLORS.textSecondary,
                size: 17,
                font: 'Helvetica Neue',
                characterSpacing: 25,
              }),
            ],
          }),
        ],
      }),
      new TableCell({
        margins: headerCellMargins,
        borders: headerCellBorders,
        width: { size: 15, type: WidthType.PERCENTAGE },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'PRIORITÄT',
                bold: true,
                color: COLORS.textSecondary,
                size: 17,
                font: 'Helvetica Neue',
                characterSpacing: 25,
              }),
            ],
          }),
        ],
      }),
    ],
  })

  const dataCellBorders = {
    top: { style: BorderStyle.NONE },
    left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE },
    bottom: { color: COLORS.border, size: 4, style: BorderStyle.SINGLE },
  }

  const dataRows = actionItems.map((item) => {
    const priorityStyle = getPriorityStyle(item.priority)

    return new TableRow({
      children: [
        new TableCell({
          margins: {
            top: convertInchesToTwip(0.1),
            bottom: convertInchesToTwip(0.1),
            left: convertInchesToTwip(0.12),
            right: convertInchesToTwip(0.12),
          },
          borders: dataCellBorders,
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: '☐  ',
                  color: COLORS.textMuted,
                  size: 20,
                }),
                new TextRun({
                  text: item.task,
                  color: COLORS.text,
                  size: 21,
                  font: 'Georgia',
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          margins: {
            top: convertInchesToTwip(0.1),
            bottom: convertInchesToTwip(0.1),
            left: convertInchesToTwip(0.12),
            right: convertInchesToTwip(0.12),
          },
          borders: dataCellBorders,
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: item.assignee || '—',
                  color: item.assignee ? COLORS.text : COLORS.textLight,
                  size: 21,
                  font: 'Georgia',
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          margins: {
            top: convertInchesToTwip(0.1),
            bottom: convertInchesToTwip(0.1),
            left: convertInchesToTwip(0.12),
            right: convertInchesToTwip(0.12),
          },
          borders: dataCellBorders,
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: item.dueDate || '—',
                  color: item.dueDate ? COLORS.text : COLORS.textLight,
                  size: 21,
                  font: 'Georgia',
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          margins: {
            top: convertInchesToTwip(0.1),
            bottom: convertInchesToTwip(0.1),
            left: convertInchesToTwip(0.12),
            right: convertInchesToTwip(0.12),
          },
          borders: dataCellBorders,
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: priorityStyle.label,
                  color: priorityStyle.color,
                  size: 20,
                  font: 'Helvetica Neue',
                }),
              ],
            }),
          ],
        }),
      ],
    })
  })

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [headerRow, ...dataRows],
  })
}

/**
 * Create elegant bullet list with custom bullet character
 */
function createBulletList(items: readonly string[]): Paragraph[] {
  return items.map(
    (item) =>
      new Paragraph({
        indent: {
          left: convertInchesToTwip(0.25),
          hanging: convertInchesToTwip(0.25),
        },
        children: [
          new TextRun({
            text: '◆  ',
            color: COLORS.primary,
            size: 16,
          }),
          new TextRun({
            text: item,
            color: COLORS.text,
            size: 22,
            font: 'Georgia',
          }),
        ],
        spacing: {
          after: 150,
          line: 300,
        },
      })
  )
}

/**
 * Create elegant numbered list with styled numbers
 */
function createNumberedList(items: readonly string[]): Paragraph[] {
  return items.map(
    (item, index) =>
      new Paragraph({
        indent: {
          left: convertInchesToTwip(0.4),
          hanging: convertInchesToTwip(0.4),
        },
        children: [
          new TextRun({
            text: `${index + 1}.`,
            color: COLORS.primary,
            size: 22,
            bold: true,
            font: 'Helvetica Neue',
          }),
          new TextRun({
            text: `  ${item}`,
            color: COLORS.text,
            size: 22,
            font: 'Georgia',
          }),
        ],
        spacing: {
          after: 150,
          line: 300,
        },
      })
  )
}

/**
 * Create premium transcript section with speaker styling
 */
function createTranscriptSection(
  segments: readonly TranscriptionSegment[],
  speakers: readonly Speaker[],
  participants: readonly ExportParticipant[]
): Paragraph[] {
  const paragraphs: Paragraph[] = []

  // Group segments by speaker
  let currentSpeakerId: string | undefined
  let currentText: string[] = []

  // Build a speaker name lookup map - PARTICIPANTS TAKE PRIORITY
  // since they have user-edited names
  const speakerNameMap = new Map<string, string>()

  // First, add participants with their speakerIds (these have user-edited names)
  for (const participant of participants) {
    if (participant.speakerId) {
      speakerNameMap.set(participant.speakerId, participant.name)
      // Also add lowercase version for case-insensitive matching
      speakerNameMap.set(participant.speakerId.toLowerCase(), participant.name)
    }
  }

  // Then add speakers (only if not already in map from participants)
  for (const speaker of speakers) {
    if (!speakerNameMap.has(speaker.id)) {
      const name = speaker.name || speaker.label
      if (name) {
        speakerNameMap.set(speaker.id, name)
        speakerNameMap.set(speaker.id.toLowerCase(), name)
      }
    }
  }

  // Create a list of unique speaker IDs from segments for index-based fallback
  const uniqueSpeakerIds: string[] = []
  for (const seg of segments) {
    if (seg.speakerId && !uniqueSpeakerIds.includes(seg.speakerId)) {
      uniqueSpeakerIds.push(seg.speakerId)
    }
  }

  const getSpeakerName = (speakerId?: string): string => {
    if (!speakerId) {
      return participants[0]?.name || 'Teilnehmer'
    }

    // Try direct lookup (case-sensitive)
    if (speakerNameMap.has(speakerId)) {
      return speakerNameMap.get(speakerId)!
    }

    // Try lowercase lookup (case-insensitive)
    if (speakerNameMap.has(speakerId.toLowerCase())) {
      return speakerNameMap.get(speakerId.toLowerCase())!
    }

    // Try to find speaker in array by ID
    const speaker = speakers.find((s) =>
      s.id === speakerId || s.id.toLowerCase() === speakerId.toLowerCase()
    )
    if (speaker && (speaker.name || speaker.label)) {
      return speaker.name || speaker.label!
    }

    // Try to find participant with this speaker ID
    const participant = participants.find((p) =>
      p.speakerId === speakerId ||
      p.speakerId?.toLowerCase() === speakerId.toLowerCase()
    )
    if (participant) {
      return participant.name
    }

    // Index-based fallback: map speaker IDs to participants by order
    const speakerIndex = uniqueSpeakerIds.indexOf(speakerId)
    if (speakerIndex !== -1 && participants[speakerIndex]) {
      return participants[speakerIndex].name
    }

    // If we have participants, use round-robin based on speaker order
    if (participants.length > 0) {
      const index = speakerIndex !== -1 ? speakerIndex % participants.length : 0
      return participants[index].name
    }

    // Last resort: return a numbered speaker label
    const displayIndex = speakerIndex !== -1 ? speakerIndex + 1 : 1
    return `Sprecher ${displayIndex}`
  }

  const flushCurrentSpeaker = () => {
    if (currentText.length > 0) {
      // Speaker name as separate styled line
      paragraphs.push(
        new Paragraph({
          spacing: { before: 250, after: 80 },
          children: [
            new TextRun({
              text: getSpeakerName(currentSpeakerId).toUpperCase(),
              bold: true,
              color: COLORS.primary,
              size: 18,
              font: 'Helvetica Neue',
              characterSpacing: 25,
            }),
          ],
        })
      )
      // Speech content with left border accent
      paragraphs.push(
        new Paragraph({
          border: {
            left: {
              color: COLORS.border,
              size: 18,
              style: BorderStyle.SINGLE,
              space: 8,
            },
          },
          indent: {
            left: convertInchesToTwip(0.15),
          },
          children: [
            new TextRun({
              text: currentText.join(' '),
              color: COLORS.textSecondary,
              size: 21,
              font: 'Georgia',
              italics: true,
            }),
          ],
          spacing: {
            after: 200,
            line: 320,
          },
        })
      )
      currentText = []
    }
  }

  for (const segment of segments) {
    if (segment.speakerId !== currentSpeakerId) {
      flushCurrentSpeaker()
      currentSpeakerId = segment.speakerId
    }
    currentText.push(segment.text)
  }
  flushCurrentSpeaker()

  return paragraphs
}

/**
 * Generate meeting protocol as DOCX
 */
export async function generateMeetingProtocol(
  data: ExportData,
  events: DocxGeneratorEvents
): Promise<void> {
  try {
    events.onProgress(0, 'Dokument wird erstellt...')

    const { config, participants, agenda, contentOptions, meeting } = data

    // Build document sections (can include paragraphs and tables)
    const sections: (Paragraph | Table)[] = []

    // =========================================
    // PREMIUM HEADER SECTION
    // =========================================
    events.onProgress(10, 'Kopfzeile wird erstellt...')

    // Top accent bar (visual element)
    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 400 },
        children: [
          new TextRun({
            text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            color: COLORS.primary,
            size: 18,
          }),
        ],
      })
    )

    // Document Type Label
    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 150 },
        children: [
          new TextRun({
            text: 'MEETING PROTOKOLL',
            bold: false,
            color: COLORS.textMuted,
            size: 20,
            font: 'Helvetica Neue',
            characterSpacing: 80,
          }),
        ],
      })
    )

    // Meeting Title - Large and elegant
    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: config.title,
            bold: true,
            color: COLORS.text,
            size: 56,
            font: 'Georgia',
          }),
        ],
      })
    )

    // Date and time subtitle
    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [
          new TextRun({
            text: formatDate(config.date),
            color: COLORS.textSecondary,
            size: 24,
            font: 'Georgia',
            italics: true,
          }),
        ],
      })
    )

    // Organization (if provided)
    if (config.organization) {
      sections.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
          children: [
            new TextRun({
              text: config.organization,
              color: COLORS.primary,
              size: 22,
              font: 'Helvetica Neue',
            }),
          ],
        })
      )
    }

    // Bottom accent bar
    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 500 },
        children: [
          new TextRun({
            text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            color: COLORS.primary,
            size: 18,
          }),
        ],
      })
    )

    // =========================================
    // MEETING INFO SECTION
    // =========================================
    events.onProgress(20, 'Meeting-Informationen werden erstellt...')

    sections.push(...createSectionHeading('Details'))

    const infoRows = [
      { label: 'Meeting-Typ', value: MEETING_TYPE_LABELS[config.meetingType] },
      { label: 'Datum', value: formatDate(config.date) },
      {
        label: 'Uhrzeit',
        value: `${formatTime(config.startTime)}${config.endTime ? ` – ${formatTime(config.endTime)}` : ''}`,
      },
      { label: 'Dauer', value: formatDuration(config.duration) },
    ]

    if (config.location) {
      infoRows.push({ label: 'Ort', value: config.location })
    }

    sections.push(createInfoTable(infoRows))

    // =========================================
    // PARTICIPANTS SECTION
    // =========================================
    events.onProgress(30, 'Teilnehmerliste wird erstellt...')

    if (participants.length > 0) {
      sections.push(...createSectionHeading('Teilnehmer'))
      sections.push(createParticipantsTable(participants))
    }

    // =========================================
    // AGENDA SECTION
    // =========================================
    events.onProgress(40, 'Agenda wird erstellt...')

    if (agenda.length > 0) {
      sections.push(...createSectionHeading('Agenda'))
      sections.push(
        ...agenda.map(
          (item) =>
            new Paragraph({
              indent: {
                left: convertInchesToTwip(0.3),
                hanging: convertInchesToTwip(0.3),
              },
              children: [
                new TextRun({
                  text: `${item.order}.`,
                  color: COLORS.primary,
                  size: 22,
                  bold: true,
                  font: 'Helvetica Neue',
                }),
                new TextRun({
                  text: `   ${item.title}`,
                  color: COLORS.text,
                  size: 22,
                  font: 'Georgia',
                }),
              ],
              spacing: { after: 150, line: 300 },
            })
        )
      )
    }

    sections.push(...createDivider())

    // =========================================
    // SUMMARY SECTION
    // =========================================
    events.onProgress(50, 'Zusammenfassung wird erstellt...')

    if (contentOptions.includeSummary && meeting.notes?.summary) {
      sections.push(...createSectionHeading('Zusammenfassung'))
      // Summary with elegant left border accent (white background)
      sections.push(
        new Paragraph({
          border: {
            left: {
              color: COLORS.primary,
              size: 24,
              style: BorderStyle.SINGLE,
            },
          },
          indent: {
            left: convertInchesToTwip(0.2),
          },
          children: [
            new TextRun({
              text: meeting.notes.summary,
              color: COLORS.text,
              size: 23,
              font: 'Georgia',
            }),
          ],
          spacing: { before: 100, after: 300, line: 340 },
        })
      )
    }

    // =========================================
    // KEY POINTS SECTION
    // =========================================
    events.onProgress(55, 'Kernpunkte werden erstellt...')

    if (contentOptions.includeKeyPoints && meeting.notes?.keyPoints?.length) {
      sections.push(...createSectionHeading('Kernpunkte'))
      sections.push(...createBulletList(meeting.notes.keyPoints))
    }

    // =========================================
    // DECISIONS SECTION
    // =========================================
    events.onProgress(60, 'Entscheidungen werden erstellt...')

    if (contentOptions.includeDecisions && meeting.notes?.decisions?.length) {
      sections.push(...createSectionHeading('Entscheidungen'))
      sections.push(
        ...meeting.notes.decisions.map(
          (decision) =>
            new Paragraph({
              indent: {
                left: convertInchesToTwip(0.25),
                hanging: convertInchesToTwip(0.25),
              },
              children: [
                new TextRun({
                  text: '✓',
                  color: COLORS.success,
                  size: 22,
                  bold: true,
                }),
                new TextRun({
                  text: '  ',
                  size: 22,
                }),
                new TextRun({
                  text: decision,
                  color: COLORS.text,
                  size: 22,
                  font: 'Georgia',
                }),
              ],
              spacing: { after: 150, line: 300 },
            })
        )
      )
    }

    // =========================================
    // ACTION ITEMS SECTION
    // =========================================
    events.onProgress(65, 'Aufgaben werden erstellt...')

    if (contentOptions.includeActionItems && meeting.notes?.actionItems?.length) {
      sections.push(...createSectionHeading('Aufgaben'))

      // Convert action items to table format
      const actionItemsData = meeting.notes.actionItems.map((item) => ({
        task: item.task,
        assignee: item.owner,
        dueDate: item.deadline,
        priority: item.priority,
      }))

      sections.push(createActionItemsTable(actionItemsData))
    }

    // =========================================
    // TOPICS SECTION
    // =========================================
    events.onProgress(70, 'Themen werden erstellt...')

    if (contentOptions.includeTopics && meeting.notes?.topics?.length) {
      sections.push(...createSectionHeading('Besprochene Themen'))

      for (const topic of meeting.notes.topics) {
        // Topic title with accent
        sections.push(
          new Paragraph({
            spacing: { before: 300, after: 120 },
            children: [
              new TextRun({
                text: '▸ ',
                color: COLORS.primary,
                size: 22,
              }),
              new TextRun({
                text: topic.title,
                bold: true,
                color: COLORS.text,
                size: 24,
                font: 'Georgia',
              }),
            ],
          })
        )

        // Topic summary with left border
        if (topic.summary) {
          sections.push(
            new Paragraph({
              indent: { left: convertInchesToTwip(0.25) },
              border: {
                left: {
                  color: COLORS.border,
                  size: 12,
                  style: BorderStyle.SINGLE,
                  space: 6,
                },
              },
              children: [
                new TextRun({
                  text: topic.summary,
                  color: COLORS.textSecondary,
                  size: 21,
                  font: 'Georgia',
                }),
              ],
              spacing: { after: 200, line: 320 },
            })
          )
        }
      }
    }

    // =========================================
    // NEXT STEPS SECTION
    // =========================================
    events.onProgress(75, 'Nächste Schritte werden erstellt...')

    if (contentOptions.includeNextSteps && meeting.notes?.nextSteps?.length) {
      sections.push(...createSectionHeading('Nächste Schritte'))
      sections.push(...createNumberedList(meeting.notes.nextSteps))
    }

    // =========================================
    // OPEN QUESTIONS SECTION
    // =========================================
    if (contentOptions.includeOpenQuestions && meeting.notes?.openQuestions?.length) {
      sections.push(...createSectionHeading('Offene Fragen'))
      // Use question mark bullet style
      sections.push(
        ...meeting.notes.openQuestions.map(
          (question) =>
            new Paragraph({
              indent: {
                left: convertInchesToTwip(0.25),
                hanging: convertInchesToTwip(0.25),
              },
              children: [
                new TextRun({
                  text: '?',
                  color: COLORS.warning,
                  size: 22,
                  bold: true,
                  font: 'Helvetica Neue',
                }),
                new TextRun({
                  text: `   ${question}`,
                  color: COLORS.text,
                  size: 22,
                  font: 'Georgia',
                }),
              ],
              spacing: { after: 150, line: 300 },
            })
        )
      )
    }

    // =========================================
    // TRANSCRIPT SECTION
    // =========================================
    events.onProgress(80, 'Transkript wird erstellt...')

    if (contentOptions.includeFullTranscript && meeting.transcriptionSegments.length > 0) {
      sections.push(...createDivider())
      sections.push(...createSectionHeading('Vollständiges Transkript'))
      // Intro text for transcript
      sections.push(
        new Paragraph({
          spacing: { after: 300 },
          children: [
            new TextRun({
              text: 'Das folgende Transkript wurde automatisch erstellt und kann geringfügige Ungenauigkeiten enthalten.',
              color: COLORS.textMuted,
              size: 18,
              font: 'Helvetica Neue',
              italics: true,
            }),
          ],
        })
      )
      sections.push(
        ...createTranscriptSection(
          meeting.transcriptionSegments,
          meeting.speakers,
          participants
        )
      )
    }

    // =========================================
    // ELEGANT FOOTER
    // =========================================
    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 600, after: 100 },
        children: [
          new TextRun({
            text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
            color: COLORS.border,
            size: 18,
          }),
        ],
      })
    )
    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 50 },
        children: [
          new TextRun({
            text: 'Erstellt mit ',
            color: COLORS.textMuted,
            size: 18,
            font: 'Helvetica Neue',
          }),
          new TextRun({
            text: 'VoiceOS',
            color: COLORS.primary,
            size: 18,
            font: 'Helvetica Neue',
            bold: true,
          }),
        ],
      })
    )
    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: `${formatDate(new Date())} · ${formatTime(new Date())}`,
            color: COLORS.textLight,
            size: 16,
            font: 'Helvetica Neue',
          }),
        ],
      })
    )

    // =========================================
    // CREATE DOCUMENT
    // =========================================
    events.onProgress(90, 'Dokument wird finalisiert...')

    const doc = new Document({
      numbering: {
        config: [
          {
            reference: 'numbered-list',
            levels: [
              {
                level: 0,
                format: LevelFormat.DECIMAL,
                text: '%1.',
                alignment: AlignmentType.LEFT,
                style: {
                  paragraph: {
                    indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) },
                  },
                  run: {
                    color: COLORS.primary,
                    bold: true,
                  },
                },
              },
            ],
          },
        ],
      },
      styles: {
        default: {
          document: {
            run: {
              font: 'Georgia',
              size: 22,
              color: COLORS.text,
            },
          },
          heading1: {
            run: {
              size: 28,
              bold: true,
              color: COLORS.primary,
              font: 'Helvetica Neue',
            },
            paragraph: {
              spacing: {
                before: 500,
                after: 200,
              },
            },
          },
          heading2: {
            run: {
              size: 24,
              bold: true,
              color: COLORS.text,
              font: 'Helvetica Neue',
            },
            paragraph: {
              spacing: {
                before: 400,
                after: 150,
              },
            },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1.2),
                right: convertInchesToTwip(1.1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1.1),
              },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  spacing: { after: 200 },
                  children: [
                    new TextRun({
                      text: config.organization ? config.organization.toUpperCase() : '',
                      color: COLORS.textLight,
                      size: 16,
                      font: 'Helvetica Neue',
                      characterSpacing: 30,
                    }),
                  ],
                }),
                new Paragraph({
                  border: {
                    bottom: {
                      color: COLORS.border,
                      size: 4,
                      style: BorderStyle.SINGLE,
                    },
                  },
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  border: {
                    top: {
                      color: COLORS.border,
                      size: 4,
                      style: BorderStyle.SINGLE,
                    },
                  },
                  spacing: { before: 150 },
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 100 },
                  children: [
                    new TextRun({
                      text: '— ',
                      color: COLORS.textLight,
                      size: 18,
                      font: 'Helvetica Neue',
                    }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      color: COLORS.primary,
                      size: 18,
                      font: 'Helvetica Neue',
                    }),
                    new TextRun({
                      text: ' —',
                      color: COLORS.textLight,
                      size: 18,
                      font: 'Helvetica Neue',
                    }),
                  ],
                }),
              ],
            }),
          },
          children: sections,
        },
      ],
    })

    // =========================================
    // EXPORT FILE
    // =========================================
    events.onProgress(95, 'Datei wird gespeichert...')

    const blob = await Packer.toBlob(doc)
    const filename = `${config.title.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '').replace(/\s+/g, '_')}_Protokoll.docx`

    saveAs(blob, filename)

    events.onProgress(100, 'Abgeschlossen')
    events.onComplete(filename)
  } catch (error) {
    events.onError(error instanceof Error ? error : new Error(String(error)))
  }
}
