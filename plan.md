# AI-Driven Video Assembler Web App

## 1. Goal Description

Create a web application that automatically edits and assembles videos using Gemma 4. The system will take raw footage, use Gemma 4 to analyze it (video frames and audio) to identify highlights, boring parts, and logical cuts, and then use FFmpeg to process and generate a final compiled video with subtitles.

## 2. Proposed Architecture

### 2.1 Frontend (User Interface)
*   **Technologies:** React (Vite) with Vanilla CSS (modern, glassmorphism, dark mode aesthetic).
*   **Core Components:**
    *   **Upload Area:** Drag and drop for raw video files.
    *   **Timeline View:** A visual representation of the raw video, displaying segments marked by AI (Highlights, Cuts, B-Roll points) and subtitles.
    *   **Video Player:** To preview the raw footage and the final AI-edited footage.
    *   **Control Panel:** Buttons to trigger AI analysis and final video generation.

### 2.2 Video Processing Engine (FFmpeg)
*   **Technologies:** `ffmpeg.wasm` (Client-side) or a lightweight backend with `ffmpeg`.
*   **Purpose:** 
    *   Extract 1 frame per second (1FPS) and audio track from the raw video to send to Gemma 4.
    *   Execute the final editing plan (cutting, concatenating, rendering subtitles) directly in the browser using the AI-generated JSON.

### 2.3 AI Integration (Gemma 4 API)
*   **Process:** 
    1.  App sends low-resolution frames (1FPS) + audio sample to Gemma 4 via an API endpoint.
    2.  Prompt instructs Gemma 4 to act as a professional video editor: identifying key moments, dropping dead air, and mapping conversational text for subtitles.
    3.  Gemma 4 returns structured JSON:
        ```json
        {
          "segments": [
            { "type": "keep", "start": 0, "end": 12.5, "subtitle": "Welcome to my vlog!" },
            { "type": "cut", "start": 12.5, "end": 20.0, "reason": "Silence/Dead air" },
            { "type": "b-roll", "start": 20.0, "end": 25.0, "prompt": "Show sunset footage" }
          ]
        }
        ```

## 3. Implementation Phases

*   **Phase 1: Project Setup & UI Foundation**
    *   Initialize Vite React project.
    *   Implement premium CSS aesthetics (animations, dark colors, typography).
    *   Create video upload and player components.
*   **Phase 2: Video Pre-processing**
    *   Integrate FFmpeg.wasm.
    *   Write logic to extract 1FPS thumbnails and audio bytes from uploaded video.
*   **Phase 3: Gemma 4 Integration**
    *   Create backend/edge function to communicate with Gemma 4 API.
    *   Design the system prompt for automated video editing.
    *   Parse the returned JSON payload.
*   **Phase 4: Auto-Editing & Timeline**
    *   Render the AI JSON onto a visual UI Timeline so the user can verify/tweak cuts.
    *   Generate FFmpeg commands to slice the video, burn subtitles, and concatenate chunks.
*   **Phase 5: Polish & Export**
    *   Loading states, error handling, and file export (download final `.mp4`).
