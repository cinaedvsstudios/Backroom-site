"""Regression tests for generated section entry points; run using unittest."""
import re
import unittest
from pathlib import Path
from scripts.build_entry_pages import ROOT, BASE, ENTRY_PAGES, build_entry_page

class EntryPageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.index = (ROOT / "index.html").read_text(encoding="utf-8")

    def test_all_pages_identically_generated_from_master(self):
        for filename, config in ENTRY_PAGES.items():
            with self.subTest(page=filename):
                saved = (ROOT / filename).read_text(encoding="utf-8")
                self.assertEqual(saved, build_entry_page(self.index, filename, config))

    def test_section_routes_and_unique_metadata(self):
        for filename, config in ENTRY_PAGES.items():
            with self.subTest(page=filename):
                page = (ROOT / filename).read_text(encoding="utf-8")
                self.assertEqual(page.count('<link rel="canonical"'), 1)
                self.assertEqual(page.count('<meta name="description"'), 1)
                self.assertEqual(page.count('<meta property="og:url"'), 1)
                self.assertIn(BASE + filename, page)
                self.assertIn("location.hash || window.location.search", page)
                self.assertIn(" + '" + config["route"] + "'", page)
                self.assertIn('id="age-gate"', page)
                self.assertIn('id="profile-modal"', page)
                self.assertIn('id="search-input"', page)
                self.assertIn('src="app-core.js?', page)
                self.assertIn('src="app.js?', page)
                self.assertIn('<nav aria-label="Browse Backroom sections">', page)
                for linked in ENTRY_PAGES:
                    self.assertIn(f'href="{linked}"', page)

    def test_home_page_has_no_entry_route(self):
        self.assertNotIn("data-backroom-entry-route", self.index)
        self.assertIn('href="https://cinaedvsstudios.github.io/Backroom-site/"', self.index)

    def test_embedded_routes_recognised_by_core(self):
        core = (ROOT / "app-core.js").read_text(encoding="utf-8")
        self.assertIn("hash === '#travel' || hash === '#heatmap'", core)
        self.assertIn("window.openBackroomEmbeddedPage?.(hash.slice(1))", core)

    def test_sitemap_generator_preserves_all_entries(self):
        source = (ROOT / "scripts/build_venue_seo.py").read_text(encoding="utf-8")
        for filename in ENTRY_PAGES:
            self.assertIn('"' + filename + '"', source)

if __name__ == "__main__":
    unittest.main()
