#!/usr/bin/env node
/*
 * Rework the Philosophy category of Hypervalues.
 * Run from the project root:  node tools/rework_philosophy.js
 *
 * What it does
 *   1. Replaces the single 10-option philosophy question with a short tree like the other categories
 *      (a broad first question, then a narrower one, then the value).
 *   2. Adds a description (and an "ai" icon source) for each philosophy value.
 *   3. Replaces the ten philosophy stances of ALL ideologies with reviewed ones, positive and negative.
 *      The old ones were mostly a flat +0.10 placeholder.
 *
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

const PHILOSOPHY = ["rationalism", "empiricism", "materialism", "idealism", "pragmatism",
  "existentialism", "nihilism", "stoicism", "utilitarianism", "deontology"];
const ABBR = { Ra: "rationalism", Em: "empiricism", Ma: "materialism", Id: "idealism", Pr: "pragmatism",
  Ex: "existentialism", Ni: "nihilism", St: "stoicism", Ut: "utilitarianism", De: "deontology" };

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
    text: "What is most basic in the way the world works?",
    options: [
      { text: "Matter and physical conditions: thoughts, beliefs and institutions grow out of how people live and what they produce", next: "materialism" },
      { text: "Mind and ideas: consciousness, ideals or spirit shape reality, and the material world follows from them", next: "idealism" }
    ]
  },
  {
    id: "p_act",
    text: "What makes an action right?",
    options: [
      { text: "Its results: the right act does the most good and the least suffering for everyone affected", next: "utilitarianism" },
      { text: "Its principle: some duties and rights bind us whatever the results, and may not be broken for a greater good", next: "deontology" },
      { text: "Its source: acting with self-command, wisdom and virtue, and calmly accepting what lies outside one's control", next: "stoicism" }
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
  deontology: "An ethical view that some duties, rights and moral rules bind us whatever the consequences. Deontologists hold that certain acts, such as treating people merely as means, breaking promises or violating basic rights, are wrong even when they would produce better outcomes. In politics it underlies rights-based liberalism, natural law and the rule of law."
};

// ---------------------------------------------------------------------------------------------
// 3. Philosophy stances for all ideologies (-1 opposes, +1 matches). Reviewed per ideology;
//    edit freely and re-run on fresh files (the script replaces these ten values each time).
// ---------------------------------------------------------------------------------------------
const STANCES = {
  "National Syndicalism": "Id.66 Ex-.65 De-.58 Ra-.57 Ma-.57 Ut-.56 Ni-.53 Pr.3 Em-.26",
  "Brazilian Integralism": "Id.9 Ma-.8 Ni-.8 St.5 Ex-.5 De.4 Ut-.4 Em-.2",
  "Italian Fascism": "De-.7 Ex-.6 Id.5 Ma-.5 Ra-.5 Ut-.5 St.5 Pr.4 Ni-.3",
  "Evolianism": "Id.9 Ma-.9 St.9 Ut-.6 Em-.5 Ra-.4 Ni-.4 De.3 Ex.2",
  "Futurism": "Ma.5 Pr.5 St-.5 De-.4 Ra.3 Id-.3 Ni.3 Ex.2",
  "National-Socialism": "De-.8 Ut-.7 Ex-.6 Ra-.5 Ma-.5 Id.4 Ni-.3 St.3",
  "Neo-Nazism": "De-.8 Ut-.7 Ex-.6 Ra-.5 Ma-.5 Id.4 Ni-.3 St.3",
  "Agrarian Fascism": "Id.66 Ma-.59 Ex-.56 Ra-.54 St.53 Ut-.53 Ni-.46 De-.42 Em-.37",
  "Strasserism": "De-.65 Ex-.54 Ut-.51 Ra-.47 Id.34 Ma-.32 Ni-.3",
  "Falangism": "Id.8 Ma-.8 Ni-.8 St.6 Ex-.5 Ut-.4 De.3 Pr.3 Em-.2",
  "Sansepolcrismo": "Pr.5 De-.4 St.3 Id.2",
  "Ecofascism": "De-.59 Ut-.52 Ra-.41 Ex-.39 Ma-.3 Id.22",
  "Sorelianism": "De-.46 Ma.43 Ra-.19",
  "Legionarianism": "Id.9 Ma-.8 Ni-.8 St.8 Ex-.4 Ut-.4 De.2 Em-.2",
  "Peronism": "Pr.7 Id.4 Ut.3 Ma-.3",
  "Techno-Fascism": "De-.58 Ex-.38 Id.23 Ni-.22 Pr-.21",
  "National Solidarity": "Pr.49 De-.42 Ma-.34 Id.25 Ex-.22",
  "Clerical Fascism": "Id.9 Ma-.8 Ni-.8 Ex-.7 St.5 Ut-.4 Pr.3 De.2 Em-.2",
  "Rexism": "Id.9 Ma-.8 Ni-.8 De.6 St.5 Ex-.5 Ut-.4 Em-.2",
  "Ba'athism": "Id.4 Pr.4 De-.3 St.2",
  "Cosmist Vanguardism": "Ma.52 Ra.5 Ut.34 St-.33 Em.26 Id-.24",
  "Duginism": "Id.5 De-.4 Ma-.4 St.3",
  "Fiumanism": "Id.46 Ma-.36 Ex-.31 Ni-.28 Em-.26 Ut-.26",
  "Pekerism": "De-.56 Ma.43 Em.4 Id-.4 Pr.38 Ut.34 Ra.28 Ni.26 Ex-.2",
  "Ethnonationalist Kemalism": "Pr.5 De-.5 St.5 Em.4 Id-.4 Ra.3 Ma.2",
  "Eneasism": "St.5 Ni-.5 Id.4 De.3 Pr.3",
  "Social Nationalism": "Pr.3 De-.26 Ut.19",
  "Ethnocacerismo": "De-.61 Ut-.54 Ex-.42 St.41 Ra-.22",
  "National Primitivism": "Ut-.58 Ra-.52 Pr-.42 Em-.26 Ma-.26 De-.25 Ex-.24",
  "Social-Bonapartism": "Ex-.39 De-.39 Ma.12",
  "Tridemism": "Ra.41 Pr.41 Ut.29 De.26 St.22",
  "Nationalist Kemalism": "Pr.5 De-.5 St.5 Em.4 Id-.4 Ra.3 Ma.2",
  "National Collectivism": "Ex-.7 De-.7 Ut-.5 Ma.39 St.37 Ra-.35 Ni-.35",
  "Nazi-Maoism": "De-.7 Ex-.67 Ut-.55 Ra-.43 Ma.33 Ni-.29 St.25 Id.24",
  "Savinkovism": "De-.69 Ex-.62 Ut-.34 Ra-.31 Ni-.31 Id.3 Em-.28 St.28",
  "Mosleyism": "De-.7 Ex-.66 Ni-.45 Ut-.39 Id.36 St.32 Ma-.27",
  "Revolutionary Nationalism": "Ma.54 Ex.28 Ut-.14",
  "Volkism": "Ra-.62 Ma-.54 Ex-.54 Ut-.54 Id.5 De-.5 Em-.38 Ni-.36 Pr-.21",
  "Optimateism": "St.49 De.31 Id.28",
  "Integralism": "Id.9 Ma-.8 Ni-.8 De.6 St.5 Ex-.5 Ut-.4 Em-.2",
  "National Capitalism": "Ut-.46 Ma-.38 Pr-.28",
  "Carlism": "Id.9 Ma-.8 Ni-.8 De.6 St.5 Ex-.5 Ut-.4 Em-.2",
  "Autocratic Monarchism": "De-.45 Ut-.36 Ra-.31 Id.28 Em-.22",
  "Theocratic Distributism": "Id.9 Ma-.8 Ni-.8 De.6 St.5 Ex-.5 Ut-.2 Em-.2",
  "Reactionary Feudalism": "St.43 Em-.42 Ut-.24 Ra-.22",
  "Neo-Absolutism": "Ut-.38 De-.32 Ra-.27 Em-.27",
  "Aristocratic Cameralism": "St.5 Pr.5 Ra.3 Ut.3",
  "Feudal Monarchism": "Ra-.35 Em-.35 St.35 Id.3 Ut-.28",
  "Clerical Monarchism": "Id.9 Ma-.8 Ni-.8 De.6 St.5 Ex-.5 Ut-.4 Em-.2",
  "Developmental Theocracy": "Id.9 Ma-.8 Ni-.8 De.6 St.5 Ex-.5 Ut-.4 Em-.2",
  "Classical Eurasianism": "Id.5 De-.4 Ma-.4 St.3",
  "Mladorossism": "Id.6 Ni-.5 St.4 Ex-.3 Pr.3",
  "National Social Capitalism": "De-.4 Ut-.4 Pr.4",
  "Right-State Liberalism": "Pr.5 De.4 Em.3",
  "Monarquia Syndicalista": "Id.56 De.4 Ra-.38 St.38 Em-.31 Ni-.28",
  "Serenissimism": "Ma-.51 Pr.5 Id.3",
  "National Conservatism": "Pr.5 Id.3 St.3 Ra-.3",
  "Paternalistic Conservatism": "Pr.7 Ut.4 Id.3 St.3 Ra-.3",
  "Buchanan Paleoconservatism": "Pr.5 Id.3 St.3 Ra-.3",
  "Hard Right Paleoconservatism": "Pr.5 Id.3 St.3 Ra-.3",
  "Old Right Paleoconservatism": "Pr.5 Id.3 St.3 Ra-.3",
  "Neoconservatism": "Pr.4 De.3 Ut.24",
  "Mesoconservatism": "Pr.5 Id.3 St.3 Ra-.3",
  "Red Toryism": "Id.6 St.4 Pr.4 De.4 Ma-.3",
  "Green Conservatism": "Pr.5 Id.3 St.3 Ra-.3",
  "Clerical Conservatism": "Id.9 Ma-.8 Ni-.8 De.6 St.5 Ex-.5 Ut-.4 Em-.2",
  "Gaullism": "Pr.5 Id.2 St.2",
  "Free-Market Conservatism": "De.5 Pr.4 Id.2 St.2 Ra-.2",
  "Agrarian Conservatism": "Pr.5 Id.3 St.3 Ra-.3",
  "Liberal Toryism": "Pr.5 Id.3 St.3 Ra-.3",
  "Social Gaullism": "Pr.5 Id.2 St.2",
  "Neo-Gaullism": "Pr.5 Id.2 St.2",
  "Bonapartist Gaullism": "Pr.5 Id.2 St.2",
  "Conservative Atlanticism": "Pr.5 Ut.2 De.2",
  "Neoconservative Atlanticism": "Pr.5 Ut.2 De.2",
  "One-Nation Conservatism": "Pr.7 Ut.4 Id.3 St.3 Ra-.3",
  "Conservative Kemalism": "Em.6 Ra.5 Pr.5 St.3 Ma.2",
  "Conservative Technoliberalism": "Pr.5 Ut.2 De.2",
  "Right-Social Authoritarianism": "Ex-.38 De-.3 Id.19",
  "Kjærsgaardism": "Pr.5 Id.3 St.3 Ra-.3",
  "Kekkonism": "Pr.5 Ut.2 De.2",
  "Reform Gaullism": "Pr.5 Id.2 St.2",
  "Paleoconservatism": "Pr.5 Id.3 St.3 Ra-.3",
  "Putinism": "Pr.7 De-.7 Ex-.5 Id.3 St.3 Ut-.3",
  "Post-Soviet Autocracy": "Pr.7 De-.7 Ex-.5 Ut-.2",
  "Radicalism": "Ra.6 Em.5 Ut.5 Pr.4 Ex.4 Id-.3 De.3",
  "Third Way": "Pr.53 Ut.34 De.24",
  "Christian Democracy": "Id.6 Ni-.6 De.5 Ma-.4 Pr.4 Ut.3",
  "Compassionate Conservatism": "Id.5 Pr.4 St.3 Ut.3 De.3",
  "Rockefeller Republicanism": "Pr.5 Ut.2 De.2",
  "Democratic Transhumanism": "Ut.54 Ra.46 Em.32 Ma.2",
  "Neo-Solidarism": "Ut.3 Pr.26 Em.2",
  "Steppe Eurasianism": "Id.5 De-.4 Ma-.4 St.3",
  "Classical Kemalism": "Em.6 Ra.5 Pr.5 Ma.4 Id-.4",
  "Centrist Kemalism": "Em.6 Ra.5 Pr.5 Ma.4 Id-.4",
  "Catholic Social Teaching": "Id.8 Ni-.8 De.7 Ma-.6 St.3 Pr.2",
  "Bleeding-Heart Authoritarianism": "Pr.5 Ut.4 De-.4 Ex-.3",
  "Austro-Corporatism": "Id.6 Ni-.6 Ma-.5 De.4 St.3 Pr.3",
  "Davos System": "Pr.8 Ut.6 Em.6 Ra.5",
  "Nordic Model": "Ut.6 Pr.5 Em.3",
  "Social Democracy": "Ut.5 Pr.5 Em.3",
  "Conservative Social Democracy": "Ut.5 Pr.5 Em.3 Id.2 St.2",
  "Social Distributism": "De.6 Ni-.6 Id.5 Ma-.4 Ut-.3",
  "Eurocommunism": "Id-.8 Ma.6 Ra.4 Em.4 Pr.4 De.3 Ni-.3 Ex.2",
  "Liberal Socialism": "De.62 Ex.56 Ra.45 Ut.33 Pr.24 Ma.23",
  "Social Georgism": "Ut.5 Pr.5 Em.3",
  "Agrarian Social Democracy": "Ut.5 Pr.5 Em.3",
  "Progressive Corporatism": "Pr.32 Ut.3",
  "Left-Gaullism": "Pr.5 Id.2 St.2",
  "Labour Atlanticism": "Ut.5 Pr.5 Em.3",
  "Green Social Democracy": "Ut.51 Pr.35 Em.21",
  "Geo-Social Democracy": "Ut.5 Pr.5 Em.3",
  "Christian Social Democracy": "Id.6 Ni-.5 De.4 Ut.4 Pr.4 Ma-.3",
  "Police Labourism": "Ut.5 Pr.5 Em.3",
  "Ecevitism": "Em.6 Ra.5 Ma.5 Pr.5 Ut.5 Id-.4",
  "Left-Social Authoritarianism": "Pr.5 Ut.4 De-.4 Ex-.3",
  "Progressive Social Authoritarianism": "Pr.5 Ut.4 De-.4 Ex-.3",
  "Left-Wing Populism": "Pr.5 Ut.3 Ma.2",
  "Left-Social Democracy": "Ut.5 Pr.5 Em.3",
  "Social-Helveticism": "Ut.5 St.26 De.23",
  "Left Kemalism": "Em.6 Ma.6 Ra.5 Pr.5 Id-.4 Ut.4",
  "Longism": "Pr.61 Ut.45 Em.22",
  "Classical Liberalism": "De.7 Ra.5 Em.5 Ex.4 Pr.3 Ut.3",
  "Neoliberalism": "Em.5 Ut.4 Ra.4 Pr.4",
  "National Liberalism": "Pr.5 Ut.2 De.2",
  "Social Liberalism": "Ut.5 De.4 Ra.4 Em.4 Pr.4",
  "Ordoliberalism": "Pr.39 Ma-.31 Ra.2",
  "Bleeding-Heart Liberalism": "Ut.5 De.41 Ra.26",
  "Bleeding-Heart Libertarianism": "De.63 Ra.3 Ex.26",
  "Geo-Liberalism": "De.4 Ut.24 Ra.17",
  "Green Liberalism": "Ut.37 Pr.34 Ra.32 De.31 Em.29",
  "Whiggism": "Pr.5 Em.4 De.4",
  "Muscular Liberalism": "Pr.5 Ut.2 De.2",
  "Liberal Atlanticism": "De.45 Ex.26 Ra.19",
  "Transatlantic Federalism": "Pr.5 Ut.2 De.2",
  "New Deal Liberalism": "Pr.8 Ut.6 Em.4",
  "Venizelism": "Pr.5 Ut.2 De.2",
  "Liberal Kemalism": "Em.6 Ra.5 Pr.5 Ma.4 Id-.4",
  "Liberal Social Authoritarianism": "Pr.5 Ut.4 De-.4 Ex-.3",
  "Techno-Social Liberalism": "Ut.3 De.3 Pr.22",
  "Technoliberalism": "De.5 Ex.27 Ra.25",
  "American Model": "De.47 Ex.26 Ra.14",
  "Techno-Neoliberalism": "Ra.54 Ut.41 Pr.34 De.34 Em.31 St.22",
  "Tsaingwenism": "Pr.37 Em.31 Ut.31 De.29",
  "Liberal Imperialism": "Pr.7 Ut.4 De-.3 Ra.3",
  "Liberal Meritocracy": "Ra.6 Pr.6 Em.5 Ut.5 De.4 Ex.3",
  "Christian Socialism": "Id.7 Ni-.7 De.4 Ma-.3 Ut.3",
  "National Bolshevism": "De-.6 Ma.34 Ra-.3 Ex-.26 Ut-.25",
  "Democratic Socialism": "Ex.5 Pr.46 Ut.46 De.41 Ra.27 Ma.22",
  "Conservative Socialism": "Ra-.29 Em-.29 Pr.24 St.23 Ma.2",
  "Paleosocialism": "Pr.5 Ut.3 Ma.2",
  "Cybernetic Socialism": "Ma.9 Id-.8 Ra.6 Em.6 Ut.4 Pr.3 Ni-.3 De-.2",
  "Utopian Communitarianism": "Ni-.38 Ut.38 Id.34 Pr-.31 Ra.26",
  "Syndicalist Republicanism": "Ut.3 Ma.27 De.26",
  "Left-Eurasianism": "Ma.4 De-.4 Id.3 St.2",
  "Socialist Kemalism": "Em.6 Ma.6 Ra.5 Pr.5 Id-.4 Ut.4",
  "Socialist Technoliberalism": "De.38 Ra.24 Ma.23 Ex.22",
  "Mugabeism": "De-.4 Pr.4 Ma.3 Ex-.3",
  "Old Left-Populism": "Pr.5 Ut.3 Ma.2",
  "Left-State Liberalism": "Ut.6 Pr.5 Em.3 Ra.3",
  "American Technocracy": "Ma.68 Ut.62 Ra.61 Em.58 Id-.57 De-.39 Pr.3",
  "Fabian Socialism": "Pr.8 Ut.8 Em.7 Ra.4",
  "Ujamaa": "Pr.42 De-.3 Id.28",
  "Bordigism": "Ma.9 Id-.8 Ra.4 Em.4 De-.4 Pr.3 Ni-.3",
  "Italian Left Communism": "Ma.9 Id-.8 Ra.4 Em.4 De-.4 Pr.3 Ni-.3",
  "Juche": "De-.6 Ex-.6 St.4 Id.3 Ma.3",
  "Mao Zedong Thought": "Ma.9 Id-.8 Ra.4 Em.4 De-.4 Pr.3 Ni-.3",
  "Maoism Third Worldism": "Ma.9 Id-.8 Ra.4 Em.4 De-.4 Pr.3 Ni-.3",
  "Marxism Leninism Maoism": "Ma.9 Id-.8 Ra.4 Em.4 De-.4 Pr.3 Ni-.3",
  "Luxemburgism": "Ma.9 Id-.8 Ra.4 Em.4 Pr.3 Ni-.3 Ex.3 De.2",
  "Trotskyism": "Ma.9 Id-.8 Ra.4 Em.4 De-.4 Pr.3 Ni-.3",
  "Marxism-Leninism": "Ma.9 Id-.8 Ra.4 Em.4 De-.4 Pr.3 Ni-.3",
  "Stalinism": "Ma.9 Id-.8 Ex-.7 De-.6 Ra.4 Em.4 Pr.3 Ni-.3",
  "Titoism": "Ma.9 Id-.8 Ra.4 Em.4 De-.4 Pr.3 Ni-.3",
  "Dengism": "Pr.9 Ma.5 Id-.5 Em.5 Ra.4 De-.4 Ni-.3",
  "Hoxhaism": "Ma.9 Id-.8 Ra.4 Em.4 De-.4 Pr.3 Ni-.3",
  "Castroism": "Id-.8 Ma.7 Ra.4 Em.4 St.4 Pr.3 De-.3 Ni-.3 Ex.2",
  "Guevarism": "Id-.8 Ma.7 Ra.4 Em.4 St.4 Pr.3 De-.3 Ni-.3 Ex.2",
  "Cyber-Communism": "Ma.9 Id-.8 Ra.6 Em.6 Ut.4 Pr.3 Ni-.3 De-.2",
  "De Leonism": "Ma.9 Id-.8 Ra.4 Em.4 De-.4 Pr.3 Ni-.3",
  "Marxism-Kemalism": "Ma.9 Id-.8 Ra.6 Em.6 Ut.4 Pr.3 Ni-.3 De-.2",
  "National Communism": "Ma.72 De-.69 Id-.66 Pr.66 Ut.62 Em.59 Ra.5 Ni.48 St.23",
  "Libertarian Municipalism": "Ma.5 Ra.5 Ex.3 Ut.2 De.2 Id-.2",
  "Communalism": "Ma.5 Ra.5 Ex.3 Ut.2 De.2 Id-.2",
  "Minarcho-Socialism": "De.5 Ex.4 Ma.3",
  "Libertarian Socialism": "Ex.66 De.57 Ma.51 Pr.32 Ra.24 Ut.24",
  "Council Communism": "Ma.9 Id-.8 Ra.4 Em.4 Pr.3 Ni-.3 Ex.3 De.2",
  "Democratic Confederalism": "De.49 Ut.46 Ra.3 Ex.3 Ma.29 Em.22",
  "Guild Socialism": "Ma.4 Pr.4 Ut.3",
  "Eco-Socialism": "Pr.39 De-.24 Ma.17",
  "Cybersyn Socialism": "Ma.9 Id-.8 Ra.6 Em.6 Ut.4 Pr.3 Ni-.3 De-.2",
  "Fourierism": "Id.36 Ni-.33 St-.22 De-.22",
  "Gandhian Socialism": "Ni-.7 Id.6 De.6 St.5 Ma-.4 Ex.2",
  "Scythianism": "Id.7 Ma-.3 Ni.2",
  "Proutism": "Ra.25 De.24 Ut.22",
  "Geolibertarianism": "De.65 Ma-.38 Ut-.3 Ex.28 Id.24 Ra.22",
  "Social Libertarianism": "De.49 Ut.34 Ex.22",
  "Helvetic Model": "De.38 St.26 Pr.13",
  "Minarcho-Distributism": "De.6 Ni-.6 Id.5 Ma-.4 Ut-.3",
  "Pirate Politics": "De.49 Ex.29 Ra.18",
  "Agorist Minarchism": "De.63 Ex.44 Ut-.21",
  "Communal Distributism": "De.6 Ni-.6 Id.5 Ma-.4 Ut-.3",
  "Yangism": "Ut.7 Pr.6 Em.5 Ra.4",
  "Libertarian Social Democracy": "Ut.51 De.46 Ex.19",
  "Progressive Helveticism": "Ut.37 De.35 Em.26 St.25 Pr.22",
  "Cosmopolitan Distributism": "De.6 Ni-.3 Ut.3 Ex.3 Id.2",
  "Cyber-Federalism": "De.64 Ex.61 Pr.52 Ra.25 Ut.24",
  "Neolibertarianism": "De.5 Pr.4 Em.2 Ex.2",
  "Libertarian Conservatism": "De.6 Id.3 St.3 Pr.3",
  "National Libertarianism": "De.5 Pr.4 Em.2 Ex.2",
  "Paleolibertarianism": "De.62 Ma-.53 Id.49 Ut-.35 Pr-.26",
  "Dark Enlightenment": "Pr.4 De-.4 Ut-.3 St.2",
  "Cyber-Libertarianism": "De.65 Ex.39 Ra.14",
  "Objectivism": "Ra.95 Ni-.9 Id-.8 Ut-.6 Pr-.5 Em.4 Ma.4 Ex.3 De.3",
  "Fusionism": "Id.66 De.66 Ma-.62 St.35 Ut-.35 Em-.27 Ni-.26 Ra-.22",
  "Minarcho-Avaritionism": "Ex.49 Ut-.27 St-.24 Ni.23",
  "Libertarian Helveticism": "De.49 St.26 Pr-.19",
  "Yarvinism": "Pr.6 De-.5 St.3 Ut.2 Ra.2",
  "Landianism": "Ni.6 De-.5 Ma.3 Ut-.3 St-.3 Ex.2",
  "Anarcho-Syndicalism": "Ex.7 Ma.6 Id-.5 Ra.4 Em.4 De.4 Ni-.3 Ut.2",
  "Platformism": "Ex.7 Ma.6 Id-.5 Ra.4 Em.4 De.4 Ni-.3 Ut.2",
  "Left-Agorism": "Ex.58 De.54 Ut.22",
  "Lys Noir": "Pr-.25 Ra-.24 Id.18",
  "Anarcho-Communism": "Ex.7 Ma.6 Id-.5 Ra.4 Em.4 De.4 Ni-.3 Ut.2",
  "Solarpunk Anarchism": "De.5 Ex.35 Ut.31 Em.22 Ma.22 Ra.2",
  "Christian Anarchism": "Id.8 De.8 Ni-.8 Ma-.7 Ex.3 St.3",
  "Insurrectionary Anarchism": "Ex.8 Ni.6 St-.4 Ut-.4 Pr-.3 De-.2",
  "Catholic Workerism": "Id.8 Ni-.8 De.7 Ma-.6 St.3 Ut-.2",
  "Mutualism": "Ma-.34 Ex.26 Id.23 Ut-.22",
  "Market Anarchism": "De.68 Ex.67 Pr-.34 Ma.26 Ra.21",
  "Mutualist Distributism": "De.6 Ni-.3 Ut-.3 Ex.3 Id.2 Ma-.2",
  "Panarchism": "Ex.63 De.59 Pr-.26 Ra.22",
  "Geoanarchism": "De.64 Ex.45 Pr-.31",
  "Green Anarchism": "De.49 Ex.37 Em.14",
  "Anarcho-Primitivism": "Ex.49 Pr-.46 De.34 Ra-.33 St.3 Ni.29 Em-.24 Ma-.24 Ut-.22 Id.21",
  "Post-Anarchism": "Ex.6 De.5 Ra-.22 Pr-.2",
  "Post-left": "Ex.8 Ni.6 St-.4 Ut-.4 Pr-.3 De-.2",
  "Anarcho-Transhumanism": "Ex.5 De.5 Ra.35 Ma.26 Pr-.21 St-.21 Ut.2",
  "Ego-Communism": "Ex.9 Ni.5 Ut-.5 St-.5 De-.4 Id-.3 Pr.2",
  "National-Anarchism": "Ut-.58 Ra-.48 Pr-.45 Id.42 Ma-.35 Em-.3 St.26 De.25 Ni-.2",
  "Ego-Mutualism": "Ex.9 Ni.5 Ut-.5 St-.5 De-.4 Id-.3 Pr.2",
  "Anarcho-Capitalism": "De.71 Ex.69 Ma-.6 Id.38 Ut-.31",
  "Hoppeanism": "De.46 Pr-.43 Ex.3 Ma-.26 Id.25 Ut-.22",
  "Bleeding-Heart Anarcho-Capitalism": "De.66 Ex.47 Pr-.33 Ut.26",
  "Traditionalist Anarcho-Distributism": "Id.7 De.7 Ni-.6 Ma-.4 Ut-.3 Ex.2",
  "Crypto-Anarchism": "De.69 Ex.58 Pr-.26 Ra.2",
  "Avaritionism": "Ex.9 Ni.5 Ut-.5 St-.5 De-.4 Id-.3 Pr.2",
  "Autarchism": "Ex.67 De.66 Pr-.34 Ut-.3",
  "Free-Market Anarcho-Distributism": "De.7 Ma-.4 Ex.4 Id.3 Ni-.3 Ut-.2",
  "Agorism": "Ex.72 De.7 Ni.48 Ut-.46 St-.39 Ra.33 Ma-.28",
  "Left-Accelerationism": "Ma.6 Pr.4 Ut.3 De-.3 Ra.3",
  "Right-Accelerationism": "Ni.5 De-.4 Ex.3 Ut-.3 Pr.2",
  "Effective Accelerationism": "Ut.5 Ra.5 Em.4 Pr.4 Ma.4 St-.3",
  "Unconditional Accelerationism": "Ni.8 De-.6 Ut-.5 St-.5 Ex.3 Ra-.3 Ma.3",
  "Neo-Libertarian Falangism": "Id.45 Ut-.41 Ma-.22 De.22 Ra-.2 Em-.2",
  "Ingsoc": "Ex-.9 De-.9 Em-.9 Ra-.6 Id.6 Ma-.4 Ut-.4 Ni.3",
  "Neo-Bolshevism": "Ma.9 Id-.8 Ra.4 Em.4 De-.4 Pr.3 Ni-.3",
  "Obliteration of the Self": "Ex-.9 De-.7 Id.3 Ni.2",
  "World State Fordism": "Ut.9 Ex-.8 De-.8 St-.7 Ma.6 Em.6 Pr.6 Ra.5 Ni.3",
  "Gileadism": "Id.9 Ex-.9 Ma-.8 Ni-.8 Em-.6 St.5 Ra-.5 Ut-.4 Pr-.4 De.2",
  "One State Benefactorism": "Ra.9 Ex-.9 Ut.8 De-.7 Em.5 Ma.5 St.2",
  "Cyberpunk Corpostatism": "De-.5 Ma.5 Pr.5 Ni.4 St-.4 Ut.2",
  "Fireman Statism": "Ex-.8 De-.7 Em-.6 Ut.5 Ra-.5 Ni.3",
  "Soylentism": "De-.8 Ut.6 Ex-.6 Ma.5 Ni.3 Em.3",
  "Burgundian System": "De-.72 Ex-.7 Ra-.67 Ut-.58 St.54 Em-.5 Pr-.36 Ni.32",
  "Russian Imperial Cult": "Id.9 Ma-.8 St.7 Ex-.7 Ut-.6 Em-.6 Ni-.5 Ra-.5",
  "Nihilist Anarchism": "Ni.95 Ex.8 Id-.7 De-.5 Ut-.5 St-.5 Ma.3",
  "Paetel's National Bolshevism": "Ma.62 De-.5 Ra-.3 St.24 Pr.2",
  "National Radicalism": "Ra-.72 Ma-.72 Id.72 Ex-.72 Ni-.72 St.72 Em-.71 Ut-.71 De-.71 Pr.55",
  "Anarcho-Fascism": "Ut-.7 Ra-.61 Id.55 Pr-.5 Ma-.46 St.45 Em-.43 De.22"
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
  for (const id of PHILOSOPHY) delete parsed[id];
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
for (const id of PHILOSOPHY) if (!(id in iconSources)) iconSources[id] = "ai";
source = source.slice(0, iconDecl.start) +
  `const iconSources = ${JSON.stringify(iconSources, null, 4)};` + source.slice(iconDecl.end);

tree.philosophy = philosophyTree;

const stamp = "backup-philosophy-rework-" + new Date().toISOString().replace(/[:.]/g, "-");
for (const f of [dataPath, treePath, scoresPath]) fs.copyFileSync(f, `${f}.${stamp}`);
fs.writeFileSync(dataPath, source, "utf8");
fs.writeFileSync(treePath, JSON.stringify(tree, null, 2) + "\n", "utf8");
fs.writeFileSync(scoresPath, JSON.stringify(jsonScores, null, 4) + "\n", "utf8");

console.log("Philosophy rework finished.");
console.log(`Question tree: ${philosophyTree.length} nodes (4 branches, 10 philosophies).`);
console.log(`Value descriptions added: ${described} (existing ones kept).`);
console.log(`Ideologies with new philosophy stances: ${updated} of ${Object.keys(ideologyScores).length}.`);
if (unknown.length) console.log("Names in STANCES not found in data.js:", unknown.join(", "));
if (missing.length) console.log("Ideologies without new stances (kept as they were):", missing.join(", "));
console.log(`Backups: *.${stamp}`);
