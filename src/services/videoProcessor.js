/**
 * Video Processing Service - Using HTML5 Canvas for frame extraction
 * No FFmpeg required - uses browser's native video capabilities
 */

let ffmpegLoaded = true;

/**
 * Initialize - no-op for canvas-based extraction
 */
export async function initFFmpeg(progressCallback = null) {
  ffmpegLoaded = true;
  return true;
}

/**
 * Check if processor is ready
 */
export function isFFmpegLoaded() {
  return true;
}

/**
 * Extract frames from video at 1 FPS using HTML5 Canvas
 */
export async function extractFrames(videoFile, progressCallback = null) {
  return new Promise((resolve, reject) => {
    const frames = [];
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    let totalFrames = 0;
    let currentFrame = 0;

    const extractNextFrame = () => {
      if (currentFrame >= totalFrames) {
        if (progressCallback) progressCallback(100, `Extracted ${frames.length} frames`);
        URL.revokeObjectURL(video.src);
        resolve(frames);
        return;
      }

      const time = currentFrame;
      video.currentTime = time;
    };

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      totalFrames = Math.min(Math.floor(video.duration), 60);

      if (progressCallback) progressCallback(10, `Video loaded: ${totalFrames} frames to extract`);
      extractNextFrame();
    };

    video.onseeked = () => {
      // Draw current frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Only add frame if we haven't reached the limit
      if (currentFrame < totalFrames) {
        const frameData = canvas.toDataURL('image/jpeg', 0.6);
        frames.push(frameData);

        if (progressCallback) {
          const progress = 10 + ((currentFrame + 1) / totalFrames) * 80;
          progressCallback(progress, `Extracted frame ${currentFrame + 1}/${totalFrames}`);
        }
      }

      currentFrame++;
      extractNextFrame();
    };

    video.onerror = (e) => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Failed to load video: ' + (e.message || 'Unknown error')));
    };

    // Start loading the video
    video.src = URL.createObjectURL(videoFile);
  });
}

/**
 * Extract audio from video - placeholder
 */
export async function extractAudio(videoFile, progressCallback = null) {
  if (progressCallback) {
    progressCallback(100, 'Audio extraction requires server-side processing');
  }
  return null;
}

/**
 * Process video based on AI segments - returns original with segment info
 */
export async function processVideo(videoFile, segments, progressCallback = null) {
  if (progressCallback) progressCallback(50, 'Processing video segments...');

  const keepSegments = segments.filter(s => s.type === 'keep');

  return {
    videoBlob: videoFile,
    cutSegments: keepSegments
  };
}

/**
 * Add subtitles - placeholder (simulated)
 */
export async function addSubtitles(videoBlob, segments, progressCallback = null) {
  if (progressCallback) progressCallback(100, 'Subtitle burning simulated');
  return videoBlob;
}
