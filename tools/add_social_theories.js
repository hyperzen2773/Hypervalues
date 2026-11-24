
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");

const files = {
    data: path.join(root, "data.js"),
    scores: path.join(root, "ideology_scores.json"),
    tree: path.join(root, "questions_tree.json")
};

// Scores are based on the descriptions of the ideologies
// in the current HyperValues ideology database.
const scoreChanges = {
    "Social Darwinism": {
        "National-Socialism": 0.65,
        "Neo-Nazism": 0.65
    },

    "Revolutionism": {
        "Sorelianism": 1,
        "Italian Left Communism": 1,
        "Mao Zedong Thought": 1,
        "Maoism Third Worldism": 1,
        "Marxism Leninism Maoism": 1,
        "Luxemburgism": 1,
        "Trotskyism": 1,
        "Guevarism": 1,
        "Council Communism": 1,
        "Anarcho-Syndicalism": 1,
        "Castroism": 0.9,
        "De Leonism": 0.9,
        "Revolutionary Nationalism": 0.9,
        "Paetel's National Bolshevism": 0.9,
        "Post-left": 0.8,
        "Agorism": 0.8,
        "Scythianism": 0.8,

        "Fabian Socialism": -1,
        "Social Democracy": -0.8
    },

    "Reformism": {
        "Fabian Socialism": 1,
        "Social Democracy": 1,
        "Reform Gaullism": 0.9,
        "Green Social Democracy": 0.9,
        "One-Nation Conservatism": 0.9,
        "Social Gaullism": 0.8,
        "Classical Kemalism": 0.8,
        "Mesoconservatism": 0.8,
        "Left-Social Democracy": 0.8,
        "Social-Helveticism": 0.8,
        "Ecevitism": 0.8,
        "Social Georgism": 0.7,
        "Green Conservatism": 0.7,
        "Liberal Toryism": 0.7,
        "Left-Gaullism": 0.7,
        "Labour Atlanticism": 0.7,
        "Bleeding-Heart Liberalism": 0.7,
        "Tsaingwenism": 0.7,
        "Conservative Kemalism": 0.6,
        "Conservative Technoliberalism": 0.6,
        "Socialist Technoliberalism": 0.6,

        "Sorelianism": -1,
        "Luxemburgism": -0.9,
        "Italian Left Communism": -0.8,
        "Council Communism": -0.8,
        "Anarcho-Syndicalism": -0.8
    }
};

const definitions = {
    social_darwinism:
        "Human society is understood through natural competition and the struggle for existence. Social hierarchies, inequalities and differences in success are interpreted as natural outcomes of evolutionary processes.",

    revolutionism:
        "A doctrine advocating fundamental transformation of the existing political and social order through revolutionary change rather than gradual reform.",

    reformism:
        "A doctrine advocating gradual transformation of society through existing institutions, legislation, political participation and incremental reforms."
};

const categoryEntries = {
    "revolutionism": "Revolutionism",
    "reformism": "Reformism"
};

function findMatchingBrace(source, openingIndex) {
    let depth = 0;
    let quote = null;
    let escaped = false;
    let lineComment = false;
    let blockComment = false;

    for (let i = openingIndex; i < source.length; i++) {
        const c = source[i];
        const next = source[i + 1];

        if (lineComment) {
            if (c === "\n") lineComment = false;
            continue;
        }

        if (blockComment) {
            if (c === "*" && next === "/") {
                blockComment = false;
                i++;
            }
            continue;
        }

        if (quote) {
            if (escaped) {
                escaped = false;
                continue;
            }

            if (c === "\\") {
                escaped = true;
                continue;
            }

            if (c === quote) quote = null;
            continue;
        }

        if (c === "/" && next === "/") {
            lineComment = true;
            i++;
            continue;
        }

        if (c === "/" && next === "*") {
            blockComment = true;
            i++;
            continue;
        }

        if (c === '"' || c === "'" || c === "`") {
            quote = c;
            continue;
        }

        if (c === "{") depth++;

        if (c === "}") {
            depth--;
            if (depth === 0) return i;
        }
    }

    throw new Error("Could not find matching closing brace.");
}

function findObjectBlock(source, declaration, property) {
    const declarationIndex = source.indexOf(declaration);

    if (declarationIndex === -1) {
        throw new Error("Missing declaration: " + declaration);
    }

    const objectStart = source.indexOf("{", declarationIndex);

    if (objectStart === -1) {
        throw new Error("Missing object for: " + declaration);
    }

    if (!property) {
        return {
            start: objectStart,
            end: findMatchingBrace(source, objectStart)
        };
    }

const pattern = new RegExp(
    '["\\\']' + property + '["\\\']\\s*:\\s*\\{'
);
    const match = pattern.exec(
        source.slice(objectStart + 1)
    );

    if (!match) {
        throw new Error("Missing object property: " + property);
    }

    const start = objectStart + 1 + match.index;
    const brace = source.indexOf("{", start);

    return {
        start: brace,
        end: findMatchingBrace(source, brace)
    };
}

function addEntries(source, declaration, entries, property) {
    const block = findObjectBlock(source, declaration, property);

    return (
        source.slice(0, block.end) +
        "\n" + entries + "\n" +
        source.slice(block.end)
    );
}

function addScoreToString(source, ideology, value) {
    const escaped = ideology.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const pattern = new RegExp(
        '(^\\s*"' + escaped + '"\\s*:\\s*")([^"]*)(")',
        "m"
    );

    const match = source.match(pattern);

    if (!match) {
        throw new Error("Ideology not found in data.js: " + ideology);
    }

    const scores = match[2].split("|").filter(Boolean);
    const scoreKey = Object.keys(value)[0];

    if (!scores.some(item => item.startsWith(scoreKey + ":"))) {
        scores.push(scoreKey + ":" + value[scoreKey]);
    }

    return source.replace(
        pattern,
        match[1] + scores.join("|") + match[3]
    );
}

