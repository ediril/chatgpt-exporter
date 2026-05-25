# Conversation Exporter

Export ChatGPT conversations as HTML files and Claude conversations as Markdown files.

## Development

### Setup

```bash
npm install
```

### Building

The project uses obfuscated JavaScript for the bookmarklets in production. To build the obfuscated versions:

```bash
npm run build
```

This will:
1. Read the source bookmarklets from the root directory:
   - `html_bookmarklet.js` (original, readable)
   - `claude_markdown_bookmarklet.js` (original, readable)

2. Generate obfuscated versions in `dist/`:
   - `dist/html_bookmarklet.js` (obfuscated)
   - `dist/claude_markdown_bookmarklet.js` (obfuscated)

3. `index.php` automatically loads the obfuscated versions from `dist/`

### Files

- **Source files** (keep in git):
  - `html_bookmarklet.js` - Original HTML exporter
  - `claude_markdown_bookmarklet.js` - Claude Markdown exporter
  - `build.js` - Build script for obfuscation

- **Generated files** (excluded from git):
  - `dist/html_bookmarklet.js` - Obfuscated HTML exporter
  - `dist/claude_markdown_bookmarklet.js` - Obfuscated Claude Markdown exporter

### Workflow

1. Edit the source bookmarklets (`html_bookmarklet.js`, `claude_markdown_bookmarklet.js`)
2. Run `npm run build` to generate obfuscated versions
3. Test with `index.php` (uses the obfuscated versions)
4. Commit only the source files, not the `dist/` folder

## Usage

Visit `index.php` in your browser and drag the bookmarklets to your bookmarks bar.
