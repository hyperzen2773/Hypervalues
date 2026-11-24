#!/usr/bin/env node
/*
 * Overhaul the Philosophy category of Hypervalues.
 * Run from the project root:  node tools/philosophy_overhaul.js
 *
 * What it does
 *   1. Replaces the single 10-option philosophy question with a short tree like the other categories
 *      (a broad first question, then narrower ones, then the value).
 *   2. Adds four new philosophy values: dualism, monism, pluralism, naturalism.
 *   3. Moves egoism (was Nation) and amoralism (was Culture) into Philosophy: registry, question trees, and icons
 *      (the icon files are copied to icons/philosophy/). Their stances on ideologies are kept as they were.
 *   4. Adds a description for each new philosophy value (and an "ai" icon source for the original ten).
 *   5. Replaces the philosophy stances (the original ten plus dualism, monism, pluralism) of ALL ideologies with
 *      reviewed ones, positive and negative. The old ten were mostly a flat +0.10 placeholder.
 *
 * Safe to re-run, and to run whether or not an earlier version of this script was already run.
 * Only the philosophy ids are touched in ideologyScores / ideology_scores.json; every other stance is kept.
 * All three files are backed up first (*.backup-philosophy-rework-<time>). The scoring engine is not modified.
 * Stances: -1 = the ideology opposes it, +1 = it matches it. An ideology that is not listed for a philosophy
 * keeps no stance on it (the model then guesses from similar ideologies).
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = process.cwd();
const dataPath = path.join(root, "data.js");
const treePath = path.join(root, "questions_tree.json");
const scoresPath = path.join(root, "ideology_scores.json");
for (const f of [dataPath, treePath, scoresPath]) if (!fs.existsSync(f)) throw new Error(`Not found: ${f}`);

const BASE = ["rationalism", "empiricism", "materialism", "idealism", "pragmatism",
  "existentialism", "nihilism", "stoicism", "utilitarianism", "deontology"];
const ADDED = ["dualism", "monism", "pluralism", "naturalism"];
const MOVED = { egoism: { from: "nation", name: "Egoism" }, amoralism: { from: "culture", name: "Amoralism" } };
const STANCE_IDS = BASE.concat(ADDED);                       // values whose stances this script sets
const PHILOSOPHY = STANCE_IDS.concat(Object.keys(MOVED));    // every value of the category
const ABBR = { Ra: "rationalism", Em: "empiricism", Ma: "materialism", Id: "idealism", Pr: "pragmatism",
  Ex: "existentialism", Ni: "nihilism", St: "stoicism", Ut: "utilitarianism", De: "deontology",
  Du: "dualism", Mo: "monism", Pl: "pluralism", Na: "naturalism" };

// ---------------------------------------------------------------------------------------------
// 1. The question tree
// ---------------------------------------------------------------------------------------------
const philosophyTree = [
  {
    id: "p1",
    text: "Which kind of question matters most to you when you think about life and society?",
    options: [
      { text: "Knowledge: how we can tell what is true, and what to trust", next: "p_know" },
      { text: "Reality: what the world is fundamentally made of, and what drives the way it changes", next: "p_real" },
      { text: "Conduct: how to decide what is right, whether as a person or as a society", next: "p_act" },
      { text: "Meaning: whether life has a purpose, and how to live without a given one", next: "p_meaning" }
    ]
  },
  {
    id: "p_know",
    text: "How do you decide whether a claim is true?",
    options: [
      { text: "Work it out by logic and first principles: sound reasoning can reach truths that observation alone never could", next: "rationalism" },
      { text: "Test it against evidence: observe, measure and trust what experience and experiment show", next: "empiricism" },
      { text: "See what happens when people act on it: an idea is true enough if it works and solves real problems", next: "pragmatism" }
    ]
  },
  {
    id: "p_real",
    text: "How would you describe the basic make-up of reality?",
    options: [
      { text: "It comes down to one thing: a single substance, principle or underlying whole explains everything", next: "p_one" },
      { text: "Two fundamentally different realms: mind and matter, or spirit and body, neither reducible to the other", next: "dualism" },
      { text: "Many irreducibly different things, truths and values, with no single master explanation", next: "pluralism" }
    ]
  },
  {
    id: "p_one",
    text: "What is that one thing?",
    options: [
      { text: "Matter and physical conditions: thoughts, beliefs and institutions grow out of how people live and what they produce", next: "materialism" },
      { text: "Mind and ideas: consciousness, ideals or spirit shape reality, and the material world follows from them", next: "idealism" },
      { text: "One unified whole: mind and matter are two sides of a single connected reality, and separating the parts misleads", next: "monism" },
      { text: "Nature: everything that exists is part of the natural world, which science can study, and nothing lies beyond it", next: "naturalism" }
    ]
  },
  {
    id: "p_act",
    text: "What makes an action right?",
    options: [
      { text: "Its results: the right act does the most good and the least suffering for everyone affected", next: "utilitarianism" },
      { text: "Its principle: some duties and rights bind us whatever the results, and may not be broken for a greater good", next: "deontology" },
      { text: "Its source: acting with self-command, wisdom and virtue, and calmly accepting what lies outside one's control", next: "stoicism" },
      { text: "Its benefit to you: each person should pursue their own interest first, owing nothing to a nation, state or higher duty", next: "egoism" },
      { text: "Nothing: there is no moral standard to meet, only desire, advantage and what one chooses to do", next: "amoralism" }
    ]
  },
  {
    id: "p_meaning",
    text: "How should we face a universe that gives no purpose ready-made?",
    options: [
      { text: "Choose freely: each person must take responsibility for creating their own meaning through what they do", next: "existentialism" },
      { text: "Accept it: there is no inherent meaning or objective moral truth, and none needs to be invented", next: "nihilism" }
    ]
  },
  ...PHILOSOPHY.map(id => ({ id }))
];

// ---------------------------------------------------------------------------------------------
// 2. Descriptions of the values (nihilism already has one and keeps it)
// ---------------------------------------------------------------------------------------------
const valueDescriptions = {
  rationalism: "The view that reason is the main source of knowledge. Rationalists hold that logic, mathematics and careful deduction from first principles can reveal truths about the world, and that sound argument should guide belief and action more than tradition, feeling or authority. In politics it favors reasoned justification of institutions, planning and law.",
  empiricism: "The view that knowledge comes mainly from observation, evidence and experience. Empiricists trust what can be measured, tested and checked, and are wary of claims that rest only on pure theory, tradition or authority. In politics it favors evidence-based policy, open inquiry and changing course when the facts change.",
  materialism: "The view that physical reality and material conditions are fundamental, and that ideas, beliefs and institutions arise from them. In philosophy it holds that everything, including the mind, depends on matter. In political thought, as in Marxism, it holds that economic life and the way people produce what they need shape law, culture and ideology.",
  idealism: "The view that mind, ideas or spirit are fundamental to reality, so the material world cannot be understood apart from consciousness or ideals. Idealists hold that ideas, values and moral or spiritual principles move history and give societies their shape and purpose. In politics it appears in appeals to national spirit, moral renewal, sacred order and shared ideals.",
  pragmatism: "The view that an idea is to be judged by its practical results and how well it works in experience. Pragmatists treat theories as tools, test them by their consequences and prefer solutions that solve real problems over doctrinal purity. In politics it favors flexibility, compromise and experiment.",
  existentialism: "A philosophy centered on individual freedom, choice and responsibility. Existentialists hold that people are not given a fixed purpose, and must create meaning and live authentically through their own decisions, without hiding behind roles, crowds or excuses. In politics it favors personal autonomy and is wary of anything that dissolves the individual into a collective.",
  stoicism: "An ancient philosophy of virtue, self-command and acceptance. Stoics hold that a good life comes from wisdom, courage, justice and self-discipline, and from focusing on what is within one's control while meeting what is not with calm. In politics it appears as an ethic of duty, restraint and civic virtue.",
  utilitarianism: "An ethical view that judges actions and policies by their consequences for the overall well-being of everyone affected. Utilitarians seek the greatest good for the greatest number and the least suffering, weighing costs and benefits impartially. In politics it supports evidence-based welfare policy and the weighing of trade-offs, and it can justify overriding individual claims for the wider good.",
  dualism: "The view that reality consists of two fundamentally different kinds of thing that cannot be reduced to one another, most often mind and matter, or soul and body. Dualists hold that consciousness, spirit or moral good is not simply a product of physical processes. The same idea appears in moral dualism, which sees the world as a struggle between two opposed principles such as good and evil. In politics it appears in sharp distinctions between the spiritual and the temporal, or between friend and enemy.",
  monism: "The view that reality is ultimately one: a single substance, principle or connected whole underlies everything, and apparent divisions are of degree rather than of kind. Monism can be materialist, idealist or neutral. In politics it appears in holistic and organic thinking, in the idea of one truth or one common good, and in movements that treat society or nature as an indivisible whole.",
  pluralism: "The view that reality, knowledge and value are many, and cannot be reduced to a single master explanation or a single highest good. Pluralists hold that people can reasonably hold different truths and values, so that diversity should be protected rather than overcome. In politics it supports tolerance, power-sharing, federalism and the coexistence of differing communities and ways of life.",
  naturalism: "The view that everything that exists is part of the natural world and can be understood through the methods of science, with no supernatural realm beyond it. Naturalists hold that mind, morality and society arise from natural processes, and that explanations should appeal to nature rather than to divine or otherwise supernatural causes. In politics it favors secular, evidence-based thinking and grounding ethics and law in human nature and the natural world.",
  deontology: "An ethical view that some duties, rights and moral rules bind us whatever the consequences. Deontologists hold that certain acts, such as treating people merely as means, breaking promises or violating basic rights, are wrong even when they would produce better outcomes. In politics it underlies rights-based liberalism, natural law and the rule of law."
};

// ---------------------------------------------------------------------------------------------
// 3. Philosophy stances for all ideologies (-1 opposes, +1 matches). Reviewed per ideology;
//    edit freely and re-run on fresh files (the script replaces these ten values each time).
// ---------------------------------------------------------------------------------------------
const STANCES = {
  "National Syndicalism": "Ex-.65 Pl-.62 Na-.62 De-.58 Ra-.57 Mo.57 Ut-.56 Ni-.53 Id.5 Du.43 Pr.3 Em-.26",
  "Brazilian Integralism": "Id.9 Ma-.8 Ni-.8 Na-.79 Du.61 St.5 Ex-.5 Mo.47 Pl-.43 De.4 Ut-.4 Em-.2",
  "Italian Fascism": "Pl-.8 De-.7 Na-.61 Ex-.6 Mo.6 Id.5 Ma-.5 Ra-.5 Ut-.5 St.5 Pr.4 Ni-.3",
  "Evolianism": "Id.9 Ma-.9 St.9 Du.8 Na-.8 Ut-.6 Em-.5 Pl-.5 Ra-.4 Ni-.4 De.3 Ex.2 Mo.2",
  "Futurism": "Du-.51 Ma.5 Pr.5 St-.5 Na.48 De-.4 Ra.3 Id-.3 Ni.3 Ex.2",
  "National-Socialism": "Pl-.9 De-.8 Ut-.7 Ex-.6 Mo.6 Na-.59 Ra-.5 Ma-.5 Id.4 Ni-.3 St.3 Du.3",
  "Neo-Nazism": "Pl-.9 De-.8 Ut-.7 Ex-.6 Mo.6 Na-.59 Ra-.5 Ma-.5 Id.4 Ni-.3 St.3 Du.3",
  "Agrarian Fascism": "Na-.68 Id.61 Ex-.56 Pl-.55 Ra-.54 St.53 Ut-.53 Du.49 Ni-.46 Ma-.44 De-.42 Mo.42 Em-.37",
  "Strasserism": "De-.65 Pl-.64 Ex-.54 Mo.53 Ut-.51 Ra-.47 Ni-.3 Na-.27",
  "Falangism": "Id.8 Ma-.8 Ni-.8 Na-.74 Pl-.64 Mo.61 St.6 Du.58 Ex-.5 Ut-.4 De.3 Pr.3 Em-.2",
  "Sansepolcrismo": "Pr.5 De-.4 St.3 Id.2",
  "Ecofascism": "Pl-.61 De-.59 Mo.54 Ut-.52 Ra-.41 Na.4 Ex-.39 Ma-.3 Id.22 Du.22",
  "Sorelianism": "Ma.58 De-.46 Pl-.41 Ra-.19",
  "Legionarianism": "Id.9 Ma-.8 Ni-.8 St.8 Na-.8 Du.63 Pl-.61 Mo.43 Ex-.4 Ut-.4 De.2 Em-.2",
  "Peronism": "Pr.7 Id.4 Na-.34 Du.31 Ut.3 Ma-.3 Mo.22 Pl-.2",
  "Techno-Fascism": "De-.58 Pl-.53 Mo.48 Ex-.38 Id.23 Ni-.22 Pr-.21",
  "National Solidarity": "Pr.49 De-.42 Pl-.39 Ex-.22",
  "Clerical Fascism": "Id.9 Ma-.8 Ni-.8 Na-.8 Ex-.7 Du.62 Pl-.61 Mo.55 St.5 Ut-.4 Pr.3 De.2 Em-.2",
  "Rexism": "Id.9 Ma-.8 Ni-.8 Na-.79 Du.61 De.6 Pl-.59 Mo.53 St.5 Ex-.5 Ut-.4 Em-.2",
  "Ba'athism": "Na.41 Id.4 Pr.4 De-.3 Mo.25 Du-.22 St.2",
  "Cosmist Vanguardism": "Ma.52 Ra.5 Du-.46 Ut.34 St-.33 Em.26 Id-.24 Mo.22 Na.2",
  "Duginism": "Id.5 Du.5 De-.4 Ma-.4 Na-.4 St.3 Mo.3 Pl-.3",
  "Fiumanism": "Na-.51 Id.46 Ma-.36 Mo.35 Ex-.31 Ni-.28 Em-.26 Ut-.26",
  "Pekerism": "Na.65 De-.56 Ma.43 Em.4 Id-.4 Du-.39 Pr.38 Pl-.36 Ut.34 Mo.32 Ra.28 Ni.26 Ex-.2",
  "Ethnonationalist Kemalism": "Na.71 Pl-.51 Pr.5 De-.5 St.5 Du-.45 Em.4 Id-.4 Ra.3 Ma.2",
  "Eneasism": "St.5 Ni-.5 Id.4 De.3 Pr.3",
  "Social Nationalism": "Pr.3 De-.26 Ut.19 Pl-.17",
  "Ethnocacerismo": "De-.61 Pl-.59 Ut-.54 Ex-.42 St.41 Mo.24 Ra-.22",
  "National Primitivism": "Ut-.58 Pl-.54 Ra-.52 Pr-.42 Mo.3 Em-.26 Ma-.26 De-.25 Ex-.24",
  "Social-Bonapartism": "Pl-.57 Ex-.39 De-.39 Mo.33 Ma.12",
  "Tridemism": "Ra.41 Pr.41 Ut.29 De.26 St.22 Pl.2",
  "Nationalist Kemalism": "Pl-.62 Na.55 Pr.5 De-.5 St.5 Mo.44 Em.4 Id-.4 Ra.3 Du-.29 Ma.2",
  "National Collectivism": "Ex-.7 De-.7 Pl-.64 Mo.62 Ut-.5 Ma.39 St.37 Ra-.35 Ni-.35 Du-.29",
  "Nazi-Maoism": "De-.7 Ex-.67 Pl-.64 Mo.59 Ut-.55 Ra-.43 Ma.33 Ni-.29 St.25 Id.24",
  "Savinkovism": "De-.69 Ex-.62 Pl-.59 Mo.39 Na-.35 Ut-.34 Ra-.31 Ni-.31 Id.3 Em-.28 St.28",
  "Mosleyism": "De-.7 Ex-.66 Pl-.62 Mo.58 Ni-.45 Ut-.39 Id.36 Na-.36 St.32 Ma-.27",
  "Revolutionary Nationalism": "Ma.54 Pl.44 Na.3 Ex.28 Ut-.14",
  "Volkism": "Ra-.62 Na-.61 Pl-.58 Mo.55 Ma-.54 Ex-.54 Ut-.54 Id.5 De-.5 Em-.38 Ni-.36 Du.31 Pr-.21",
  "Optimateism": "St.49 De.31 Id.28 Na-.25 Du.21",
  "Integralism": "Id.9 Ma-.8 Ni-.8 Na-.8 Du.62 De.6 St.5 Ex-.5 Mo.44 Pl-.42 Ut-.4 Em-.2",
  "National Capitalism": "Ut-.46 Pr-.28 Du.2 Mo-.2 Ra-.13",
  "Carlism": "Id.9 Ma-.8 Ni-.8 Na-.79 Du.61 De.6 St.5 Ex-.5 Ut-.4 Mo.35 Pl-.32 Em-.2",
  "Autocratic Monarchism": "Pl-.58 De-.45 Ut-.36 Na-.33 Ra-.31 Id.28 Em-.22",
  "Theocratic Distributism": "Id.9 Ma-.8 Ni-.8 Na-.79 Du.61 De.6 St.5 Ex-.5 Pl-.29 Mo.21 Ut-.2 Em-.2",
  "Reactionary Feudalism": "Na-.44 St.43 Em-.42 Ut-.24 Ra-.22 Du.15",
  "Neo-Absolutism": "Pl-.47 Ut-.38 Na-.36 De-.32 Ra-.27 Em-.27",
  "Aristocratic Cameralism": "St.5 Pr.5 Ra.3 Ut.3 Pl-.21",
  "Feudal Monarchism": "Na-.53 Ra-.35 Em-.35 St.35 Id.3 Ut-.28 Du.23",
  "Clerical Monarchism": "Id.9 Ma-.8 Ni-.8 Na-.8 De.6 Du.6 Pl-.59 St.5 Ex-.5 Mo.43 Ut-.4 Em-.2",
  "Developmental Theocracy": "Id.9 Ma-.8 Ni-.8 Na-.8 Du.61 De.6 St.5 Ex-.5 Ut-.4 Pl-.37 Mo.36 Em-.2",
  "Classical Eurasianism": "Id.5 Na-.47 De-.4 Ma-.4 Mo.36 Du.31 St.3 Pl-.28",
  "Mladorossism": "Id.6 Na-.52 Ni-.5 Pl-.49 St.4 Mo.33 Ex-.3 Pr.3 Du.22",
  "National Social Capitalism": "Pl-.5 De-.4 Ut-.4 Pr.4 Mo.22",
  "Right-State Liberalism": "Pr.5 De.4 Em.3 Mo-.15",
  "Monarquia Syndicalista": "Na-.63 Id.56 De.4 Pl.4 Ra-.38 St.38 Em-.31 Du.3 Ni-.28",
  "Serenissimism": "Pr.5 Ut-.5 Du.42 Na-.37 Id.3",
  "National Conservatism": "Pr.5 Id.3 St.3 Ra-.3 Na-.21 Du.17",
  "Paternalistic Conservatism": "Pr.7 Ut.4 Id.3 St.3 Ra-.3 Mo.15",
  "Buchanan Paleoconservatism": "Pr.5 Id.3 St.3 Ra-.3 Na-.21 Pl-.17",
  "Hard Right Paleoconservatism": "Pr.5 Na-.5 Id.3 St.3 Ra-.3 Du.19",
  "Old Right Paleoconservatism": "Pr.5 Id.3 St.3 Ra-.3 Na-.2 Pl.17",
  "Neoconservatism": "Pr.4 De.3 Ut.24 Pl.15",
  "Mesoconservatism": "Pr.5 Id.3 St.3 Ra-.3 Pl.15",
  "Red Toryism": "Id.6 Na-.47 Du.44 St.4 Pr.4 De.4 Ma-.3 Mo.2",
  "Green Conservatism": "Pr.5 Id.3 St.3 Ra-.3 Na.3 Mo.23",
  "Clerical Conservatism": "Id.9 Ma-.8 Ni-.8 Na-.79 De.6 Du.6 St.5 Ex-.5 Ut-.4 Mo.3 Em-.2",
  "Gaullism": "Pr.5 Id.2 St.2 Pl-.15",
  "Free-Market Conservatism": "De.5 Pr.4 Du.35 Pl.23 Id.2 St.2 Ra-.2 Na-.2",
  "Agrarian Conservatism": "Pr.5 Id.3 St.3 Ra-.3 Mo.15",
  "Liberal Toryism": "Pr.5 Id.3 St.3 Ra-.3",
  "Social Gaullism": "Pr.5 Id.2 St.2",
  "Neo-Gaullism": "Pr.5 Id.2 St.2 Pl-.18",
  "Bonapartist Gaullism": "Pr.5 Pl-.32 Id.2 St.2",
  "Conservative Atlanticism": "Pr.5 Ut.2 De.2 Pl.15",
  "Neoconservative Atlanticism": "Pr.5 Ut.2 De.2 Pl.18",
  "One-Nation Conservatism": "Pr.7 Ut.4 Id.3 St.3 Ra-.3 Du.25 Na-.25",
  "Conservative Kemalism": "Na.62 Em.6 Ra.5 Pr.5 St.3 Ma.2 Mo-.17",
  "Conservative Technoliberalism": "Pr.5 Pl.24 Ut.2 De.2",
  "Right-Social Authoritarianism": "Pl-.45 Ex-.38 De-.3 Id.19",
  "Kjærsgaardism": "Pr.5 Id.3 St.3 Ra-.3 Pl-.2 Na-.2",
  "Kekkonism": "Pr.5 Ut.2 De.2 Pl-.18",
  "Reform Gaullism": "Pr.5 Id.2 St.2",
  "Paleoconservatism": "Pr.5 Id.3 St.3 Ra-.3 Pl-.25 Na-.23",
  "Putinism": "Pr.7 De-.7 Pl-.58 Ex-.5 Id.3 St.3 Ut-.3 Mo.21",
  "Post-Soviet Autocracy": "Pr.7 De-.7 Pl-.58 Ex-.5 Ut-.2 Mo.2",
  "Radicalism": "Na.77 Pl.63 Ra.6 Mo-.53 Em.5 Ut.5 Du-.45 Pr.4 Ex.4 Id-.3 De.3",
  "Third Way": "Pr.53 Ut.34 Pl.31 De.24",
  "Christian Democracy": "Id.6 Ni-.6 Na-.6 De.5 Du.5 Ma-.4 Pr.4 Pl.4 Ut.3",
  "Compassionate Conservatism": "Id.5 Na-.44 Pr.4 St.3 Ut.3 De.3 Du.23",
  "Rockefeller Republicanism": "Pr.5 Ut.2 De.2 Pl.15",
  "Democratic Transhumanism": "Ut.54 Na.5 Ra.46 Em.32 Du-.29 Pl.26 Ma.2",
  "Neo-Solidarism": "Na.36 Ut.3 Pr.26 Em.2 Pl.15",
  "Steppe Eurasianism": "Id.5 Na-.43 De-.4 Ma-.4 St.3 Du.28 Mo.2",
  "Classical Kemalism": "Em.6 Na.6 Pl.55 Du-.54 Ra.5 Pr.5 Ma.4 Id-.4 Mo-.34",
  "Centrist Kemalism": "Na.64 Em.6 Ra.5 Pr.5 Ma.4 Id-.4 Du-.35 Pl.31",
  "Catholic Social Teaching": "Id.8 Ni-.8 Na-.8 De.7 Ma-.6 Du.6 St.3 Pr.2 Pl.2",
  "Bleeding-Heart Authoritarianism": "Pr.5 Ut.4 De-.4 Ex-.3 Pl-.17",
  "Austro-Corporatism": "Id.6 Ni-.6 Ma-.5 Mo.43 Na-.42 De.4 St.3 Pr.3 Du.25",
  "Davos System": "Pr.8 Na.7 Ut.6 Em.6 Pl.6 Ra.5 Mo-.22",
  "Nordic Model": "Ut.6 Pr.5 Em.3 Pl.17",
  "Social Democracy": "Ut.5 Pr.5 Pl.32 Em.3",
  "Conservative Social Democracy": "Ut.5 Pr.5 Em.3 Id.2 St.2 Pl.15",
  "Social Distributism": "De.6 Ni-.6 Id.5 Ma-.4 Na-.39 Du.31 Ut-.3",
  "Eurocommunism": "Id-.8 Ma.6 Pl.49 Na.41 Ra.4 Em.4 Pr.4 De.3 Ni-.3 Du-.3 Ex.2",
  "Liberal Socialism": "De.62 Pl.62 Ex.56 Mo-.5 Ra.45 Ut.33 Na.26 Pr.24 Ma.23",
  "Social Georgism": "Ut.5 Pr.5 Em.3 Pl.15",
  "Agrarian Social Democracy": "Ut.5 Pr.5 Em.3 Pl.15",
  "Progressive Corporatism": "Pr.32 Ut.3 Mo.18",
  "Left-Gaullism": "Pr.5 Id.2 St.2",
  "Labour Atlanticism": "Ut.5 Pr.5 Em.3 Pl.16",
  "Green Social Democracy": "Ut.51 Pr.35 Na.23 Em.21 Pl.16",
  "Geo-Social Democracy": "Ut.5 Pr.5 Em.3 Pl.15",
  "Christian Social Democracy": "Id.6 Ni-.5 Na-.5 De.4 Ut.4 Pr.4 Ma-.3 Du.29",
  "Police Labourism": "Ut.5 Pr.5 Em.3 Pl-.15",
  "Ecevitism": "Na.67 Em.6 Ra.5 Ma.5 Pr.5 Ut.5 Id-.4 Du-.37 Pl.29",
  "Left-Social Authoritarianism": "Pr.5 Ut.4 De-.4 Ex-.3 Pl-.26",
  "Progressive Social Authoritarianism": "Pr.5 Ut.4 De-.4 Ex-.3 Pl-.26",
  "Left-Wing Populism": "Pr.5 Ut.3 Ma.2 Pl.15",
  "Left-Social Democracy": "Ut.5 Pr.5 Em.3 Pl.18",
  "Social-Helveticism": "Pl.7 Ut.5 St.26 De.23",
  "Left Kemalism": "Na.76 Em.6 Ma.6 Du-.55 Ra.5 Pr.5 Pl.46 Id-.4 Ut.4",
  "Longism": "Pr.61 Ut.45 Pl.33 Em.22",
  "Classical Liberalism": "De.7 Pl.7 Na.54 Ra.5 Em.5 Ex.4 Pr.3 Ut.3 Mo-.3",
  "Neoliberalism": "Em.5 Ut.4 Ra.4 Pr.4 Pl.3 Du-.2",
  "National Liberalism": "Pr.5 Ut.2 De.2 Pl.15",
  "Social Liberalism": "Pl.8 Ut.5 De.4 Ra.4 Em.4 Pr.4 Mo-.3 Na.29",
  "Ordoliberalism": "Pr.39 Pl.21 Ra.2 St.12",
  "Bleeding-Heart Liberalism": "Ut.5 Pl.48 De.41 Ra.26",
  "Bleeding-Heart Libertarianism": "De.63 Pl.36 Ra.3 Ex.26",
  "Geo-Liberalism": "De.4 Pl.32 Ut.24 Ra.17",
  "Green Liberalism": "Pl.43 Na.4 Ut.37 Pr.34 Ra.32 De.31 Em.29",
  "Whiggism": "Pl.6 Pr.5 Em.4 De.4",
  "Muscular Liberalism": "Pr.5 Pl.36 Ut.2 De.2",
  "Liberal Atlanticism": "Pl.47 De.45 Ex.26 Mo-.2 Ra.19",
  "Transatlantic Federalism": "Pr.5 Pl.5 Ut.2 De.2",
  "New Deal Liberalism": "Pr.8 Ut.6 Em.4 Pl.26",
  "Venizelism": "Pr.5 Ut.2 De.2",
  "Liberal Kemalism": "Na.69 Em.6 Pl.56 Ra.5 Pr.5 Ma.4 Id-.4 Du-.35 Mo-.35",
  "Liberal Social Authoritarianism": "Pr.5 Ut.4 De-.4 Pl-.31 Ex-.3",
  "Techno-Social Liberalism": "Pl.35 Ut.3 De.3 Pr.22",
  "Technoliberalism": "De.5 Pl.49 Ex.27 Ra.25 Mo-.23",
  "American Model": "Pl.53 De.47 Mo-.31 Ex.26 Ra.14",
  "Techno-Neoliberalism": "Ra.54 Ut.41 Na.41 Pr.34 De.34 Em.31 St.22 Pl.2",
  "Tsaingwenism": "Pr.37 Na.34 Em.31 Ut.31 De.29 Pl.29",
  "Liberal Imperialism": "Pr.7 Pl.56 Mo-.49 Ut.4 Du.36 De-.3 Ra.3",
  "Liberal Meritocracy": "Ra.6 Pr.6 Pl.59 Em.5 Ut.5 Na.42 De.4 Mo-.35 Ex.3",
  "Christian Socialism": "Id.7 Ni-.7 De.4 Na-.39 Ma-.3 Ut.3 Du.21",
  "National Bolshevism": "De-.6 Pl-.54 Mo.44 Ma.34 Ra-.3 Du-.28 Ex-.26 Ut-.25",
  "Democratic Socialism": "Pl.6 Ex.5 Pr.46 Ut.46 De.41 Mo-.41 Ra.27 Ma.22",
  "Conservative Socialism": "Ra-.29 Em-.29 Pr.24 Na-.24 St.23 Mo.21 Ma.2",
  "Paleosocialism": "Pr.5 Ut.3 Ma.2 Du-.2",
  "Cybernetic Socialism": "Ma.9 Id-.8 Ra.6 Em.6 Na.6 Du-.57 Mo.45 Ut.4 Pr.3 Ni-.3 De-.2",
  "Utopian Communitarianism": "Ni-.38 Ut.38 Id.34 Pr-.31 Ra.26 Pl.15",
  "Syndicalist Republicanism": "Pl.45 Ut.3 Ma.27 De.26",
  "Left-Eurasianism": "Ma.4 De-.4 Mo.37 Id.3 Pl-.28 St.2",
  "Socialist Kemalism": "Na.73 Em.6 Ma.6 Ra.5 Pr.5 Du-.49 Id-.4 Ut.4",
  "Socialist Technoliberalism": "Pl.43 Na.41 De.38 Ra.24 Ma.23 Ex.22",
  "Mugabeism": "De-.4 Pr.4 Pl-.35 Ma.3 Ex-.3 Mo.27",
  "Old Left-Populism": "Pr.5 Ut.3 Ma.2 Mo.15",
  "Left-State Liberalism": "Ut.6 Pr.5 Em.3 Ra.3 Na.25",
  "American Technocracy": "Na.7 Ma.68 Ut.62 Ra.61 Em.58 Id-.57 Du-.56 De-.39 Pr.3 Pl.25 Mo.2",
  "Fabian Socialism": "Pr.8 Ut.8 Em.7 Na.62 Ra.4",
  "Ujamaa": "Pr.42 Ma.35 Mo.33 De-.3",
  "Bordigism": "Ma.9 Id-.8 Na.51 Du-.47 Mo.42 Ra.4 Em.4 De-.4 Pl-.37 Pr.3 Ni-.3",
  "Italian Left Communism": "Ma.9 Id-.8 Na.61 Du-.46 Ra.4 Em.4 De-.4 Mo.39 Pl-.37 Pr.3 Ni-.3",
  "Juche": "De-.6 Ex-.6 Pl-.54 St.4 Mo.39 Id.3 Ma.3 Du-.2",
  "Mao Zedong Thought": "Ma.9 Id-.8 Na.58 Mo.5 Pl-.5 Ra.4 Em.4 De-.4 Du-.4 Pr.3 Ni-.3",
  "Maoism Third Worldism": "Ma.9 Id-.8 Na.53 Ra.4 Em.4 De-.4 Du-.37 Mo.33 Pr.3 Ni-.3 Pl-.28",
  "Marxism Leninism Maoism": "Ma.9 Id-.8 Na.53 Ra.4 Em.4 De-.4 Du-.37 Mo.35 Pl-.31 Pr.3 Ni-.3",
  "Luxemburgism": "Ma.9 Id-.8 Na.55 Mo.5 Ra.4 Em.4 Du-.4 Pr.3 Ni-.3 Ex.3 De.2 Pl.2",
  "Trotskyism": "Ma.9 Id-.8 Na.55 Mo.5 Ra.4 Em.4 De-.4 Du-.4 Pr.3 Ni-.3 Pl-.2",
  "Marxism-Leninism": "Ma.9 Id-.8 Mo.6 Du-.5 Pl-.5 Na.5 Ra.4 Em.4 De-.4 Pr.3 Ni-.3",
  "Stalinism": "Ma.9 Id-.8 Pl-.8 Ex-.7 De-.6 Mo.6 Na.52 Du-.5 Ra.4 Em.4 Pr.3 Ni-.3",
  "Titoism": "Ma.9 Id-.8 Na.47 Ra.4 Em.4 De-.4 Du-.37 Pr.3 Ni-.3 Mo.23",
  "Dengism": "Pr.9 Ma.5 Id-.5 Em.5 Pl-.43 Ra.4 De-.4 Na.39 Mo.34 Ni-.3 Du-.29",
  "Hoxhaism": "Ma.9 Id-.8 Na.51 Du-.49 Mo.46 Ra.4 Em.4 De-.4 Pl-.4 Pr.3 Ni-.3",
  "Castroism": "Id-.8 Ma.7 Na.58 Du-.44 Pl-.44 Mo.41 Ra.4 Em.4 St.4 Pr.3 De-.3 Ni-.3 Ex.2",
  "Guevarism": "Id-.8 Ma.7 Na.54 Ra.4 Em.4 St.4 Du-.33 Pr.3 De-.3 Ni-.3 Ex.2",
  "Cyber-Communism": "Ma.9 Id-.8 Ra.6 Em.6 Na.6 Ut.4 Mo.4 Du-.4 Pr.3 Ni-.3 De-.2",
  "De Leonism": "Ma.9 Id-.8 Na.53 Ra.4 Em.4 De-.4 Du-.4 Pr.3 Ni-.3 Mo.21",
  "Marxism-Kemalism": "Ma.9 Id-.8 Na.73 Ra.6 Em.6 Du-.54 Ut.4 Pr.3 Ni-.3 De-.2",
  "National Communism": "Na.76 Ma.72 De-.69 Id-.66 Pr.66 Ut.62 Em.59 Du-.59 Ra.5 Ni.48 Pl-.38 Mo.29 St.23",
  "Libertarian Municipalism": "Pl.58 Ma.5 Ra.5 Na.48 Ex.3 Ut.2 De.2 Id-.2",
  "Communalism": "Na.54 Ma.5 Ra.5 Pl.49 Ex.3 Ut.2 De.2 Id-.2",
  "Minarcho-Socialism": "De.5 Ex.4 Ma.3",
  "Libertarian Socialism": "Ex.66 De.57 Ma.51 Pl.5 Pr.32 Ra.24 Ut.24 Na.23",
  "Council Communism": "Ma.9 Id-.8 Na.53 Mo.5 Ra.4 Em.4 Du-.4 Pr.3 Ni-.3 Ex.3 De.2 Pl.2",
  "Democratic Confederalism": "Pl.7 De.49 Ut.46 Na.45 Ra.3 Ex.3 Ma.29 Em.22",
  "Guild Socialism": "Ma.4 Pr.4 Ut.3 Du-.15",
  "Eco-Socialism": "Na.5 Mo.4 Pr.39 De-.24 Pl.2 Ma.17",
  "Cybersyn Socialism": "Ma.9 Id-.8 Na.7 Ra.6 Em.6 Du-.5 Ut.4 Pr.3 Ni-.3 Mo.3 De-.2",
  "Fourierism": "Id.36 Ni-.33 Pl.25 St-.22 De-.22",
  "Gandhian Socialism": "Ni-.7 Id.6 De.6 Mo.6 St.5 Ma-.4 Pl.3 Du-.3 Na-.3 Ex.2",
  "Scythianism": "Id.7 Na-.47 Ma-.3 Du.23 Ni.2",
  "Proutism": "Pl.33 Ra.25 De.24 Ut.22",
  "Geolibertarianism": "De.65 Pl.46 Mo-.39 Ut-.3 Ex.28 Ra.22 Du.2",
  "Social Libertarianism": "De.49 Ut.34 Pl.27 Ex.22",
  "Helvetic Model": "Pl.7 De.38 St.26 Pr.13",
  "Minarcho-Distributism": "De.6 Ni-.6 Id.5 Na-.42 Ma-.4 Ut-.3 Du.3",
  "Pirate Politics": "Pl.6 De.49 Ex.29 Ra.18",
  "Agorist Minarchism": "De.63 Ex.44 Pl.37 Mo-.22 Ut-.21",
  "Communal Distributism": "De.6 Ni-.6 Id.5 Ma-.4 Na-.35 Ut-.3 Du.21 Mo.2 Pl.2",
  "Yangism": "Ut.7 Pr.6 Em.5 Ra.4 Na.4 Pl.15",
  "Libertarian Social Democracy": "Ut.51 De.46 Pl.25 Ex.19",
  "Progressive Helveticism": "Pl.7 Ut.37 De.35 Na.29 Em.26 St.25 Pr.22",
  "Cosmopolitan Distributism": "Pl.63 De.6 Ni-.3 Ut.3 Ex.3 Id.2",
  "Cyber-Federalism": "Pl.7 De.64 Ex.61 Pr.52 Ra.25 Ut.24 Na.24",
  "Neolibertarianism": "De.5 Pr.4 Pl.32 Mo-.21 Em.2 Ex.2",
  "Libertarian Conservatism": "De.6 Id.3 St.3 Pr.3 Pl.29",
  "National Libertarianism": "De.5 Pr.4 Em.2 Ex.2",
  "Paleolibertarianism": "De.62 Pl.37 Ut-.35 Du.32 Pr-.26 Mo-.25 Id.22",
  "Dark Enlightenment": "Pl-.52 Pr.4 De-.4 Na-.31 Ut-.3 St.2",
  "Cyber-Libertarianism": "De.65 Pl.43 Ex.39 Ra.14",
  "Objectivism": "Ra.95 Ni-.9 Id-.8 Du-.7 Ut-.6 Na.6 Pr-.5 Em.4 Ma.4 Mo.4 Ex.3 De.3 Pl-.3",
  "Fusionism": "Na-.68 De.66 Du.53 Id.5 Mo-.36 St.35 Ut-.35 Pl.32 Em-.27 Ni-.26 Ra-.22",
  "Minarcho-Avaritionism": "Ex.49 Ut-.27 St-.24 Ni.23 Mo-.15",
  "Libertarian Helveticism": "Pl.6 De.49 St.26 Pr-.19",
  "Yarvinism": "Pr.6 De-.5 Pl-.36 St.3 Ut.2 Ra.2 Na-.2",
  "Landianism": "Ni.6 De-.5 Mo-.46 Pl.43 Ma.3 Ut-.3 St-.3 Na-.26 Du-.23 Ex.2",
  "Anarcho-Syndicalism": "Ex.7 Ma.6 Id-.5 Pl.5 Na.46 Ra.4 Em.4 De.4 Du-.4 Ni-.3 Mo.3 Ut.2",
  "Platformism": "Ex.7 Ma.6 Id-.5 Pl.5 Na.42 Ra.4 Em.4 De.4 Du-.4 Ni-.3 Mo.3 Ut.2",
  "Left-Agorism": "Ex.58 De.54 Pl.5 Mo-.23 Ut.22",
  "Lys Noir": "Pr-.25 Ra-.24 Id.18 Pl-.15",
  "Anarcho-Communism": "Ex.7 Ma.6 Id-.5 Pl.5 Na.44 Ra.4 Em.4 De.4 Du-.4 Ni-.3 Mo.3 Ut.2",
  "Solarpunk Anarchism": "Na.6 De.5 Ex.35 Pl.35 Ut.31 Em.22 Ma.22 Ra.2",
  "Christian Anarchism": "Id.8 De.8 Ni-.8 Na-.8 Ma-.7 Du.6 Ex.3 St.3 Pl.3",
  "Insurrectionary Anarchism": "Ex.8 Ni.6 Pl.55 St-.4 Ut-.4 Mo-.37 Pr-.3 De-.2",
  "Catholic Workerism": "Id.8 Ni-.8 Na-.8 De.7 Ma-.6 Du.6 St.3 Pl.3 Ut-.2",
  "Mutualism": "Pl.4 Ex.26 Mo-.23 Ut-.22 De.19",
  "Market Anarchism": "De.68 Ex.67 Pl.62 Mo-.52 Pr-.34 Ma.26 Ra.21",
  "Mutualist Distributism": "De.6 Ni-.3 Ut-.3 Ex.3 Pl.22 Id.2 Ma-.2",
  "Panarchism": "Pl.9 Ex.63 De.59 Mo-.4 Pr-.26 Ra.22",
  "Geoanarchism": "De.64 Ex.45 Pl.45 Pr-.31",
  "Green Anarchism": "Mo.5 Na.5 De.49 Ex.37 Pl.3 Em.14",
  "Anarcho-Primitivism": "Na.5 Ex.49 Pr-.46 Mo.4 De.34 Ra-.33 St.3 Ni.29 Em-.24 Ma-.24 Ut-.22 Id.21 Pl.2",
  "Post-Anarchism": "Pl.7 Ex.6 De.5 Mo-.5 Ra-.22 Pr-.2",
  "Post-left": "Ex.8 Ni.6 Pl.5 St-.4 Ut-.4 Mo-.4 Pr-.3 De-.2",
  "Anarcho-Transhumanism": "Ex.5 De.5 Pl.44 Ra.35 Na.34 Ma.26 Du-.24 Pr-.21 St-.21 Ut.2",
  "Ego-Communism": "Ex.9 Ni.5 Ut-.5 St-.5 De-.4 Id-.3 Pl.22 Pr.2",
  "National-Anarchism": "Ut-.58 Na-.56 Ra-.48 Pr-.45 Id.42 Ma-.35 Em-.3 Pl-.29 Du.27 St.26 De.25 Mo.23 Ni-.2",
  "Ego-Mutualism": "Ex.9 Pl.64 Mo-.63 Ni.5 Ut-.5 St-.5 De-.4 Na.33 Id-.3 Du.28 Pr.2",
  "Anarcho-Capitalism": "De.71 Ex.69 Pl.4 Ut-.31 Mo-.3 Id-.22",
  "Hoppeanism": "De.46 Pr-.43 Ex.3 Ut-.22 Du.15",
  "Bleeding-Heart Anarcho-Capitalism": "De.66 Ex.47 Pl.41 Pr-.33 Ut.26",
  "Traditionalist Anarcho-Distributism": "Id.7 De.7 Na-.67 Ni-.6 Ma-.4 Du.4 Ut-.3 Ex.2",
  "Crypto-Anarchism": "De.69 Ex.58 Pl.5 Pr-.26 Mo-.23 Ra.2",
  "Avaritionism": "Ex.9 Ni.5 Ut-.5 St-.5 Pl.48 De-.4 Mo-.38 Id-.3 Pr.2",
  "Autarchism": "Ex.67 De.66 Pl.43 Pr-.34 Ut-.3 Mo-.28",
  "Free-Market Anarcho-Distributism": "De.7 Ma-.4 Ex.4 Id.3 Ni-.3 Na-.28 Pl.26 Ut-.2",
  "Agorism": "Ex.72 De.7 Pl.64 Mo-.63 Ni.48 Ut-.46 St-.39 Ra.33 Du.2",
  "Left-Accelerationism": "Ma.6 Pr.4 Na.36 Ut.3 De-.3 Ra.3 Du-.26",
  "Right-Accelerationism": "Ni.5 De-.4 Ex.3 Ut-.3 Pr.2 Mo-.18",
  "Effective Accelerationism": "Ut.5 Ra.5 Em.4 Pr.4 Ma.4 St-.3 Na.3 Du-.25",
  "Unconditional Accelerationism": "Ni.8 De-.6 Ut-.5 St-.5 Ex.3 Ra-.3 Ma.3",
  "Neo-Libertarian Falangism": "Na-.56 Id.45 Ut-.41 Du.27 Ma-.22 De.22 Ra-.2 Em-.2",
  "Ingsoc": "Ex-.9 De-.9 Em-.9 Pl-.9 Ra-.6 Id.6 Mo.6 Na-.59 Ma-.4 Ut-.4 Ni.3",
  "Neo-Bolshevism": "Ma.9 Id-.8 Pl-.57 Mo.56 Du-.49 Na.45 Ra.4 Em.4 De-.4 Pr.3 Ni-.3",
  "Obliteration of the Self": "Ex-.9 Pl-.8 De-.7 Mo.6 Id.3 Ni.2",
  "World State Fordism": "Ut.9 Ex-.8 De-.8 Pl-.8 St-.7 Na.64 Ma.6 Em.6 Pr.6 Ra.5 Mo.5 Ni.3",
  "Gileadism": "Id.9 Ex-.9 Pl-.9 Na-.9 Ma-.8 Ni-.8 Du.8 Em-.6 St.5 Ra-.5 Ut-.4 Pr-.4 Mo.4 De.2",
  "One State Benefactorism": "Ra.9 Ex-.9 Pl-.9 Ut.8 De-.7 Mo.7 Na.59 Em.5 Ma.5 St.2",
  "Cyberpunk Corpostatism": "De-.5 Ma.5 Pr.5 Ni.4 St-.4 Na.36 Du-.25 Mo.25 Ut.2",
  "Fireman Statism": "Ex-.8 De-.7 Em-.6 Pl-.54 Ut.5 Ra-.5 Ni.3 Mo.29",
  "Soylentism": "De-.8 Pl-.62 Ut.6 Ex-.6 Ma.5 Mo.48 Ni.3 Em.3 Na.29 Du-.21",
  "Burgundian System": "De-.72 Ex-.7 Ra-.67 Pl-.64 Mo.62 Ut-.58 Na-.57 St.54 Em-.5 Pr-.36 Ni.32",
  "Russian Imperial Cult": "Id.9 Ma-.8 Na-.79 St.7 Ex-.7 Pl-.64 Ut-.6 Em-.6 Mo.59 Du.57 Ni-.5 Ra-.5",
  "Nihilist Anarchism": "Ni.95 Ex.8 Id-.7 De-.5 Ut-.5 St-.5 Ma.3 Na.3 Pl.2 Mo-.2",
  "Paetel's National Bolshevism": "Ma.62 Mo.55 De-.5 Pl-.49 Du-.36 Na.36 Ra-.3 St.24 Pr.2",
  "National Radicalism": "Na-.8 Ra-.72 Ma-.72 Id.72 Ex-.72 Ni-.72 St.72 Em-.71 Ut-.71 De-.71 Du.64 Mo.64 Pl-.64 Pr.55",
  "Anarcho-Fascism": "Ut-.7 Na-.64 Ra-.61 Id.55 Pr-.5 Ma-.46 St.45 Em-.43 Du.39 Mo.32 De.22"
};

// ---------------------------------------------------------------------------------------------
// data.js helpers (same approach as tools/add_philosophy.js)
// ---------------------------------------------------------------------------------------------
function findDeclaration(source, name) {
  const re = new RegExp(`\\bconst\\s+${name}\\s*=`);
  const match = re.exec(source);
  if (!match) throw new Error(`Could not find "const ${name} =" in data.js`);
  const start = match.index;
  const exprStart = source.indexOf("=", match.index) + 1;
  let quote = null, escaped = false, lineComment = false, blockComment = false, depth = 0, end = -1;
  for (let i = exprStart; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (lineComment) { if (c === "\n") lineComment = false; continue; }
    if (blockComment) { if (c === "*" && n === "/") { blockComment = false; i++; } continue; }
    if (quote) { if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === quote) quote = null; continue; }
    if (c === "/" && n === "/") { lineComment = true; i++; continue; }
    if (c === "/" && n === "*") { blockComment = true; i++; continue; }
    if (c === "'" || c === '"' || c === "`") { quote = c; continue; }
    if (c === "{" || c === "[" || c === "(") depth++;
    else if (c === "}" || c === "]" || c === ")") depth--;
    else if (c === ";" && depth === 0) { end = i + 1; break; }
  }
  if (end < 0) throw new Error(`Could not find the end of "${name}"`);
  const value = vm.runInNewContext(`(${source.slice(exprStart, end - 1).trim()})`);
  return { start, end, value };
}
function parseScoreString(s) {
  const out = {};
  String(s || "").split("|").forEach(part => {
    const at = part.lastIndexOf(":");
    if (at <= 0) return;
    const key = part.slice(0, at).trim(), val = Number(part.slice(at + 1));
    if (key && Number.isFinite(val)) out[key] = val;
  });
  return out;
}
const fmt = n => String(Number(n.toFixed(2)));
function replacePhilosophy(scoreString, stances) {
  const parsed = parseScoreString(scoreString);
  for (const id of STANCE_IDS) delete parsed[id];
  Object.assign(parsed, stances);
  return Object.entries(parsed).map(([k, v]) => `${k}:${fmt(v)}`).join("|");
}
function expand(row) {
  const out = {};
  row.trim().split(/\s+/).forEach(token => {
    const m = /^([A-Z][a-z])(-?\d*\.?\d+)$/.exec(token);
    if (!m || !ABBR[m[1]]) throw new Error(`Bad stance token "${token}"`);
    const v = Number(m[2]);
    if (!(v >= -1 && v <= 1) || v === 0) throw new Error(`Stance out of range in "${token}"`);
    out[ABBR[m[1]]] = v;
  });
  return out;
}

// ---------------------------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------------------------
let source = fs.readFileSync(dataPath, "utf8");
const tree = JSON.parse(fs.readFileSync(treePath, "utf8"));
const jsonScores = JSON.parse(fs.readFileSync(scoresPath, "utf8"));

const scoresDecl = findDeclaration(source, "ideologyScores");
const ideologyScores = scoresDecl.value;

const unknown = Object.keys(STANCES).filter(name => !(name in ideologyScores));
const missing = Object.keys(ideologyScores).filter(name => !(name in STANCES));
let updated = 0;
for (const name of Object.keys(ideologyScores)) {
  if (!(name in STANCES)) continue;      // ideologies added later keep what they have
  ideologyScores[name] = replacePhilosophy(ideologyScores[name], expand(STANCES[name]));
  if (jsonScores[name]) jsonScores[name].s = ideologyScores[name];
  updated++;
}
source = source.slice(0, scoresDecl.start) +
  `const ideologyScores = ${JSON.stringify(ideologyScores, null, 4)};` + source.slice(scoresDecl.end);

const descDecl = findDeclaration(source, "descriptions");
const descriptions = descDecl.value;
let described = 0;
for (const [id, text] of Object.entries(valueDescriptions)) {
  if (!descriptions[id]) { descriptions[id] = text; described++; }
}
source = source.slice(0, descDecl.start) +
  `const descriptions = ${JSON.stringify(descriptions, null, 4)};` + source.slice(descDecl.end);

const iconDecl = findDeclaration(source, "iconSources");
const iconSources = iconDecl.value;
for (const id of BASE.concat(ADDED)) if (!(id in iconSources)) iconSources[id] = "ai";
source = source.slice(0, iconDecl.start) +
  `const iconSources = ${JSON.stringify(iconSources, null, 4)};` + source.slice(iconDecl.end);

tree.philosophy = philosophyTree;

// Move egoism and amoralism into the philosophy category (idempotent)
const mapDecl = findDeclaration(source, "resultsMapping");
const resultsMapping = mapDecl.value;
if (!resultsMapping.philosophy) throw new Error("data.js has no philosophy category: run tools/add_philosophy.js first");
const moved = [];
for (const [id, info] of Object.entries(MOVED)) {
  if (resultsMapping[info.from] && id in resultsMapping[info.from]) {
    delete resultsMapping[info.from][id];
    moved.push(id);
  }
}
// registry order: original ten, then the new values, then the moved ones
const ordered = {};
for (const id of PHILOSOPHY) ordered[id] = resultsMapping.philosophy[id] ||
  (MOVED[id] && MOVED[id].name) || id.charAt(0).toUpperCase() + id.slice(1);
for (const id of Object.keys(resultsMapping.philosophy)) if (!(id in ordered)) ordered[id] = resultsMapping.philosophy[id];
resultsMapping.philosophy = ordered;
source = source.slice(0, mapDecl.start) +
  `const resultsMapping = ${JSON.stringify(resultsMapping, null, 4)};` + source.slice(mapDecl.end);

// Remove the old options and leaves from the Nation / Culture trees
for (const [id, info] of Object.entries(MOVED)) {
  const nodes = tree[info.from];
  if (!Array.isArray(nodes)) continue;
  for (const node of nodes) {
    if (Array.isArray(node.options)) node.options = node.options.filter(o => o.next !== id);
  }
  tree[info.from] = nodes.filter(node => node.id !== id);
}

// Icons follow the category (the site loads icons/<category>/<id>.svg). The originals are left in place.
let iconsCopied = 0;
for (const [id, info] of Object.entries(MOVED)) {
  const from = path.join(root, "icons", info.from, `${id}.svg`);
  const to = path.join(root, "icons", "philosophy", `${id}.svg`);
  if (fs.existsSync(from) && !fs.existsSync(to)) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    iconsCopied++;
  }
}

const stamp = "backup-philosophy-rework-" + new Date().toISOString().replace(/[:.]/g, "-");
for (const f of [dataPath, treePath, scoresPath]) fs.copyFileSync(f, `${f}.${stamp}`);
fs.writeFileSync(dataPath, source, "utf8");
fs.writeFileSync(treePath, JSON.stringify(tree, null, 2) + "\n", "utf8");
fs.writeFileSync(scoresPath, JSON.stringify(jsonScores, null, 4) + "\n", "utf8");

console.log("Philosophy rework finished.");
console.log(`Question tree: ${philosophyTree.length} nodes (${PHILOSOPHY.length} philosophies).`);
console.log(`Moved into Philosophy: ${moved.length ? moved.join(", ") : "nothing (already moved)"}; icons copied: ${iconsCopied}.`);
console.log(`Value descriptions added: ${described} (existing ones kept).`);
console.log(`Ideologies with new philosophy stances: ${updated} of ${Object.keys(ideologyScores).length}.`);
if (unknown.length) console.log("Names in STANCES not found in data.js:", unknown.join(", "));
if (missing.length) console.log("Ideologies without new stances (kept as they were):", missing.join(", "));
console.log(`Backups: *.${stamp}`);