function addScoreToJSON(database, ideology, key, value) {
    if (!database[ideology]) {
        throw new Error("Ideology not found in ideology_scores.json: " + ideology);
    }

    const parts = (database[ideology].s || "")
        .split("|")
        .filter(Boolean);

    const existing = parts.findIndex(
        item => item.startsWith(key + ":")
    );

    if (existing === -1) {
        parts.push(key + ":" + value);
    } else {
        parts[existing] = key + ":" + value;
    }

    database[ideology].s = parts.join("|");
}

function main() {
    let data = fs.readFileSync(files.data, "utf8");
    const scoreDatabase = JSON.parse(
        fs.readFileSync(files.scores, "utf8")
    );
    const tree = JSON.parse(
        fs.readFileSync(files.tree, "utf8")
    );

    // Check that all ideology names exist before making changes.
    for (const group of Object.values(scoreChanges)) {
        for (const ideology of Object.keys(group)) {
            if (!scoreDatabase[ideology]) {
                throw new Error("Unknown ideology: " + ideology);
            }
        }
    }

    // 1. Add the Social Darwinism answer to the existing philosophy question.
    const philosophyQuestion = tree.philosophy.find(
        question => question.id === "p1"
    );

    if (!philosophyQuestion) {
        throw new Error("Could not find philosophy question p1.");
    }

    const darwinAnswer =
        "Human society is governed by natural competition and the struggle for existence. Hierarchies, inequalities and differences in success are viewed as natural outcomes of evolutionary processes.";

    if (!philosophyQuestion.options.some(
        option => option.next === "social_darwinism"
    )) {
        philosophyQuestion.options.push({
            text: darwinAnswer,
            next: "social_darwinism"
        });
    }

    if (!tree.philosophy.some(
        question => question.id === "social_darwinism"
    )) {
        tree.philosophy.push({
            id: "social_darwinism"
        });
    }

    // 2. Add the new social change category and its questions.
    if (!tree.social_change) {
        tree.social_change = [
            {
                id: "ch1",
                text: "How should major social and political change be pursued?",
                options: [
                    {
                        text: "Replace the existing political and social order through fundamental revolutionary change",
                        next: "revolutionism"
                    },
                    {
                        text: "Transform existing institutions gradually through legislation, participation and incremental reform",
                        next: "reformism"
                    }
                ]
            },
            { id: "revolutionism" },
            { id: "reformism" }
        ];
    }

    // 3. Add category to data.js.
    if (!data.includes('"social_change"')) {
        data = data.replace(
            '"philosophy"\n];',
            '"social_change",\n    "philosophy"\n];'
        );
    }

    // 4. Add category title.
    if (!data.includes('"social_change": "Social Change"')) {
        data = addEntries(
            data,
            "const categoryTitles =",
            '    "social_change": "Social Change",'
        );
    }

    // 5. Add the Social Darwinism result to Philosophy.
    if (!data.includes('"social_darwinism": "Social Darwinism"')) {
        data = addEntries(
            data,
            "const resultsMapping =",
            '        "social_darwinism": "Social Darwinism",',
            "philosophy"
        );
    }

    // 6. Add Revolutionism and Reformism to the new category.
    if (!data.includes('"social_change": {')) {
        data = addEntries(
            data,
            "const resultsMapping =",
            [
                '    "social_change": {',
                '        "revolutionism": "Revolutionism",',
                '        "reformism": "Reformism"',
                "    },"
            ].join("\n")
        );
    }

    // 7. Add the philosophy description.
    if (!data.includes('"social_darwinism":')) {
        data = addEntries(
            data,
            "const philosophyDescriptions =",
            '    "social_darwinism": ' +
                JSON.stringify(definitions.social_darwinism) + ","
        );
    }

    // 8. Add icons using the existing AI icon convention.
    const iconEntries = [
        '    "social_darwinism": "ai",',
        '    "revolutionism": "ai",',
        '    "reformism": "ai",'
    ];

    for (const entry of iconEntries) {
        const key = entry.match(/"([^"]+)"/)[1];

        if (!data.includes('"' + key + '":')) {
            data = addEntries(
                data,
                "const iconSources =",
                entry
            );
        }
    }

    // 9. Update ideology scores in both databases.
    for (const [value, ideologies] of Object.entries(scoreChanges)) {
        const key = value === "Social Darwinism"
            ? "social_darwinism"
            : value === "Revolutionism"
                ? "revolutionism"
                : "reformism";

        for (const [ideology, score] of Object.entries(ideologies)) {
            addScoreToJSON(scoreDatabase, ideology, key, score);

            data = addScoreToString(data, ideology, {
                [key]: score
            });
        }
    }

    // 10. Validate everything before writing any file.
    new vm.Script(data, { filename: "data.js" });

    JSON.parse(JSON.stringify(scoreDatabase));
    JSON.parse(JSON.stringify(tree));

    // 11. Write all three files.
    fs.writeFileSync(files.data, data);
    fs.writeFileSync(
        files.scores,
        JSON.stringify(scoreDatabase, null, 2) + "\n"
    );
    fs.writeFileSync(
        files.tree,
        JSON.stringify(tree, null, 2) + "\n"
    );

    console.log("Successfully added Social Darwinism, Revolutionism and Reformism.");
    console.log("Updated data.js, ideology_scores.json and questions_tree.json.");
}

try {
    main();
} catch (error) {
    console.error("\nUPDATE FAILED:");
    console.error(error.message);
    console.error("No files were written if validation failed.");
    process.exit(1);
}
