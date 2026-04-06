import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the FFmpeg utilities
vi.mock('@ffmpeg/ffmpeg', () => {
  return {
    FFmpeg: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      load: vi.fn().mockResolvedValue(undefined),
      exec: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn().mockImplementation((filename) => {
        if (filename === 'test.jpg') {
          return { buffer: new ArrayBuffer(100) };
        }
        if (filename === 'output.wav') {
          return { buffer: new ArrayBuffer(200) };
        }
        if (filename === 'output.mp4') {
          return { buffer: new ArrayBuffer(300) };
        }
        throw new Error('File not found');
      }),
      deleteFile: vi.fn().mockResolvedValue(undefined),
    }))
  };
});

vi.mock('@ffmpeg/util', () => {
  return {
    fetchFile: vi.fn().mockResolvedValue(new ArrayBuffer(1000)),
    toBlobURL: vi.fn().mockResolvedValue('blob:http://localhost/test')
  };
});

describe('FFmpeg Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initFFmpeg', () => {
    it('should be importable', async () => {
      const { initFFmpeg } = await import('../src/services/ffmpegService.js');
      expect(initFFmpeg).toBeDefined();
    });
  });

  describe('extractFrames', () => {
    it('should be importable', async () => {
      const { extractFrames } = await import('../src/services/ffmpegService.js');
      expect(extractFrames).toBeDefined();
    });
  });

  describe('processVideo', () => {
    it('should be importable', async () => {
      const { processVideo } = await import('../src/services/ffmpegService.js');
      expect(processVideo).toBeDefined();
    });
  });

  describe('addSubtitles', () => {
    it('should be importable', async () => {
      const { addSubtitles } = await import('../src/services/ffmpegService.js');
      expect(addSubtitles).toBeDefined();
    });
  });
});
