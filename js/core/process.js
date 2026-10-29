// Process diagrams: a built-in set of man-made processes and natural cycles,
// the question, and the language — present simple throughout, the passive
// as the default for man-made stages, sequencing markers, and an overview
// that characterises the process (CLAUDE-task1.md, type 1). Pure.
//
// ProcessVisual = {
//   kind: 'process', id, title, cycle: boolean, natural: boolean,
//   how: 'how bricks are made for the building industry',      // the question
//   howAlt: 'how bricks are produced for the construction industry', // a paraphrase
//   nominal: 'the production of bricks',
//   starts: 'the digging of clay', ends: 'the delivery of the bricks',
//   characterise: 'Overall, the process … [[requiring]] …',   // one [[ ]]
//   steps: [{ label, sentence }],      // sentence: one [[ ]] around the verb
// }
import { pickOne } from './rng.js';
import { numberWord, capitalise } from './english.js';
import { countMarks, markedParts, stripMarks } from './marked.js';
import { isObject } from './json.js';

const S = (label, sentence) => ({ label, sentence });

export const PROCESSES = [
  {
    id: 'bricks', title: 'Brick manufacturing', cycle: false, natural: false,
    how: 'how bricks are manufactured for the building industry', howAlt: 'how bricks are produced for the construction industry',
    nominal: 'the production of bricks', starts: 'the digging of clay', ends: 'the delivery of the finished bricks',
    characterise: 'Overall, the process is largely mechanised, [[involving]] heavy machinery or high temperatures at almost every stage.',
    steps: [
      S('Digging the clay', 'The clay [[is dug]] from the ground using a large digger.'),
      S('Sieving', 'The clay [[is placed]] on a metal grid, which removes stones and roots.'),
      S('Mixing and moulding', 'It [[is mixed]] with sand and water and then shaped in a mould or cut with a wire cutter.'),
      S('Drying', 'The raw bricks [[are left]] to dry in a drying oven for 24 to 48 hours.'),
      S('Firing in a kiln', 'They [[are heated]] in a kiln at temperatures rising from 200°C to 1,300°C.'),
      S('Cooling', 'The fired bricks [[are cooled]] in a cooling chamber for up to three days.'),
      S('Packing and delivery', 'The bricks [[are packed]] and delivered to building sites.'),
    ],
  },
  {
    id: 'glass', title: 'Recycling glass bottles', cycle: true, natural: false,
    how: 'how glass bottles are recycled', howAlt: 'the way in which used glass bottles are turned into new ones',
    nominal: 'the recycling of glass bottles', starts: 'the collection of used bottles', ends: 'the filling of new ones',
    characterise: 'Overall, the process is cyclical, [[turning]] used bottles into new ones in seven stages.',
    steps: [
      S('Collection', 'Used glass bottles [[are collected]] from collection points.'),
      S('Transport', 'They [[are taken]] by truck to a recycling plant.'),
      S('Cleaning', 'At the plant, the bottles [[are washed]] with high-pressure water jets.'),
      S('Sorting', 'They [[are sorted]] into green, brown and clear glass.'),
      S('Crushing and melting', 'The sorted glass [[is crushed]] and melted in a furnace.'),
      S('Moulding', 'The molten glass [[is poured]] into moulds to make new bottles.'),
      S('Filling and sale', 'The new bottles [[are filled]] and returned to shops, ready to be used again.'),
    ],
  },
  {
    id: 'chocolate', title: 'Chocolate production', cycle: false, natural: false,
    how: 'how chocolate is produced', howAlt: 'the stages in making chocolate from cocoa beans',
    nominal: 'the production of chocolate', starts: 'the harvesting of cocoa pods', ends: 'the making of liquid chocolate',
    characterise: 'Overall, the process begins on a farm and ends in a factory, [[combining]] natural stages with industrial ones.',
    steps: [
      S('Harvesting the pods', 'Ripe red cocoa pods [[are harvested]] from cocoa trees.'),
      S('Removing the beans', 'The pods [[are cut]] open and the white beans are removed.'),
      S('Fermenting', 'The beans [[are left]] to ferment for several days.'),
      S('Drying in the sun', 'They [[are spread]] out on large trays and dried in the sun.'),
      S('Transport', 'The dried beans [[are packed]] into sacks and transported by train and ship.'),
      S('Roasting', 'At the factory, the beans [[are roasted]] at around 350°C.'),
      S('Crushing', 'The outer shells [[are removed]] and the inner beans are crushed.'),
      S('Liquid chocolate', 'The crushed beans [[are turned]] into liquid chocolate.'),
    ],
  },
  {
    id: 'paper', title: 'Recycling paper', cycle: false, natural: false,
    how: 'how waste paper is recycled', howAlt: 'the process by which waste paper is turned into new paper',
    nominal: 'the recycling of waste paper', starts: 'the collection of waste paper', ends: 'the winding of new paper onto reels',
    characterise: 'Overall, waste paper goes through six main stages [[before being turned]] into new paper.',
    steps: [
      S('Collection', 'Waste paper [[is collected]] from homes, offices and recycling banks.'),
      S('Sorting', 'It [[is sorted]] by grade at a recycling centre.'),
      S('Pulping', 'The paper [[is mixed]] with water and chemicals, which break it down into pulp.'),
      S('Cleaning', 'The pulp [[is screened]] to remove ink, glue and staples.'),
      S('Pressing and drying', 'It [[is pressed]] between rollers and dried.'),
      S('Rolling', 'The new paper [[is wound]] onto large reels.'),
    ],
  },
  {
    id: 'hydro', title: 'Pumped-storage hydroelectric power', cycle: true, natural: false,
    how: 'how electricity is generated in a pumped-storage hydroelectric power station', howAlt: 'how a pumped-storage hydroelectric power station produces electricity',
    nominal: 'the generation of hydroelectric power', starts: 'the storage of water in a high-level reservoir', ends: 'the pumping of water back up at night',
    characterise: 'Overall, the system [[operates]] in a daily cycle, generating power by day and pumping water back by night.',
    steps: [
      S('Storing water', 'Water [[is stored]] in a high-level reservoir behind a dam.'),
      S('Releasing water by day', 'During the day, the water [[is released]] through an intake.'),
      S('Driving the turbines', 'It [[flows]] down to the power station, where it drives the turbines.'),
      S('To the grid', 'The electricity produced [[is fed]] into the national grid.'),
      S('Low-level reservoir', 'The water [[is held]] in a low-level reservoir.'),
      S('Pumping back at night', 'At night, the turbines [[are reversed]] to pump the water back up to the high-level reservoir.'),
    ],
  },
  {
    id: 'water-cycle', title: 'The water cycle', cycle: true, natural: true,
    how: 'the water cycle', howAlt: 'how water moves between the oceans, the air and the land',
    nominal: 'the water cycle', starts: 'evaporation from the oceans', ends: 'the return of water to the sea',
    characterise: 'Overall, the water cycle is a continuous natural process, [[driven]] by the heat of the sun.',
    steps: [
      S('Evaporation', 'Heat from the sun [[causes]] water in the oceans to evaporate.'),
      S('Condensation', 'As the water vapour rises, it [[cools]] and condenses into clouds.'),
      S('Precipitation', 'The water [[falls]] back to the ground as rain or snow.'),
      S('Surface run-off', 'Some of it [[runs]] into rivers and lakes.'),
      S('Infiltration', 'The rest [[soaks]] into the ground and becomes groundwater.'),
      S('Return to the sea', 'Eventually, both [[flow]] back into the sea, and the cycle begins again.'),
    ],
  },
  {
    id: 'frog', title: 'The life cycle of a frog', cycle: true, natural: true,
    how: 'the life cycle of a frog', howAlt: 'the stages in the development of a frog, from egg to adult',
    nominal: 'the life cycle of a frog', starts: 'the laying of eggs', ends: 'the emergence of an adult frog',
    characterise: 'Overall, the frog [[passes through]] five distinct stages, from egg to adult.',
    steps: [
      S('Frogspawn', 'The adult female [[lays]] thousands of eggs in water, known as frogspawn.'),
      S('Tadpole', 'After about ten days, the eggs [[hatch]] into tadpoles.'),
      S('Back legs', 'Over the next few weeks, the tadpoles [[develop]] back legs.'),
      S('Front legs', 'The tadpoles [[grow]] front legs, and their tails gradually shrink.'),
      S('Adult frog', 'The young frog [[leaves]] the water, and when it matures, the cycle begins again.'),
    ],
  },
  {
    id: 'olive-oil', title: 'Olive oil production', cycle: false, natural: false,
    how: 'how olive oil is produced', howAlt: 'the stages involved in making olive oil',
    nominal: 'the production of olive oil', starts: 'the harvesting of the olives', ends: 'the bottling of the oil',
    characterise: 'Overall, the production of olive oil [[involves]] seven stages, most of which are mechanised.',
    steps: [
      S('Harvesting', 'The olives [[are picked]] by hand or shaken from the trees by machine.'),
      S('Washing', 'They [[are washed]] to remove leaves and dirt.'),
      S('Crushing', 'The olives [[are crushed]], stones and all, into a thick paste.'),
      S('Mixing', 'The paste [[is stirred]] slowly for about 30 minutes.'),
      S('Separating', 'A centrifuge [[separates]] the oil from the water and solids.'),
      S('Settling', 'The oil [[is stored]] in steel tanks to settle.'),
      S('Bottling', 'The oil [[is filtered]] and bottled for sale.'),
    ],
  },
];

