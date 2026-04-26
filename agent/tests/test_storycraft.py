import unittest
from pathlib import Path

from liteauthor_agent.storycraft.loader import _parse_one_file, clear_rules_cache, load_rules, infer_bucket
from liteauthor_agent.storycraft.selector import select_rules

_REPO = Path(__file__).resolve().parents[2]
_BUILT_IN = _REPO / "backend" / "builtin-skills"
_SAMPLE = _BUILT_IN / "daily-scene-conflict.md"


class StorycraftTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        clear_rules_cache()

    def test_load_builtin_skills(self):
        rules = load_rules(_BUILT_IN)
        self.assertGreater(len(rules), 10)
        by_slug = {r.slug: r for r in rules}
        self.assertIn("daily-scene-conflict", by_slug)
        r = by_slug["daily-scene-conflict"]
        self.assertTrue(r.instruction)
        self.assertIn(
            r.bucket,
            ("hook", "character", "conflict", "pacing", "payoff", "addiction", "dialogue", "world"),
        )

    def test_parse_one(self):
        rule = _parse_one_file(_SAMPLE)
        self.assertIsNotNone(rule)
        assert rule is not None
        self.assertEqual(rule.slug, "daily-scene-conflict")
        blob = rule.instruction + rule.name + rule.slug
        self.assertTrue("冲突" in blob or "矛盾" in blob)

    def test_infer_bucket_strings(self):
        b = infer_bucket(
            {"bucket": "dialogue", "name": "x", "description": "y", "tags": []},
            "x",
            "",
        )
        self.assertEqual(b, "dialogue")

    def test_selector_top_k(self):
        rules = load_rules(_BUILT_IN)[:200]
        sel = select_rules(rules, selection="A\n\nB" * 15, intent="increase_tension", surface="inline_suggestion")
        self.assertEqual(len(sel.rules) <= 5, True)
        self.assertIsNotNone(sel.diagnostics.selection_word_count)

    def test_phase2_intents_stable(self):
        """Phase 2 product modules map to selector intents without errors."""
        rules = load_rules(_BUILT_IN)[:120]
        sample = "The door opened. She froze, but the hallway stayed empty."
        for intent, pos in [
            ("opening_doctor", "opening"),
            ("pacing_analyzer", None),
            ("character_engine", None),
            ("payoff_tracker", None),
        ]:
            sel = select_rules(rules, selection=sample, intent=intent, chapter_position=pos, surface="inline_suggestion")
            self.assertTrue(sel.rules, msg=f"expected at least one rule for {intent}")
            self.assertIn("Priority:", " ".join(sel.diagnosis), msg=repr(sel.diagnosis))

    def test_phase3_intents_stable(self):
        """Phase 3 product modules map to selector intents without errors."""
        rules = load_rules(_BUILT_IN)[:120]
        sample = "The contract sat unread on the table. 'We need to talk,' she said."
        for intent in (
            "lore_compression",
            "chapter_addiction",
            "character_consistency",
            "planning_architect",
        ):
            sel = select_rules(rules, selection=sample, intent=intent, surface="inline_suggestion")
            self.assertTrue(sel.rules, msg=f"expected at least one rule for {intent}")
            self.assertIn("Priority:", " ".join(sel.diagnosis), msg=repr(sel.diagnosis))


if __name__ == "__main__":
    unittest.main()
