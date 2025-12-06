import { TranscriptItem } from './types'
import { formatTime } from './utils'

/**
 * Format transcript to plain text
 */
export function formatAsText(transcript: TranscriptItem[]): string {
  return transcript.map(item => item.text).join(' ')
}

/**
 * Format transcript to SRT format
 */
export function formatAsSRT(transcript: TranscriptItem[]): string {
  return transcript
    .map((item, index) => {
      const start = formatTime(item.offset)
      const end = formatTime(item.offset + item.duration)
      return `${index + 1}\n${start} --> ${end}\n${item.text}\n`
    })
    .join('\n')
}

/**
 * Format transcript to JSON
 */
export function formatAsJSON(transcript: TranscriptItem[]): string {
  return JSON.stringify(transcript, null, 2)
}

/**
 * Get file extension for format type
 */
export function getFileExtension(format: 'text' | 'srt' | 'json'): string {
  switch (format) {
    case 'text':
      return 'txt'
    case 'srt':
      return 'srt'
    case 'json':
      return 'json'
  }
}

/**
 * Get MIME type for format type
 */
export function getMimeType(format: 'text' | 'srt' | 'json'): string {
  switch (format) {
    case 'text':
      return 'text/plain'
    case 'srt':
      return 'text/srt'
    case 'json':
      return 'application/json'
  }
}

