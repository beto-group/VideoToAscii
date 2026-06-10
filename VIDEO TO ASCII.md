---
cssclasses:
  - bfv-container
  - fulltab-910-videotoascii
---

```datacorejsx
try {
    const activeFile = dc.resolvePath("VIDEO TO ASCII") || "_RESOURCES/DATACORE/_DONE/VIDEO TO ASCII/VIDEO TO ASCII.md";
    const folderPath = activeFile.substring(0, activeFile.lastIndexOf('/'));
    
    const { View } = await dc.require(folderPath + "/src/index.jsx");
    return <View folderPath={folderPath} />;
} catch (e) {
    return (
        <div style={{ color: 'var(--text-error, red)', padding: '20px', background: 'var(--background-secondary)', zIndex: 100000, position: 'relative', fontFamily: 'monospace' }}>
            <h3>Datacore Load Error</h3>
            <pre>{e.stack || e.message || String(e)}</pre>
        </div>
    );
}
```
