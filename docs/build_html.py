"""
Build script: DEVELOPER_GUIDE.md → DEVELOPER_GUIDE.html

Produces a single self-contained HTML page with:
- Custom design (oxblood + warm paper, Newsreader display, JetBrains Mono code)
- Sticky table of contents on desktop, drawer on mobile
- Scroll-spy highlighting current section
- Copy buttons on code blocks
- Section numbers as oversized serif italic glyphs in oxblood
- Anchor links on headings
- Print-friendly
"""

import re
from pathlib import Path

import markdown

SRC = Path("/mnt/user-data/outputs/DEVELOPER_GUIDE.md")
OUT = Path("/mnt/user-data/outputs/DEVELOPER_GUIDE.html")

# Read source
md_text = SRC.read_text()

# Strip the original front matter / first H1 because we render our own header
# Keep everything else
lines = md_text.split("\n")
content_lines = []
skipping_intro = False
seen_first_h1 = False
seen_toc_marker = False
for line in lines:
    if not seen_first_h1 and line.startswith("# "):
        seen_first_h1 = True
        skipping_intro = True
        continue
    if skipping_intro:
        # Skip until we hit the first H2 (signals end of intro)
        if line.startswith("## "):
            skipping_intro = False
            content_lines.append(line)
        # else: keep skipping
        continue
    content_lines.append(line)

# Strip the "Table of contents" section since we generate our own
cleaned_lines = []
in_toc_block = False
for line in content_lines:
    if line.strip() == "## Table of contents":
        in_toc_block = True
        continue
    if in_toc_block:
        # Skip until the next H2 or HR
        if line.startswith("## ") or line.strip() == "---":
            in_toc_block = False
        else:
            continue
    cleaned_lines.append(line)

clean_md = "\n".join(cleaned_lines)

# Convert markdown to HTML
md = markdown.Markdown(
    extensions=[
        "fenced_code",
        "tables",
        "attr_list",
        "toc",
        "sane_lists",
    ],
    extension_configs={
        "toc": {
            "permalink": False,
            "toc_depth": "2-3",
            "anchorlink": False,
        }
    },
)

html_body = md.convert(clean_md)

# Build TOC from the markdown's toc_tokens (H2 only for the sidebar)
toc_items = []
for token in md.toc_tokens:
    if token["level"] == 2:
        toc_items.append({"id": token["id"], "name": token["name"]})

import html as html_lib

# Section numbering by order of appearance
_section_counter = {"n": 0}

def inject_section_numbers(html_text):
    """Find <h2 id="..."> and inject a sequential section number."""

    def repl(m):
        full_id = m.group(1)
        text = m.group(2)
        _section_counter["n"] += 1
        num = _section_counter["n"]
        return (
            f'<h2 id="{full_id}">'
            f'<span class="sec-num">{num}.</span>'
            f'<span class="sec-text">{text}</span>'
            f'<a class="anchor" href="#{full_id}" aria-label="Permalink">#</a>'
            f"</h2>"
        )

    return re.sub(r'<h2 id="([^"]+)">(.*?)</h2>', repl, html_text, flags=re.DOTALL)


def inject_h3_anchors(html_text):
    def repl(m):
        full_id = m.group(1)
        text = m.group(2)
        return (
            f'<h3 id="{full_id}">{text}'
            f'<a class="anchor" href="#{full_id}" aria-label="Permalink">#</a>'
            f"</h3>"
        )

    return re.sub(r'<h3 id="([^"]+)">(.*?)</h3>', repl, html_text, flags=re.DOTALL)


def wrap_code_blocks(html_text):
    """Wrap <pre><code> in a container that includes a copy button."""

    def repl(m):
        pre_content = m.group(0)
        return (
            '<div class="code-wrap">'
            '<button class="copy-btn" aria-label="Copy code">Copy</button>'
            f"{pre_content}"
            "</div>"
        )

    return re.sub(r"<pre><code[^>]*>.*?</code></pre>", repl, html_text, flags=re.DOTALL)


html_body = inject_section_numbers(html_body)
html_body = inject_h3_anchors(html_body)
html_body = wrap_code_blocks(html_body)

# Build TOC HTML — use order-of-appearance numbering matching the H2 numbering
toc_html_parts = ['<ol class="toc-list">']
for i, item in enumerate(toc_items, start=1):
    toc_html_parts.append(
        f'<li><a href="#{item["id"]}" data-target="{item["id"]}">'
        f'<span class="toc-num">{i}</span>'
        f'<span class="toc-text">{html_lib.escape(item["name"])}</span>'
        f"</a></li>"
    )
toc_html_parts.append("</ol>")
toc_html = "\n".join(toc_html_parts)

