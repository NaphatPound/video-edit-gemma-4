/**
 * Gemma 4 API Service - Ollama Cloud Integration
 *
 * Uses gemma4:31b-cloud model via Ollama Cloud API
 * API Key: e71c42f8cbe24bb6afde747d0a70e692.AJv2tQuixzTaJpXyf13cIJv6
 */

const OLLAMA_API_KEY = 'e71c42f8cbe24bb6afde747d0a70e692.AJv2tQuixzTaJpXyf13cIJv6';
const API_URL = '/api/chat';
const MODEL_NAME = 'gemma4:31b-cloud';

/**
 * Send a chat request to Gemma 4 via Ollama Cloud
 * @param {string|Array} prompt - Text prompt or array of content objects (for multimodal)
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Response from Gemma 4
 */
export async function sendToGemma(prompt, options = {}) {
  const { systemPrompt, images, temperature = 1.0, topP = 0.95, topK = 64 } = options;

  const messages = [];

  if (systemPrompt) {
    messages.push({
      role: 'system',
      content: systemPrompt
    });
  }

  // Handle both string prompts and multimodal content
  if (typeof prompt === 'string') {
    messages.push({
      role: 'user',
      content: prompt
    });
  } else if (Array.isArray(prompt)) {
    // Multimodal content (text + images)
    messages.push({
      role: 'user',
      content: prompt
    });
  }

  const requestBody = {
    model: MODEL_NAME,
    messages,
    options: {
      temperature,
      top_p: topP,
      top_k: topK
    },
    stream: false
  };

  if (images && images.length > 0) {
    requestBody.images = images;
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OLLAMA_API_KEY}`
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemma API Error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Analyze video frames and audio with Gemma 4
 * Returns structured JSON for video editing decisions
 * @param {Array<string>} frameBase64 - Array of base64 encoded frames
 * @param {string} transcriptText - Transcribed audio text
 * @param {Function} progressCallback - Optional progress callback
 * @returns {Promise<Object>} - Video editing analysis
 */
export async function analyzeVideoContent(frameBase64, transcriptText, progressCallback = null) {
  const systemPrompt = `You are a professional video editor AI. You MUST respond with ONLY valid JSON, no other text.

Analyze this video and return JSON with this exact structure:
{
  "segments": [
    { "type": "keep", "start": 0.0, "end": 12.5, "subtitle": "Welcome to my vlog!" },
    { "type": "cut", "start": 12.5, "end": 20.0, "reason": "Dead air" },
    { "type": "b-roll", "start": 20.0, "end": 25.0, "brollDescription": "Scenic sunset footage" }
  ],
  "summary": "Brief summary of the video content"
}`;

  let userPrompt = `Analyze this video for editing.\n\nAudio transcript: "${transcriptText || 'No audio available'}"\n\n`;

  // Add frame descriptions (since we can't send actual images without multimodal)
  if (frameBase64 && frameBase64.length > 0) {
    userPrompt += `Video contains ${frameBase64.length} frames extracted at 1 FPS.`;
  }

  userPrompt += `\n\nReturn ONLY valid JSON, no markdown, no explanation.`;

  if (progressCallback) progressCallback(10, 'Sending to Gemma 4...');

  const response = await sendToGemma(userPrompt, {
    systemPrompt,
    temperature: 0.1,
    topP: 0.9,
    topK: 40
  });

  if (progressCallback) progressCallback(50, 'Processing response...');

  // Parse the JSON response
  try {
    const content = response.message?.content || response.response || '';
    console.log('Raw Gemma response:', JSON.stringify(content).substring(0, 200));

    if (!content || typeof content !== 'string') {
      throw new Error('Empty or invalid response from API');
    }

    let jsonStr = content.trim();

    // If starts with markdown code block, extract content
    if (jsonStr.startsWith('```')) {
      const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) jsonStr = match[1];
    }

    // Try to find JSON object
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    if (progressCallback) progressCallback(80, 'Parsing results...');

    const parsed = JSON.parse(jsonStr);
    return parsed;
  } catch (error) {
    console.error('Failed to parse Gemma response:', error);
    console.error('Response object:', JSON.stringify(response).substring(0, 200));
    throw new Error('Failed to parse AI response as JSON');
  }
}

/**
 * Check if the Gemma API is working
 * @returns {Promise<boolean>}
 */
export async function testGemmaConnection() {
  try {
    const response = await sendToGemma('Reply with exactly: "API IS WORKING"');
    const content = response.message?.content || response.response || '';
    return content.includes('API IS WORKING');
  } catch (error) {
    console.error('Gemma connection test failed:', error);
    return false;
  }
}

export { MODEL_NAME, API_URL };
