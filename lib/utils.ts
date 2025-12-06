import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null

  // Remove whitespace
  url = url.trim()

  // Pattern 1: https://www.youtube.com/watch?v=VIDEO_ID
  const watchPattern = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  const match = url.match(watchPattern)
  
  if (match && match[1]) {
    return match[1]
  }

  // Pattern 2: Short URL youtu.be/VIDEO_ID
  const shortPattern = /youtu\.be\/([a-zA-Z0-9_-]{11})/
  const shortMatch = url.match(shortPattern)
  
  if (shortMatch && shortMatch[1]) {
    return shortMatch[1]
  }

  // Pattern 3: Embed URL
  const embedPattern = /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/
  const embedMatch = url.match(embedPattern)
  
  if (embedMatch && embedMatch[1]) {
    return embedMatch[1]
  }

  return null
}

/**
 * Format seconds to SRT time format (HH:MM:SS,mmm)
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const milliseconds = Math.floor((seconds % 1) * 1000)

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`
}

/**
 * Validate YouTube URL
 */
export function isValidYouTubeUrl(url: string): boolean {
  return extractVideoId(url) !== null
}

