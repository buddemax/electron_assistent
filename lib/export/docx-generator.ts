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
  NumberFormat,
  Packer,
  TableOfContents,
  ShadingType,
  convertInchesToTwip,
  LevelFormat,
  UnderlineType,
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

// Color palette
const COLORS = {
  primary: '2563EB', // Blue
  secondary: '64748B', // Slate
  accent: 'F59E0B', // Amber
  success: '22C55E', // Green
  border: 'E2E8F0', // Light gray
  background: 'F8FAFC', // Very light gray
  text: '1E293B', // Dark slate
  muted: '94A3B8', // Muted text
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
 * Create a styled heading
 */
function createHeading(text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel]): Paragraph {
  return new Paragraph({
    text,
    heading: level,
    spacing: {
      before: 400,
      after: 200,
    },
  })
}

/**
 * Create a horizontal divider
 */
function createDivider(): Paragraph {
  return new Paragraph({
    border: {
      bottom: {
        color: COLORS.border,
        space: 1,
        size: 6,
        style: BorderStyle.SINGLE,
      },
    },
    spacing: {
      before: 200,
      after: 200,
    },
  })
}

/**
 * Create info table (key-value pairs)
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
              width: {
                size: 30,
                type: WidthType.PERCENTAGE,
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: row.label,
                      bold: true,
                      color: COLORS.secondary,
                      size: 22,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: {
                size: 70,
                type: WidthType.PERCENTAGE,
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: row.value,
                      color: COLORS.text,
                      size: 22,
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
 * Create participants table
 */
function createParticipantsTable(participants: readonly ExportParticipant[]): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        shading: {
          fill: COLORS.primary,
          type: ShadingType.SOLID,
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'Name',
                bold: true,
                color: 'FFFFFF',
                size: 22,
              }),
            ],
          }),
        ],
      }),
      new TableCell({
        shading: {
          fill: COLORS.primary,
          type: ShadingType.SOLID,
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'Rolle/Position',
                bold: true,
                color: 'FFFFFF',
                size: 22,
              }),
            ],
          }),
        ],
      }),
    ],
  })

  const dataRows = participants.map(
    (participant, index) =>
      new TableRow({
        children: [
          new TableCell({
            shading: {
              fill: index % 2 === 0 ? 'FFFFFF' : COLORS.background,
              type: ShadingType.SOLID,
            },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: participant.name,
                    color: COLORS.text,
                    size: 22,
                  }),
                  ...(participant.isOrganizer
                    ? [
                        new TextRun({
                          text: ' (Moderator)',
                          color: COLORS.muted,
                          size: 20,
                          italics: true,
                        }),
                      ]
                    : []),
                ],
              }),
            ],
          }),
          new TableCell({
            shading: {
              fill: index % 2 === 0 ? 'FFFFFF' : COLORS.background,
              type: ShadingType.SOLID,
            },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: participant.role || '-',
                    color: COLORS.text,
                    size: 22,
                  }),
                ],
              }),
            ],
          }),
        ],
      })
  )

  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    rows: [headerRow, ...dataRows],
  })
}

/**
 * Create action items table
 */
function createActionItemsTable(
  actionItems: readonly { task: string; assignee?: string; dueDate?: string; priority?: string }[]
): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        shading: { fill: COLORS.primary, type: ShadingType.SOLID },
        children: [
          new Paragraph({
            children: [new TextRun({ text: 'Aufgabe', bold: true, color: 'FFFFFF', size: 22 })],
          }),
        ],
      }),
      new TableCell({
        shading: { fill: COLORS.primary, type: ShadingType.SOLID },
        children: [
          new Paragraph({
            children: [new TextRun({ text: 'Verantwortlich', bold: true, color: 'FFFFFF', size: 22 })],
          }),
        ],
      }),
      new TableCell({
        shading: { fill: COLORS.primary, type: ShadingType.SOLID },
        children: [
          new Paragraph({
            children: [new TextRun({ text: 'Fällig', bold: true, color: 'FFFFFF', size: 22 })],
          }),
        ],
      }),
      new TableCell({
        shading: { fill: COLORS.primary, type: ShadingType.SOLID },
        children: [
          new Paragraph({
            children: [new TextRun({ text: 'Priorität', bold: true, color: 'FFFFFF', size: 22 })],
          }),
        ],
      }),
    ],
  })

  const dataRows = actionItems.map(
    (item, index) =>
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: index % 2 === 0 ? 'FFFFFF' : COLORS.background, type: ShadingType.SOLID },
            children: [new Paragraph({ children: [new TextRun({ text: item.task, size: 22 })] })],
          }),
          new TableCell({
            shading: { fill: index % 2 === 0 ? 'FFFFFF' : COLORS.background, type: ShadingType.SOLID },
            children: [new Paragraph({ children: [new TextRun({ text: item.assignee || '-', size: 22 })] })],
          }),
          new TableCell({
            shading: { fill: index % 2 === 0 ? 'FFFFFF' : COLORS.background, type: ShadingType.SOLID },
            children: [new Paragraph({ children: [new TextRun({ text: item.dueDate || '-', size: 22 })] })],
          }),
          new TableCell({
            shading: { fill: index % 2 === 0 ? 'FFFFFF' : COLORS.background, type: ShadingType.SOLID },
            children: [new Paragraph({ children: [new TextRun({ text: item.priority || '-', size: 22 })] })],
          }),
        ],
      })
  )

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  })
}

