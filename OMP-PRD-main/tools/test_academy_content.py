#!/usr/bin/env python3
"""Content/snapshot guardrails. No database connection or writes."""
import json
import re
import unittest
from build_academy_snapshot import ROOT, SOURCE, TARGET, seed_rows, snapshot


class AcademyContentTests(unittest.TestCase):
    def test_snapshot_matches_reviewed_public_seed(self):
        self.assertEqual(json.loads(TARGET.read_text()), snapshot())

    def test_snapshot_contains_no_assessment_or_learner_data(self):
        data = json.loads(TARGET.read_text())
        self.assertEqual(data['quizzes'], [])
        for field in ('answer_index', 'question_index', 'user_id', 'recipient_name',
                      'email', 'certificate_id', 'highest_score'):
            self.assertNotIn(f'"{field}"', TARGET.read_text())
        self.assertEqual(len(data['topics']), 4)
        self.assertTrue(all(t['status'] == 'published' for t in data['topics']))
        self.assertTrue(all(lab['url'].startswith('https://') for lab in data['labs']))

    def test_hierarchy_seed_matches_additive_migration(self):
        structure = json.loads((ROOT / 'supabase/academy-curriculum.json').read_text())
        migration = (ROOT / 'supabase/migrations/20260929120000_academy_curriculum_hierarchy.sql').read_text()
        for key, table in [('paths', 'learning_paths'), ('modules', 'learning_modules')]:
            rows = seed_rows(migration, table)
            for row in rows:
                for field in ('prerequisites', 'outcomes'):
                    if field in row:
                        row[field] = json.loads(row[field])
            self.assertEqual(rows, structure[key])
        for topic_id, module_id in structure['assignments'].items():
            self.assertIn(f"set module_id = '{module_id}' where id = '{topic_id}'", migration)
        self.assertNotRegex(migration.lower(), r'\b(delete from|truncate|drop table)\b')

    def test_correction_matches_all_misindexed_seed_answers(self):
        sql = SOURCE.read_text()
        quizzes = {q['id']: json.loads(q['questions']) for q in seed_rows(sql, 'learning_quizzes')}
        keys = seed_rows(sql, 'learning_quiz_answers')
        fix = (ROOT / 'supabase/migrations/20260929090000_correct_foundation_quiz_keys.sql').read_text()
        corrections = re.findall(r"\('([^']+)'::uuid, (\d), '((?:[^']|'')*)'\)", fix)
        self.assertEqual(len(corrections), 12)
        for quiz_id, question_index, correct_option in corrections:
            index = int(question_index)
            self.assertEqual(quizzes[quiz_id][index]['options'][3], correct_option.replace("''", "'"))
            next(key for key in keys if key['quiz_id'] == quiz_id and key['question_index'] == index)['answer_index'] = 3
        self.assertEqual(len(keys), 16)
        self.assertTrue(all(key['answer_index'] == 3 for key in keys))
        self.assertNotRegex(fix.lower(), r'\b(delete from|truncate|drop table)\b')
        self.assertIn("quiz.questions -> expected.question_index -> 'options' ->> 3 = expected.correct_option", fix)


if __name__ == '__main__':
    unittest.main(verbosity=2)
