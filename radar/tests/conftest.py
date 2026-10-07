"""Shared pytest configuration for radar/tests. Keep it minimal: every agent's tests rely on it."""
from __future__ import annotations

import os

import pytest


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line("markers", "live: needs the network; runs only when RADAR_LIVE=1")
    config.addinivalue_line("markers", "soak: long simulation; CI runs it in its own job (-m soak), "
                                       "pushes and PRs run -m 'not soak'")


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if os.environ.get("RADAR_LIVE") == "1":
        return
    skip = pytest.mark.skip(reason="live test: set RADAR_LIVE=1 to run")
    for item in items:
        if "live" in item.keywords:
            item.add_marker(skip)
