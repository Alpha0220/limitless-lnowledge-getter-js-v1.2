import { NextRequest, NextResponse } from 'next/server'
import { YoutubeTranscript } from 'youtube-transcript'
import { extractVideoId } from '@/lib/utils'
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
      // Try to fetch transcript using library first
      // If that fails, fallback to direct YouTube API
      console.log(`📋 Fetching transcript for videoId: ${videoId}, language: ${lang}`)
      
      // Prepare options for YouTube transcript
      const options: any = {
        lang: lang,
      }

      // Retry mechanism for IP blocking and rate limiting
      let transcriptData
      const maxRetries = 5 // Increased retries for rate limiting
      let lastError: any = null

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Add delay before each attempt (except first) to avoid rate limiting
          if (attempt > 1) {
            const delay = Math.min(2000 * (attempt - 1), 10000) // Progressive delay: 2s, 4s, 6s, 8s, 10s
            console.log(`⏳ Waiting ${delay}ms before attempt ${attempt}...`)
            await new Promise((resolve) => setTimeout(resolve, delay))
          }

          console.log(`🔄 Attempt ${attempt}/${maxRetries}: Fetching transcript for videoId=${videoId}, lang=${lang}`)
          
          try {
            transcriptData = await YoutubeTranscript.fetchTranscript(
              videoId,
              options
            )
          } catch (fetchError: any) {
            // Log the actual error from library
            console.error(`❌ Library fetch error:`, {
              message: fetchError?.message,
              name: fetchError?.name,
              stack: fetchError?.stack?.substring(0, 300),
              toString: String(fetchError),
            })
            throw fetchError // Re-throw to be caught by outer catch
          }
          
          // Log what we got from library
          console.log(`📦 Attempt ${attempt}: Got transcript data:`, {
            type: typeof transcriptData,
            isArray: Array.isArray(transcriptData),
            length: Array.isArray(transcriptData) ? transcriptData.length : 'N/A',
            sample: Array.isArray(transcriptData) && transcriptData.length > 0 ? transcriptData[0] : null,
          })
          
          // Log options being used
          console.log(`🔧 Options used:`, {
            lang: options.lang,
          })
          
          // If we got data (even if empty), break the retry loop
          // Empty array means no transcript available, not an error
          if (Array.isArray(transcriptData)) {
            if (transcriptData.length === 0) {
              console.warn(`⚠️ Attempt ${attempt}: Library returned empty array`)
              console.log(`   This usually means:`)
              console.log(`   1. Video has no transcript in language "${lang}"`)
              console.log(`   2. YouTube blocked the request silently`)
              console.log(`   3. Language code "${lang}" doesn't match YouTube's format`)
              console.log(`   4. Library successfully fetched but YouTube returned empty data`)
              console.log(`   Video ID: ${videoId}`)
              
              // Try to get available languages to compare
              console.log(`💡 Tip: Check if this language is actually available via /api/languages?videoId=${videoId}`)
            }
            break // Success (even if empty), exit retry loop
          }
          
          // If not an array, something went wrong
          console.error(`❌ Transcript data is not an array:`, transcriptData)
          throw new Error(`Invalid transcript data format: ${typeof transcriptData}`)
        } catch (error: any) {
          lastError = error
          
          // Log error details
          console.error(`❌ Attempt ${attempt} failed:`, {
            error: error?.message,
            name: error?.name,
            stack: error?.stack?.substring(0, 500), // First 500 chars of stack
          })
          
          // Check if it's a blocking/rate limit error
          const errorMsg = String(error?.message || '').toLowerCase()
          const errorStack = String(error?.stack || '').toLowerCase()
          const isBlockingError =
            errorMsg.includes('429') ||
            errorMsg.includes('rate limit') ||
            errorMsg.includes('too many requests') ||
            errorMsg.includes('blocked') ||
            errorMsg.includes('forbidden') ||
            errorStack.includes('429') ||
            errorStack.includes('too many requests') ||
            error?.status === 429 ||
            error?.status === 403

          if (isBlockingError && attempt < maxRetries) {
            // Wait before retry (exponential backoff with longer delays for rate limiting)
            const delay = Math.min(3000 * Math.pow(2, attempt - 1), 15000) // Longer delays: 3s, 6s, 12s, 15s
            console.log(
              `⚠️ Rate limit detected (429). Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`
            )
            await new Promise((resolve) => setTimeout(resolve, delay))
            continue
          } else if (!isBlockingError && attempt < maxRetries) {
            // For non-rate-limit errors, shorter delay
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
            console.log(
              `Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`
            )
            await new Promise((resolve) => setTimeout(resolve, delay))
            continue
          } else {
            throw error // Not a retryable error or max retries reached
          }
        }
      }

      if (!transcriptData) {
        throw lastError || new Error('Failed to fetch transcript after retries')
      }

      // Log raw transcript data for debugging
      console.log('🔍 Raw transcriptData from library:', {
        type: typeof transcriptData,
        isArray: Array.isArray(transcriptData),
        length: Array.isArray(transcriptData) ? transcriptData.length : 'N/A',
        firstItem: Array.isArray(transcriptData) && transcriptData.length > 0 ? transcriptData[0] : null,
        fullData: transcriptData,
      })

      // Check if transcriptData is empty
      if (!Array.isArray(transcriptData)) {
        console.error('❌ Transcript data is not an array:', transcriptData)
        return NextResponse.json<TranscriptError>(
          {
            error: 'Invalid transcript data format received from YouTube',
          },
          { status: 500 }
        )
      }
      
      if (transcriptData.length === 0) {
        console.warn('⚠️ Library returned empty array, trying fallback method...')
        
        // Fallback: Try to fetch transcript directly from YouTube API
        try {
          console.log('🔄 Attempting fallback: Fetching transcript directly from YouTube API')
          const fallbackTranscript = await fetchTranscriptDirectly(videoId, lang)
          
          if (fallbackTranscript && fallbackTranscript.length > 0) {
            console.log(`✅ Fallback method succeeded! Got ${fallbackTranscript.length} segments`)
            transcriptData = fallbackTranscript
          } else {
            throw new Error('Fallback method also returned empty result')
          }
        } catch (fallbackError: any) {
          console.error('❌ Fallback method failed:', fallbackError?.message)
          console.warn('⚠️ Transcript data is empty array')
          console.log('🔍 Possible reasons:')
          console.log(`  1. Video (${videoId}) has no transcript in language "${lang}"`)
          console.log('  2. Library returned empty array (YouTube may have blocked silently)')
          console.log(`  3. Language code "${lang}" may not match YouTube's format`)
          console.log('  4. Video may require authentication or have region restrictions')
          console.log('  5. youtube-transcript library may have compatibility issues')
          
          // Try to get more info about what languages are actually available
          console.log('💡 Suggestion: Check /api/languages endpoint to see what languages are actually available for this video')
          console.log(`💡 Try accessing: /api/languages?videoId=${videoId}`)
          console.log('💡 Note: This is a known issue with youtube-transcript library when YouTube blocks requests silently')
          console.log('💡 The library returns empty array instead of throwing an error')
          
          return NextResponse.json<TranscriptError>(
            {
              error: `No transcript available for this video in language "${lang}".\n\nPossible causes:\n• Video doesn't have transcript in this language\n• YouTube is blocking requests silently\n• Language code format mismatch\n\nTry:\n• Selecting a different language\n• Checking /api/languages to see available languages\n• Trying a different video that definitely has transcripts`,
            },
            { status: 404 }
          )
        }
      }

      // Transform the data to match our interface
      const transcript = transcriptData.map((item: any, index: number) => {
        // Log first few items structure for debugging
        if (index < 3) {
          console.log(`📋 Transcript item ${index}:`, {
            item,
            keys: Object.keys(item),
            text: item.text,
            duration: item.duration,
            offset: item.offset,
          })
        }
        
        // Handle different possible property names
        return {
          text: item.text || item.text || '',
          duration: item.duration || item.dur || 0,
          offset: item.offset || item.start || item.startTime || 0,
        }
      })
      
      console.log('✅ Transformed transcript:', {
        length: transcript.length,
        firstItem: transcript[0],
        lastItem: transcript[transcript.length - 1],
      })

      const response: TranscriptResponse = {
        videoId,
        transcript,
        totalItems: transcript.length,
      }

      return NextResponse.json(response, { status: 200 })
    } catch (error: any) {
      // Log error for debugging
      console.error('YouTube Transcript Error:', {
        videoId,
        lang,
        error: error?.message,
        stack: error?.stack,
        name: error?.name,
      })

      // Handle specific YouTube transcript errors
      const errorMessage = String(error?.message || '')
      const errorMessageLower = errorMessage.toLowerCase()
      const errorName = String(error?.name || '').toLowerCase()

      // Check for various error types
      if (
        errorMessageLower.includes('transcript is disabled') ||
        errorMessageLower.includes('could not retrieve a transcript') ||
        errorMessageLower.includes('no transcript found') ||
        errorMessageLower.includes('transcript not available') ||
        errorMessageLower.includes('unable to retrieve transcript') ||
        errorMessageLower.includes('no transcripts are available') ||
        errorMessage.includes('🚨') ||
        errorMessage.includes('No transcripts are available')
      ) {
        return NextResponse.json<TranscriptError>(
          {
            error: 'No transcript available for this video in the selected language',
          },
          { status: 404 }
        )
      }

      if (
        errorMessage.includes('invalid video id') ||
        errorMessage.includes('video not found') ||
        errorMessage.includes('video does not exist')
      ) {
        return NextResponse.json<TranscriptError>(
          { error: 'Invalid YouTube video ID or video not found' },
          { status: 400 }
        )
      }

      // Check for network/rate limiting/IP blocking errors
      const isRateLimitError =
        errorMessage.includes('rate limit') ||
        errorMessage.includes('too many requests') ||
        errorMessage.includes('429') ||
        errorMessage.includes('403') ||
        errorMessage.includes('forbidden') ||
        errorMessage.includes('blocked') ||
        errorMessage.includes('access denied') ||
        errorName.includes('fetch') ||
        error?.status === 429 ||
        error?.status === 403

      if (isRateLimitError) {
        let rateLimitMessage = '⚠️ YouTube is rate limiting requests (429 Too Many Requests).'
        rateLimitMessage += '\n\nThis happens when:'
        rateLimitMessage += '\n• Making too many requests too quickly'
        rateLimitMessage += '\n• YouTube detects automated requests'
        rateLimitMessage += '\n• IP address has been flagged'
        rateLimitMessage += '\n\nSolutions:'
        rateLimitMessage += '\n1. Wait a few minutes and try again'
        rateLimitMessage += '\n2. Deploy to Vercel for better IP reputation'

        return NextResponse.json<TranscriptError>(
          {
            error: rateLimitMessage,
          },
          { status: 429 }
        )
      }

      // Generic error with more details in development
      return NextResponse.json<TranscriptError>(
        {
          error:
            process.env.NODE_ENV === 'development'
              ? `Error: ${errorMessage || 'Unknown error occurred'}`
              : 'An error occurred while fetching the transcript. Please try again.',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    return NextResponse.json<TranscriptError>(
      {
        error: 'An error occurred while processing your request',
      },
      { status: 500 }
    )
  }
}

// Fallback method: Fetch transcript directly from YouTube API using baseUrl from captionTracks
async function fetchTranscriptDirectly(
  videoId: string,
  lang: string
): Promise<any[]> {
  try {
    console.log(`🔍 Fetching YouTube page to get caption tracks for videoId: ${videoId}, lang: ${lang}`)
    
    // Fetch YouTube watch page
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`
    const response = await fetch(watchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch YouTube page: ${response.status}`)
    }

    const html = await response.text()

    // Extract caption tracks from page HTML
    // Try multiple regex patterns to find captionTracks
    let captionTracksMatch = html.match(/"captionTracks":(\[[^\]]*\])/)
    
    // If first pattern doesn't work, try a more flexible pattern
    if (!captionTracksMatch) {
      captionTracksMatch = html.match(/"captionTracks":(\[.*?\])/)
    }
    
    if (!captionTracksMatch) {
      throw new Error('Could not find captionTracks in YouTube page')
    }

    let captionTracks: any[]
    try {
      captionTracks = JSON.parse(captionTracksMatch[1])
    } catch (parseError) {
      // Try to unescape the JSON string
      const unescaped = captionTracksMatch[1].replace(/\\u0026/g, '&').replace(/\\"/g, '"')
      captionTracks = JSON.parse(unescaped)
    }
    
    console.log(`📋 Found ${captionTracks.length} caption tracks`)

    // Find the track matching the requested language
    const matchingTrack = captionTracks.find(
      (track: any) => track.languageCode === lang
    )

    if (!matchingTrack) {
      console.log(`⚠️ No track found for language "${lang}"`)
      console.log(`Available languages: ${captionTracks.map((t: any) => t.languageCode).join(', ')}`)
      throw new Error(`No caption track found for language "${lang}"`)
    }

    let baseUrl = matchingTrack.baseUrl
    if (!baseUrl) {
      throw new Error('Caption track has no baseUrl')
    }

    // Decode URL if it's escaped
    baseUrl = baseUrl
      .replace(/\\u0026/g, '&')
      .replace(/\\u003D/g, '=')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
    
    // Ensure fmt parameter is set to get XML format
    try {
      const urlObj = new URL(baseUrl)
      if (!urlObj.searchParams.has('fmt')) {
        urlObj.searchParams.set('fmt', '3') // fmt=3 is XML format
      }
      baseUrl = urlObj.toString()
    } catch (urlError) {
      console.warn('⚠️ Failed to parse baseUrl as URL, using as-is:', urlError)
    }

    console.log(`✅ Found matching track for "${lang}"`)
    console.log(`🔗 baseUrl (first 300 chars): ${baseUrl.substring(0, 300)}...`)
    
    // Fetch transcript from baseUrl immediately (URLs may expire quickly)
    // Use more browser-like headers to avoid detection
    const transcriptResponse = await fetch(baseUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/xml,application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,*/*;q=0.5',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': `https://www.youtube.com/watch?v=${videoId}`,
        'Origin': 'https://www.youtube.com',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    })

    console.log(`📡 Transcript response status: ${transcriptResponse.status}`)
    console.log(`📡 Transcript response headers:`, {
      'content-type': transcriptResponse.headers.get('content-type'),
      'content-length': transcriptResponse.headers.get('content-length'),
    })

    if (!transcriptResponse.ok) {
      const errorText = await transcriptResponse.text()
      console.error(`❌ Failed to fetch transcript: ${transcriptResponse.status}`)
      console.error(`❌ Error response: ${errorText.substring(0, 500)}`)
      throw new Error(`Failed to fetch transcript: ${transcriptResponse.status} - ${errorText.substring(0, 100)}`)
    }

    const transcriptXml = await transcriptResponse.text()
    
    // Check if response is actually empty
    if (!transcriptXml || transcriptXml.trim().length === 0) {
      console.error(`❌ Transcript XML is empty!`)
      console.error(`Response status: ${transcriptResponse.status}`)
      console.error(`Response headers:`, Object.fromEntries(transcriptResponse.headers.entries()))
      throw new Error('Transcript XML response is empty - URL may have expired or video has no transcript')
    }
    
    // Log first 500 chars of XML for debugging
    console.log(`📄 Transcript XML preview (first 500 chars):`, transcriptXml.substring(0, 500))
    console.log(`📄 Transcript XML length: ${transcriptXml.length} chars`)
    
    // Parse XML transcript
    const transcript = parseTranscriptXml(transcriptXml)
    
    console.log(`✅ Successfully parsed ${transcript.length} transcript segments`)
    if (transcript.length > 0) {
      console.log(`📋 First segment:`, transcript[0])
    }
    return transcript
  } catch (error: any) {
    console.error('❌ Error in fetchTranscriptDirectly:', error?.message)
    throw error
  }
}

// Parse YouTube transcript XML format
function parseTranscriptXml(xml: string): any[] {
  try {
    // YouTube transcript XML format can be:
    // Format 1: <text start="0.0" dur="5.5">Hello world</text>
    // Format 2: <text start="0.0" dur="5.5"><![CDATA[Hello world]]></text>
    // Format 3: May have escaped characters
    
    console.log('🔍 Parsing transcript XML...')
    
    // Try multiple regex patterns
    let textMatches: RegExpMatchArray[] = []
    
    // Pattern 1: Standard format
    const pattern1 = /<text\s+start="([^"]+)"\s+dur="([^"]+)"[^>]*>([^<]*)<\/text>/g
    let match
    while ((match = pattern1.exec(xml)) !== null) {
      textMatches.push(match)
    }
    
    // Pattern 2: With CDATA
    if (textMatches.length === 0) {
      const pattern2 = /<text\s+start="([^"]+)"\s+dur="([^"]+)"[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/text>/g
      while ((match = pattern2.exec(xml)) !== null) {
        textMatches.push(match)
      }
    }
    
    // Pattern 3: More flexible pattern
    if (textMatches.length === 0) {
      const pattern3 = /<text[^>]*start="([^"]+)"[^>]*dur="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g
      while ((match = pattern3.exec(xml)) !== null) {
        textMatches.push(match)
      }
    }
    
    console.log(`📊 Found ${textMatches.length} text matches`)
    
    const transcript: any[] = []
    
    for (const match of textMatches) {
      const start = parseFloat(match[1])
      const duration = parseFloat(match[2])
      let text = match[3] || ''
      
      // Remove CDATA wrapper if present
      text = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      
      // Decode HTML entities
      text = text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
        .trim()
      
      if (text) {
        transcript.push({
          text,
          duration,
          offset: start,
        })
      }
    }
    
    console.log(`✅ Parsed ${transcript.length} transcript segments`)
    
    if (transcript.length === 0 && xml.length > 0) {
      console.warn('⚠️ No segments parsed but XML is not empty')
      console.log('XML sample:', xml.substring(0, 1000))
    }
    
    return transcript
  } catch (error: any) {
    console.error('❌ Error parsing transcript XML:', error)
    console.error('XML sample:', xml.substring(0, 500))
    throw new Error(`Failed to parse transcript XML: ${error?.message}`)
  }
}

