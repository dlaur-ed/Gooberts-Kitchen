#!/usr/bin/env python3
"""
Regenerates data/recipes.json from recipes.csv.
Run this any time you add or edit recipes in the CSV.

Usage: python csv_to_json.py
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CSV_PATH = ROOT / "recipes.csv"
OUT_PATH = ROOT / "data" / "recipes.json"


def split_pipe(value: str) -> list[str]:
    return [part.strip() for part in (value or "").split("|") if part.strip()]


def main() -> None:
    rows = list(csv.DictReader(CSV_PATH.open(encoding="utf-8-sig")))
    recipes = []
    for r in rows:
        recipes.append({
            "id": r["id"],
            "category": r["category"].strip().lower(),
            "title": r["title"],
            "calories": int(r["calories"]),
            "protein": int(r["protein"]),
            "carbs": int(r["carbs"]),
            "fat": int(r["fat"]),
            "fiber": int(r.get("fiber") or 0),
            "servings": r["servings"],
            "prep_time": r["prep_time"],
            "total_time": r["total_time"],
            "difficulty": int(r.get("difficulty") or 1),
            "dishes": int(r.get("dishes") or 1),
            "image": r["image"].replace("assets/", ""),
            "ingredients": split_pipe(r.get("ingredients", "")),
            "method": split_pipe(r.get("method", "")),
            "notes": split_pipe(r.get("notes", "")),
            "tags": split_pipe(r.get("tags", "")),
            "freezer_friendly": r.get("freezer_friendly", "").strip().lower() in {"yes", "true", "1"},
            "meal_prep_friendly": r.get("meal_prep_friendly", "").strip().lower() in {"yes", "true", "1"},
        })

    OUT_PATH.write_text(json.dumps(recipes, indent=2), encoding="utf-8")
    print(f"Wrote {len(recipes)} recipes to {OUT_PATH}")


if __name__ == "__main__":
    main()
