const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const dataPath = path.join(root, "data.js");
const jsonPath = path.join(root, "ideology_scores.json");

function extractObject(source, name) {
    const start = source.indexOf(`const ${name} =`);
    if (start < 0) throw new Error(`Missing ${name}`);

    const open = source.indexOf("{", start);
    let depth = 0;
    let quote = null;
    let escaped = false;

    for (let i = open; i < source.length; i++) {
        const c = source[i];

        if (quote) {
            if (escaped) escaped = false;
            else if (c === "\\") escaped = true;
            else if (c === quote) quote = null;
            continue;
        }

        if (c === '"' || c === "'" || c === "`") quote = c;
        else if (c === "{") depth++;
        else if (c === "}" && --depth === 0) {
            return {
                object: vm.runInNewContext(
                    `(${source.slice(open, i + 1)})`
                ),
                start,
                end: i + 1
            };
        }
    }

    throw new Error(`Could not parse ${name}`);
}

function main() {
    let source = fs.readFileSync(dataPath, "utf8");
    const extracted = extractObject(source, "ideologyScores");
    const scores = extracted.object;

    const corrections = {
        "Evolianism": null,
        "National-Socialism": null,
        "National Radicalism": null
    };

    const json = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

    // Remove only the unsupported automatic materialism assignments.
    // Do not change any other philosophical or political scores.
    let removed = 0;

    for (const [name, unused] of Object.entries(corrections)) {
        if (!scores[name]) continue;

        const parts = scores[name].split("|");
        const filtered = parts.filter(part => {
            const key = part.split(":")[0].toLowerCase();

            if (key === "materialism") {
                removed++;
                return false;
            }

            return true;
        });

        scores[name] = filtered.join("|");

        if (json[name]) {
            json[name].s = scores[name];
        }
    }

    fs.copyFileSync(dataPath, dataPath + ".before-philosophy-fix");
    fs.copyFileSync(jsonPath, jsonPath + ".before-philosophy-fix");

    const replacement =
        `const ideologyScores = ${JSON.stringify(scores, null, 4)};`;

    source =
        source.slice(0, extracted.start) +
        replacement +
        source.slice(extracted.end);

    fs.writeFileSync(dataPath, source, "utf8");
    fs.writeFileSync(jsonPath, JSON.stringify(json, null, 4), "utf8");

    console.log("Philosophy correction finished.");
    console.log(`Unsupported materialism scores removed: ${removed}`);
    console.log("All other scores preserved.");
}

main();
