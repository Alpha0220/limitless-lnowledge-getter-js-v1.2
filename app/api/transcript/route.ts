import { NextRequest, NextResponse } from 'next/server'
import path from 'path'

export const dynamic = 'force-dynamic'

import { create } from 'youtube-dl-exec'
const youtubedl = create(path.join(process.cwd(), 'bin', 'yt-dlp'))
import { TranscriptResponse, TranscriptError } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const videoId = searchParams.get('videoId')
    const lang = searchParams.get('lang') || 'en'

    // Validate videoId
    if (!videoId) {
      return NextResponse.json<TranscriptError>(
        { error: 'Video ID is required' },
        { status: 400 }
      )
    }

    // Validate video ID format (should be 11 characters)
    if (videoId.length !== 11) {
      return NextResponse.json<TranscriptError>(
        { error: 'Invalid YouTube video ID' },
        { status: 400 }
      )
    }

    try {
      console.log(`📋 Fetching transcript for videoId: ${videoId}, language: ${lang} using yt-dlp`)

      // Use yt-dlp to dump json with subtitles
      // We use the --skip-download flag to only get metadata
      // --write-subs and --write-auto-subs to get subtitles
      // --sub-lang to specify language

      const output = await youtubedl(
        `https://www.youtube.com/watch?v=${videoId}`,
        {
          dumpSingleJson: true,
          skipDownload: true,
          writeSub: true,
          writeAutoSub: true,
          subLang: lang,
          noWarnings: true,
        }
      )

      // Check if requested language is available in subtitles
      let subtitles = output.subtitles?.[lang] || output.automatic_captions?.[lang]

      // If exact match not found, try to find a variant (e.g. 'en-US' for 'en')
      if (!subtitles) {
        const allSubs = { ...output.subtitles, ...output.automatic_captions }
        const availableLangs = Object.keys(allSubs)
        const match = availableLangs.find(l => l.startsWith(lang))
        if (match) {
          subtitles = allSubs[match]
        }
      }

      if (!subtitles) {
        return NextResponse.json<TranscriptError>(
          { error: `No transcript available for language "${lang}"` },
          { status: 404 }
        )
      }

      // yt-dlp returns a list of formats for the subtitle (vtt, ttml, srv3, etc.)
      // We need to fetch the content of one of them. JSON format is best if available (json3), otherwise vtt.
      // However, yt-dlp dump-json only gives URLs to the subtitle files.
      // We need to fetch the content from that URL.

      const subTrack = subtitles.find((s: any) => s.ext === 'json3') || subtitles.find((s: any) => s.ext === 'vtt') || subtitles[0]

      if (!subTrack || !subTrack.url) {
        return NextResponse.json<TranscriptError>(
          { error: 'Failed to find subtitle track URL' },
          { status: 500 }
        )
      }

      console.log(`Found subtitle track: ${subTrack.ext}, fetching from ${subTrack.url}`)

      const subResponse = await fetch(subTrack.url)
      if (!subResponse.ok) {
        throw new Error(`Failed to fetch subtitle content: ${subResponse.status}`)
      }

      let transcript = []

      if (subTrack.ext === 'json3') {
        const json = await subResponse.json()
        if (json.events) {
          transcript = json.events
            .filter((e: any) => e.segs && e.segs.length > 0)
            .map((e: any) => ({
              text: e.segs.map((s: any) => s.utf8).join(''),
              duration: e.dDurationMs / 1000 || 0,
              offset: e.tStartMs / 1000 || 0,
            }))
        }
      } else {
        // Fallback for VTT or other formats - this is simplified, might need a proper VTT parser
        // For now, let's assume json3 is available for most YouTube videos (it usually is)
        // If not, we might need to add a VTT parser here.
        const text = await subResponse.text()
        // Simple VTT parser
        const lines = text.split('\n')
        let currentSegment: any = null

        for (const line of lines) {
          if (line.includes('-->')) {
            const [start, end] = line.split(' --> ')
            currentSegment = {
              offset: parseVttTime(start),
              duration: parseVttTime(end) - parseVttTime(start),
              text: ''
            }
            transcript.push(currentSegment)
          } else if (currentSegment && line.trim() && !line.startsWith('NOTE') && !line.startsWith('WEBVTT')) {
            currentSegment.text += (currentSegment.text ? ' ' : '') + line.trim()
          }
        }
      }

      console.log(`✅ Transformed transcript: ${transcript.length} segments`)

      const response: TranscriptResponse = {
        videoId,
        transcript,
        totalItems: transcript.length,
      }

      return NextResponse.json(response, { status: 200 })

    } catch (error: any) {
      console.error('yt-dlp Error:', error)
      return NextResponse.json<TranscriptError>(
        {
          error: `Failed to fetch transcript: ${error.message || 'Unknown error'}`,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('General Error:', error)
    return NextResponse.json<TranscriptError>(
      {
        error: 'An error occurred while processing your request',
      },
      { status: 500 }
    )
  }
}

function parseVttTime(timeStr: string): number {
  if (!timeStr) return 0
  const parts = timeStr.trim().split(':')
  let seconds = 0
  if (parts.length === 3) {
    seconds += parseFloat(parts[0]) * 3600
    seconds += parseFloat(parts[1]) * 60
    seconds += parseFloat(parts[2])
  } else if (parts.length === 2) {
    seconds += parseFloat(parts[0]) * 60
    seconds += parseFloat(parts[1])
  }
  return seconds
}
