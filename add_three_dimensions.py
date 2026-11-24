
import json
import re
from pathlib import Path

BASE = Path(__file__).resolve().parent

INPUT_JSON = BASE / "ideology_scores.json"
INPUT_JS = BASE / "data.js"

OUTPUT_JSON = BASE / "ideology_scores.updated.json"
OUTPUT_JS = BASE / "data.updated.js"

DIMENSIONS = (
    "revolutionism",
    "reformism",
    "social_darwinism",
)

# Each signal has a weight. Positive weights support the dimension;
# negative weights oppose it.
#
# These are ideological indicators, not simple name-based guesses.

SIGNALS = {
    "revolutionism": {
        "positive": {
            "revolutionary": 1.0,
            "revolution": 1.0,
            "revolutionism": 1.0,
            "insurrection": 1.0,
            "insurrectionary": 1.0,
            "overthrow": 1.0,
            "abolition": 0.65,
            "communization": 0.9,
            "direct action": 0.65,
            "general strike": 0.8,
            "vanguard": 0.55,
            "radical transformation": 0.9,
            "dismantled": 0.75,
            "dismantling": 0.75,
            "seize control": 0.85,
            "uprising": 0.9,
            "revolt": 0.9,
            "break with the old order": 0.9,
            "accelerationism": 0.3,
        },
        "negative": {
            "reactionaryism": 1.0,
            "reactionary": 0.9,
            "traditionalist conservatism": 0.8,
            "conservatism": 0.55,
            "preservation": 0.65,
            "preserve": 0.65,
            "gradual change": 0.65,
            "established institutions": 0.65,
            "continuity": 0.55,
            "restoration": 0.8,
            "return to a previous": 0.8,
            "status quo": 0.8,
        },
    },

    "reformism": {
        "positive": {
            "reformism": 1.0,
            "reformist": 1.0,
            "reform": 0.75,
            "reforms": 0.75,
            "gradual change": 1.0,
            "gradual reform": 1.0,
            "incremental": 0.9,
            "pragmatic reform": 0.9,
            "progressive reform": 0.9,
            "parliamentary": 0.45,
            "constitutional": 0.35,
            "electoral": 0.3,
            "existing institutions": 0.45,
            "policy change": 0.4,
            "social democracy": 0.7,
            "progressive conservatism": 0.65,
        },
        "negative": {
            "revolutionary": 0.85,
            "revolution": 0.85,
            "insurrection": 0.9,
            "insurrectionary": 0.9,
            "overthrow": 0.85,
            "communization": 0.75,
            "general strike": 0.55,
            "direct action": 0.35,
            "abolition of the state": 0.85,
            "abolition of money": 0.65,
            "restoration": 0.75,
            "reactionaryism": 0.8,
            "reactionary": 0.65,
            "return to a previous": 0.75,
        },
    },

    "social_darwinism": {
        "positive": {
            "social darwinism": 1.0,
            "social darwinist": 1.0,
            "survival of the fittest": 1.0,
            "struggle for existence": 0.9,
            "natural selection": 0.65,
            "biological competition": 1.0,
            "racial hierarchy": 1.0,
            "hereditary superiority": 1.0,
            "racial struggle": 0.9,
            "eugenics": 0.9,
            "eugenic": 0.9,
            "superior race": 1.0,
            "inferior race": 1.0,
            "might makes right": 0.85,
            "fitness of the strong": 0.9,
            "biological hierarchy": 1.0,
        },
        "negative": {
            "rejects social darwinism": 1.0,
            "opposes social darwinism": 1.0,
            "anti-social-darwinist": 1.0,
            "mutual aid": 0.5,
            "solidarity": 0.35,
            "egalitarian": 0.4,
            "equality": 0.3,
            "cooperation": 0.2,
        },
    },
}


# Existing ideological tags also provide evidence.
# These are deliberately separate from the description indicators.

TAG_SIGNALS = {
    "revolutionism": {
        "positive": {
            "communization": 0.9,
            "anarchism": 0.55,
            "syndicalism": 0.5,
            "hierarchical_communism": 0.65,
            "agrarian_socialism": 0.35,
            "utopian_socialism": 0.3,
            "primitivism": 0.4,
            "insurrectionary": 1.0,
        },
        "negative": {
            "reactionaryism": 1.0,
            "traditionalist_conservatism": 0.75,
            "paleoconservatism": 0.65,
            "conservatism": 0.4,
            "perennial_traditionalism": 0.6,
            "feudalism": 0.5,
        },
    },

    "reformism": {
        "positive": {
            "progressivism": 0.65,
            "social_progressivism": 0.7,
            "progressive_conservatism": 0.65,
            "social_democracy": 0.8,
            "representative_democracy": 0.2,
            "referendum_democracy": 0.2,
            "constitutional": 0.35,
            "keynesianism": 0.25,
            "social_market": 0.25,
        },
        "negative": {
            "communization": 0.85,
            "reactionaryism": 0.75,
            "neoreactionaryism": 0.85,
            "insurrectionary": 0.9,
            "primitivism": 0.3,
        },
    },

    "social_darwinism": {
        "positive": {
            "racial_nationalism": 0.55,
            "ethnic_nationalism": 0.2,
            "aristocracy": 0.2,
            "oligarchy": 0.15,
            "meritocracy": 0.15,
        },
        "negative": {
            "collective_distribution": 0.15,
            "communalism": 0.2,
            "mutualism": 0.2,
            "free_socialism": 0.2,
            "social_solidarity_economy": 0.2,
            "pacifism": 0.1,
        },
    },
}


