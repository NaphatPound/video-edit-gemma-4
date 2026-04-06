/**
 * FFmpeg Service - Video processing using FFmpeg.wasm
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpeg = null;
let ffmpegLoaded = false;

/**
 * Initialize FFmpeg - loads the WASM binary
 */
export async function initFFmpeg(progressCallback = null) {
  if (ffmpegLoaded) return true;

  try {
    ffmpeg = new FFmpeg();

    if (progressCallback) {
      ffmpeg.on('progress', ({ progress, time }) => {
        progressCallback(progress * 100, `Processing: ${Math.round(progress * 100)}%`);
      });
    }

    // Load from node_modules - Vite will handle it
    const coreURL = new URL('@ffmpeg/core/dist/esm/ffmpeg-core.js', import.meta.url).href;
    const wasmURL = new URL('@ffmpeg/core/dist/esm/ffmpeg-core.wasm', import.meta.url).href;

    await ffmpeg.load({
      coreURL,
      wasmURL,
    });

    ffmpegLoaded = true;
    console.log('FFmpeg loaded successfully');
    return true;
  } catch (error) {
    console.error('Failed to load FFmpeg:', error);
    return false;
  }
}

/**
 * Extract frames from video at 1 FPS
 * @param {File} videoFile - The video file to process
 * @param {Function} progressCallback - Progress callback (progress: number, message: string)
 * @returns {Promise<string[]>} - Array of base64 encoded frames
 */
export async function extractFrames(videoFile, progressCallback = null) {
  if (!ffmpegLoaded) {
    await initFFmpeg(progressCallback);
  }

  const frames = [];

  try {
    if (progressCallback) progressCallback(5, 'Loading video...');

    // Write input file to FFmpeg virtual filesystem
    const inputData = await fetchFile(videoFile);
    await ffmpeg.writeFile('input.mp4', inputData);

    if (progressCallback) progressCallback(15, 'Extracting frames at 1 FPS...');

    // Extract frames at 1 FPS (every 1 second)
    // Output format: frame_0001.jpg, frame_0002.jpg, etc.
    await ffmpeg.exec([
      '-i', 'input.mp4',
      '-vf', 'fps=1',
      '-q:v', '5', // Quality (2 is high, 5 is medium)
      '-frames:v', '60', // Max 60 frames (60 seconds of video)
      '-f', 'image2',
      'frame_%04d.jpg'
    ]);

    if (progressCallback) progressCallback(70, 'Reading frame data...');

    // Read all extracted frames
    // We need to list and read each frame
    let frameNum = 1;
    let hasMoreFrames = true;

    while (hasMoreFrames && frameNum <= 60) {
      const frameName = `frame_${String(frameNum).padStart(4, '0')}.jpg`;

      try {
        const frameData = await ffmpeg.readFile(frameName);
        const blob = new Blob([frameData.buffer], { type: 'image/jpeg' });
        const base64 = await blobToBase64(blob);
        frames.push(base64);

        if (progressCallback) {
          const progress = 70 + (frameNum / 60) * 25;
          progressCallback(progress, `Extracted frame ${frameNum}`);
        }

        frameNum++;
      } catch {
        hasMoreFrames = false;
      }
    }

    // Cleanup
    await ffmpeg.deleteFile('input.mp4');
    for (let i = 1; i < frameNum; i++) {
      try {
        await ffmpeg.deleteFile(`frame_${String(i).padStart(4, '0')}.jpg`);
      } catch {}
    }

    if (progressCallback) progressCallback(100, `Extracted ${frames.length} frames`);

    return frames;
  } catch (error) {
    console.error('Frame extraction failed:', error);
    throw new Error(`Frame extraction failed: ${error.message}`);
  }
}

/**
 * Extract audio from video as WAV
 * @param {File} videoFile - The video file
 * @param {Function} progressCallback - Progress callback
 * @returns {Promise<Blob>} - Audio blob (WAV format)
 */
export async function extractAudio(videoFile, progressCallback = null) {
  if (!ffmpegLoaded) {
    await initFFmpeg(progressCallback);
  }

  try {
    if (progressCallback) progressCallback(5, 'Loading video for audio extraction...');

    const inputData = await fetchFile(videoFile);
    await ffmpeg.writeFile('input.mp4', inputData);

    if (progressCallback) progressCallback(30, 'Extracting audio...');

    // Extract audio as WAV (16kHz mono for better transcription)
    await ffmpeg.exec([
      '-i', 'input.mp4',
      '-vn', // No video
      '-ac', '1', // Mono
      '-ar', '16000', // 16kHz sample rate
      '-f', 'wav',
      'output.wav'
    ]);

    if (progressCallback) progressCallback(80, 'Reading audio data...');

    const audioData = await ffmpeg.readFile('output.wav');

    // Cleanup
    await ffmpeg.deleteFile('input.mp4');
    await ffmpeg.deleteFile('output.wav');

    if (progressCallback) progressCallback(100, 'Audio extracted');

    return new Blob([audioData.buffer], { type: 'audio/wav' });
  } catch (error) {
    console.error('Audio extraction failed:', error);
    throw new Error(`Audio extraction failed: ${error.message}`);
  }
}

/**
 * Cut and assemble video based on segment decisions
 * @param {File} videoFile - Original video file
 * @param {Array} segments - Array of segment decisions from AI
 * @param {Function} progressCallback - Progress callback
 * @returns {Promise<{videoBlob: Blob, cutSegments: Array}>} - Final video blob and cut info
 */