# Compose final HTML
HTML_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Developer Guide — Poker Trainer V1</title>
<meta name="description" content="Comprehensive technical reference for developers working on the Poker Trainer V1 build." />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;0,6..72,700;1,6..72,400;1,6..72,500;1,6..72,600;1,6..72,700&family=JetBrains+Mono:ital,wght@0,400;0,500;0,700;1,400&display=swap" rel="stylesheet" />
<style>
:root {
  --bg: #F7F4ED;
  --bg-elev: #FFFFFF;
  --bg-code: #1B1817;
  --ink: #1B1817;
  --ink-soft: #4A453F;
  --ink-mute: #8C8579;
  --ink-faint: rgba(27, 24, 23, 0.18);
  --accent: #7A2E2E;
  --accent-bg: rgba(122, 46, 46, 0.06);
  --rule: rgba(27, 24, 23, 0.10);
  --code-text: #E8E3DA;
  --code-mute: #908A80;

  --font-display: 'Newsreader', Georgia, 'Times New Roman', serif;
  --font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', 'Menlo', Consolas, monospace;

  --max-content: 720px;
  --toc-width: 280px;
  --pad-page: 32px;
}

* { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 16.5px;
  line-height: 1.65;
  font-feature-settings: "kern", "liga", "calt", "ss01";
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

::selection { background: var(--accent); color: #fff; }

/* --- Header --- */

.site-header {
  max-width: 1200px;
  margin: 0 auto;
  padding: 56px var(--pad-page) 0;
}

.eyebrow {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-mute);
  display: flex;
  align-items: center;
  gap: 14px;
}

.eyebrow .dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--accent);
  display: inline-block;
}

.title-wrap {
  margin-top: 28px;
  padding-bottom: 36px;
  border-bottom: 1px solid var(--rule);
  max-width: var(--max-content);
}

h1.doc-title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: clamp(40px, 7vw, 64px);
  line-height: 1.02;
  letter-spacing: -0.02em;
  margin: 0;
  color: var(--ink);
}

h1.doc-title em {
  font-style: italic;
  color: var(--accent);
  font-weight: 500;
}

.doc-meta {
  margin-top: 18px;
  display: flex;
  flex-wrap: wrap;
  gap: 18px 28px;
  align-items: baseline;
}

.doc-meta dt {
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-mute);
  margin: 0;
}

.doc-meta dd {
  font-family: var(--font-body);
  font-size: 14px;
  color: var(--ink-soft);
  margin: 0 0 0 8px;
  display: inline;
}

.doc-meta .meta-item { display: inline-flex; align-items: baseline; gap: 8px; }

.lead {
  max-width: var(--max-content);
  margin: 36px 0 0;
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 19px;
  line-height: 1.55;
  color: var(--ink-soft);
}

/* --- Layout --- */

.layout {
  max-width: 1200px;
  margin: 0 auto;
  padding: 64px var(--pad-page) 96px;
  display: grid;
  grid-template-columns: var(--toc-width) 1fr;
  gap: 64px;
  align-items: start;
}

/* --- TOC --- */

.toc-toggle {
  display: none;
  position: fixed;
  bottom: 20px; right: 20px;
  background: var(--ink);
  color: var(--bg);
  border: none;
  padding: 12px 18px;
  border-radius: 999px;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  z-index: 100;
}

.toc {
  position: sticky;
  top: 32px;
  max-height: calc(100vh - 64px);
  overflow-y: auto;
  padding-right: 16px;
}

.toc-label {
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-mute);
  margin: 0 0 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--rule);
}

.toc-list {
  list-style: none;
  margin: 0; padding: 0;
  counter-reset: none;
}

.toc-list li { margin: 0; }

.toc-list a {
  display: grid;
  grid-template-columns: 26px 1fr;
  gap: 6px;
  padding: 7px 0;
  text-decoration: none;
  color: var(--ink-soft);
  font-size: 13.5px;
  line-height: 1.4;
  border-left: 2px solid transparent;
  padding-left: 12px;
  margin-left: -12px;
  transition: color 120ms ease, border-color 120ms ease, background-color 120ms ease;
}

.toc-list a:hover {
  color: var(--ink);
}

.toc-list a.active {
  color: var(--accent);
  border-left-color: var(--accent);
  background: var(--accent-bg);
}

.toc-num {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 500;
  color: var(--ink-mute);
}

.toc-list a.active .toc-num { color: var(--accent); }

/* --- Main content --- */

.content {
  max-width: var(--max-content);
  min-width: 0;
}

.content p {
  margin: 0 0 18px;
  color: var(--ink);
}

.content > p:first-of-type { margin-top: 0; }

.content h2 {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 32px;
  line-height: 1.15;
  letter-spacing: -0.015em;
  margin: 72px 0 24px;
  padding-top: 16px;
  color: var(--ink);
  position: relative;
  display: flex;
  align-items: baseline;
  gap: 16px;
  scroll-margin-top: 24px;
}

