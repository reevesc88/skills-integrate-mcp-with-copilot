"""Activity records keep a display schedule plus fields used for filtering."""

import ast
import datetime
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_PATH = ROOT / "src" / "app.py"
HTML_PATH = ROOT / "src" / "static" / "index.html"
JS_PATH = ROOT / "src" / "static" / "app.js"
CSS_PATH = ROOT / "src" / "static" / "styles.css"

WEEKDAYS = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]

# Original human-readable schedules. These must stay as display text.
EXPECTED_SCHEDULES = {
    "Chess Club": "Fridays, 3:30 PM - 5:00 PM",
    "Programming Class": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
    "Gym Class": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
    "Soccer Team": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
    "Basketball Team": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
    "Art Club": "Thursdays, 3:30 PM - 5:00 PM",
    "Drama Club": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
    "Math Club": "Tuesdays, 3:30 PM - 4:30 PM",
    "Debate Team": "Fridays, 4:00 PM - 5:30 PM",
    "GitHub Skills": "Mondays, 3:30 PM - 5:00 PM",
}


def load_activities():
    module = ast.parse(APP_PATH.read_text())
    for node in module.body:
        if not isinstance(node, ast.Assign):
            continue
        for target in node.targets:
            if isinstance(target, ast.Name) and target.id == "activities":
                return ast.literal_eval(node.value)
    raise AssertionError("activities dict not found")


def to_12h(hour, minute):
    suffix = "AM" if hour < 12 else "PM"
    hour12 = hour % 12 or 12
    return f"{hour12}:{minute:02d} {suffix}"


class ActivityDataTests(unittest.TestCase):
    def setUp(self):
        self.activities = load_activities()

    def test_every_activity_has_category_date_and_schedule(self):
        self.assertEqual(set(self.activities), set(EXPECTED_SCHEDULES))
        for name, details in self.activities.items():
            self.assertIn("category", details)
            self.assertTrue(details["category"].strip())
            self.assertIn("date", details)
            self.assertEqual(details["schedule"], EXPECTED_SCHEDULES[name])
            self.assertIn("description", details)
            self.assertIn("max_participants", details)
            self.assertIsInstance(details["participants"], list)

    def test_date_matches_earliest_scheduled_day_and_start_time(self):
        for name, details in self.activities.items():
            parsed = datetime.datetime.fromisoformat(details["date"])
            weekday = parsed.strftime("%A")
            days_header = details["schedule"].split(",")[0]
            mentioned = [day for day in WEEKDAYS if day in days_header]
            self.assertTrue(mentioned, name)
            self.assertEqual(weekday, mentioned[0], name)
            self.assertIn(to_12h(parsed.hour, parsed.minute), details["schedule"])

    def test_categories_are_a_small_known_set(self):
        categories = {details["category"] for details in self.activities.values()}
        self.assertEqual(categories, {"Academic", "Arts", "Sports", "Technology"})

    def test_toolbar_markup_and_styles_exist(self):
        html = HTML_PATH.read_text()
        js = JS_PATH.read_text()
        css = CSS_PATH.read_text()
        self.assertIn('id="activity-toolbar"', html)
        self.assertIn('id="activity-search"', html)
        self.assertIn('id="category-filter"', html)
        self.assertIn('id="sort-by"', html)
        self.assertLess(html.index("activity-toolbar"), html.index("activities-list"))
        for element_id in ("activity-search", "category-filter", "sort-by"):
            self.assertIn(element_id, js)
        self.assertIn("filterAndSortActivities", js)
        self.assertIn(".toolbar", css)
        self.assertIn("@media (max-width: 600px)", css)


if __name__ == "__main__":
    unittest.main()