export async function processVideo(videoFile, segments, progressCallback = null) {
  if (!ffmpegLoaded) {
    await initFFmpeg(progressCallback);
  }

  try {
    if (progressCallback) progressCallback(5, 'Loading video...');

    const inputData = await fetchFile(videoFile);
    await ffmpeg.writeFile('input.mp4', inputData);

    // Build list of segments to keep
    const keepSegments = segments.filter(s => s.type === 'keep');

    if (keepSegments.length === 0) {
      throw new Error('No segments marked to keep');
    }

    if (progressCallback) progressCallback(15, 'Preparing segments...');

    // For each keep segment, extract it and concatenate
    // FFmpeg concat requires intermediate files
    const tempFiles = [];

    for (let i = 0; i < keepSegments.length; i++) {
      const seg = keepSegments[i];
      const startTime = seg.start;
      const duration = seg.end - seg.start;
      const outputName = `segment_${i}.mp4`;

      if (progressCallback) {
        progressCallback(15 + (i / keepSegments.length) * 40, `Cutting segment ${i + 1}/${keepSegments.length}...`);
      }

      try {
        await ffmpeg.exec([
          '-i', 'input.mp4',
          '-ss', String(startTime),
          '-t', String(duration),
          '-c', 'copy',
          '-avoid_negative_ts', 'make_zero',
          outputName
        ]);
        tempFiles.push(outputName);
      } catch (err) {
        console.warn(`Failed to extract segment ${i}:`, err);
      }
    }

    if (tempFiles.length === 0) {
      throw new Error('Failed to extract any segments');
    }

    if (progressCallback) progressCallback(60, 'Concatenating segments...');

    let finalBlob;

    if (tempFiles.length === 1) {
      // Single segment - just rename
      const data = await ffmpeg.readFile(tempFiles[0]);
      finalBlob = new Blob([data.buffer], { type: 'video/mp4' });
    } else {
      // Multiple segments - need to concat
      // Create concat file list
      const concatList = tempFiles.map(f => `file '${f}'`).join('\n');
      await ffmpeg.writeFile('concat.txt', new TextEncoder().encode(concatList));

      try {
        await ffmpeg.exec([
          '-f', 'concat',
          '-safe', '0',
          '-i', 'concat.txt',
          '-c', 'copy',
          'output.mp4'
        ]);

        const outputData = await ffmpeg.readFile('output.mp4');
        finalBlob = new Blob([outputData.buffer], { type: 'video/mp4' });
      } catch {
        // Fallback: just use first segment
        const data = await ffmpeg.readFile(tempFiles[0]);
        finalBlob = new Blob([data.buffer], { type: 'video/mp4' });
      }
    }

    // Cleanup all temp files
    await ffmpeg.deleteFile('input.mp4');
    for (const f of tempFiles) {
      try { await ffmpeg.deleteFile(f); } catch {}
    }
    try { await ffmpeg.deleteFile('concat.txt'); } catch {}
    try { await ffmpeg.deleteFile('output.mp4'); } catch {}

    if (progressCallback) progressCallback(100, 'Video processed successfully');

    return {
      videoBlob: finalBlob,
      cutSegments: keepSegments
    };
  } catch (error) {
    console.error('Video processing failed:', error);
    throw new Error(`Video processing failed: ${error.message}`);
  }
}

/**
 * Add subtitles/burn text into video
 * @param {Blob} videoBlob - Input video
 * @param {Array} segments - Segments with subtitles
 * @param {Function} progressCallback - Progress callback
 * @returns {Promise<Blob>} - Video with burned subtitles
 */
export async function addSubtitles(videoBlob, segments, progressCallback = null) {
  if (!ffmpegLoaded) {
    await initFFmpeg(progressCallback);
  }

  try {
    if (progressCallback) progressCallback(5, 'Loading video...');

    const inputData = await fetchFile(videoBlob);
    await ffmpeg.writeFile('input.mp4', inputData);

    // Build ASS subtitle file from segments
    const assContent = buildAssSubtitles(segments);
    await ffmpeg.writeFile('subtitles.ass', new TextEncoder().encode(assContent));

    if (progressCallback) progressCallback(40, 'Burning subtitles...');

    await ffmpeg.exec([
      '-i', 'input.mp4',
      '-vf', `ass=subtitles.ass`,
      '-c:a', 'copy',
      'output.mp4'
    ]);

    if (progressCallback) progressCallback(80, 'Finalizing...');

    const outputData = await ffmpeg.readFile('output.mp4');

    // Cleanup
    await ffmpeg.deleteFile('input.mp4');
    await ffmpeg.deleteFile('subtitles.ass');
    await ffmpeg.deleteFile('output.mp4');

    if (progressCallback) progressCallback(100, 'Subtitles added');

    return new Blob([outputData.buffer], { type: 'video/mp4' });
  } catch (error) {
    console.error('Subtitle burning failed:', error);
    throw new Error(`Subtitle burning failed: ${error.message}`);
  }
}

/**
 * Build ASS subtitle format from segments
 */
function buildAssSubtitles(segments) {
  const keepSegments = segments.filter(s => s.type === 'keep' && s.subtitle);

  let ass = `[Script Info]
Title: Generated Subtitles
ScriptType: v4.00+
Collisions: Normal
PlayDepth: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Text
`;

  keepSegments.forEach((seg, idx) => {
    const startTime = formatAssTime(seg.start);
    const endTime = formatAssTime(seg.end);
    const text = seg.subtitle.replace(/"/g, "'");
    ass += `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${text}\n`;
  });

  return ass;
}

function formatAssTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/**
 * Helper: Convert Blob to Base64
 */
async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Check if FFmpeg is loaded
 */
export function isFFmpegLoaded() {
  return ffmpegLoaded;
}
