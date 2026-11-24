const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "data.js");
const treePath = path.join(__dirname, "questions_tree.json");

let data = fs.readFileSync(dataPath, "utf8");
let tree = fs.readFileSync(treePath, "utf8");

function replaceOnce(source, search, replacement, label) {
    const first = source.indexOf(search);

    if (first === -1) {
        throw new Error(`Could not find insertion point: ${label}`);
    }

    if (source.indexOf(search, first + search.length) !== -1) {
        throw new Error(`Insertion point is ambiguous: ${label}`);
    }

    return source.replace(search, replacement);
}

// Prevent accidental duplicate additions.
if (
    data.includes('"social_change"') ||
    tree.includes('"social_change"')
) {
    throw new Error(
        "Social Change already appears in the project. No files were changed."
    );
}

// 1. Register the category.
data = replaceOnce(
    data,
    '    "social_control",\n',
    '    "social_control",\n    "social_change",\n',
    "categories"
);

// 2. Add its display title.
data = replaceOnce(
    data,
    '    "social_control": "Social Control",\n',
    '    "social_control": "Social Control",\n' +
    '    "social_change": "Social Change",\n',
    "categoryTitles"
);

// 3. Register the two values.
data = replaceOnce(
    data,
    '    "territorial_organization": {\n',
    `    "social_change": {
        "reformism": "Reformism",
        "revolutionism": "Revolutionism"
    },
    "territorial_organization": {
`,
    "resultsMapping"
);

// 4. Register icon sources.
// "ai" follows the existing project's icon-source convention.
const iconEnd = data.lastIndexOf("\n};");

if (iconEnd === -1) {
    throw new Error("Could not locate the end of iconSources.");
}

data =
    data.slice(0, iconEnd) +
    `
    "reformism": "ai",
    "revolutionism": "ai",` +
    data.slice(iconEnd);

// 5. Add the category to the quiz question tree.
const questionCategory = `  "social_change": [
    {
      "id": "sch1",
      "text": "How should fundamental social and political change be pursued?",
      "options": [
        {
          "text": "Through gradual reforms within existing institutions, using legislation and policy changes",
          "next": "reformism"
        },
        {
          "text": "Through a fundamental transformation of the existing social and political order rather than gradual reform",
          "next": "revolutionism"
        }
      ]
    },
    {
      "id": "reformism"
    },
    {
      "id": "revolutionism"
    }
  ],
`;

tree = replaceOnce(
    tree,
    '"philosophy": [',
    questionCategory + '"philosophy": [',
    "questions_tree.json"
);

// 6. Validate the question tree before writing.
JSON.parse(tree);

// 7. Save the modified files.
fs.writeFileSync(dataPath, data, "utf8");
fs.writeFileSync(treePath, tree, "utf8");

console.log("Social Change category successfully added!");
console.log("Added values: Reformism and Revolutionism");
console.log("Updated: data.js and questions_tree.json");
