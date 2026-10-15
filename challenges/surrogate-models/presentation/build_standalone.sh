#!/usr/bin/env bash
# One self-contained HTML of the whole deck, to send or put anywhere:
# scripts, styles, images, data snapshots and the embedded pages all go inside it.
# Only the YouTube videos and Plotly/MathJax from their CDNs still need internet.
#
# Usage: ./build_standalone.sh [output file, default plasma_pirates_presentation.html]
set -euo pipefail
cd "$(dirname "$0")"

OUT="${1:-plasma_pirates_presentation.html}"
quarto render index.md -M embed-resources:true --output "$OUT"

# The lightbox opens a slide image from its link's href, which pandoc does not embed:
# point each link at the data URI of the image it wraps.
python3 - "$OUT" <<'PY'
import re, sys
path = sys.argv[1]
html = open(path, encoding="utf-8").read()
pattern = re.compile(r'(<a href=")(index_files/images/[^"]+)("[^>]*class="lightbox"[^>]*>\s*<img[^>]*?src=")(data:[^"]+)(")')
html, n = pattern.subn(lambda m: m.group(1) + m.group(4) + m.group(3) + m.group(4) + m.group(5), html)

# Browsers cap URLs at ~2 MB, so a large embedded page (the 34 MB histogram) cannot stay in
# an iframe's data: src. Keep it in an inert <script> block and load it as a Blob URL.
BIG = 1_500_000
holders = []
def to_blob(m):
    if len(m.group(2)) < BIG:
        return m.group(0)
    holder = f'standalone-frame-{len(holders) + 1}'
    holders.append(f'<script type="text/plain" id="{holder}">{m.group(2)}</script>')
    return f'{m.group(1)} src="about:blank" data-standalone-src="{holder}"'
html = re.sub(r'(<iframe[^>]*?)\ssrc="(data:[^"]+)"', to_blob, html)
big = len(holders)
if big:
    loader = '''<script>
document.querySelectorAll('iframe[data-standalone-src]').forEach((frame) => {
  const uri = document.getElementById(frame.dataset.standaloneSrc).textContent;
  const comma = uri.indexOf(',');
  const meta = uri.slice(5, comma);
  const body = meta.includes(';base64')
    ? Uint8Array.from(atob(uri.slice(comma + 1)), (c) => c.charCodeAt(0))
    : decodeURIComponent(uri.slice(comma + 1));
  frame.src = URL.createObjectURL(new Blob([body], {type: meta.split(';')[0] || 'text/html'}));
});
</script>'''
    # The last </body>: the first one sits inside a script (the speaker-notes template).
    end = html.rindex('</body>')
    html = html[:end] + ''.join(holders) + loader + html[end:]
left = re.findall(r'(?:src|href)="(index_files/[^"]+|data/[^"]+|pipeline\.js)"', html)
open(path, "w", encoding="utf-8").write(html)
print(f"{path}: {n} lightbox links embedded, {big} large frames as blobs; "
      f"local references left: {left or 'none'}")
PY
ls -lh "$OUT"

# A self-contained render deletes index_files/libs, which the normal index.html loads:
# render the normal deck again so both versions stay usable.
quarto render index.md --quiet
