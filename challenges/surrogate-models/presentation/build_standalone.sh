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

# The slide photos are up to 4400 px and 18 MB each; 2560 px is plenty for a 1280x720 deck
# on a retina screen. Scale the embedded copies down (macOS sips), never the source images.
import base64, os, shutil, subprocess, tempfile
def shrink(m):
    kind, data = m.group(1), m.group(2)
    if len(data) < 3_000_000 or not shutil.which("sips"):
        return m.group(0)
    with tempfile.TemporaryDirectory() as tmp:
        image = os.path.join(tmp, f"image.{'png' if kind == 'png' else 'jpg'}")
        with open(image, "wb") as out:
            out.write(base64.b64decode(data))
        subprocess.run(["sips", "-Z", "2560", image], check=True, capture_output=True)
        with open(image, "rb") as small:
            data = base64.b64encode(small.read()).decode()
    return f"data:image/{kind};base64,{data}"
before = len(html)
html = re.sub(r'data:image/(png|jpeg);base64,([A-Za-z0-9+/=]+)', shrink, html)
saved = (before - len(html)) / 1e6

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

# Pages loaded lazily (the data-explorer iframe and its case buttons) sit in data-src. Pandoc
# embeds them percent-encoded, about three times their size, once per button and once per
# frame, and too long for a data: URL to load. Keep each page once, base64 in a holder, and
# let the loader below turn data-src into a Blob URL.
import base64, hashlib, urllib.parse
pages = {}
def to_holder(m):
    uri = m.group(1)
    meta, data = uri[5:uri.index(',')], uri[uri.index(',') + 1:]
    body = base64.b64decode(data) if ';base64' in meta else urllib.parse.unquote_to_bytes(data)
    key = hashlib.sha1(body).hexdigest()
    if key not in pages:
        pages[key] = f'standalone-page-{len(pages) + 1}'
        holders.append(f'<script type="text/plain" id="{pages[key]}">'
                       f'data:text/html;base64,{base64.b64encode(body).decode()}</script>')
    return f'data-src="standalone:{pages[key]}"'
html = re.sub(r'data-src="(data:text/html[^"]*)"', to_holder, html)
lazy = len(pages)
if holders:
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
const blobs = {};
const blobOf = (holder) => {
  if (!blobs[holder]) {
    const uri = document.getElementById(holder).textContent;
    const bytes = Uint8Array.from(atob(uri.slice(uri.indexOf(',') + 1)), (c) => c.charCodeAt(0));
    blobs[holder] = URL.createObjectURL(new Blob([bytes], {type: 'text/html'}));
  }
  return blobs[holder];
};
document.querySelectorAll('[data-src^="standalone:"]').forEach((el) => {
  el.dataset.src = blobOf(el.dataset.src.slice('standalone:'.length));
  if (el.tagName === 'IFRAME' && el.getAttribute('src')) el.src = el.dataset.src;
});
</script>'''
    # The last </body>: the first one sits inside a script (the speaker-notes template).
    end = html.rindex('</body>')
    html = html[:end] + ''.join(holders) + loader + html[end:]
left = re.findall(r'(?:src|href|data-src)="(index_files/[^"]+|data/[^"]+|[a-z]+\.js)"', html)
open(path, "w", encoding="utf-8").write(html)
print(f"{path}: {n} lightbox links embedded, {big} large frames and {lazy} lazy pages as blobs; "
      f"{saved:.0f} MB saved on images; local references left: {left or 'none'}")
PY
ls -lh "$OUT"

# A self-contained render deletes index_files/libs, which the normal index.html loads:
# render the normal deck again so both versions stay usable.
quarto render index.md --quiet
