#!/usr/bin/env node

// Adds Social Autonomy as a new Social Control value.
// Updates resultsMapping and descriptions in data.js.
// Checks the result before saving.
// Run: node tools/add_social_autonomy.js

const fs = require("fs");
const path = require("path");

const DATA = {
    id: "social_autonomy",
    label: "Social Autonomy",

    description:
        "A social philosophy emphasizing the independence of individuals from imposed social regulation and coercive control. It rejects compulsory conformity, enforced social conventions and externally imposed restrictions on personal choices. Individuals and communities remain free to establish their own social relationships, arrangements and norms through voluntary cooperation and mutual agreement, without requiring an authority to impose them."
};

const root = path.join(__dirname, "..");
const file = path.join(root, "data.js");

function fail(message) {
    console.error("STOPPED: " + message);
    process.exit(1);
}

let source = fs.readFileSync(file, "utf8");
const original = source;

// Check whether it already exists.
if (source.includes('"social_autonomy"')) {
    fail("Social Autonomy already exists in data.js. No changes made.");
}

// 1. Add to resultsMapping.
const mappingAnchor =
    '"permissivism": "Permissivism",';

if (source.split(mappingAnchor).length !== 2) {
    fail("Could not find the Social Control resultsMapping insertion point.");
}

source = source.replace(
    mappingAnchor,
    mappingAnchor +
    '\n        "social_autonomy": "Social Autonomy",'
);

// 2. Add its description.
const descriptionAnchor =
    '"civic_paternalism":';

const descriptionIndex = source.indexOf(
    descriptionAnchor,
    source.indexOf("/* Social Control Values */")
);

if (descriptionIndex === -1) {
    fail("Could not find the Social Control descriptions section.");
}

source =
    source.slice(0, descriptionIndex) +
    '"' + DATA.id + '": ' +
    JSON.stringify(DATA.description) +
    ',\n    ' +
    source.slice(descriptionIndex);

// 3. Verify JavaScript syntax.
const vm = require("vm");
const context = {};

try {
    vm.createContext(context);
    vm.runInContext(
        source.replace(/^const /gm, "var "),
        context
    );
} catch (error) {
    fail("JavaScript validation failed: " + error.message);
}

// 4. Verify registration.
if (
    context.resultsMapping.social_control[DATA.id] !== DATA.label
) {
    fail("Social Autonomy was not registered in resultsMapping.");
}

if (context.descriptions[DATA.id] !== DATA.description) {
    fail("Social Autonomy description was not registered.");
}

// 5. Save.
if (source === original) {
    fail("No changes detected.");
}

fs.writeFileSync(file, source);

console.log("SUCCESS: Social Autonomy has been added!");
console.log("Category: Social Control");
console.log("ID: " + DATA.id);
console.log("Description: registered successfully.");
console.log("Next: node --check data.js");