export function generateProcess(rng, { id = null } = {}) {
  const p = (id && PROCESSES.find((x) => x.id === id)) || pickOne(rng, PROCESSES);
  return { kind: 'process', ...structuredClone(p) };
}

export function processRubric(p) {
  return `The diagram below shows ${p.how}.`;
}

const SEQUENCE = ['First,', 'Next,', 'After that,', 'Following this,', 'Subsequently,', 'At this stage,', 'Once this is done,'];

// A stage sentence with a sequencing marker in front. Every other stage drills
// the marker instead of the verb, so both get practised. A stage that already
// opens with a time phrase ("During the day", "Eventually") keeps it instead.
function stageLine(step, i, n) {
  const s = step.sentence;
  if (/^(During|At |After |Over |Eventually|As |Once |When |Then |Finally)/.test(stripMarks(s))) return { text: s, focus: 'sequence' };
  const marker = i === 0 ? 'First,' : i === n - 1 ? 'Finally,' : SEQUENCE[1 + ((i - 1) % (SEQUENCE.length - 1))];
  const body = s.charAt(0).toLowerCase() + s.slice(1);
  if (i % 2 === 1) return { text: `[[${marker}]] ${stripMarks(body)}`, focus: 'sequence' };
  return { text: `${marker} ${body}`, focus: 'sequence' };
}

