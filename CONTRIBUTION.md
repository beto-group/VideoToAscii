# Contribution Standards — VIDEO TO ASCII

To maintain code security, style consistency, and runtime reliability, all contributions to this component must adhere to these policies:

## 1. Zero-Build Architecture
This component is evaluated dynamically in Obsidian via `dc.require`.
*   **Do not** introduce `package.json`, `node_modules`, or build systems (Webpack, Vite, Babel).
*   **Do not** reference external absolute paths (e.g. `/Volumes/` or system roots).

## 2. No ES Module (ESM) Exports
The sandbox loader does not support ESM.
*   **Do not** use `export` or `export default` statements.
*   All exports must be returned as a plain object at the end of the file:
    ```javascript
    return { MyModule };
    ```

## 3. Dynamic Styling
*   Avoid hardcoded hexadecimal colors (`#000000`, `#ffffff`).
*   Always bind colors to host (Obsidian) theme variables (e.g., `var(--background-primary)`, `var(--text-normal)`).

## 4. FullTab Immersion
*   Never modify the DOM structure of other open note leaves.
*   Always use the standard placeholder reparenting standard to prevent React reconciliation loops.