.content h2:first-child { margin-top: 0; }

.sec-num {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 500;
  font-size: 44px;
  color: var(--accent);
  line-height: 1;
  flex-shrink: 0;
}

.sec-text { flex: 1; }

.content h3 {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 22px;
  line-height: 1.25;
  letter-spacing: -0.01em;
  margin: 44px 0 16px;
  color: var(--ink);
  scroll-margin-top: 24px;
}

.content h4 {
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 15px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 32px 0 12px;
  color: var(--ink-soft);
}

.anchor {
  font-family: var(--font-mono);
  font-weight: 400;
  font-size: 0.65em;
  color: var(--ink-faint);
  text-decoration: none;
  margin-left: 10px;
  opacity: 0;
  transition: opacity 120ms ease, color 120ms ease;
}

.content h2:hover .anchor,
.content h3:hover .anchor { opacity: 1; }

.anchor:hover { color: var(--accent); }

.content a {
  color: var(--accent);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  text-decoration-color: rgba(122, 46, 46, 0.35);
  transition: text-decoration-color 120ms ease;
}

.content a:hover {
  text-decoration-color: var(--accent);
}

.content strong { font-weight: 600; color: var(--ink); }
.content em { font-style: italic; }

.content ul, .content ol {
  margin: 0 0 18px;
  padding-left: 24px;
}

.content li { margin-bottom: 6px; }
.content li > p { margin-bottom: 8px; }
.content li > ul, .content li > ol { margin-top: 6px; margin-bottom: 6px; }

.content ul li::marker { color: var(--accent); }
.content ol li::marker { color: var(--accent); font-family: var(--font-display); font-style: italic; }

/* Inline code */

.content code {
  font-family: var(--font-mono);
  font-size: 0.88em;
  background: var(--accent-bg);
  color: var(--ink);
  padding: 1px 5px;
  border-radius: 3px;
  border: 1px solid rgba(122, 46, 46, 0.08);
}

/* Code blocks */

.code-wrap {
  position: relative;
  margin: 24px 0;
}

.content pre {
  margin: 0;
  background: var(--bg-code);
  color: var(--code-text);
  padding: 20px 22px;
  border-radius: 4px;
  overflow-x: auto;
  font-size: 13.5px;
  line-height: 1.6;
}

.content pre code {
  background: transparent;
  color: var(--code-text);
  padding: 0;
  border: none;
  font-size: inherit;
  border-radius: 0;
}

.copy-btn {
  position: absolute;
  top: 12px; right: 12px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--code-text);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 5px 10px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  opacity: 0;
  transition: opacity 150ms ease, background 150ms ease;
}

.code-wrap:hover .copy-btn { opacity: 1; }

.copy-btn:hover { background: rgba(255, 255, 255, 0.15); }

.copy-btn.copied {
  background: var(--accent);
  border-color: var(--accent);
  opacity: 1;
}

/* Tables */

.content table {
  width: 100%;
  margin: 24px 0;
  border-collapse: collapse;
  font-size: 14.5px;
}

.content thead {
  border-top: 1.5px solid var(--ink);
  border-bottom: 1px solid var(--rule);
}

.content th {
  text-align: left;
  padding: 12px 14px 12px 0;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-soft);
}

.content tbody tr {
  border-bottom: 1px solid var(--rule);
}

.content td {
  padding: 12px 14px 12px 0;
  vertical-align: top;
  color: var(--ink-soft);
}

.content td:first-child { color: var(--ink); font-weight: 500; }

/* Blockquotes */

.content blockquote {
  margin: 24px 0;
  padding: 4px 0 4px 20px;
  border-left: 2px solid var(--accent);
  font-style: italic;
  color: var(--ink-soft);
}

/* Horizontal rule */

.content hr {
  border: none;
  border-top: 1px solid var(--rule);
  margin: 56px 0;
}

/* Footer */

.site-footer {
  max-width: 1200px;
  margin: 0 auto;
  padding: 32px var(--pad-page) 56px;
  border-top: 1px solid var(--rule);
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-mute);
}

.site-footer a { color: var(--ink-mute); text-decoration: none; }
.site-footer a:hover { color: var(--accent); }

/* Responsive */

