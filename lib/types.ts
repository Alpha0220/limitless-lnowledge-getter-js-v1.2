export interface TranscriptItem {
  text: string
  duration: number
  offset: number
}

export interface TranscriptResponse {
  videoId: string
  transcript: TranscriptItem[]
  totalItems: number
}

export interface TranscriptError {
  error: string
}

export type FormatType = 'text' | 'srt' | 'json'

export interface LanguageOption {
  value: string
  label: string
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { value: 'en', label: 'English' },
  { value: 'th', label: 'Thai' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
]

