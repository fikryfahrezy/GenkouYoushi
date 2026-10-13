"""Bundle license texts from the installed API environment for redistribution."""

from importlib.metadata import distributions
from pathlib import Path
from re import IGNORECASE, match


def main() -> None:
    sections = [
        "Genkou Youshi API — Python dependency notices\n"
        "Generated from the installed environment. OS package notices remain "
        "in /usr/share/doc in the Docker image. KanjiVG notices are in "
        "licenses/KanjiVG-CC-BY-SA-3.0.txt and the returned SVGs."
    ]
    installed = sorted(distributions(), key=lambda item: item.metadata["Name"].lower())
    for distribution in installed:
        name = distribution.metadata["Name"]
        if name == "kanji-api":
            continue
        files = sorted(
            (
                file for file in distribution.files or []
                if match(
                    r"^(licen[cs]e|copying|notice)([._-].*)?$", file.name,
                    flags=IGNORECASE,
                )
            ),
            key=str,
        )
        if not any(
            match(r"^(licen[cs]e|copying)", file.name, flags=IGNORECASE)
            for file in files
        ):
            raise RuntimeError(f"Missing license text for {name} {distribution.version}")
        sections.append(
            f"{name} {distribution.version}\n\n" + "\n\n".join(
                distribution.locate_file(file).read_text(encoding="utf-8") for file in files
            )
        )
    output = Path(__file__).resolve().parents[1] / "licenses/PYTHON_DEPENDENCY_NOTICES.txt"
    output.write_text("\n\n========================================\n\n".join(sections) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
