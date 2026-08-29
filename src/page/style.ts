// The page is one response, so the whole style ships inside it. There is no second request, no
// script and no network font, which is what lets the edge cache hold the entire page.
export const STYLE = `
:root {
  color-scheme: light dark;
  --ink: #14181f;
  --ink-soft: #5a6474;
  --paper: #ffffff;
  --paper-soft: #f4f6f9;
  --line: #e2e7ee;
  --accent: #1f5eff;
  --accent-ink: #ffffff;
  --space: 8px;
  --radius: 12px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --ink: #e8ecf3;
    --ink-soft: #98a3b4;
    --paper: #10141a;
    --paper-soft: #171c24;
    --line: #262d38;
    --accent: #7aa2ff;
    --accent-ink: #0b0e13;
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 17px;
  line-height: 1.6;
}
.wrap {
  max-width: 46rem;
  margin: 0 auto;
  padding: calc(var(--space) * 5) calc(var(--space) * 3) calc(var(--space) * 12);
}
header { border-bottom: 1px solid var(--line); padding-bottom: calc(var(--space) * 3); }
.eyebrow {
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-soft);
  margin: 0 0 var(--space);
}
h1 {
  font-size: clamp(1.5rem, 1.1rem + 1.8vw, 2.1rem);
  line-height: 1.25;
  letter-spacing: -0.015em;
  margin: 0;
  font-weight: 650;
}
.meta {
  margin: calc(var(--space) * 2) 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space) calc(var(--space) * 2);
  font-size: 0.875rem;
  color: var(--ink-soft);
}
.meta li { display: flex; gap: calc(var(--space) / 2); }
.meta b { font-weight: 550; color: var(--ink); }
.transcript {
  margin: calc(var(--space) * 4) 0 0;
  font-size: 1.0625rem;
  line-height: 1.75;
  max-width: 70ch;
  white-space: pre-wrap;
  overflow-wrap: break-word;
}
.transcript p { margin: 0 0 calc(var(--space) * 3); }
.note {
  margin: calc(var(--space) * 4) 0 0;
  padding: calc(var(--space) * 3);
  background: var(--paper-soft);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}
.note h2 { margin: 0 0 var(--space); font-size: 1.0625rem; font-weight: 600; }
.note p { margin: 0; color: var(--ink-soft); }
.note p + p { margin-top: var(--space); }
form { margin: calc(var(--space) * 4) 0 0; display: flex; flex-wrap: wrap; gap: var(--space); }
label { display: block; width: 100%; font-size: 0.875rem; color: var(--ink-soft); margin-bottom: var(--space); }
input[type="text"] {
  flex: 1 1 16rem;
  min-height: 44px;
  padding: 0 calc(var(--space) * 1.5);
  font: inherit;
  color: var(--ink);
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}
button {
  min-height: 44px;
  padding: 0 calc(var(--space) * 3);
  font: inherit;
  font-weight: 550;
  color: var(--accent-ink);
  background: var(--accent);
  border: 1px solid transparent;
  border-radius: var(--radius);
  cursor: pointer;
}
a { color: var(--accent); }
a:hover { text-decoration-thickness: 2px; }
:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9em;
  background: var(--paper-soft);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 1px 5px;
}
footer {
  margin-top: calc(var(--space) * 8);
  padding-top: calc(var(--space) * 3);
  border-top: 1px solid var(--line);
  font-size: 0.8125rem;
  color: var(--ink-soft);
}
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
`.trim();