export function describeProcess(p) {
  const n = p.steps.length;
  const noun = p.natural ? 'diagram' : 'flow chart';
  const intro = [
    { text: `The diagram [[illustrates]] ${p.howAlt}.`, focus: 'intro' },
    p.natural
      ? { text: `The diagram [[sets out]] the main stages of ${p.nominal}.`, focus: 'intro' }
      : { text: `The ${noun} sets out [[the stages involved in]] ${p.nominal}.`, focus: 'intro' },
  ];
  const overview = [
    { text: `Overall, there are ${numberWord(n)} main stages in the ${p.natural ? 'cycle' : 'process'}, [[beginning with]] ${p.starts} and ending with ${p.ends}.`, focus: 'overview' },
    { text: p.characterise, focus: 'overview' },
  ];
  if (p.cycle) overview.push({ text: `The ${p.natural ? 'cycle' : 'process'} is [[continuous]]: the final stage leads back to the first.`, focus: 'overview' });
  const body = p.steps.map((s, i) => stageLine(s, i, n));
  return { intro, overview, body };
}

// A process written by Claude: { title, how?, cycle?, natural?, steps: [{ label, sentence? }] }.
export function validateProcess(input) {
  const problems = [];
  if (!isObject(input)) return { process: null, problems: ['Not a process.'] };
  const steps = (Array.isArray(input.steps) ? input.steps : [])
    .map((s) => (typeof s === 'string' ? { label: s } : isObject(s) ? s : null))
    .filter(Boolean)
    .map((s) => {
      const label = String(s.label || '').trim().slice(0, 60);
      let sentence = String(s.sentence || '').trim();
      if (sentence && countMarks(sentence) !== 1) sentence = '';
      return label ? { label, sentence: sentence || `${capitalise(label)} [[takes place]].` } : null;
    })
    .filter(Boolean)
    .slice(0, 12);
  if (steps.length < 3) return { process: null, problems: ['A process needs at least three stages.'] };
  const title = String(input.title || 'Process').trim().slice(0, 80);
  const how = String(input.how || title.toLowerCase()).trim();
  const p = {
    kind: 'process',
    id: 'claude',
    title,
    cycle: !!input.cycle,
    natural: !!input.natural,
    how,
    howAlt: String(input.howAlt || how).trim(),
    nominal: String(input.nominal || `the ${title.toLowerCase()} process`).trim(),
    starts: String(input.starts || steps[0].label.toLowerCase()).trim(),
    ends: String(input.ends || steps[steps.length - 1].label.toLowerCase()).trim(),
    characterise: countMarks(String(input.characterise || '')) === 1 ? String(input.characterise) : `Overall, the process [[consists of]] ${numberWord(steps.length)} stages.`,
    steps,
  };
  if (!markedParts(p.characterise)) problems.push('The overview sentence was replaced.');
  return { process: p, problems };
}
