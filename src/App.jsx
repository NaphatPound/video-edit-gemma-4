import React, { useState, useRef, useCallback, useEffect } from 'react';
import { testGemmaConnection, analyzeVideoContent } from './services/gemmaApi.js';
import { initFFmpeg, extractFrames, processVideo, addSubtitles, isFFmpegLoaded } from './services/videoProcessor.js';

function App() {
  const [apiStatus, setApiStatus] = useState('checking');
  const [ffmpegStatus, setFfmpegStatus] = useState('loading');
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState(0);
  const [frames, setFrames] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [exportedVideoUrl, setExportedVideoUrl] = useState('');
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  // Check API connection on mount
  useEffect(() => {
    // Check API with timeout (API is slow ~10s)
    const apiTimeout = setTimeout(() => {
      setApiStatus('timeout');
    }, 30000);

    async function init() {
      try {
        // API test with longer timeout
        const apiOk = await Promise.race([
          testGemmaConnection(),
          new Promise(resolve => setTimeout(() => resolve(false), 25000))
        ]);
        clearTimeout(apiTimeout);
        setApiStatus(apiOk ? 'connected' : 'disconnected');
      } catch (err) {
        clearTimeout(apiTimeout);
        setApiStatus('disconnected');
        console.error('Init error:', err);
      }
    }
    init();

    // Video processor is always ready (canvas-based)
    setFfmpegStatus('ready');
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0] || e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setResult(null);
      setError('');
      setExportedVideoUrl('');
      setFrames([]);
    }
  };

  const handleVideoLoaded = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    handleFileSelect(e);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.currentTarget.classList.remove('drag-over');
  }, []);

  const analyzeVideo = async () => {
    if (!videoFile) return;

    setAnalyzing(true);
    setProcessing(true);
    setProgress(0);
    setProgressText('Starting analysis...');
    setError('');
    setResult(null);
    setExportedVideoUrl('');

    try {
      // Extract frames using canvas
      setProgressText('Extracting frames from video...');
      const extractedFrames = await extractFrames(videoFile, (prog, text) => {
        setProgress(33 + prog * 0.3); // 33-63% for frame extraction
        setProgressText(text);
      });
      setFrames(extractedFrames);
      console.log(`Extracted ${extractedFrames.length} frames`);

      // Send to Gemma for analysis
      setProgressText('Analyzing video with Gemma 4...');
      const analysis = await analyzeVideoContent(
        extractedFrames,
        `Video file: ${videoFile.name} (${formatFileSize(videoFile.size)}, ${formatTime(videoDuration)} duration)`
      );

      setProgress(95);
      setProgressText('Analysis complete!');
      setResult(analysis);
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
      setProcessing(false);
    }
  };

  const exportEditedVideo = async () => {
    if (!result || !videoFile) return;

    setProcessing(true);
    setProgress(0);
    setProgressText('Processing video...');
    setError('');

    try {
      // Process video based on AI decisions
      setProgressText('Cutting and assembling video...');
      const { videoBlob, cutSegments } = await processVideo(
        videoFile,
        result.segments,
        (prog, text) => {
          setProgress(30 + prog * 0.4);
          setProgressText(text);
        }
      );

      // Add subtitles if any
      const segmentsWithSubs = result.segments.filter(s => s.subtitle);
      let finalBlob = videoBlob;

      if (segmentsWithSubs.length > 0) {
        setProgressText('Adding subtitles...');
        finalBlob = await addSubtitles(videoBlob, result.segments, (prog, text) => {
          setProgress(70 + prog * 0.25);
          setProgressText(text);
        });
      }

      setProgress(100);
      setProgressText('Export complete!');

      // Create download URL
      const url = URL.createObjectURL(finalBlob);
      setExportedVideoUrl(url);

      // Also save to result for reference
      setResult(prev => ({
        ...prev,
        exportedBlob: finalBlob,
        cutSegments
      }));
    } catch (err) {
      console.error('Export error:', err);
      setError(err.message || 'Export failed');
    } finally {
      setProcessing(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatTime = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected':
      case 'ready':
        return '#10b981';
      case 'timeout':
      case 'loading':
        return '#f59e0b';
      case 'disconnected':
      case 'error':
        return '#ef4444';
      default:
        return '#f59e0b';
    }
  };

  return (
    <div className="app">
      <header>
        <h1>AI Video Editor</h1>
        <p className="subtitle">Powered by Gemma 4 (gemma4:31b-cloud)</p>
      </header>

      <div className="status-bar">
        <div className="status-item">
          <span
            className="status-dot"
            style={{ background: getStatusColor(apiStatus) }}
          ></span>
          <span>
            Gemma 4 API:{' '}
            {apiStatus === 'checking'
              ? 'Checking...'
              : apiStatus === 'connected'
              ? 'Connected'
              : apiStatus === 'timeout'
              ? 'Slow - will retry'
              : 'Disconnected'}
          </span>
        </div>
        <div className="status-item">
          <span
            className="status-dot"
            style={{ background: getStatusColor(ffmpegStatus) }}
          ></span>
          <span>
            Video Engine:{' '}
            {ffmpegStatus === 'loading'
              ? 'Loading...'
              : ffmpegStatus === 'ready'
              ? 'Ready'
              : 'Error'}
          </span>
        </div>
        <div className="status-item">
          <span>Model: gemma4:31b-cloud</span>
        </div>
      </div>

      <div className="main-content">
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Upload Video</span>
            {videoDuration > 0 && (
              <span className="duration-badge">{formatTime(videoDuration)}</span>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          <div
            className={`upload-area ${videoUrl ? 'has-video' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {videoUrl ? (
              <video
                ref={videoRef}
                className="video-preview"
                src={videoUrl}
                controls
                muted
                onLoadedMetadata={handleVideoLoaded}
              />
            ) : (
              <>
                <div className="upload-icon">🎬</div>
                <p className="upload-text">Click or drag video to upload</p>
                <p className="upload-hint">MP4, MOV, AVI, WebM supported</p>
              </>
            )}
          </div>

          {videoFile && (
            <>
              <div className="file-info">
                <div>
                  <span className="file-name">{videoFile.name}</span>
                  <span className="file-size">
                    {formatFileSize(videoFile.size)}
                    {frames.length > 0 && ` • ${frames.length} frames extracted`}
                  </span>
                </div>
              </div>

              <button
                className="btn btn-primary analyze-btn"
                onClick={analyzeVideo}
                disabled={analyzing || (apiStatus !== 'connected' && apiStatus !== 'timeout') || ffmpegStatus !== 'ready'}
              >
                {analyzing ? 'Analyzing...' : 'Analyze with Gemma 4'}
              </button>

              {processing && (
                <div className="progress-section">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <p className="progress-text">{progressText}</p>
                </div>
              )}
            </>
          )}

          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">AI Analysis</span>
            {result && (
              <span className="segment-count">
                {result.segments?.length || 0} segments
              </span>
            )}
          </div>

          {!result && !error && (
            <div className="placeholder-state">
              <p>Upload a video and click "Analyze" to see AI recommendations</p>
              <p className="placeholder-hint">
                Frames will be extracted and sent to Gemma 4 for analysis
              </p>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          {result && (
            <>
              <div className="summary-box">
                <p className="summary-title">Video Summary</p>
                <p className="summary-text">
                  {result.summary || 'No summary available'}
                </p>
              </div>

              <div className="timeline-section">
                <h3>Timeline</h3>
                <div className="timeline">
                  <div className="timeline-track">
                    {result.segments?.map((segment, idx) => (
                      <div
                        key={idx}
                        className={`timeline-segment ${segment.type}`}
                        style={{
                          width: `${((segment.end - segment.start) / videoDuration) * 100}%`,
                          left: `${(segment.start / videoDuration) * 100}%`,
                        }}
                        title={`${segment.type}: ${segment.start}s - ${segment.end}s`}
                      >
                        <span className="timeline-label">
                          {segment.type === 'keep' && '📹'}
                          {segment.type === 'cut' && '✂️'}
                          {segment.type === 'b-roll' && '🎬'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="timeline-time">
                    <span>0:00</span>
                    <span>{formatTime(videoDuration)}</span>
                  </div>
                </div>
              </div>

              <div className="segments-list">
                <h4>Segment Details</h4>
                {result.segments?.map((segment, idx) => (
                  <div key={idx} className={`segment-item ${segment.type}`}>
                    <span className={`segment-type ${segment.type}`}>
                      {segment.type}
                    </span>
                    <span className="segment-time">
                      {formatTime(segment.start)} - {formatTime(segment.end)}
                    </span>
                    <div className="segment-content">
                      {segment.subtitle && <p>{segment.subtitle}</p>}
                      {segment.reason && (
                        <p className="segment-reason">{segment.reason}</p>
                      )}
                      {segment.brollDescription && (
                        <p className="segment-reason">
                          B-Roll: {segment.brollDescription}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                className="btn btn-primary"
                onClick={exportEditedVideo}
                disabled={processing || !result.segments?.some(s => s.type === 'keep')}
              >
                {processing ? 'Processing...' : 'Export Edited Video'}
              </button>

              {exportedVideoUrl && !processing && (
                <div className="export-preview">
                  <h4>Video Exported Successfully!</h4>
                  <a
                    href={exportedVideoUrl}
                    download="ai-edited-video.mp4"
                    className="btn btn-primary"
                  >
                    Download Edited Video
                  </a>
                  <p className="export-info">
                    {result.cutSegments?.length || 0} segments concatenated
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