/**
 * Create bullet list
 */
function createBulletList(items: readonly string[]): Paragraph[] {
  return items.map(
    (item) =>
      new Paragraph({
        bullet: {
          level: 0,
        },
        children: [
          new TextRun({
            text: item,
            color: COLORS.text,
            size: 22,
          }),
        ],
        spacing: {
          after: 100,
        },
      })
  )
}

/**
 * Create numbered list
 */
function createNumberedList(items: readonly string[]): Paragraph[] {
  return items.map(
    (item, index) =>
      new Paragraph({
        numbering: {
          reference: 'numbered-list',
          level: 0,
        },
        children: [
          new TextRun({
            text: item,
            color: COLORS.text,
            size: 22,
          }),
        ],
        spacing: {
          after: 100,
        },
      })
  )
}

/**
 * Create transcript section
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

  const getSpeakerName = (speakerId?: string): string => {
    if (!speakerId) return 'Unbekannt'
    const speaker = speakers.find((s) => s.id === speakerId)
    const participant = participants.find((p) => p.speakerId === speakerId)
    return participant?.name || speaker?.name || speaker?.label || 'Unbekannt'
  }

  const flushCurrentSpeaker = () => {
    if (currentText.length > 0) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${getSpeakerName(currentSpeakerId)}: `,
              bold: true,
              color: COLORS.primary,
              size: 22,
            }),
            new TextRun({
              text: currentText.join(' '),
              color: COLORS.text,
              size: 22,
            }),
          ],
          spacing: {
            after: 200,
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
    // HEADER SECTION
    // =========================================
    events.onProgress(10, 'Kopfzeile wird erstellt...')

    // Title
    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [
          new TextRun({
            text: 'MEETING-PROTOKOLL',
            bold: true,
            color: COLORS.secondary,
            size: 28,
            allCaps: true,
          }),
        ],
      })
    )

    // Meeting Title
    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [
          new TextRun({
            text: config.title,
            bold: true,
            color: COLORS.text,
            size: 48,
          }),
        ],
      })
    )

    sections.push(createDivider())

    // =========================================
    // MEETING INFO SECTION
    // =========================================
    events.onProgress(20, 'Meeting-Informationen werden erstellt...')

    sections.push(createHeading('Meeting-Informationen', HeadingLevel.HEADING_1))

    const infoRows = [
      { label: 'Typ:', value: MEETING_TYPE_LABELS[config.meetingType] },
      { label: 'Datum:', value: formatDate(config.date) },
      {
        label: 'Zeit:',
        value: `${formatTime(config.startTime)}${config.endTime ? ` - ${formatTime(config.endTime)}` : ''} (${formatDuration(config.duration)})`,
      },
    ]

    if (config.location) {
      infoRows.push({ label: 'Ort:', value: config.location })
    }

    if (config.organization) {
      infoRows.push({ label: 'Organisation:', value: config.organization })
    }

    sections.push(createInfoTable(infoRows))

    // =========================================
    // PARTICIPANTS SECTION
    // =========================================
    events.onProgress(30, 'Teilnehmerliste wird erstellt...')

    if (participants.length > 0) {
      sections.push(createHeading('Teilnehmer', HeadingLevel.HEADING_1))
      sections.push(createParticipantsTable(participants))
    }

    // =========================================
    // AGENDA SECTION
    // =========================================
    events.onProgress(40, 'Agenda wird erstellt...')

    if (agenda.length > 0) {
      sections.push(createHeading('Agenda', HeadingLevel.HEADING_1))
      sections.push(
        ...agenda.map(
          (item) =>
            new Paragraph({
              children: [
                new TextRun({
                  text: `${item.order}. ${item.title}`,
                  color: COLORS.text,
                  size: 22,
                }),
              ],
              spacing: { after: 100 },
            })
        )
      )
    }

    sections.push(createDivider())

    // =========================================
    // SUMMARY SECTION
    // =========================================
    events.onProgress(50, 'Zusammenfassung wird erstellt...')

    if (contentOptions.includeSummary && meeting.notes?.summary) {
      sections.push(createHeading('Zusammenfassung', HeadingLevel.HEADING_1))
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: meeting.notes.summary,
              color: COLORS.text,
              size: 22,
            }),
          ],
          spacing: { after: 200 },
        })
      )
    }

    // =========================================
    // KEY POINTS SECTION
    // =========================================
    events.onProgress(55, 'Kernpunkte werden erstellt...')

    if (contentOptions.includeKeyPoints && meeting.notes?.keyPoints?.length) {
      sections.push(createHeading('Kernpunkte', HeadingLevel.HEADING_1))
      sections.push(...createBulletList(meeting.notes.keyPoints))
    }

    // =========================================
    // DECISIONS SECTION
    // =========================================
    events.onProgress(60, 'Entscheidungen werden erstellt...')

    if (contentOptions.includeDecisions && meeting.notes?.decisions?.length) {
      sections.push(createHeading('Entscheidungen', HeadingLevel.HEADING_1))
      sections.push(
        ...meeting.notes.decisions.map(
          (decision) =>
            new Paragraph({
              children: [
                new TextRun({
                  text: '✓ ',
                  color: COLORS.success,
                  size: 22,
                }),
                new TextRun({
                  text: decision,
                  color: COLORS.text,
                  size: 22,
                }),
              ],
              spacing: { after: 100 },
            })
        )
      )
    }

    // =========================================
    // ACTION ITEMS SECTION
    // =========================================
    events.onProgress(65, 'Aufgaben werden erstellt...')

    if (contentOptions.includeActionItems && meeting.notes?.actionItems?.length) {
      sections.push(createHeading('Aufgaben', HeadingLevel.HEADING_1))

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
      sections.push(createHeading('Besprochene Themen', HeadingLevel.HEADING_1))

      for (const topic of meeting.notes.topics) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: topic.title,
                bold: true,
                color: COLORS.text,
                size: 24,
              }),
            ],
            spacing: { before: 200, after: 100 },
          })
        )

        if (topic.summary) {
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: topic.summary,
                  color: COLORS.text,
                  size: 22,
                }),
              ],
              spacing: { after: 100 },
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
      sections.push(createHeading('Nächste Schritte', HeadingLevel.HEADING_1))
      sections.push(...createNumberedList(meeting.notes.nextSteps))
    }

    // =========================================
    // OPEN QUESTIONS SECTION
    // =========================================
    if (contentOptions.includeOpenQuestions && meeting.notes?.openQuestions?.length) {
      sections.push(createHeading('Offene Fragen', HeadingLevel.HEADING_1))
      sections.push(...createBulletList(meeting.notes.openQuestions))
    }

    // =========================================
    // TRANSCRIPT SECTION
    // =========================================
    events.onProgress(80, 'Transkript wird erstellt...')

    if (contentOptions.includeFullTranscript && meeting.transcriptionSegments.length > 0) {
      sections.push(createDivider())
      sections.push(createHeading('Vollständiges Transkript', HeadingLevel.HEADING_1))
      sections.push(
        ...createTranscriptSection(
          meeting.transcriptionSegments,
          meeting.speakers,
          participants
        )
      )
    }

    // =========================================
    // FOOTER
    // =========================================
    sections.push(createDivider())
    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `Erstellt mit VoiceOS am ${formatDate(new Date())} um ${formatTime(new Date())}`,
            color: COLORS.muted,
            size: 18,
            italics: true,
          }),
        ],
        spacing: { before: 400 },
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
                },
              },
            ],
          },
        ],
      },
      styles: {
        default: {
          heading1: {
            run: {
              size: 32,
              bold: true,
              color: COLORS.text,
            },
            paragraph: {
              spacing: {
                before: 400,
                after: 200,
              },
            },
          },
          heading2: {
            run: {
              size: 28,
              bold: true,
              color: COLORS.text,
            },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1),
              },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: config.organization || 'Meeting-Protokoll',
                      color: COLORS.muted,
                      size: 18,
                    }),
                  ],
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: 'Seite ',
                      color: COLORS.muted,
                      size: 18,
                    }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      color: COLORS.muted,
                      size: 18,
                    }),
                    new TextRun({
                      text: ' von ',
                      color: COLORS.muted,
                      size: 18,
                    }),
                    new TextRun({
                      children: [PageNumber.TOTAL_PAGES],
                      color: COLORS.muted,
                      size: 18,
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
