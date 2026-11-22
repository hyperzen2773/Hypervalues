
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dataPath = path.join(root, "data.js");
const scoresPath = path.join(root, "ideology_scores.json");

const label = "Nihilist Anarchism";

const definition =
    "Combines philosophical nihilism with anarchism. It rejects inherent meaning, objective moral foundations and the assumption that established political or social institutions possess an unquestionable right to authority. It favors individual autonomy and opposition to imposed hierarchies, while leaving room for voluntary association and self-organized forms of cooperation.";

const stances =
    "nihilism:1|anarchism:1|anti_organizationalism:0.5|civil_libertarianism:0.5|egoism:0.4|ethical_statism:-0.8|centralism:-0.8|autocracy:-0.8|partocracy:-0.7|religious_traditionalism:-0.5";

const color = "#5b3a72";

function fail(message) {
    console.error("ERROR: " + message);
    process.exit(1);
}

function insertIntoObject(source, objectName, property) {
    const marker = `const ${objectName} = {`;
    const start = source.indexOf(marker);

    if (start === -1) {
        fail(`Could not find ${objectName} in data.js`);
    }

    const end = source.indexOf("\n};", start);

    if (end === -1) {
        fail(`Could not find the end of ${objectName}`);
    }

    const section = source.slice(start, end);

    if (section.includes(`"${label}"`)) {
        console.log(`${objectName}: already contains ${label}`);
        return source;
    }

    return (
        source.slice(0, end) +
        "\n    " + property +
        source.slice(end)
    );
}

function addToGroup(source) {
    const marker = '"Centre-Anarchist": [';
    const start = source.indexOf(marker);

    if (start === -1) {
        fail("Could not find the Centre-Anarchist group");
    }

    const end = source.indexOf("\n    ],", start);

    if (end === -1) {
        fail("Could not find the end of Centre-Anarchist");
    }

    const section = source.slice(start, end);

    if (section.includes(`"${label}"`)) {
        console.log("ideologyGroups: already contains " + label);
        return source;
    }

    return (
        source.slice(0, end) +
        `\n        "${label}",` +
        source.slice(end)
    );
}

function validateStances(source) {
    const start = source.indexOf("const resultsMapping = {");
    const end = source.indexOf("\n};", start);

    if (start === -1 || end === -1) {
        fail("Could not find resultsMapping");
    }

    const mapping = source.slice(start, end);
    const validIds = new Set(
        [...mapping.matchAll(/"([^"]+)"\s*:/g)].map(m => m[1])
    );

    for (const part of stances.split("|")) {
        const [id, rawScore] = part.split(":");
        const score = Number(rawScore);

        if (!validIds.has(id)) {
            fail(`Unknown stance ID: ${id}`);
        }

        if (!Number.isFinite(score) || score < -1 || score > 1 || score === 0) {
            fail(`Invalid score for ${id}: ${rawScore}`);
        }
    }
}

function addJsonEntry(source) {
    const json = JSON.parse(source);

    if (json[label]) {
        console.log("ideology_scores.json: already contains " + label);
        return source;
    }

    json[label] = {
        d: definition,
        s: stances
    };

    return JSON.stringify(json, null, 0) + "\n";
}

function main() {
    if (!fs.existsSync(dataPath)) {
        fail("data.js was not found");
    }

    if (!fs.existsSync(scoresPath)) {
        fail("ideology_scores.json was not found");
    }

    let data = fs.readFileSync(dataPath, "utf8");
    let scores = fs.readFileSync(scoresPath, "utf8");

    validateStances(data);

    // Add the ideology to its group.
    data = addToGroup(data);

    // Add a quiz-result combination.
    data = insertIntoObject(
        data,
        "labelMapping",
        `"nihilism|anarchism|egoism|civil_libertarianism|anti_organizationalism": "${label}",`
    );

    // Add its display color.
    data = insertIntoObject(
        data,
        "labelColors",
        `"${label}": "${color}",`
    );

    // Add its definition.
    data = insertIntoObject(
        data,
        "descriptions",
        `"${label}": ${JSON.stringify(definition)},`
    );

    // Add its scoring profile.
    data = insertIntoObject(
        data,
        "ideologyScores",
        `"${label}": "${stances}",`
    );

    // Add the matching JSON entry.
    scores = addJsonEntry(scores);

    // Check the resulting JSON before writing.
    const parsed = JSON.parse(scores);

    if (parsed[label].s !== stances) {
        fail("The JSON stance string does not match the intended profile");
    }

    // Write both files.
    fs.writeFileSync(dataPath, data, "utf8");
    fs.writeFileSync(scoresPath, scores, "utf8");

    console.log("");
    console.log("Successfully added " + label);
    console.log("Updated data.js");
    console.log("Updated ideology_scores.json");
    console.log("");
    console.log("Next, run: node tools/check_scoring.js");
}

main();
