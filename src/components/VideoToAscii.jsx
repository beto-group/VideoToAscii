const { React, useState, useEffect, useRef } = dc;

function VideoToAscii({ styles, folderPath, ...props }) {
    const STYLES = styles;
    const [videoSrc, setVideoSrc] = useState(null);
    const [ascii, setAscii] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // Settings
    const [charWidth, setCharWidth] = useState(100);
    const [contrast, setContrast] = useState(1.2);
    const [charset, setCharset] = useState('detailed');
    const [color, setColor] = useState('#00ff00');
    const [scaleX, setScaleX] = useState(1);
    const [scaleY, setScaleY] = useState(1);
    const [smoothing, setSmoothing] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const processorRef = useRef(null);
    const previousBufferRef = useRef(null);

    // Load Utils
    useEffect(() => {
        const loadUtils = async () => {
            const { processFrameToAscii, getHtmlAscii, getHtmlPlayer, CHARSETS } = await dc.require(folderPath + "/src/utils/asciiProcessor.js");
            processorRef.current = { processFrameToAscii, getHtmlAscii, getHtmlPlayer, CHARSETS };
        };
        loadUtils();
    }, [folderPath]);

    const handleFileChange = (e) => {
        const file = e.type === 'drop' ? e.dataTransfer.files[0] : e.target.files[0];
        if (file && (file.type.startsWith('video/') || /\.(mp4|webm|mov|avi)$/i.test(file.name))) {
            const url = URL.createObjectURL(file);
            setVideoSrc(url);
            setIsProcessing(false);
            setAscii("");
        }
    };

    const processFrame = () => {
        if (!videoRef.current || !canvasRef.current || !processorRef.current) {
            return;
        }

        const video = videoRef.current;
        if (isProcessing && (video.paused || video.ended)) {
            // Stop processing if video stopped externally
            setIsProcessing(false);
            return;
        }
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // Calculate height based on character aspect ratio (usually ~0.5 for monospace)
        const aspectRatio = video.videoWidth / video.videoHeight;
        const targetWidth = Math.floor(charWidth * scaleX);
        const targetHeight = Math.floor(charWidth / aspectRatio * 0.5 * scaleY);

        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            // Clear previous buffer on resolution change
            previousBufferRef.current = null;
        }

        if (currentTime !== video.currentTime) {
            setCurrentTime(video.currentTime);
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const { ascii: newAscii, buffer } = processorRef.current.processFrameToAscii(imageData, {
            charsetName: charset,
            contrast: contrast,
            smoothing: smoothing
        }, previousBufferRef.current);

        previousBufferRef.current = buffer;
        setAscii(newAscii);

        if (isProcessing) window.requestAnimationFrame(processFrame);
    };

    // Live preview update when settings change (even if paused)
    useEffect(() => {
        if (!isProcessing && videoSrc && processorRef.current) {
            // Need to wait for video to be ready or just try processing
            // Reset buffer if resolution changes to avoid size mismatch artifacts or errors
            // (processFrameToAscii handles resize but we should be aware)
            window.requestAnimationFrame(processFrame);
        }
    }, [charWidth, contrast, charset, scaleX, scaleY, smoothing]);

    useEffect(() => {
        if (isProcessing) {
            window.requestAnimationFrame(processFrame);
        }
    }, [isProcessing]);

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
        }
    };

    const handleSeek = (e) => {
        const time = parseFloat(e.target.value);
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            setCurrentTime(time);
            window.requestAnimationFrame(processFrame);
        }
    };

    const stepFrame = (mod) => {
        if (videoRef.current) {
            // Assume 30fps = ~0.033s. 0.04s is safe for 25fps.
            const newTime = Math.min(Math.max(0, videoRef.current.currentTime + (mod * 0.04)), duration);
            videoRef.current.currentTime = newTime;
            setCurrentTime(newTime);
            window.requestAnimationFrame(processFrame);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const toggleProcessing = () => {
        if (!videoSrc) return;
        if (isProcessing) {
            setIsProcessing(false);
            videoRef.current.pause();
        } else {
            setIsProcessing(true);
            videoRef.current.play();
        }
    };

    const exportTxt = () => {
        if (!ascii) return;
        const blob = new Blob([ascii], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = activeDocument.createElement('a');
        a.href = url;
        a.download = `ascii-art-${Date.now()}.txt`;
        a.click();
    };

    const exportHtml = () => {
        if (!ascii || !processorRef.current) return;
        const html = processorRef.current.getHtmlAscii(ascii, color);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = activeDocument.createElement('a');
        a.href = url;
        a.download = `ascii-art-${Date.now()}.html`;
        a.click();
    };
    const exportVideo = async () => {
        if (!videoRef.current || !processorRef.current) return;

        setIsProcessing(false);
        const video = videoRef.current;
        const originalTime = video.currentTime;
        video.pause();

        const frames = [];
        const fps = 30; // Target FPS for extraction
        const frameDuration = 1 / fps;
        let currentTime = 0;
        const duration = video.duration;

        // Temporary canvas for rendering
        const canvas = activeDocument.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // Setup initial dimensions based on current settings
        const aspectRatio = video.videoWidth / video.videoHeight;
        const targetWidth = Math.floor(charWidth * scaleX);
        const targetHeight = Math.floor(charWidth / aspectRatio * 0.5 * scaleY);
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Capture loop
        // We use a seek loop. This converts async seek to promise
        const seek = (time) => new Promise(resolve => {
            const onSeek = () => {
                video.removeEventListener('seeked', onSeek);
                resolve();
            };
            video.addEventListener('seeked', onSeek);
            video.currentTime = time;
        });

        // Iterate frames
        while (currentTime < duration) {
            await seek(currentTime);

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            // No smoothing for export frames typically to keep them crisp or reuse setting? 
            // Reuse current settings
            const { ascii } = processorRef.current.processFrameToAscii(imageData, {
                charsetName: charset,
                contrast: contrast,
                smoothing: 0 // Disable smoothing for frame capture to avoid ghosting artifacts from jumps
            });
            frames.push(ascii);

            currentTime += frameDuration;
        }

        // Restore state
        video.currentTime = originalTime;

        // Generate HTML
        const html = processorRef.current.getHtmlPlayer(frames, fps, color);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = activeDocument.createElement('a');
        a.href = url;
        a.download = `ascii-video-${Date.now()}.html`;
        a.click();
    };

    return (
        <div style={STYLES.container}>
            <div style={STYLES.header}>
                <div style={STYLES.title}>VIDEO TO ASCII TERMINAL</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-monospace, monospace)' }}>V.1.0.0</div>
                    <div
                        style={{ cursor: 'pointer', opacity: 0.6, display: 'flex' }}
                        onClick={props.onToggleFullTab}
                        title={props.isFullTab ? "Exit Full Mode" : "Enter Full Mode"}
                    >
                        <dc.Icon icon={props.isFullTab ? "minimize" : "maximize"} style={{ width: "16px", height: "16px", color: 'var(--interactive-accent)' }} />
                    </div>
                </div>
            </div>

            <div style={STYLES.content}>
                <div style={STYLES.previewArea}>
                    <div
                        style={{
                            ...STYLES.asciiContainer,
                            border: isDragging ? '2px dashed var(--interactive-accent)' : STYLES.asciiContainer.border,
                            background: isDragging ? 'var(--background-modifier-hover)' : STYLES.asciiContainer.background,
                            transition: 'all 0.2s'
                        }}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileChange(e); }}
                    >
                        {!videoSrc && (
                            <div style={{ color: 'var(--text-muted)', textAlign: 'center', zIndex: 1 }}>
                                <dc.Icon icon="terminal" style={{ width: '64px', height: '64px', marginBottom: '15px', opacity: 0.1, color: 'var(--interactive-accent)' }} />
                                <p style={{ fontFamily: 'var(--font-monospace, monospace)', fontSize: '12px' }}>DROP VIDEO HERE TO INITIALIZE</p>
                            </div>
                        )}
                        {ascii && (
                            <pre style={{ ...STYLES.asciiDisplay, color: color, fontSize: `${Math.max(4, 10 - charWidth / 40)}px` }}>
                                {ascii}
                            </pre>
                        )}
                        <canvas ref={canvasRef} style={{ display: 'none' }} />
                        <video
                            ref={videoRef}
                            src={videoSrc}
                            style={{ display: 'none' }}
                            loop
                            muted
                            playsInline
                            onLoadedMetadata={handleLoadedMetadata}
                            onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                            onSeeked={processFrame}
                        />
                    </div>

                    {/* Timeline Controls */}
                    {videoSrc && (
                        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <input
                                type="range"
                                min="0"
                                max={duration || 100}
                                step="0.01"
                                value={currentTime}
                                onChange={handleSeek}
                                style={{ ...STYLES.range, height: '4px' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-monospace, monospace)' }}>
                                <span>{formatTime(currentTime)}</span>
                                <span>{formatTime(duration)}</span>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
                        <button style={STYLES.button} onClick={() => activeDocument.getElementById('ascii-file').click()}>
                            <dc.Icon icon="upload" style={{ width: '16px' }} />
                            {videoSrc ? 'Change' : 'Load'}
                        </button>
                        <input id="ascii-file" type="file" accept="video/*" onChange={handleFileChange} style={{ display: 'none' }} />

                        {videoSrc && (
                            <>
                                <button
                                    style={{ ...STYLES.button, width: '30px', padding: '0', justifyContent: 'center' }}
                                    onClick={() => stepFrame(-1)}
                                    title="-1 Frame"
                                >
                                    <dc.Icon icon="chevron-left" style={{ width: '14px' }} />
                                </button>
                                <button
                                    style={{ ...STYLES.button, flex: 1, justifyContent: 'center' }}
                                    onClick={toggleProcessing}
                                >
                                    <dc.Icon icon={isProcessing ? "pause" : "play"} style={{ width: '16px', marginRight: '5px' }} />
                                    {isProcessing ? 'PAUSE' : 'PLAY'}
                                </button>
                                <button
                                    style={{ ...STYLES.button, width: '30px', padding: '0', justifyContent: 'center' }}
                                    onClick={() => stepFrame(1)}
                                    title="+1 Frame"
                                >
                                    <dc.Icon icon="chevron-right" style={{ width: '14px' }} />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div style={STYLES.controlsArea}>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', borderBottom: '1px solid var(--background-modifier-border)', paddingBottom: '10px', color: 'var(--interactive-accent)', fontFamily: 'var(--font-monospace, monospace)' }}>PARAMETERS</h3>

                    <div style={STYLES.inputGroup}>
                        <label style={STYLES.label}>Character Set</label>
                        <select
                            value={charset}
                            onChange={(e) => setCharset(e.target.value)}
                            style={STYLES.select}
                        >
                            <option value="detailed">Detailed ($@B%...)</option>
                            <option value="simple">Simple (@%#*...)</option>
                            <option value="blocks">Blocks (█▓▒░)</option>
                            <option value="binary">Binary (01)</option>
                        </select>
                    </div>

                    <div style={STYLES.inputGroup}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <label style={STYLES.label}>Resolution (Chars)</label>
                            <span style={{ fontSize: '12px', color: 'var(--interactive-accent)', fontFamily: 'var(--font-monospace, monospace)' }}>{charWidth}</span>
                        </div>
                        <input
                            type="range"
                            min="20" max="500"
                            style={STYLES.range}
                            value={charWidth}
                            onChange={(e) => setCharWidth(parseInt(e.target.value))}
                        />
                    </div>

                    <div style={STYLES.inputGroup}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <label style={STYLES.label}>Scale X (Width)</label>
                            <span style={{ fontSize: '12px', color: 'var(--interactive-accent)', fontFamily: 'var(--font-monospace, monospace)' }}>{scaleX.toFixed(1)}x</span>
                        </div>
                        <input
                            type="range"
                            min="0.1" max="3" step="0.1"
                            style={STYLES.range}
                            value={scaleX}
                            onChange={(e) => setScaleX(parseFloat(e.target.value))}
                        />
                    </div>

                    <div style={STYLES.inputGroup}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <label style={STYLES.label}>Scale Y (Height)</label>
                            <span style={{ fontSize: '12px', color: 'var(--interactive-accent)', fontFamily: 'var(--font-monospace, monospace)' }}>{scaleY.toFixed(1)}x</span>
                        </div>
                        <input
                            type="range"
                            min="0.1" max="3" step="0.1"
                            style={STYLES.range}
                            value={scaleY}
                            onChange={(e) => setScaleY(parseFloat(e.target.value))}
                        />
                    </div>

                    <div style={STYLES.inputGroup}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <label style={STYLES.label}>Contrast</label>
                            <span style={{ fontSize: '12px', color: 'var(--interactive-accent)', fontFamily: 'var(--font-monospace, monospace)' }}>{contrast.toFixed(1)}</span>
                        </div>
                        <input
                            type="range"
                            min="0.5" max="3" step="0.1"
                            style={STYLES.range}
                            value={contrast}
                            onChange={(e) => setContrast(parseFloat(e.target.value))}
                        />
                    </div>

                    <div style={STYLES.inputGroup}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <label style={STYLES.label}>Smoothing (Anti-Flicker)</label>
                            <span style={{ fontSize: '12px', color: 'var(--interactive-accent)', fontFamily: 'var(--font-monospace, monospace)' }}>{Math.round(smoothing * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0" max="0.95" step="0.05"
                            style={STYLES.range}
                            value={smoothing}
                            onChange={(e) => setSmoothing(parseFloat(e.target.value))}
                        />
                    </div>

                    <div style={STYLES.inputGroup}>
                        <label style={STYLES.label}>Terminal Color</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {['#00ff00', '#00ffff', '#ffff00', '#ff00ff', '#ffffff'].map(c => (
                                <div
                                    key={c}
                                    onClick={() => setColor(c)}
                                    style={{
                                        width: '24px',
                                        height: '24px',
                                        background: c,
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        border: color === c ? '2px solid var(--text-normal)' : 'none'
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    <div style={STYLES.exportSection}>
                        <label style={STYLES.label}>EXPORT COMMANDS</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <button style={STYLES.button} onClick={exportTxt} disabled={!ascii}>
                                <dc.Icon icon="file-text" style={{ width: '14px' }} />
                                .TXT
                            </button>
                            <button style={STYLES.button} onClick={exportHtml} disabled={!ascii}>
                                <dc.Icon icon="code" style={{ width: '14px' }} />
                                .HTML
                            </button>
                            <button style={{ ...STYLES.button, gridColumn: 'span 2' }} onClick={exportVideo} disabled={!videoSrc}>
                                <dc.Icon icon="film" style={{ width: '14px' }} />
                                .HTML VIDEO (Full Clip)
                            </button>
                        </div>
                    </div>

                    <div style={{ marginTop: 'auto', padding: '15px', background: 'var(--background-modifier-hover)', borderRadius: '8px', border: '1px solid var(--background-modifier-border)' }}>
                        <div style={{ fontSize: '10px', color: 'var(--interactive-accent)', fontWeight: 'bold', marginBottom: '5px', fontFamily: 'var(--font-monospace, monospace)' }}>SYSTEM READY</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4', fontFamily: 'var(--font-monospace, monospace)' }}>
                            Process video frame by frame. Map luminance to ASCII tokens. Output compatible with xterm-256 and modern shells.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

return { VideoToAscii };
