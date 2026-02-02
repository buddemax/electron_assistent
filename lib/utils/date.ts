/**
 * Date utilities for calendar integration
 */

const GERMAN_DAYS: Record<string, number> = {
  sonntag: 0,
  montag: 1,
  dienstag: 2,
  mittwoch: 3,
  donnerstag: 4,
  freitag: 5,
  samstag: 6,
}

/**
 * Pattern matchers for relative date expressions
 */
interface RelativeTimePattern {
  pattern: RegExp
  resolver: (match: RegExpMatchArray, now: Date) => Date
}

const RELATIVE_PATTERNS: RelativeTimePattern[] = [
  // "in X Tagen"
  {
    pattern: /^in\s+(\d+)\s+tag(?:en)?$/i,
    resolver: (match, now) => {
      const days = parseInt(match[1], 10)
      const target = new Date(now)
      target.setDate(now.getDate() + days)
      return target
    }
  },
  // "in X Wochen"
  {
    pattern: /^in\s+(\d+)\s+woche(?:n)?$/i,
    resolver: (match, now) => {
      const weeks = parseInt(match[1], 10)
      const target = new Date(now)
      target.setDate(now.getDate() + weeks * 7)
      return target
    }
  },
  // "in X Monaten"
  {
    pattern: /^in\s+(\d+)\s+monat(?:en)?$/i,
    resolver: (match, now) => {
      const months = parseInt(match[1], 10)
      const target = new Date(now)
      target.setMonth(now.getMonth() + months)
      return target
    }
  },
  // "nächsten Montag/Dienstag/..." or "nächster Montag"
  {
    pattern: /^n[aä]chste[rn]?\s+(\w+)$/i,
    resolver: (match, now) => {
      const dayName = match[1].toLowerCase()
      const targetDay = GERMAN_DAYS[dayName]
      if (targetDay === undefined) return now

      const target = new Date(now)
      const currentDay = now.getDay()
      let daysUntil = (targetDay - currentDay + 7) % 7
      if (daysUntil === 0) daysUntil = 7 // Next week, not today

      target.setDate(now.getDate() + daysUntil)
      return target
    }
  },
  // "übernächsten Montag/..." or "übernächster Montag"
  {
    pattern: /^[uü]bern[aä]chste[rn]?\s+(\w+)$/i,
    resolver: (match, now) => {
      const dayName = match[1].toLowerCase()
      const targetDay = GERMAN_DAYS[dayName]
      if (targetDay === undefined) return now

      const target = new Date(now)
      const currentDay = now.getDay()
      let daysUntil = (targetDay - currentDay + 7) % 7
      if (daysUntil === 0) daysUntil = 7
      daysUntil += 7 // One week further

      target.setDate(now.getDate() + daysUntil)
      return target
    }
  },
  // "am Montag/Dienstag/..." (without "nächsten")
  {
    pattern: /^am\s+(\w+)$/i,
    resolver: (match, now) => {
      const dayName = match[1].toLowerCase()
      const targetDay = GERMAN_DAYS[dayName]
      if (targetDay === undefined) return now

      const target = new Date(now)
      const currentDay = now.getDay()
      let daysUntil = (targetDay - currentDay + 7) % 7
      if (daysUntil === 0) daysUntil = 7

      target.setDate(now.getDate() + daysUntil)
      return target
    }
  },
  // "Ende der Woche" / "Wochenende" / "Ende Woche"
  {
    pattern: /^(?:ende\s+(?:der\s+)?woche|wochenende)$/i,
    resolver: (_, now) => {
      const target = new Date(now)
      const currentDay = now.getDay()
      // Friday = 5
      const daysUntilFriday = (5 - currentDay + 7) % 7 || 7
      target.setDate(now.getDate() + daysUntilFriday)
      return target
    }
  },
  // "Anfang nächster Woche" / "Anfang der Woche"
  {
    pattern: /^anfang\s+(?:n[aä]chster?\s+)?woche$/i,
    resolver: (_, now) => {
      const target = new Date(now)
      const currentDay = now.getDay()
      // Monday = 1
      const daysUntilMonday = (1 - currentDay + 7) % 7 || 7
      target.setDate(now.getDate() + daysUntilMonday)
      return target
    }
  },
  // "Mitte der Woche" / "Mitte nächster Woche"
  {
    pattern: /^mitte\s+(?:(?:der|n[aä]chster?)\s+)?woche$/i,
    resolver: (_, now) => {
      const target = new Date(now)
      const currentDay = now.getDay()
      // Wednesday = 3
      let daysUntilWednesday = (3 - currentDay + 7) % 7
      if (daysUntilWednesday <= 0) daysUntilWednesday += 7
      target.setDate(now.getDate() + daysUntilWednesday)
      return target
    }
  },
]

