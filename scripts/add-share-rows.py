#!/usr/bin/env python3
"""Insert the share row into every content page.

Idempotent: a page that already carries a share row is rewritten, not doubled,
so this can be re-run after new pages are added. Run from the site root:

    python3 scripts/add-share-rows.py --apply        # write the changes
    python3 scripts/add-share-rows.py                # dry run, reports only

The row is written into the HTML rather than built by JavaScript so that the
Facebook / X / Email links work with scripting switched off. share.js only
drives the copy button and the phone share sheet.
"""
import argparse
import html
import os
import re
import sys

# submit.html is a form with no heading of its own. Section index pages
# (price-guide/index.html and friends) ARE shareable, so only the site's own
# front page is excluded — by path, not by file name.
SKIP_FILES = {'404.html', 'submit.html'}
SKIP_PATHS = {'./index.html'}

CANONICAL = re.compile(r'<link\s+rel="canonical"\s+href="([^"]+)"', re.I)
H1 = re.compile(r'<h1[^>]*>(.*?)</h1>', re.I | re.S)
TITLE = re.compile(r'<title>(.*?)</title>', re.I | re.S)
EXISTING_ROW = re.compile(r'\n?<div class="share" data-share.*?</div>\n?', re.I | re.S)
SHARE_SCRIPT = '<script src="/assets/share.js" defer></script>'
SHARE_CSS = '<link rel="stylesheet" href="/assets/share.css">'

ICONS = {
    'facebook': 'M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.25-1.5 1.55-1.5h1.65V3.6A22 22 0 0 0 14.3 3.5c-2.4 0-4 1.45-4 4.1v2.3H7.6V13h2.7v8Z',
    'x': 'M17.5 3h3l-6.6 7.5L21.8 21h-6l-4.7-6.1L5.7 21h-3l7-8-6.9-10h6.1l4.3 5.6Zm-1.05 16.2h1.65L7.6 4.7H5.85Z',
    'email': 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm9 7.4L4.6 7H19.4ZM4 8.5V17h16V8.5l-7.4 5.4a1 1 0 0 1-1.2 0Z',
    'copy': 'M8 2h9a2 2 0 0 1 2 2v11h-2V4H8Zm-3 4h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm0 2v12h9V8Z',
    'native': 'M18 16.1a2.9 2.9 0 0 0-1.95.77L8.9 12.7a3 3 0 0 0 0-1.4l7.05-4.11A2.9 2.9 0 0 0 18 8a3 3 0 1 0-3-3c0 .24.04.47.1.7L8.05 9.81a3 3 0 1 0 0 4.38l7.12 4.16c-.06.2-.09.4-.09.6a2.92 2.92 0 1 0 2.92-2.85Z',
}


def icon(name):
    return ('<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
            '<path fill="currentColor" d="%s"/></svg>' % ICONS[name])


def plain(fragment):
    """Visible text of an HTML fragment, entities resolved, whitespace tidied."""
    text = re.sub(r'<[^>]+>', '', fragment)
    return re.sub(r'\s+', ' ', html.unescape(text)).strip()


def attr(value):
    return html.escape(value, quote=True)


def build_row(url, title):
    from urllib.parse import quote
    enc = lambda s: quote(s, safe='')
    fb = 'https://www.facebook.com/sharer/sharer.php?u=' + enc(url)
    x = 'https://x.com/intent/tweet?url=%s&text=%s' % (enc(url), enc(title))
    mail = 'mailto:?subject=%s&body=%s' % (enc(title), enc('%s\n\n%s' % (title, url)))
    t = attr(title)
    return (
        '<div class="share" data-share data-share-url="%s" data-share-title="%s">\n'
        '<span class="share-label">Share this page</span>\n'
        '<a class="share-btn" href="%s" target="_blank" rel="noopener" aria-label="Share &quot;%s&quot; on Facebook">%s<span>Facebook</span></a>\n'
        '<a class="share-btn" href="%s" target="_blank" rel="noopener" aria-label="Share &quot;%s&quot; on X">%s<span>X</span></a>\n'
        '<a class="share-btn" href="%s" aria-label="Email a link to &quot;%s&quot;">%s<span>Email</span></a>\n'
        '<button class="share-btn share-copy" type="button" hidden aria-label="Copy the link to &quot;%s&quot;">%s<span class="share-copy-text">Copy link</span></button>\n'
        '<button class="share-btn share-native" type="button" hidden aria-label="Share &quot;%s&quot;">%s<span>Share</span></button>\n'
        '<span class="share-status" role="status" aria-live="polite"></span>\n'
        '</div>\n'
        % (attr(url), t,
           attr(fb), t, icon('facebook'),
           attr(x), t, icon('x'),
           attr(mail), t, icon('email'),
           t, icon('copy'),
           t, icon('native'))
    )


SITE = 'https://relicsofwar.com'


def url_from_path(path):
    """A page without a canonical tag still has one true URL — its own path."""
    rel = os.path.relpath(path, '.').replace(os.sep, '/')
    if rel.endswith('/index.html'):
        return '/' + rel[:-len('index.html')]
    if rel == 'index.html':
        return '/'
    return '/' + rel


def process(path, apply_changes):
    raw = open(path, encoding='utf-8', errors='replace').read()

    # Every page here closes a <main>; the article close is preferred so the
    # row sits with the content rather than below it.
    if raw.count('</article>') == 1:
        anchor = '</article>'
    elif raw.count('</main>') == 1:
        anchor = '</main>'
    elif raw.count('<footer') == 1:
        anchor = raw[raw.index('<footer'):].split('>')[0] + '>'
    else:
        return 'no-anchor'

    m = CANONICAL.search(raw)
    if m:
        url = html.unescape(m.group(1))
    else:
        url = SITE + url_from_path(path)

    h = H1.search(raw)
    if h:
        title = plain(h.group(1))
    else:
        t = TITLE.search(raw)
        title = plain(t.group(1)).split(' | ')[0] if t else ''
    if not title:
        return 'no-title'

    updated = EXISTING_ROW.sub('\n', raw)          # replace, never duplicate
    updated = updated.replace(anchor, build_row(url, title) + anchor, 1)

    if SHARE_CSS not in updated:
        updated = updated.replace('</head>', SHARE_CSS + '\n</head>', 1)

    if SHARE_SCRIPT not in updated:
        updated = updated.replace('</body>', SHARE_SCRIPT + '</body>', 1)

    if updated == raw:
        return 'unchanged'
    if apply_changes:
        open(path, 'w', encoding='utf-8').write(updated)
    return 'updated'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true', help='write the files')
    args = ap.parse_args()

    counts = {}
    skipped = []
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in ('.git', 'node_modules', 'scripts', 'assets')]
        for fn in sorted(files):
            if not fn.endswith(('.htm', '.html')) or fn in SKIP_FILES:
                continue
            path = os.path.join(root, fn)
            if path in SKIP_PATHS:
                continue
            result = process(path, args.apply)
            counts[result] = counts.get(result, 0) + 1
            if result not in ('updated', 'unchanged'):
                skipped.append('%s (%s)' % (path, result))

    for key in sorted(counts):
        print('%-16s %d' % (key, counts[key]))
    if skipped:
        print('\nskipped:')
        for line in skipped:
            print('  ' + line)
    if not args.apply:
        print('\nDry run — nothing written. Re-run with --apply.')


if __name__ == '__main__':
    sys.exit(main())
