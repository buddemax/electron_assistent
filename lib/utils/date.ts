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
 * Resolve a relative or absolute date string to a Date object
 */
export function resolveDate(dateStr: string, timeStr: string): Date {
  const now = new Date()
  const targetDate = new Date(now)

  // Reset time to midnight
  targetDate.setHours(0, 0, 0, 0)

  const lowerDate = dateStr.toLowerCase().trim()

  // Handle relative dates
  if (lowerDate === 'heute') {
    // Keep today
  } else if (lowerDate === 'morgen') {
    targetDate.setDate(now.getDate() + 1)
  } else if (lowerDate === 'übermorgen') {
    targetDate.setDate(now.getDate() + 2)
  } else if (lowerDate.startsWith('nächste woche')) {
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

    // If it's the same day and past noon, assume next week
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
