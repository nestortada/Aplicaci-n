from __future__ import annotations

import unittest
from datetime import time

from app.services.time_calculator import InvalidTimeError, calculate_duration_hours


class TimeCalculatorTest(unittest.TestCase):
    def test_calculates_colon_am_pm_format(self) -> None:
        self.assertEqual(calculate_duration_hours("05:00:PM", "06:00:PM"), 1)

    def test_calculates_space_am_pm_format(self) -> None:
        self.assertEqual(calculate_duration_hours("08:00 AM", "09:30 AM"), 1.5)

    def test_calculates_24h_format(self) -> None:
        self.assertEqual(calculate_duration_hours("08:00", "10:00"), 2)

    def test_calculates_cross_midnight_duration(self) -> None:
        self.assertEqual(calculate_duration_hours("23:00", "01:00"), 2)

    def test_calculates_excel_time_object(self) -> None:
        self.assertEqual(calculate_duration_hours(time(8, 0), time(10, 0)), 2)

    def test_rejects_invalid_time(self) -> None:
        with self.assertRaises(InvalidTimeError):
            calculate_duration_hours("no-es-hora", "10:00")


if __name__ == "__main__":
    unittest.main()

