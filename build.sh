#!/usr/bin/env bash
# Inline style.css and app.js into index.html → index-dist.html
# Uses Python (available on macOS by default) for reliable multi-line substitution.
set -euo pipefail

python3 - <<'PYEOF'
import re, sys

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

with open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()

with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

html = re.sub(
    r'<link rel="stylesheet" href="style\.css">',
    f'<style>\n{css}\n</style>',
    html
)
html = re.sub(
    r'<script src="app\.js"></script>',
    f'<script>\n{js}\n</script>',
    html
)

with open('index-dist.html', 'w', encoding='utf-8') as f:
    f.write(html)

size = len(html.encode('utf-8'))
print(f"✓ Built index-dist.html ({size:,} bytes, {size//1024} KB)")
PYEOF
