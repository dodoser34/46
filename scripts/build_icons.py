"""Сборка SVG-спрайта иконок.

Исходники — отдельные файлы frontend/assets/img/icons/<имя>.svg (24×24, линия 1.6).
Скрипт собирает их в один файл sprite.svg, который подключает сайт:

    <svg class="icon"><use href="/assets/img/icons/sprite.svg#heart"></use></svg>

Цвет и толщина линии задаются в CSS (.icon), поэтому в символы спрайта
переносится только содержимое иконки — без атрибутов fill/stroke.

Запуск из корня проекта:  python scripts/build_icons.py
"""
import pathlib
import re

ICONS_DIR = pathlib.Path(__file__).resolve().parents[1] / "frontend" / "assets" / "img" / "icons"
SPRITE = ICONS_DIR / "sprite.svg"


def inner_svg(text: str) -> str:
    match = re.search(r"<svg[^>]*>(.*)</svg>", text, re.S)
    if not match:
        raise ValueError("не найден тег <svg>")
    return " ".join(line.strip() for line in match.group(1).strip().splitlines())


def main() -> None:
    files = sorted(p for p in ICONS_DIR.glob("*.svg") if p.name != SPRITE.name)
    symbols = [
        f'  <symbol id="{p.stem}" viewBox="0 0 24 24">{inner_svg(p.read_text(encoding="utf-8"))}</symbol>'
        for p in files
    ]
    SPRITE.write_text(
        '<svg xmlns="http://www.w3.org/2000/svg">\n'
        "  <!-- Сгенерировано scripts/build_icons.py — правьте отдельные файлы иконок, а не этот. -->\n"
        + "\n".join(symbols) + "\n</svg>\n",
        encoding="utf-8",
    )
    print(f"Собрано иконок: {len(files)} -> {SPRITE.relative_to(ICONS_DIR.parents[3])}")


if __name__ == "__main__":
    main()
