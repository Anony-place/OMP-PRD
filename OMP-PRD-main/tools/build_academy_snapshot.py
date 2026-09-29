#!/usr/bin/env python3
"""Build the public, read-only Academy snapshot from reviewed foundation seed.

Run from any directory: python3 tools/build_academy_snapshot.py
This intentionally reads only categories, topics and labs; NEVER answer keys,
progress, certificates, account records or assessment questions.
If the published curriculum changes, review/update the source migration below
before regenerating. This is a seed-specific parser, not a general SQL parser.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'supabase/migrations/20260927143000_reset_to_web_application_security.sql'
TARGET = ROOT / 'assets/data/academy-reading.json'


def seed_rows(sql, table):
    block = re.search(r'insert into public\.' + table + r'\((.*?)\) values\s*(.*?);\n', sql, re.S)
    if not block:
        raise ValueError(f'Missing seed table: {table}')
    columns = block[1].split(',')
    rows = []
    for row in re.findall(r"\(((?:[^'()]|'(?:[^']|'')*')*)\)", block[2]):
        fields = re.findall(r"'(?:[^']|'')*'|[^,]+", row)
        values = []
        for field in fields:
            field = field.strip()
            if field.startswith("'"):
                value = field[1:-1].replace("''", "'")
            elif field in ('true', 'false'):
                value = field == 'true'
            else:
                value = int(field)
            values.append(value)
        if len(values) != len(columns):
            raise ValueError(f'Unexpected seed structure: {table}')
        rows.append(dict(zip(columns, values)))
    if not rows:
        raise ValueError(f'No rows parsed: {table}')
    return rows


def snapshot():
    sql = SOURCE.read_text()
    categories = [c for c in seed_rows(sql, 'learning_categories') if c['is_active']]
    category_ids = {c['id'] for c in categories}
    topics = [t for t in seed_rows(sql, 'learning_topics')
              if t['status'] == 'published' and t['category_id'] in category_ids]
    for topic in topics:
        topic['content'] = json.loads(topic['content'])
    structure = json.loads((ROOT / 'supabase/academy-curriculum.json').read_text())
    for topic in topics:
        topic['module_id'] = structure['assignments'][topic['id']]
        topic['path_id'] = next(m['path_id'] for m in structure['modules'] if m['id'] == topic['module_id'])
    topic_ids = {t['id'] for t in topics}
    labs = [lab for lab in seed_rows(sql, 'learning_labs')
            if lab['is_active'] and lab['topic_id'] in topic_ids]
    for category in categories:
        category['topics'] = [t for t in topics if t['category_id'] == category['id']]
    return {'snapshot_date': '2026-09-27', 'categories': categories,
            'paths': structure['paths'], 'modules': structure['modules'],
            'topics': topics, 'labs': labs, 'quizzes': []}


if __name__ == '__main__':
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(json.dumps(snapshot(), indent=2) + '\n')
    print(f'Updated {TARGET.relative_to(ROOT)} (reading only; no assessment data)')