/**
 * Resolve a relative or absolute date string to a Date object
 */
export function resolveDate(dateStr: string, timeStr: string): Date {
  const now = new Date()
  const targetDate = new Date(now)

  // Reset time to midnight
  targetDate.setHours(0, 0, 0, 0)

  const lowerDate = dateStr.toLowerCase().trim()

  // Handle simple relative dates
  if (lowerDate === 'heute') {
    // Keep today
  } else if (lowerDate === 'morgen') {
    targetDate.setDate(now.getDate() + 1)
  } else if (lowerDate === 'übermorgen') {
    targetDate.setDate(now.getDate() + 2)
  } else {
    // Try extended relative patterns first
    let matched = false

    for (const { pattern, resolver } of RELATIVE_PATTERNS) {
      const match = lowerDate.match(pattern)
      if (match) {
        const resolved = resolver(match, now)
        targetDate.setFullYear(resolved.getFullYear())
        targetDate.setMonth(resolved.getMonth())
        targetDate.setDate(resolved.getDate())
        matched = true
        break
      }
    }

    if (!matched) {
      // Handle "nächste woche" with optional day name
      if (lowerDate.startsWith('nächste woche')) {
        // Next week - add 7 days
        targetDate.setDate(now.getDate() + 7)

        // Check if there's a day name after "nächste woche"
        const parts = lowerDate.split(' ')
        if (parts.length >= 3) {
          const dayName = parts[2]
          if (GERMAN_DAYS[dayName] !== undefined) {
            const targetDay = GERMAN_DAYS[dayName]
            const currentDay = targetDate.getDay()
            const diff = (targetDay - currentDay + 7) % 7
            targetDate.setDate(targetDate.getDate() + diff)
          }
        }
      } else if (GERMAN_DAYS[lowerDate] !== undefined) {
        // Day name (Montag, Dienstag, etc.)
        const targetDay = GERMAN_DAYS[lowerDate]
        const currentDay = now.getDay()
        let daysUntil = (targetDay - currentDay + 7) % 7

        // If it's the same day, assume next week
        if (daysUntil === 0) {
          daysUntil = 7
        }

        targetDate.setDate(now.getDate() + daysUntil)
      } else if (lowerDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // ISO date format
        const parsed = new Date(dateStr)
        if (!isNaN(parsed.getTime())) {
          targetDate.setFullYear(parsed.getFullYear())
          targetDate.setMonth(parsed.getMonth())
          targetDate.setDate(parsed.getDate())
        }
      } else if (lowerDate.match(/^\d{1,2}\.\d{1,2}\.(\d{2,4})?$/)) {
        // German date format (DD.MM. or DD.MM.YYYY)
        const parts = lowerDate.split('.')
        const day = parseInt(parts[0], 10)
        const month = parseInt(parts[1], 10) - 1
        let year = now.getFullYear()

        if (parts[2]) {
          year = parseInt(parts[2], 10)
          if (year < 100) year += 2000
        }

        targetDate.setFullYear(year)
        targetDate.setMonth(month)
        targetDate.setDate(day)
      }
    }
  }

  // Parse time
  const timeMatch = timeStr.match(/(\d{1,2}):?(\d{2})?/)
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10)
    const minutes = parseInt(timeMatch[2] || '0', 10)

    // Handle "nachmittags" or "abends" modifier
    const lowerTime = timeStr.toLowerCase()
    if ((lowerTime.includes('nachmittag') || lowerTime.includes('pm')) && hours < 12) {
      hours += 12
    }
    if (lowerTime.includes('abend') && hours < 18) {
      hours += 12
    }

    targetDate.setHours(hours)
    targetDate.setMinutes(minutes)
    targetDate.setSeconds(0)
    targetDate.setMilliseconds(0)
  }

  return targetDate
}

/**
 * Format a date for display in German
 */
export function formatDateGerman(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Format a time range for display
 */
export function formatTimeRange(startDate: Date, endDate: Date): string {
  const start = startDate.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const end = endDate.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${start} - ${end} Uhr`
}

/**
 * Format duration in human-readable German
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} Minuten`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (remainingMinutes === 0) {
    return hours === 1 ? '1 Stunde' : `${hours} Stunden`
  }

  return `${hours} Std. ${remainingMinutes} Min.`
}
