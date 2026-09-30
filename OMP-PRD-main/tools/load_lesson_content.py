#!/usr/bin/env python3
"""Load reviewed lesson content into public.learning_topics.

Reads data-only JSON from supabase/lesson-content/, validates every lesson
against the same rules the static Academy build enforces (the six published
sections plus HTTPS references), then writes through the Supabase REST API.

Why a loader rather than raw SQL: the content is long, quoting it into SQL is
error-prone, and the REST path is what the publisher already uses. The loader
refuses to send a lesson that would fail the build, so a partial or malformed
import can never take the site down.

Usage:
  SUPABASE_URL=... SUPABASE_KEY=... python3 tools/load_lesson_content.py
  python3 tools/load_lesson_content.py --check          # validate only, no writes
  python3 tools/load_lesson_content.py --module cyber-security-fundamentals
"""
import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT_DIR = ROOT / 'supabase/lesson-content'

# The six sections scripts/build-academy.mjs requires for a published lesson,
# mirroring legacySections in assets/js/academy-content.mjs.
REQUIRED_SECTIONS = (
    'overview', 'how_it_works', 'history',
    'real_world', 'what_to_look_for', 'defensive',
)
MAX_LIST_ITEMS = 12
MAX_ITEM_CHARS = 600
MAX_SECTION_CHARS = 4000
SLUG_RE = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
RESERVED_IDS = {'labs', 'quiz', 'account', 'main', 'learning-app'}


def is_text(value):
    return isinstance(value, str) and bool(value.strip())


def is_list(value):
    return (isinstance(value, list) and 0 < len(value) <= MAX_LIST_ITEMS
            and all(is_text(v) and len(v) <= MAX_ITEM_CHARS for v in value))


def validate(slug, content):
    """Return a list of problems. Empty list means the lesson is publishable."""
    problems = []
    if not SLUG_RE.match(slug):
        problems.append(f'{slug}: invalid slug')
    if not isinstance(content, dict):
        return [f'{slug}: content must be an object']
    for key in REQUIRED_SECTIONS:
        value = content.get(key)
        if not (is_text(value) or is_list(value)):
            problems.append(f'{slug}: needs non-empty "{key}"')
        elif is_text(value) and len(value) > MAX_SECTION_CHARS:
            problems.append(f'{slug}: "{key}" longer than {MAX_SECTION_CHARS} chars')
    refs = content.get('references')
    if not isinstance(refs, list) or not refs:
        problems.append(f'{slug}: needs at least one reference')
    else:
        for ref in refs:
            if not is_text(ref):
                problems.append(f'{slug}: reference must be text')
                continue
            try:
                url = urllib.parse.urlparse(ref)
            except ValueError:
                problems.append(f'{slug}: unparseable reference {ref!r}')
                continue
            if url.scheme != 'https' or not url.netloc or url.username or url.password:
                problems.append(f'{slug}: reference must be a plain HTTPS URL: {ref!r}')
    for key in ('seo_title', 'seo_description', 'practice_guidance'):
        if key in content and not is_text(content[key]):
            problems.append(f'{slug}: "{key}" must be non-empty text')
    if 'keywords' in content and not (is_text(content['keywords']) or is_list(content['keywords'])):
        problems.append(f'{slug}: "keywords" must be text or a list')
    for key in content:
        if key in REQUIRED_SECTIONS:
            continue
        if key in ('references', 'seo_title', 'seo_description',
                   'practice_guidance', 'keywords', 'self_check'):
            continue
        problems.append(f'{slug}: unknown key "{key}" (content is data-only)')
    return problems


def load_files(module_filter=None):
    if not CONTENT_DIR.is_dir():
        raise SystemExit(f'No content directory at {CONTENT_DIR}')
    found = []
    for path in sorted(CONTENT_DIR.glob('*.json')):
        if module_filter and module_filter not in path.stem:
            continue
        data = json.loads(path.read_text())
        found.append((path.stem, data.get('lessons', {})))
    if not found:
        raise SystemExit('No lesson content files matched.')
    return found


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true',
                        help='validate only, do not write')
    parser.add_argument('--module', help='load one module file only')
    args = parser.parse_args()

    files = load_files(args.module)
    lessons = {}
    problems = []
    for stem, block in files:
        for slug, content in block.items():
            if slug in lessons:
                problems.append(f'{slug}: defined in more than one file')
            lessons[slug] = content
            problems.extend(validate(slug, content))

    print(f'Validating {len(lessons)} lesson(s) from {len(files)} file(s)...')
    if problems:
        print(f'\n{len(problems)} problem(s):', file=sys.stderr)
        for p in problems:
            print(f'  - {p}', file=sys.stderr)
        return 1
    print('All lessons valid. No content would break the static build.')

    if args.check:
        return 0

    url = os.environ.get('SUPABASE_URL', 'https://aeehfulikupskyrvcpzb.supabase.co')
    key = os.environ.get('SUPABASE_PUBLISHABLE_KEY',
                          'sb_publishable_s3n2U32MNB4PvHx0GolyqA_wlkzD6eR')
    endpoint = f'{url}/rest/v1/learning_topics?slug=in.({",".join(lessons)})&select=id,slug,status'
    request = urllib.request.Request(endpoint, headers={'apikey': key})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            existing = json.loads(response.read())
    except urllib.error.URLError as error:
        print(f'Cannot reach Supabase: {error}', file=sys.stderr)
        return 1

    by_slug = {row['slug']: row for row in existing}
    missing = sorted(set(lessons) - set(by_slug))
    if missing:
        print(f'\nNot in the published catalogue, skipped: {missing}', file=sys.stderr)
    if not by_slug:
        return 0

    rows = [{'id': row['id'], 'content': lessons[row['slug']]} for row in existing.values()]
    patch = urllib.request.Request(
        f'{url}/rest/v1/learning_topics',
        data=json.dumps(rows).encode(),
        headers={
            'apikey': key,
            'content-type': 'application/json',
            'preference': 'return=minimal',
        },
        method='PATCH',
    )
    try:
        with urllib.request.urlopen(patch, timeout=60) as response:
            response.read()
    except urllib.error.HTTPError as error:
        print(f'Update failed: {error.code} {error.read().decode()[:400]}', file=sys.stderr)
        return 1
    print(f'\nUpdated content for {len(rows)} lesson(s): {", ".join(sorted(by_slug))}')
    return 0


if __name__ == '__main__':
    import urllib.parse  # noqa: F401  (used via urllib.parse.urlparse above)
    raise SystemExit(main())
