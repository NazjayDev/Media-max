const API = "https://api.elevenlabs.io/v1";

// "Adam" is one of ElevenLabs' default voices; override with ELEVENLABS_VOICE_ID.
const DEFAULT_VOICE_ID = "pNInz6obpgDQGcFmaJgB";
const TTS_MODEL = "eleven_flash_v2_5";
const STT_MODEL = "scribe_v1";

export class ElevenLabsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const elevenLabsConfigured = () => !!process.env.ELEVENLABS_API_KEY;

export const voiceId = () => process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

async function failure(res: Response): Promise<ElevenLabsError> {
  const body = await res.text().catch(() => "");
  return new ElevenLabsError(`ElevenLabs ${res.status}: ${body.slice(0, 200)}`, res.status);
}

/** Speech-to-text with ElevenLabs Scribe. Returns the transcript text. */
export async function transcribe(audio: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append("model_id", STT_MODEL);
  form.append("tag_audio_events", "false");
  form.append("file", audio, filename);

  const res = await fetch(`${API}/speech-to-text`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
    body: form,
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw await failure(res);

  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}

/** Text-to-speech. Returns MP3 bytes. */
export async function synthesize(text: string): Promise<Buffer> {
  const res = await fetch(`${API}/text-to-speech/${voiceId()}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY!,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({ text, model_id: TTS_MODEL }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw await failure(res);
  return Buffer.from(await res.arrayBuffer());
}