@media (max-width: 960px) {
  :root { --pad-page: 24px; }

  .site-header { padding-top: 36px; }

  .layout {
    grid-template-columns: 1fr;
    gap: 0;
    padding-top: 32px;
  }

  .toc-toggle { display: block; }

  .toc {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: var(--bg);
    padding: 32px 24px;
    overflow-y: auto;
    z-index: 50;
    transform: translateY(100%);
    transition: transform 220ms ease;
    max-height: 100vh;
  }

  .toc.open { transform: translateY(0); }

  .toc-close {
    display: block;
    margin: 0 0 20px auto;
    background: none;
    border: 1px solid var(--rule);
    color: var(--ink);
    padding: 6px 12px;
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .content h2 { font-size: 26px; gap: 12px; margin-top: 56px; }
  .sec-num { font-size: 34px; }
  .content h3 { font-size: 19px; }

  h1.doc-title { font-size: 40px; }

  .copy-btn { opacity: 1; } /* Always visible on touch */
}

@media (min-width: 961px) {
  .toc-close { display: none; }
}

@media print {
  .toc, .toc-toggle, .anchor, .copy-btn { display: none !important; }
  .layout { grid-template-columns: 1fr; padding: 24px; }
  .content { max-width: 100%; }
  body { font-size: 11pt; }
  .content pre { font-size: 9.5pt; page-break-inside: avoid; }
  .content h2 { page-break-after: avoid; }
}
</style>
</head>
<body>

<header class="site-header">
  <div class="eyebrow">
    <span class="dot"></span>
    <span>BLAGOJCHE.DEV</span>
    <span>·</span>
    <span>DOCS</span>
    <span>·</span>
    <span>POKER TRAINER</span>
  </div>

  <div class="title-wrap">
    <h1 class="doc-title">Developer <em>Guide</em></h1>
    <dl class="doc-meta">
      <span class="meta-item"><dt>Project</dt><dd>Beat Small Stakes</dd></span>
      <span class="meta-item"><dt>Version</dt><dd>V1 build</dd></span>
      <span class="meta-item"><dt>Repo</dt><dd>beatsmallstakes/beat-small-stakes-app</dd></span>
      <span class="meta-item"><dt>Stack</dt><dd>React · Supabase · Stripe</dd></span>
    </dl>
    <p class="lead">Comprehensive technical reference for developers working on the Poker Trainer app. This is a content-heavy subscription PWA with a no-code content operations backbone. The codebase is one repo, but logically two workstreams: the member-facing app and the CMS pipeline. For day-to-day code style, see <code>CLAUDE.md</code> at the repo root. This document complements it with deeper architecture, patterns, and how-to-extend guidance.</p>
  </div>
</header>

<div class="layout">

  <aside class="toc" id="toc" aria-label="Table of contents">
    <button class="toc-close" aria-label="Close table of contents">Close</button>
    <p class="toc-label">Contents</p>
    {TOC}
  </aside>

  <main class="content" id="content">
    {BODY}
  </main>

</div>

<footer class="site-footer">
  <div>Developer Guide · Poker Trainer V1</div>
  <div>
    <a href="DEVELOPER_GUIDE.md">View as Markdown</a>
    <span style="margin: 0 12px; color: var(--ink-faint);">·</span>
    Last updated June 2026
  </div>
</footer>

<button class="toc-toggle" id="tocToggle" aria-label="Open table of contents">Contents</button>

<script>
(function () {
  // Copy buttons
  document.querySelectorAll('.copy-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var code = btn.parentElement.querySelector('code') || btn.parentElement.querySelector('pre');
      if (!code) return;
      var text = code.innerText;
      navigator.clipboard.writeText(text).then(function () {
        btn.textContent = 'Copied';
        btn.classList.add('copied');
        setTimeout(function () {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 1400);
      });
    });
  });

  // Mobile TOC toggle
  var toc = document.getElementById('toc');
  var toggle = document.getElementById('tocToggle');
  var closeBtn = document.querySelector('.toc-close');
  toggle && toggle.addEventListener('click', function () { toc.classList.add('open'); });
  closeBtn && closeBtn.addEventListener('click', function () { toc.classList.remove('open'); });
  toc.addEventListener('click', function (e) {
    if (e.target.tagName === 'A' && window.innerWidth <= 960) {
      toc.classList.remove('open');
    }
  });

  // Scroll-spy
  var sections = document.querySelectorAll('.content h2[id]');
  var tocLinks = document.querySelectorAll('.toc-list a');
  var linkMap = {};
  tocLinks.forEach(function (link) {
    var target = link.getAttribute('data-target');
    if (target) linkMap[target] = link;
  });

  function setActive(id) {
    tocLinks.forEach(function (l) { l.classList.remove('active'); });
    if (linkMap[id]) linkMap[id].classList.add('active');
  }

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          setActive(entry.target.id);
        }
      });
    }, { rootMargin: '-30% 0px -65% 0px', threshold: 0 });
    sections.forEach(function (s) { observer.observe(s); });
  }
})();
</script>

</body>
</html>
"""

final_html = HTML_TEMPLATE.replace("{TOC}", toc_html).replace("{BODY}", html_body)

OUT.write_text(final_html)
print(f"Wrote {OUT}")
print(f"Size: {len(final_html):,} bytes")
print(f"Sections found: {len(toc_items)}")
