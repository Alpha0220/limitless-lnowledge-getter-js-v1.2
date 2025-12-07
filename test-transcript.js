const { YoutubeTranscript } = require('youtube-transcript');

async function test() {
  try {
    console.log('Fetching transcript for jNQXAC9IVRw (Me at the zoo)...');
    const transcript = await YoutubeTranscript.fetchTranscript('jNQXAC9IVRw');
    console.log('Success!');
    console.log(transcript.slice(0, 5));
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
