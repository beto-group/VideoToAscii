# VideoToAscii Integration Example

To run the Video to ASCII terminal on a custom workspace page:

1. Create a new markdown file (e.g. `AsciiPlayer.md`).
2. Add the `bfv-container` frontmatter layout classes to make it full-pane.
3. Insert the standard `datacorejsx` rendering code block.

### Example Note Template

```markdown
---
cssclasses:
  - bfv-container
  - fulltab-910-videotoascii
---

\`\`\`datacorejsx
const activeFile = dc.resolvePath("VIDEO TO ASCII") || "_RESOURCES/DATACORE/_DONE/VIDEO TO ASCII/VIDEO TO ASCII.md";
const folderPath = activeFile.substring(0, activeFile.lastIndexOf('/'));

const { View } = await dc.require(folderPath + "/src/index.jsx");
return <View folderPath={folderPath} />;
\`\`\`
```
