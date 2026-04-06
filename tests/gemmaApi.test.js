import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendToGemma, analyzeVideoContent, testGemmaConnection } from '../src/services/gemmaApi.js';

describe('Gemma API Service', () => {
  let fetchSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('sendToGemma', () => {
    it('should send a text prompt and return response', async () => {
      const mockResponse = {
        message: { content: 'Test response' },
        model: 'gemma4:31b-cloud'
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await sendToGemma('Hello Gemma');

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/chat',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('"model":"gemma4:31b-cloud"')
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should include system prompt when provided', async () => {
      const mockResponse = {
        message: { content: 'Response with system prompt' }
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await sendToGemma('User message', {
        systemPrompt: 'You are a helpful assistant'
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/chat',
        expect.objectContaining({
          body: expect.stringContaining('"role":"system"')
        })
      );
    });

    it('should throw error on API failure', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => Promise.resolve('Unauthorized')
      });

      await expect(sendToGemma('test')).rejects.toThrow('Gemma API Error: 401');
    });
  });

  describe('analyzeVideoContent', () => {
    it('should return parsed JSON from Gemma response', async () => {
      const mockResponse = {
        message: {
          content: `\`\`\`json
{
  "segments": [
    { "type": "keep", "start": 0.0, "end": 10.0, "subtitle": "Introduction" }
  ],
  "summary": "Test video"
}
\`\`\``
        }
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await analyzeVideoContent([], 'Test transcript');

      expect(result).toHaveProperty('segments');
      expect(result.segments[0].type).toBe('keep');
    });

    it('should handle plain JSON without markdown code blocks', async () => {
      const mockResponse = {
        message: {
          content: '{"segments": [{"type": "cut", "start": 5.0, "end": 8.0}], "summary": "Test"}'
        }
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await analyzeVideoContent([], 'Test transcript');

      expect(result.segments[0].type).toBe('cut');
    });
  });

  describe('testGemmaConnection', () => {
    it('should return true when API responds correctly', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          message: { content: 'API IS WORKING' }
        })
      });

      const result = await testGemmaConnection();

      expect(result).toBe(true);
    });

    it('should return false when API call fails', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => Promise.resolve('Server Error')
      });

      const result = await testGemmaConnection();

      expect(result).toBe(false);
    });
  });
});