def normalize(text):
    return re.sub(r"[_\-]+", " ", str(text).lower())


def parse_existing_scores(score_string):
    result = {}

    for part in str(score_string or "").split("|"):
        if ":" not in part:
            continue

        key, value = part.split(":", 1)

        try:
            result[key.strip()] = float(value.strip())
        except ValueError:
            continue

    return result


def calculate_dimension(description, score_string, dimension):
    description = normalize(description)
    existing = parse_existing_scores(score_string)

    evidence = SIGNALS[dimension]
    tag_evidence = TAG_SIGNALS[dimension]

    positive = 0.0
    negative = 0.0

    # Description evidence.
    for phrase, weight in evidence["positive"].items():
        phrase = normalize(phrase)
        if phrase in description:
            positive += weight

    for phrase, weight in evidence["negative"].items():
        phrase = normalize(phrase)
        if phrase in description:
            negative += weight

    # Existing ideological tags.
    for tag, weight in tag_evidence["positive"].items():
        value = existing.get(tag, 0.0)
        if value > 0:
            positive += weight * value

    for tag, weight in tag_evidence["negative"].items():
        value = existing.get(tag, 0.0)
        if value > 0:
            negative += weight * value

    # Normalize evidence to the -1 to +1 range.
    total = positive + negative

    if total == 0:
        return 0.0

    result = (positive - negative) / total

    return round(max(-1.0, min(1.0, result)), 2)


def evaluate_ideology(name, entry):
    description = entry.get("d", "")
    existing = entry.get("s", "")

    return {
        dimension: calculate_dimension(
            description,
            existing,
            dimension,
        )
        for dimension in DIMENSIONS
    }


def format_score(value):
    return f"{value:.2f}"


def update_json():
    with INPUT_JSON.open("r", encoding="utf-8") as f:
        data = json.load(f)

    evaluated = {}

    for name, entry in data.items():
        scores = evaluate_ideology(name, entry)
        evaluated[name] = scores

        existing = parse_existing_scores(entry.get("s", ""))

        # Preserve every original score.
        for dimension in DIMENSIONS:
            existing[dimension] = scores[dimension]

        entry["s"] = "|".join(
            f"{key}:{format_score(value)}"
            for key, value in existing.items()
        )

    with OUTPUT_JSON.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

    return evaluated


def find_object_end(source, opening_brace):
    depth = 0
    in_string = False
    escaped = False

    for i in range(opening_brace, len(source)):
        char = source[i]

        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1

            if depth == 0:
                return i

    raise ValueError("Could not find end of JavaScript object.")


def update_js(evaluated):
    source = INPUT_JS.read_text(encoding="utf-8")

    marker = "const ideologyScores ="
    start = source.find(marker)

    if start == -1:
        raise ValueError("Could not find const ideologyScores in data.js")

    opening = source.find("{", start)

    if opening == -1:
        raise ValueError("Could not find ideologyScores object.")

    closing = find_object_end(source, opening)

    object_text = source[opening:closing + 1]

    for name, scores in evaluated.items():
        pattern = re.compile(
            r'(^[ \t]*"' + re.escape(name) +
            r'"[ \t]*:[ \t]*)"([^"]*)"',
            re.MULTILINE,
        )

        match = pattern.search(object_text)

        if not match:
            raise ValueError(
                f"Ideology missing from data.js: {name}"
            )

        original_string = match.group(2)
        existing = parse_existing_scores(original_string)

        for dimension in DIMENSIONS:
            existing[dimension] = scores[dimension]

        updated_string = "|".join(
            f"{key}:{format_score(value)}"
            for key, value in existing.items()
        )

        replacement = match.group(1) + json.dumps(updated_string)

        object_text = (
            object_text[:match.start()]
            + replacement
            + object_text[match.end():]
        )

    source = (
        source[:opening]
        + object_text
        + source[closing + 1:]
    )

    OUTPUT_JS.write_text(source, encoding="utf-8")


def main():
    if not INPUT_JSON.exists():
        raise FileNotFoundError(INPUT_JSON)

    if not INPUT_JS.exists():
        raise FileNotFoundError(INPUT_JS)

    evaluated = update_json()
    update_js(evaluated)

    print("Successfully evaluated:", len(evaluated), "ideologies")
    print("Dimensions:", ", ".join(DIMENSIONS))
    print("Individual scores:", len(evaluated) * len(DIMENSIONS))
    print("Created:", OUTPUT_JSON.name)
    print("Created:", OUTPUT_JS.name)

    print("\nSample results:")
    for name, scores in list(evaluated.items())[:10]:
        print(name, scores)


if __name__ == "__main__":
    main()
