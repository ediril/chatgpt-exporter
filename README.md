# AI Chat Exporter

Two bookmarklet exporters, deployed as separate pages:

- `chatgpt-export/` exports ChatGPT conversations as self-contained HTML files.
- `claude-export/` exports Claude conversations as Markdown files.

## Development

### Setup

```bash
cd chatgpt-export && npm install
cd ../claude-export && npm install
```

### Building

Each project uses obfuscated JavaScript for its production bookmarklet. Build each page from its own folder:

```bash
npm run build
```

The build reads the source bookmarklet from the project folder and writes the obfuscated version to that project's `dist/` directory. Each `index.php` loads its own generated file from `dist/`.

### Files

- `chatgpt-export/html_bookmarklet.js` - ChatGPT HTML exporter source.
- `claude-export/claude_markdown_bookmarklet.js` - Claude Markdown exporter source.
- `*/build.js` - Project-local build script for obfuscation.
- `*/index.php` - Project-local install page.

Generated `dist/` files are excluded from git.

## Usage

Visit the relevant project's `index.php` page and drag its bookmarklet to your bookmarks bar.
