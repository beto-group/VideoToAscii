const CHARSETS = {
    detailed: "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ",
    simple: "@%#*+=-:. ",
    blocks: "█▓▒░ ",
    binary: "01 "
};

function getAsciiChar(brightness, charsetName = 'detailed') {
    const chars = CHARSETS[charsetName] || CHARSETS.detailed;
    const index = Math.floor((brightness / 255) * (chars.length - 1));
    return chars[chars.length - 1 - index];
}

function processFrameToAscii(imageData, options = {}, previousBuffer = null) {
    const { width, height, data } = imageData;
    const { charsetName = 'detailed', contrast = 1, smoothing = 0 } = options;

    // Initialize buffer if needed or resize if dimensions changed
    let buffer = previousBuffer;
    if (!buffer || buffer.length !== width * height) {
        buffer = new Float32Array(width * height);
    }

    let ascii = "";

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = y * width + x;
            const offset = index * 4;
            const r = data[offset];
            const g = data[offset + 1];
            const b = data[offset + 2];

            // Grayscale luminance
            let brightness = (0.2126 * r + 0.7152 * g + 0.0722 * b);

            // Apply contrast
            brightness = ((brightness / 255 - 0.5) * contrast + 0.5) * 255;
            brightness = Math.max(0, Math.min(255, brightness));

            // Apply smoothing
            if (smoothing > 0) {
                const prev = buffer[index];
                // If previous buffer was 0 (init), jump straight to current to avoid ghosting from black
                if (prev === 0 && buffer[0] === 0 && buffer[buffer.length - 1] === 0) {
                    buffer[index] = brightness;
                } else {
                    buffer[index] = prev * smoothing + brightness * (1 - smoothing);
                    brightness = buffer[index];
                }
            } else {
                buffer[index] = brightness;
            }

            ascii += getAsciiChar(brightness, charsetName);
        }
        ascii += "\n";
    }
    return { ascii, buffer };
}

function getHtmlAscii(ascii, color = '#00ff00') {
    return `
        <pre style="
            font-family: monospace;
            font-size: 8px;
            line-height: 1;
            background: #000;
            color: ${color};
            margin: 0;
            padding: 20px;
            white-space: pre;
        ">${ascii}</pre>
    `;
}

function getHtmlPlayer(frames, fps = 30, color = '#00ff00', backgroundColor = '#000000') {
    const compressedFrames = JSON.stringify(frames);
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>ASCII Video Export</title>
    <style>
        body {
            background-color: ${backgroundColor};
            color: ${color};
            font-family: monospace;
            font-size: 8px; /* Adjustable via JS */
            line-height: 1; /* Critical for aspect ratio */
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            overflow: hidden;
        }
        #player {
            white-space: pre;
            text-align: center;
            transform-origin: center;
        }
        #controls {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 50, 0, 0.8);
            border: 1px solid ${color};
            padding: 10px;
            border-radius: 8px;
            display: flex;
            gap: 15px;
            font-family: sans-serif;
            font-size: 14px;
            opacity: 0;
            transition: opacity 0.3s;
        }
        body:hover #controls { opacity: 1; }
        button {
            background: transparent;
            color: ${color};
            border: 1px solid ${color};
            padding: 5px 10px;
            cursor: pointer;
            font-family: monospace;
        }
        button:hover { background: rgba(0, 255, 0, 0.2); }
    </style>
</head>
<body>
    <div id="player"></div>
    <div id="controls">
        <button onclick="togglePlay()" id="playBtn">PAUSE</button>
        <div id="time">00:00 / 00:00</div>
    </div>

    <script>
        const frames = ${compressedFrames};
        const fps = ${fps};
        const interval = 1000 / fps;
        let p = 0;
        let playing = true;
        let lastTime = 0;
        const player = document.getElementById('player');
        const playBtn = document.getElementById('playBtn');
        const timeDisplay = document.getElementById('time');
        const totalDuration = frames.length / fps;

        function formatTime(sec) {
            const m = Math.floor(sec / 60);
            const s = Math.floor(sec % 60);
            return m + ':' + (s < 10 ? '0' : '') + s;
        }

        function togglePlay() {
            playing = !playing;
            playBtn.innerText = playing ? 'PAUSE' : 'PLAY';
            if (playing) requestAnimationFrame(loop);
        }

        function loop(timestamp) {
            if (!playing) return;
            if (timestamp - lastTime >= interval) {
                player.textContent = frames[p];
                timeDisplay.innerText = formatTime(p / fps) + ' / ' + formatTime(totalDuration);
                p = (p + 1) % frames.length;
                lastTime = timestamp;
            }
            requestAnimationFrame(loop);
        }

        // Auto-scale font size
        function resize() {
            // Rough mapping based on char count
            if (frames.length > 0) {
                 const lines = frames[0].split('\\n');
                 const height = lines.length;
                 const width = lines[0].length;
                 // Calculate max font size that fits
                 const vh = window.innerHeight;
                 const vw = window.innerWidth;
                 // 0.6 is roughly w/h ratio of monospace
                 const fh = vh / height;
                 const fw = vw / width / 0.6; 
                 const size = Math.min(fh, fw);
                 document.body.style.fontSize = Math.floor(size) + 'px';
            }
        }
        
        window.addEventListener('resize', resize);
        resize();
        requestAnimationFrame(loop);
    </script>
</body>
</html>
    `;
}

return { processFrameToAscii, getHtmlAscii, getHtmlPlayer, CHARSETS, getAsciiChar };
