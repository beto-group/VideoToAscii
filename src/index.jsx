/* eslint-disable obsidianmd/no-static-styles-assignment */
/**
 * index.jsx
 * Entry point for VIDEO TO ASCII.
 * Implements Safe Agent recovery, FullTab view hijacking, and stylesheet overlays.
 */
function View({ folderPath, ...props }) {
    const { useState, useEffect, useRef } = dc;

    // 1. Initialize Safe Agent immediately
    const Agent = {
        timer: null,
        start: (fPath, onReload) => {
            if (Agent.timer) window.clearInterval(Agent.timer);
            const cmdFile = fPath + "/data/mcp_commands.json";

            Agent.timer = window.setInterval(async () => {
                try {
                    const adapter = dc.app.vault.adapter;
                    if (!(await adapter.exists(cmdFile))) return;

                    const content = await adapter.read(cmdFile);
                    let cmd;
                    try { cmd = JSON.parse(content); } catch { return; }

                    if (cmd && cmd.executed === false) {
                        if (cmd.action === "reload") {
                            cmd.executed = true;
                            cmd.result = "Executed";
                            cmd.executedAt = new Date().toISOString();
                            await adapter.write(cmdFile, JSON.stringify(cmd, null, 2));
                            onReload();
                        }
                    }
                } catch (e) { console.error("[SafeAgent] Error", e); }
            }, 1000);
            return () => window.clearInterval(Agent.timer);
        }
    };

    const SafeRoot = () => {
        const [app, setApp] = useState(null);
        const [error, setError] = useState(null);
        const [key, setKey] = useState(0);

        useEffect(() => {
            const stopAgent = Agent.start(folderPath, () => {
                if (dc.app.workspace.activeLeaf?.rebuildView) {
                    dc.app.workspace.activeLeaf.rebuildView();
                } else {
                    setKey(k => k + 1);
                }
            });
            return stopAgent;
        }, []);

        useEffect(() => {
            const load = async () => {
                try {
                    const { STYLES } = await dc.require(folderPath + '/src/styles/styles.jsx');
                    const { VideoToAscii } = await dc.require(folderPath + '/src/components/VideoToAscii.jsx');
                    setApp({ STYLES, VideoToAscii });
                } catch (e) {
                    console.error("VideoToAscii Load Error:", e);
                    setError(e);
                }
            };
            load();
        }, [key]);

        if (error) {
            return (
                <div style={{ color: 'var(--text-error, #ff4444)', padding: '40px', backgroundColor: 'var(--background-primary)', height: '100%', fontFamily: 'monospace' }}>
                    <h2 style={{ fontWeight: 900 }}>VIDEO TO ASCII LOAD ERROR</h2>
                    <pre style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{error.stack}</pre>
                    <button 
                        onClick={() => { setError(null); setKey(k => k + 1); }} 
                        style={{ padding: '12px 24px', backgroundColor: 'var(--interactive-accent)', color: 'var(--text-on-accent)', border: 'none', fontWeight: 700, borderRadius: '4px', cursor: 'pointer' }}
                    >
                        RETRY PROTOCOL
                    </button>
                </div>
            );
        }

        if (!app) {
            return (
                <div style={{ 
                    backgroundColor: 'var(--background-primary)', 
                    height: '100%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'var(--interactive-accent)',
                    fontFamily: 'monospace',
                    fontSize: '13px'
                }}>
                    INITIALIZING_VIDEO_TO_ASCII_PROTOCOL...
                </div>
            );
        }

        const { STYLES, VideoToAscii } = app;
        return <FullTabWrapper STYLES={STYLES} VideoToAscii={VideoToAscii} key={key} />;
    };

    const FullTabWrapper = ({ STYLES, VideoToAscii }) => {
        const [isFullTab, setIsFullTab] = useState(!props.isInception);
        const [hijacked, setHijacked] = useState(false);
        const rootRef = useRef(null);
        const stateRefs = useRef({}).current;
        const componentId = useRef('videotoascii-' + Math.random().toString(36).substr(2, 5)).current;

        useEffect(() => {
            if (!isFullTab) {
                setHijacked(false);
                return;
            }

            const container = rootRef.current;
            if (!container) return;

            let poller;
            let attempts = 0;

            const tryHijack = () => {
                // 1. Locate nearest leaf content wrapper
                const leaf = container.closest('.workspace-leaf-content') || container.closest('.workspace-leaf');
                if (!leaf) return false;

                // 2. Select the view-content container below the header
                const contentWrapper = leaf.querySelector(':scope > .view-content') || leaf.querySelector('.view-content') || leaf;
                const currentParent = container.parentNode;
                if (!currentParent || currentParent === contentWrapper) return false;

                // 3. Setup placeholder in standard DOM layout
                stateRefs.originalParent = currentParent;
                const placeholder = activeDocument.createElement("div");
                placeholder.style.display = "none";
                if (container.nextSibling) {
                    currentParent.insertBefore(placeholder, container.nextSibling);
                } else {
                    currentParent.appendChild(placeholder);
                }
                stateRefs.placeholder = placeholder;

                // 4. Inject impeccable status bar suppression stylesheet
                const styleId = `impeccable-status-${componentId}`;
                let styleEl = activeDocument.getElementById(styleId);
                if (!styleEl) {
                    styleEl = activeDocument.createElement('style');
                    styleEl.id = styleId;
                    styleEl.textContent = `
                        /* Hide global status bar and view footers */
                        .status-bar, .view-footer, .workspace-leaf-content-footer { 
                            display: none !important; 
                        }
                        
                        /* Expand workspace-leaf-content to edge-to-edge container */
                        .workspace-leaf-content { 
                            padding: 0 !important; 
                            margin: 0 !important; 
                            border-radius: 0 !important; 
                        }
                    `;
                    activeDocument.head.appendChild(styleEl);
                }

                stateRefs.parentPositionInfo = {
                    element: contentWrapper,
                    originalInlinePosition: contentWrapper.style.position,
                };

                if (window.getComputedStyle(contentWrapper).position === 'static') {
                    contentWrapper.style.position = "relative";
                }

                // 5. Append component to view-content
                contentWrapper.appendChild(container);

                window.requestAnimationFrame(() => {
                    Object.assign(contentWrapper.style, {
                        padding: "0",
                        margin: "0",
                        height: "100%",
                        width: "100%",
                        display: "block",
                        overflow: "hidden"
                    });
                });

                Object.assign(container.style, {
                    position: "absolute",
                    top: "0",
                    left: "0",
                    width: "100%",
                    height: "100%",
                    zIndex: "9998",
                    overflow: "hidden",
                    backgroundColor: "var(--background-primary)",
                    display: "flex",
                    flexDirection: "column",
                    visibility: "visible",
                });
                setHijacked(true);
                return true;
            };

            // Run first try
            if (!tryHijack()) {
                poller = window.setInterval(() => {
                    attempts++;
                    if (tryHijack() || attempts > 100) {
                        window.clearInterval(poller);
                    }
                }, 16);
            }

            // 6. Graceful cleanup on unmount or fulltab minimize toggle
            return () => {
                if (poller) window.clearInterval(poller);

                if (stateRefs.placeholder?.parentNode) {
                    stateRefs.placeholder.parentNode.replaceChild(container, stateRefs.placeholder);
                } else if (stateRefs.originalParent) {
                    stateRefs.originalParent.appendChild(container);
                }

                const styleId = `impeccable-status-${componentId}`;
                const el = activeDocument.getElementById(styleId);
                if (el) el.remove();

                if (stateRefs.parentPositionInfo?.element) {
                    const { element, originalInlinePosition } = stateRefs.parentPositionInfo;
                    element.style.position = originalInlinePosition || '';
                    element.style.padding = '';
                    element.style.margin = '';
                    element.style.height = '';
                    element.style.width = '';
                    element.style.overflow = '';
                }

                container.removeAttribute("style");
                setHijacked(false);
            };
        }, [isFullTab]);

        return (
            <div 
                ref={rootRef}
                style={{
                    width: '100%',
                    height: '100%',
                    visibility: hijacked ? 'visible' : 'hidden',
                }}
            >
                <VideoToAscii
                    styles={STYLES}
                    folderPath={folderPath}
                    isFullTab={isFullTab}
                    onToggleFullTab={() => setIsFullTab(!isFullTab)}
                    {...props}
                />
            </div>
        );
    };

    return <SafeRoot />;
}

return { View };
