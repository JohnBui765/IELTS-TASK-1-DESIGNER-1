// The built-in starter set, made from CLAUDE-task1.md (the owner's Task 1
// reference, built on Cambridge English Mindset for IELTS 1–3). Entries the
// reference marks [M] are printed in Mindset; `m: true` keeps that mark.
// Every example is written for this app, set in a different Task 1
// situation, with the drilled words in [[ ]]. Bump CORE_VERSION after any
// change so installed apps pick it up (seed.js).

export const CORE_VERSION = '1';

const E = (slug, kind, section, types, level, text, note, examples, extra = {}) => ({
  id: `core-${slug}`,
  kind,
  section,
  types,
  level,
  text,
  note,
  examples: examples.map((t) => ({ text: t, from: 'core', page: '' })),
  pattern: '',
  risk: false,
  wrong: [],
  verbatim: !!extra.m,
  page: '',
  ...extra,
});

const ALL = [];
const PROCESS = ['process'];
const MAP = ['map'];
const DATA = ['line', 'bar', 'table'];
const LINE = ['line'];
const BAR = ['bar', 'table'];
const PIE = ['pie'];
const MIXED = ['mixed'];

export const CORE_ENTRIES = [
  /* ---------- Rules for every Task 1 ---------- */
  E('impersonal', 'rule', 'general', ALL, 'B2+', 'One thing [[that can be seen]] from the data is that X.',
    'Task 1 is impersonal: no I, we or you. The passive removes "we".', [
      'One point [[that can be seen]] from the graph is that car ownership more than doubled.',
      'It [[can be seen]] from the table that the figures for Japan were consistently the highest.',
      'As [[can be seen]] in the diagram, the process begins with the harvesting of the olives.',
    ], { m: true, wrong: ['we can see', 'you can see', 'I can see'] }),
  E('report-adverbs', 'rule', 'general', ALL, 'B2', 'Sales rose [[markedly]] after 2010.',
    'Adverbs must report, not interpret: gradually, markedly, noticeably, sharply, significantly and steadily are fine; amazingly, shockingly, surprisingly, predictably and worryingly interpret.', [
      'The number of cyclists rose [[markedly]] after the new bridge opened in 2015.',
      'Coal consumption fell [[noticeably]] between 2005 and 2010.',
      'The proportion of older internet users grew [[significantly]] over the decade.',
    ], { wrong: ['amazingly', 'shockingly', 'surprisingly', 'predictably', 'worryingly'] }),
  E('no-passive-increase', 'rule', 'general', DATA, 'B2', 'Subscriptions [[have increased]] by 20% since 2015.',
    'Rise, fall, increase, decrease, grow, remain, change, expand, double, decline, drop, plummet, rocket and peak are intransitive here: never passivise them.', [
      'Online subscriptions [[have increased]] by a fifth since 2018.',
      'Between 2000 and 2010, the number of visitors [[increased]] by almost 40%.',
      'The share of renewable energy [[has increased]] steadily since 2012.',
    ], { m: true, wrong: ['have been increased', 'has been increased'] }),
  E('no-passive-double', 'rule', 'general', DATA, 'B2', 'The proportion [[almost doubled]] between 2000 and 2020.',
    '"Double" is intransitive when figures change by themselves: never "was doubled".', [
      'The proportion of students living at home [[almost doubled]] between 1995 and 2015.',
      'Rice exports from Vietnam [[doubled]] over the ten-year period.',
      'Average house prices in the capital [[more than doubled]] in less than two decades.',
    ], { m: true, wrong: ['was almost doubled', 'was doubled'] }),
  E('no-passive-occur', 'rule', 'general', DATA, 'B2', 'The biggest change [[occurred]] in 2015.',
    '"Occur" has no passive: "was occurred" is always wrong.', [
      'The most dramatic fall in sales [[occurred]] between 2008 and 2009.',
      'A brief recovery [[occurred]] in 2012, when the figure rose to 45%.',
      'The sharpest rise [[occurred]] in the final five years of the period.',
    ], { m: true, wrong: ['was occurred'] }),
  E('no-passive-rise', 'rule', 'general', DATA, 'B2', 'Sales [[rose]] sharply in 2010.',
    '"Rise" and "fall" are intransitive: never "was risen" or "were fallen".', [
      'Ticket sales [[rose]] sharply in 2010, reaching 2.4 million.',
      'Unemployment [[fell]] steadily after 2013.',
      'The figure for Brazil [[rose]] from 12% to 31% over the period.',
    ], { wrong: ['was risen', 'were risen', 'was rised', 'was fallen', 'were fallen'] }),
  E('register-considerably', 'rule', 'overview', ALL, 'B2', 'Overall, the area changed [[considerably]].',
    '"A lot" is spoken register: use "considerably" or "substantially" in writing.', [
      'Overall, the village changed [[considerably]] between 1990 and 2020.',
      'The proportion of household spending on food fell [[substantially]] over the period.',
      'Visitor numbers at the museum varied [[considerably]] from month to month.',
    ], { m: true, wrong: ['a lot', 'lots'] }),
  E('register-rise', 'rule', 'trend', DATA, 'B1', 'Sales [[rose]] in 2010.',
    '"Go up" and "go down" are spoken register: write rise, increase, fall or decrease.', [
      'The number of passengers [[rose]] in each of the five years shown.',
      'Average rents [[increased]] between 2015 and 2020.',
      'The price of a litre of petrol [[rose]] slightly in 2019.',
    ], { wrong: ['went up', 'go up', 'goes up', 'gone up'] }),
  E('register-fall', 'rule', 'trend', DATA, 'B1', 'Sales [[fell]] in 2011.',
    '"Go down" is spoken register: write fall, decrease or decline.', [
      'The birth rate [[fell]] in almost every country in the table.',
      'Coal production [[decreased]] after 2005.',
      'The number of cinema visits [[declined]] between 2010 and 2020.',
    ], { wrong: ['went down', 'go down', 'goes down', 'gone down'] }),

  /* ---------- Processes ---------- */
  E('proc-shows', 'phrase', 'intro', PROCESS, 'B1', 'The diagram [[shows]] the process of making X.',
    'The weakest reporting verb: correct and invisible, but it scores nothing.', [
      'The diagram [[shows]] the process of making bricks for the building industry.',
      'The flow chart [[shows]] the process of recycling glass bottles.',
      'The diagram [[shows]] how electricity is produced in a hydroelectric power station.',
    ]),
  E('proc-illustrates-how', 'phrase', 'intro', PROCESS, 'B2', 'The diagram [[illustrates how]] X is made.',
    '"Illustrates" is a genuine upgrade, and the embedded passive clause adds a second clause free.', [
      'The diagram [[illustrates how]] chocolate is made from cocoa beans.',
      'The flow chart [[illustrates how]] paper is produced from recycled newspapers.',
      'The diagram [[illustrates how]] olive oil is extracted and bottled.',
    ], { m: true }),
  E('proc-each-picture', 'phrase', 'intro', PROCESS, 'B2', '[[Each picture represents]] a stage in the process of X.',
    'Useful when the diagram is a strip of images rather than a flow chart.', [
      '[[Each picture represents]] a stage in the process of making cheese.',
      'In the diagram, [[each picture represents]] one stage in the life cycle of a frog.',
      '[[Each picture represents]] a step in the production of instant noodles.',
    ], { m: true }),
  E('proc-appositive', 'structure', 'intro', PROCESS, 'B2+', 'The diagram demonstrates the process of preparing stringhoppers, [[a kind of]] noodle.',
    'The cheapest C1 move in Task 1: gloss an unfamiliar noun in a comma-bounded phrase.', [
      'The diagram explains how kombucha, [[a kind of]] fermented tea, is produced.',
      'The flow chart shows how tofu, [[a type of]] bean curd, is made from soya beans.',
      'The diagram illustrates the production of biochar, [[a form of]] charcoal used to improve soil.',
    ], { m: true, pattern: 'noun, + a kind of / a type of / a form of + noun,' }),
  E('proc-sets-out', 'phrase', 'intro', PROCESS, 'C1', 'The flow chart sets out [[the stages involved in]] the production of X.',
    '"Sets out" plus the nominalisation "the production of": precise and formal.', [
      'The flow chart sets out [[the stages involved in]] the production of glass bottles.',
      'The diagram sets out [[the stages involved in]] recycling aluminium cans.',
      'The flow chart sets out [[the stages involved in]] the manufacture of cement.',
    ]),
  E('proc-by-which', 'structure', 'intro', PROCESS, 'C1', 'The diagram depicts [[the procedure by which]] X is manufactured.',
    '"By which" is high-value but frequently mangled; "depicts" leans pictorial and suits maps better than flow charts.', [
      'The diagram explains [[the procedure by which]] crude oil is refined into petrol.',
      'The flow chart outlines [[the method by which]] rainwater is collected and purified.',
      'The diagram shows [[the process by which]] silk thread is obtained from silkworm cocoons.',
    ], { risk: true }),
  E('proc-count', 'phrase', 'overview', PROCESS, 'B1', 'There are six stages [[in the process]].',
    'Counting is the minimum viable overview.', [
      'There are eight stages [[in the process]], from mining the clay to delivering the bricks.',
      'There are five main stages [[in the process]] of making fruit juice.',
      'Overall, there are seven distinct stages [[in the process]].',
    ]),
  E('proc-beginning-with', 'phrase', 'overview', PROCESS, 'B2', 'There are six main stages, [[beginning with]] X and ending with Y.',
    'Mindset prints "ending in"; "ending with" is the commoner collocation and safer.', [
      'There are seven main stages, [[beginning with]] the harvesting of the beans and ending with packaging.',
      'The process consists of six stages, [[beginning with]] the collection of used glass.',
      'There are five stages in total, [[beginning with]] the mining of limestone.',
    ], { m: true }),
  E('proc-comprises', 'rule', 'overview', PROCESS, 'C1', 'The process [[comprises]] eight distinct stages, from the initial X through to the final Y.',
    '"Comprises" takes no "of". "From … through to" outperforms "from … to".', [
      'The process [[comprises]] eight distinct stages, from the initial mining of clay through to delivery.',
      'The production of cement [[comprises]] five main stages.',
      'The life cycle of the salmon [[comprises]] six stages, from egg to adult.',
    ], { wrong: ['comprises of', 'comprised of'] }),
  E('proc-characterise', 'structure', 'overview', PROCESS, 'C1', 'Overall, the process is entirely manual, [[requiring]] no specialist machinery.',
    'The strongest process overview characterises the process instead of counting it; a present-participle clause does the work.', [
      'Overall, the process is largely automated, [[requiring]] very little human labour.',
      'Overall, the process is cyclical, [[beginning]] and ending with the same stage.',
      'In general, the method is simple, [[involving]] only basic equipment.',
    ], { m: true, pattern: 'main clause, + present participle (-ing) clause' }),
  E('proc-in-conclusion', 'phrase', 'summary', PROCESS, 'B2', '[[In conclusion]], this simple process shows how X.',
    'Mindset’s closing template; "To conclude" is interchangeable.', [
      '[[In conclusion]], this simple process shows how waste paper can be turned into new products.',
      '[[To conclude]], the process transforms raw cocoa beans into chocolate in seven stages.',
      '[[In conclusion]], the diagram shows how rainwater can be made safe to drink.',
    ], { m: true }),
  E('proc-first-then', 'lexis', 'sequence', PROCESS, 'B1', '[[First]], X. Then, Y. Next, Z. Finally, W.',
    'Necessary scaffolding, but do not build the whole answer from it.', [
      '[[First]], the clay is dug from the ground by a large digger.',
      'The beans are roasted, and [[then]] they are ground into a fine powder.',
      '[[Finally]], the bottles are labelled and delivered to shops.',
    ], { m: true, pattern: 'First · Then · Next · After that · Finally' }),
  E('proc-next-stage', 'phrase', 'sequence', PROCESS, 'B2', '[[The next stage is to]] X.',
    'Active, and it breaks up a run of passives without losing register.', [
      '[[The next stage is to]] heat the mixture to around 1,400°C.',
      'Once the bricks have dried, [[the next stage is to]] fire them in a kiln.',
      '[[The next stage is to]] separate the liquid from the pulp.',
    ], { m: true, pattern: 'The next stage is to… · At this stage… · Once this is done…' }),
  E('proc-subsequently', 'lexis', 'sequence', PROCESS, 'B2+', '[[Subsequently]], X.',
    '"Subsequently" is the safest formal substitute for "then".', [
      '[[Subsequently]], the glass is melted in a furnace.',
      'The leaves are rolled and [[subsequently]] left to ferment.',
      '[[Following this]], the juice is pasteurised and bottled.',
    ], { pattern: 'Following this · Subsequently · Thereafter' }),
  E('proc-having-been', 'structure', 'sequence', PROCESS, 'C1', '[[Having been dried]], the leaves are then packed.',
    'A perfect passive participle. One per script is plenty; two reads as showing off.', [
      '[[Having been washed]], the bottles are sorted by colour.',
      '[[Having been cooled]], the bricks are packaged for delivery.',
      '[[Having been filtered]], the water is stored in a large tank.',
    ], { pattern: 'Having been + past participle, + main clause' }),
  E('proc-before-being', 'structure', 'sequence', PROCESS, 'C1', 'The fruit is cleaned [[before being transported]] to the processing plant.',
    'A passive gerund after a preposition compresses a whole stage into a phrase.', [
      'The beans are dried in the sun [[before being sent]] to the factory.',
      'The cans are crushed into blocks [[before being melted]] down.',
      'The milk is heated [[after being collected]] from local farms.',
    ], { m: true, pattern: 'before / after + being + past participle' }),
  E('proc-at-the-same-time', 'lexis', 'sequence', PROCESS, 'B2+', '[[At the same time]], X.',
    'Simultaneity markers: the most under-taught language in Task 1. Use them when the diagram shows parallel stages.', [
      '[[At the same time]], the sugar is dissolved in hot water.',
      '[[Whilst this is happening]], the moulds are coated with oil.',
      'The dough rises in a warm room; [[simultaneously]], the filling is prepared.',
    ], { m: true, pattern: 'Whilst this is happening · At the same time · Simultaneously' }),
  E('proc-passive-present', 'structure', 'sequence', PROCESS, 'B1', 'The rice [[is put]] into a grinder.',
    'The present simple passive is the default for process stages.', [
      'The cocoa beans [[are roasted]] at a high temperature.',
      'The sand and limestone [[are mixed]] in a large drum.',
      'The used paper [[is collected]] from homes and offices.',
    ], { m: true, pattern: 'is / are + past participle' }),
  E('proc-using', 'structure', 'sequence', PROCESS, 'B2', 'The wood is cut into pieces [[using]] a saw.',
    'Names the tool without an agent.', [
      'The clay is shaped into bricks [[using]] a wire cutter.',
      'The juice is extracted [[using]] a mechanical press.',
      'The logs are cut into planks [[using]] an electric saw.',
    ], { m: true, pattern: 'passive verb + using + instrument' }),
  E('proc-modal-passive', 'structure', 'sequence', PROCESS, 'B2+', 'Four squares [[have to be tied]] together.',
    'A modal passive.', [
      'The bricks [[have to be left]] to dry for 24 to 48 hours.',
      'The mixture [[must be stirred]] continuously while it cools.',
      'The cans [[need to be washed]] before they are shredded.',
    ], { m: true, pattern: 'modal + be + past participle' }),
  E('proc-passive-infinitive', 'structure', 'sequence', PROCESS, 'B2+', 'The lantern is ready [[to be decorated]].',
    'A passive infinitive.', [
      'At this point, the bottles are ready [[to be filled]].',
      'The cooled bricks are then ready [[to be packed]] and delivered.',
      'Once dry, the paper is ready [[to be rolled]] onto large reels.',
    ], { m: true, pattern: 'to be + past participle' }),
  E('proc-reduced-relative', 'structure', 'sequence', PROCESS, 'B2+', 'the techniques [[used]] for carving wooden shoes',
    'A reduced passive relative clause.', [
      'The water [[collected]] from the roof is stored in an underground tank.',
      'The glass [[produced]] in this way can be recycled again and again.',
      'The steam [[generated]] by the boiler drives a turbine.',
    ], { m: true, pattern: 'noun + past participle (= which is/are + past participle)' }),
  E('proc-active-agent', 'rule', 'sequence', PROCESS, 'B2', 'The clog maker [[takes]] a long knife to cut the shoe to shape.',
    'The active belongs in three places only: the framing sentence, stage-naming nominals ("The first stage is to…"), and clauses where the agent matters.', [
      'In the next stage, a farmer [[collects]] the eggs by hand.',
      'The process [[consists of]] six stages.',
      'A worker [[checks]] each bottle for cracks before it is filled.',
    ], { m: true }),

  /* ---------- Maps ---------- */
  E('map-past-perfect', 'rule', 'tense', MAP, 'B2+', 'By 1935, the factory [[had been removed]].',
    'Second map dated in the past: past simple for the changes, past perfect for "by" the later date.', [
      'By 1995, the old railway line [[had been removed]].',
      'By 2010, a shopping centre [[had been built]] on the site of the market.',
      'By the time of the second map, the forest [[had been cleared]].',
    ], { m: true }),
  E('map-present-perfect', 'rule', 'tense', MAP, 'B2+', 'A motorway [[has been built]] to the north of the village.',
    'Second map labelled "now" or "today": present perfect for the change, present simple for what is there now.', [
      'A new bridge [[has been built]] across the river.',
      'The farmland to the east of the village [[has been replaced]] by housing.',
      'The car park [[has been extended]] to twice its original size.',
    ], { m: true }),
  E('map-still-remain', 'rule', 'tense', MAP, 'B2', 'The church and pond [[still remain]] the same.',
    'Unchanged features take the present simple when the later map shows today.', [
      'The school and the post office [[still remain]] in their original positions.',
      'The main road [[still runs]] along the southern edge of the town.',
      'The lake in the centre of the park [[remains]] unchanged.',
    ], { m: true }),
  E('map-now-contains', 'rule', 'tense', MAP, 'B2', 'The old library building [[now contains]] laboratories.',
    'One map dated, one "today": past simple for changes, present simple for the current state.', [
      'The former factory [[now contains]] luxury apartments.',
      'The old station building [[now houses]] a museum.',
      'The site of the market [[is now]] a car park.',
    ], { m: true }),
  E('map-illustrate-how', 'rule', 'intro', MAP, 'B2+', 'The maps [[illustrate how]] Poulton was modernised between 1900 and 1935.',
    'Never lift the question’s wording: Mindset ranks a copied introduction lowest. A "how" clause with a change verb already interprets.', [
      'The maps [[illustrate how]] the village of Ashford developed between 1980 and 2020.',
      'The two maps [[illustrate how]] the university campus has changed since 2005.',
      'The maps [[illustrate how]] the island was transformed for tourism.',
    ], { m: true }),
  E('map-show-changes', 'phrase', 'intro', MAP, 'B1', 'The two maps [[show the changes to]] X between 1990 and 2010.',
    'Safe; it paraphrases at least.', [
      'The two maps [[show the changes to]] a small fishing village between 1990 and 2010.',
      'The maps [[show the changes to]] the city centre over a thirty-year period.',
      'The plans [[show the changes to]] a school site between 2000 and the present day.',
    ]),
  E('map-depict', 'phrase', 'intro', MAP, 'C1', 'The maps [[depict]] an area of the town in 1900 and 1935 and the urban developments that took place.',
    '"Depict" is at home with maps; the appended noun phrase previews the content without listing it.', [
      'The maps [[depict]] the town of Westbury in 1970 and today, and the developments that have taken place.',
      'The two maps [[depict]] a coastal area before and after the construction of a tourist resort.',
      'The maps [[depict]] the layout of a hospital site in 1995 and 2025.',
    ], { m: true }),
  E('map-notable-changes', 'phrase', 'overview', MAP, 'B2', 'Overall, there were [[a number of notable changes]] to the buildings and amenities of this area.',
    'Solid and neutral; it quantifies nothing, which is correct for an overview.', [
      'Overall, there were [[a number of notable changes]] to the village’s roads and housing.',
      'Overall, there have been [[a number of notable changes]] to the leisure facilities in the park.',
      'In general, there were [[a number of notable changes]] to the layout of the campus.',
    ], { m: true }),
  E('map-extension-improvement', 'structure', 'overview', MAP, 'C1', 'Generally speaking, the changes illustrate [[the extension and improvement]] of its facilities.',
    'A twin nominalisation: the Mindset model’s single best sentence.', [
      'Generally speaking, the changes illustrate [[the expansion and modernisation]] of the town centre.',
      'Overall, the maps show [[the development and improvement]] of the island’s tourist facilities.',
      'Taken together, the changes reflect [[the extension and upgrading]] of the hospital site.',
    ], { m: true, pattern: 'the + noun (-sion/-ment) + and + noun + of' }),
  E('map-transformed', 'phrase', 'overview', MAP, 'C1', 'Overall, the area [[was transformed from]] a largely industrial district into a residential one.',
    'The "from X into Y" frame is the highest-value map overview: the whole change in one clause.', [
      'Overall, the village [[was transformed from]] a farming community into a commuter town.',
      'Overall, the waterfront [[has been transformed from]] an industrial port into a leisure area.',
      'Overall, the island [[was transformed from]] an undeveloped area into a tourist resort.',
    ]),
  E('map-put-up', 'lexis', 'change', MAP, 'B1', 'The old cinema [[was knocked down]].',
    'Phrasal verbs lean informal in writing: prefer demolish, construct and erect.', [
      'The old warehouse [[was knocked down]] to make room for flats.',
      'A new fence [[was put up]] around the playing fields.',
      'Several houses along the river [[were torn down]].',
    ], { m: true, risk: true, pattern: 'build · put up · knock down · tear down' }),
  E('map-construct', 'lexis', 'change', MAP, 'B2', 'A new sports centre [[was constructed]] next to the school.',
    'The B2 building verbs: construct, erect, extend, enlarge, expand, develop.', [
      'A new sports centre [[was constructed]] next to the school.',
      'A footbridge [[has been erected]] across the river.',
      'The car park [[was enlarged]] to accommodate twice as many vehicles.',
    ], { m: true, pattern: 'construct · erect · extend · enlarge · expand · develop' }),
  E('map-relocate', 'lexis', 'change', MAP, 'B2', 'The station [[was relocated]] to the east of the town.',
    'The B2 alteration verbs: modernise, renovate, relocate, convert, replace, alter.', [
      'The bus station [[was relocated]] to the edge of the town centre.',
      'The old library [[has been converted]] into a café.',
      'The tennis courts [[were replaced]] by a swimming pool.',
    ], { m: true, pattern: 'modernise · renovate · relocate · convert · replace · alter' }),
  E('map-demolish', 'lexis', 'change', MAP, 'B2', 'The factory [[was demolished]] and the site cleared.',
    'The B2 removal verbs: demolish, remove, clear, flatten.', [
      'The old hospital [[was demolished]] in the 1990s.',
      'The trees along the main road [[have been removed]].',
      'The area of woodland [[was cleared]] for new housing.',
    ], { m: true, pattern: 'demolish · remove · clear · flatten' }),
  E('map-underwent', 'lexis', 'change', MAP, 'C1', 'The town centre [[underwent redevelopment]] in the 1990s.',
    'C1 change verbs: underwent redevelopment, gave way to, was cleared to make way for.', [
      'The harbour area [[underwent extensive redevelopment]] between 2000 and 2015.',
      'The northern part of the campus [[has undergone redevelopment]].',
      'The shopping street [[underwent redevelopment]] and was pedestrianised.',
    ]),
  E('map-gave-way', 'lexis', 'change', MAP, 'C1', 'The farmland [[gave way to]] a housing estate.',
    'Describes replacement without naming an agent.', [
      'The orchards to the south of the village [[gave way to]] a housing estate.',
      'The old docks [[have given way to]] restaurants and apartments.',
      'Much of the forest [[gave way to]] farmland during this period.',
    ]),
  E('map-make-way', 'lexis', 'change', MAP, 'C1', 'The woodland [[was cleared to make way for]] a car park.',
    'Two changes in one verb phrase: removal and replacement.', [
      'The playing fields [[were cleared to make way for]] a supermarket.',
      'Several houses [[were demolished to make way for]] a new road.',
      'The old market [[has been knocked down to make way for]] a shopping centre.',
    ]),
  E('map-nominalise', 'structure', 'change', MAP, 'C1', 'The most significant change was [[the construction of]] an extra storey.',
    'Nominalise for Grammatical Range: "they built an extra storey" becomes "the construction of an extra storey" at no cost.', [
      'Another major change was [[the relocation of]] the bus station to the edge of town.',
      'The most striking development is [[the expansion of]] the airport.',
      'These changes were accompanied by [[the construction of]] a new ring road.',
    ], { m: true, pattern: 'the construction / relocation / expansion / extension / removal of + noun' }),
  E('map-opposite', 'lexis', 'location', MAP, 'B1', 'The library is [[opposite]] the town hall.',
    'The basic prepositions of place.', [
      'A new café was built [[opposite]] the entrance to the park.',
      'The bank is located [[between]] the post office and the supermarket.',
      'A car park has been added [[behind]] the sports centre.',
    ], { m: true, pattern: 'between · opposite · next to · in front of · behind · to the left of · in the middle of' }),
  E('map-corner', 'lexis', 'location', MAP, 'B2', 'A car park was built [[in the top right-hand corner]] of the site.',
    'Precise positions: corners, compass directions and the outskirts.', [
      'A playground was added [[in the top right-hand corner]] of the park.',
      'A new housing estate has been built [[to the north of]] the river.',
      'The supermarket was relocated [[to the outskirts of]] the town.',
    ], { m: true, pattern: 'in the top right-hand corner · to the north of · on the outskirts of' }),
  E('map-adjacent', 'lexis', 'location', MAP, 'C1', 'A new housing estate now stands [[adjacent to]] the park.',
    'C1 prepositions of place: adjacent to, bordering.', [
      'A new medical centre was built [[adjacent to]] the hospital.',
      'The fields [[bordering]] the river were turned into a nature reserve.',
      'The hotel [[adjacent to]] the beach has been extended.',
    ], { pattern: 'adjacent to · bordering' }),

  /* ---------- Line graphs: tense by time marker ---------- */
  E('tense-since', 'rule', 'tense', DATA, 'B2', 'Since 2015, sales [[have grown]] rapidly to 90,000.',
    '"Since…" → present perfect.', [
      'Since 2010, the number of electric cars [[has grown]] rapidly.',
      'The proportion of people working from home [[has risen]] steadily since 2019.',
      'Since the turn of the century, coal exports [[have fallen]] by half.',
    ], { m: true }),
  E('tense-between', 'rule', 'tense', DATA, 'B1', 'Between 1980 and 1990, sales [[grew]] rapidly to 90,000.',
    'A finished, dated period → past simple.', [
      'Between 1990 and 2000, car ownership in Poland [[grew]] rapidly.',
      'Between 2005 and 2010, unemployment [[rose]] from 6% to 11%.',
      'From 1970 to 1980, the population of the city [[fell]] slightly.',
    ], { m: true }),
  E('tense-future', 'rule', 'tense', DATA, 'B2', 'From 2020 to 2030, sales [[are expected to grow]] steadily.',
    'Projections → future forms: will, are predicted to, are expected to, are projected to.', [
      'From 2025 to 2040, the number of people aged over 65 [[is expected to rise]] sharply.',
      'Solar power [[is projected to overtake]] coal by 2035.',
      'Demand for water [[will continue]] to grow until 2050.',
    ], { m: true, pattern: 'will · is/are expected to · is/are predicted to · is/are projected to' }),
  E('tense-by-past', 'rule', 'tense', DATA, 'B2+', 'By the year 2000, sales [[had grown]] to 90,000.',
    '"By" + a past date → past perfect.', [
      'By 2010, the number of international students [[had doubled]].',
      'By the end of the period, rice production [[had reached]] 180 million tonnes.',
      'By 1990, the figure for Japan [[had fallen]] to just 4%.',
    ], { m: true }),
  E('tense-by-future', 'rule', 'tense', DATA, 'C1', 'By the year 2040, sales [[will have grown]] to 90,000.',
    '"By" + a future date → future perfect.', [
      'By 2050, the population of the city [[will have reached]] 12 million.',
      'By 2035, electric cars [[will have overtaken]] petrol cars in sales.',
      'By the end of the decade, the gap between the two countries [[will have narrowed]] considerably.',
    ], { m: true }),
  E('tense-going-to', 'rule', 'tense', DATA, 'B1', 'Next year, house prices [[are going to rise]].',
    'The "going to" future (Mindset Level 2): fine, but "is expected to" is more formal.', [
      'According to the forecast, energy prices [[are going to rise]] next year.',
      'The number of visitors [[is going to increase]] when the new terminal opens.',
      'Sales of e-books [[are going to fall]] slightly in 2027, according to the projection.',
    ], { m: true }),
  E('tense-snapshot', 'rule', 'tense', ['bar', 'table', 'pie'], 'B2', 'Services [[account for]] the largest share of employment.',
    'A single-year snapshot with no change describes a state: present simple. (Mindset’s own model does this, whatever the rubric says.) A chart dated in the past may also take the past simple.', [
      'Agriculture [[accounts for]] over 40% of jobs in India.',
      'Germany [[has]] the highest literacy rate of the six countries.',
      'Housing [[represents]] the largest category of household spending.',
    ], { m: true }),
  E('tense-overview-perfect', 'rule', 'overview', LINE, 'B2', 'Overall, the numbers [[have not changed]] much.',
    'The overview often takes the present perfect (the period as a whole) while the body takes the past simple.', [
      'Overall, the figures [[have not changed]] significantly since 2000.',
      'Overall, the proportion of renewable energy [[has risen]] steadily.',
      'Overall, the gap between the two cities [[has widened]] over the period.',
    ], { m: true }),

  /* ---------- Line graphs: introduction and overview ---------- */
  E('line-shows', 'phrase', 'intro', LINE, 'B1', 'The line graph [[shows]] the number of X between 1990 and 2015.',
    'The functional floor.', [
      'The line graph [[shows]] the number of cars sold in three countries between 1990 and 2015.',
      'The graph [[shows]] the average price of a cinema ticket from 2000 to 2020.',
      'The line graph [[shows]] changes in the birth rate in Japan over five decades.',
    ], { m: true }),
  E('line-over-period', 'phrase', 'intro', DATA, 'B2', 'The graph illustrates the percentage of X [[over a twenty-five-year period]].',
    '"Over a … period" beats repeating both dates.', [
      'The graph illustrates the percentage of households with internet access [[over a twenty-year period]].',
      'The bar chart compares the number of tourists in four countries [[over a ten-year period]].',
      'The table gives information about rice production [[over a thirty-year period]] starting in 1990.',
    ]),
  E('line-sets-out', 'phrase', 'intro', DATA, 'C1', 'The line chart [[sets out]] the main motivations people expressed for relocating to the countryside.',
    'The best reporting verb in the series for graphs: precise, formal, unhackneyed.', [
      'The line graph [[sets out]] the amount of coal exported by four countries between 2000 and 2025.',
      'The bar chart [[sets out]] the main reasons people gave for using public transport.',
      'The table [[sets out]] the number of international students in five countries.',
    ], { m: true }),
  E('line-breakdown', 'phrase', 'intro', ['line', 'bar', 'table', 'pie'], 'C1', 'The graph provides [[a breakdown of]] X by Y.',
    '"A breakdown of" is exact and signals that you understand the chart’s structure.', [
      'The table provides [[a breakdown of]] household spending by category.',
      'The pie charts provide [[a breakdown of]] electricity generation by source in 2004 and 2024.',
      'The bar chart provides [[a breakdown of]] university graduates by subject and gender.',
    ]),
  E('line-overall-increased', 'phrase', 'overview', DATA, 'B1', 'Overall, the numbers [[increased]].',
    'Technically an overview, but it scores the minimum: add what increased most, or what stayed highest.', [
      'Overall, the number of visitors to all four museums [[increased]] over the period.',
      'Overall, life expectancy [[increased]] in every country shown.',
      'Overall, the figures for both cities [[decreased]] between 2000 and 2020.',
    ]),
  E('line-trend-upward', 'phrase', 'overview', DATA, 'B2+', 'The overall trend for the period [[was upward]].',
    'Mindset’s "is of an increase" is awkward: prefer "was upward" or "is one of steady growth".', [
      'The overall trend for the period [[was upward]] in all three countries.',
      'The overall trend [[was one of steady growth]], despite a brief fall in 2009.',
      'For most of the regions, the overall trend [[was downward]].',
    ], { m: true, risk: true, wrong: ['is of an increase', 'was of an increase'] }),
  E('line-clear-trend', 'phrase', 'overview', DATA, 'B2+', '[[The clear trend in the figures is that]] X.',
    'A replacement for "Obviously", which implies the reader already knows: neutral and data-anchored.', [
      '[[The clear trend in the figures is that]] online sales rose while shop sales fell.',
      '[[The clear trend in the figures is that]] car ownership increased in every country.',
      '[[The clear trend in the figures is that]] older people are now far more likely to use smartphones.',
    ], { m: true, wrong: ['Obviously,', 'Obviously'] }),
  E('line-what-stands-out', 'structure', 'overview', ALL, 'C1', '[[What stands out is that]] X.',
    'A pseudo-cleft: it foregrounds the key finding grammatically rather than asserting its importance.', [
      '[[What stands out is that]] Indonesia overtook Australia as the largest exporter in 2015.',
      '[[What stands out is that]] women outnumbered men in every age group over 35.',
      '[[What stands out is that]] the proportion spent on housing almost doubled.',
    ], { m: true, pattern: 'What stands out is that + clause' }),
  E('line-it-is-striking', 'phrase', 'overview', ALL, 'C1', '[[It is striking that]] the figure fell in every region but one.',
    'Impersonal, formal, and a legitimate way to highlight without editorialising.', [
      '[[It is striking that]] the figure fell in every region except Asia.',
      '[[It is striking that]] cycling was the only mode of transport to grow.',
      '[[It is striking that]] the two countries had almost identical figures by 2020.',
    ], { m: true }),

  /* ---------- Movement language ---------- */
  E('move-rise-noun', 'lexis', 'trend', DATA, 'B2', 'There was [[a rise]] in the number of X.',
    'The workhorses, as verbs and nouns: rise, fall, increase, decrease.', [
      'There was [[a sharp rise]] in the number of visitors after 2015.',
      'The period saw [[a steady decrease]] in coal consumption.',
      'There was [[a slight fall]] in the unemployment rate in 2012.',
    ], { m: true, pattern: 'rise · fall · increase · decrease (verb) / a rise in · a fall in (noun)' }),
  E('move-dip', 'lexis', 'trend', DATA, 'B2', 'Sales [[dipped]] in 2012 before recovering.',
    '"Dip" implies a fall followed by recovery: use it only when the line actually recovers.', [
      'Visitor numbers [[dipped]] slightly in 2009 before recovering the following year.',
      'The figure [[dropped]] to 12% in 2015.',
      'Exports [[declined]] steadily throughout the 1990s.',
    ], { m: true, pattern: 'drop · decline · dip' }),
  E('move-peak', 'lexis', 'trend', DATA, 'B2+', 'Sales [[peaked at]] 90,000 in 2015.',
    'Precise and compact.', [
      'Rice production in Vietnam [[peaked at]] 45 million tonnes in 2018.',
      'Demand for electricity [[peaks at]] around 6 pm in winter.',
      'The number of passengers [[reached a peak of]] 12 million in 2019.',
    ], { m: true, pattern: 'peak at · reach a peak of · a peak' }),
  E('move-level-off', 'lexis', 'trend', DATA, 'B2+', 'Sales [[levelled off]] at around 50,000.',
    'Plateau language: the movement candidates most often fail to name.', [
      'After 2010, the number of cinema admissions [[levelled off]] at around 170 million.',
      'Unemployment [[stabilised]] at 5% for the last three years of the period.',
      'The figure for Spain [[remained flat]] between 2015 and 2020.',
    ], { pattern: 'level off · plateau · stabilise · remain flat' }),
  E('move-plummet', 'lexis', 'trend', DATA, 'B2+', 'Prices [[plummeted]] in 2008.',
    'Dramatic and journalistic: reserve plummet and rocket for genuinely extreme movements, once per script.', [
      'Sales of DVDs [[plummeted]] after 2010.',
      'The number of tourists [[plummeted]] in 2020, from 80 million to just 19 million.',
      'Demand for electric bicycles [[rocketed]] between 2019 and 2022.',
    ], { m: true, risk: true, pattern: 'plummet · rocket' }),
  E('move-saw', 'structure', 'trend', DATA, 'B2+', 'Japan [[saw]] a sharp rise in exports.',
    '"Saw" and "experienced" are safer than "witnessed", which is overused and faintly personifying.', [
      'The 1990s [[saw]] a sharp rise in the number of students.',
      'Germany [[experienced]] a steady decline in coal production.',
      'The final decade [[saw]] a dramatic fall in the birth rate.',
    ], { pattern: 'X saw / experienced + a/an + adjective + noun' }),
  E('adj-big', 'lexis', 'trend', DATA, 'B2', 'There was [[a significant]] increase in sales.',
    'Adjectives for big changes go before the noun.', [
      'There was [[a significant]] increase in the number of cyclists.',
      'The period saw [[a substantial]] fall in coal imports.',
      'There was [[a marked]] rise in the price of rice in 2008.',
    ], { m: true, pattern: 'significant · dramatic · substantial · marked' }),
  E('adv-big', 'lexis', 'trend', DATA, 'B2', 'Sales rose [[considerably]].',
    'Adverbs for big changes follow the verb.', [
      'The number of overseas students rose [[considerably]] after 2005.',
      'Coal exports fell [[sharply]] between 2015 and 2020.',
      'Life expectancy in Brazil increased [[substantially]] over the period.',
    ], { m: true, pattern: 'significantly · dramatically · substantially · considerably · sharply' }),
  E('adj-small', 'lexis', 'trend', DATA, 'B2', 'There was [[a slight]] fall in demand.',
    'Small changes: slight, modest, marginal / slightly, moderately, marginally.', [
      'There was [[a slight]] fall in demand for printed books.',
      'The figure for Italy rose [[marginally]], from 41% to 43%.',
      'Visitor numbers increased [[moderately]] in the second half of the period.',
    ], { m: true, pattern: 'slight · modest · marginal / slightly · moderately · marginally' }),
  E('adv-steady', 'lexis', 'trend', DATA, 'B2', 'Numbers rose [[steadily]] throughout the decade.',
    'Gradual or no change: steadily, gradually, consistently, slowly. "Steady", "stable" and "unchanged" usually follow the noun or a linking verb.', [
      'The number of students rose [[steadily]] throughout the decade.',
      'Water consumption fell [[gradually]] between 2000 and 2020.',
      'The figure for Sweden remained [[stable]] at around 20%.',
    ], { m: true, pattern: 'steadily · gradually · consistently · slowly; remain stable / unchanged' }),
  E('adv-fast', 'lexis', 'trend', DATA, 'B2', 'Sales grew [[rapidly]].',
    'Speed: rapid, swift / rapidly, quickly.', [
      'Internet use in Vietnam grew [[rapidly]] after 2010.',
      'There was [[a rapid]] increase in the number of electric cars.',
      'Prices recovered [[quickly]] after the fall in 2009.',
    ], { pattern: 'rapid · swift / rapidly · quickly' }),
  E('nominal-superlative', 'structure', 'trend', DATA, 'C1', '[[The most consistent and stable increase]] was seen in Europe.',
    'Nominalisation: "increased most consistently" becomes a noun phrase. Same information, a band higher.', [
      '[[The most dramatic fall]] was seen in the figure for coal.',
      '[[The sharpest increase]] was recorded in the 18–24 age group.',
      '[[The most significant change]] occurred between 2010 and 2015.',
    ], { m: true, pattern: 'The most + adjective + noun + was seen in / occurred in' }),

  /* ---------- Prepositions with figures ---------- */
  E('fig-from-to', 'lexis', 'figures', DATA, 'B2', 'The figure rose [[from]] 17% to 20%.',
    'from … to gives the start and end points.', [
      'Car ownership rose [[from]] 120 to 450 cars per 1,000 people.',
      'The proportion of renewable energy grew [[from]] 8% in 2005 to 31% in 2020.',
      'The average price fell [[from]] £4.20 to £3.80.',
    ], { m: true, pattern: 'rose from … to' }),
  E('fig-by', 'lexis', 'figures', DATA, 'B2', 'Sales increased [[by]] 3% in 2015.',
    '"By" gives the size of the change. For percentages, a change from 17% to 20% is 3 percentage points.', [
      'Exports increased [[by]] 25 million tonnes over the period.',
      'The figure for Spain fell [[by]] 4 percentage points.',
      'The price of a ticket rose [[by]] almost a third.',
    ], { m: true }),
  E('fig-stood-at', 'lexis', 'figures', DATA, 'B2', 'Unemployment [[stood at]] 7% in 2010.',
    'Gives a value at a point in time without a change.', [
      'In 2000, coal exports from Australia [[stood at]] 210 million tonnes.',
      'The figure for women [[stood at]] 38%, compared with 45% for men.',
      'At the start of the period, the price of a house [[stood at]] around £80,000.',
    ], { m: true, pattern: 'stand at · at (90,000)' }),
  E('fig-rise-in', 'lexis', 'figures', DATA, 'B2', 'There was a rise [[in]] the number of X.',
    'A rise / fall / increase IN something; a rise OF a certain amount.', [
      'There was a sharp rise [[in]] the number of overseas visitors.',
      'The table shows a steady fall [[in]] the price of solar panels.',
      'There was an increase [[of]] 12% in the number of passengers.',
    ], { m: true, pattern: 'a rise in + noun · a rise of + amount' }),

  /* ---------- Bar charts and tables ---------- */
  E('bar-group-pattern', 'rule', 'comparison', BAR, 'B2+', 'The three Asian countries [[followed a similar pattern]], with X.',
    'Group by pattern, not by row: a category-by-category walkthrough is "too mechanical" (Mindset Level 3).', [
      'The three European countries [[followed a similar pattern]], with steady growth throughout.',
      'The two youngest age groups [[showed a similar pattern]], with figures well above 60%.',
      'Spain and Italy [[followed a similar trend]], both reaching a peak in 2019.',
    ], { m: true }),
  E('bar-gives', 'phrase', 'intro', BAR, 'B1', 'The bar chart [[gives]] the percentage of X.',
    'Fine, but flat.', [
      'The bar chart [[gives]] the percentage of adults who exercise regularly.',
      'The table [[gives]] the number of graduates in six subjects.',
      'The chart [[gives]] information about broadband speeds in six countries.',
    ], { m: true }),
  E('bar-for-purposes', 'phrase', 'intro', ['bar', 'table', 'pie'], 'C1', '[[For the purposes of this data set]], the world is divided into seven regions.',
    'A rare framing move: it explains the chart’s structure before describing it.', [
      '[[For the purposes of this data set]], the workforce is divided into three sectors.',
      '[[For the purposes of this data set]], adults are divided into six age groups.',
      '[[For the purposes of this data set]], household spending is split into six categories.',
    ], { m: true }),
  E('bar-respectively', 'lexis', 'comparison', BAR, 'B2+', 'X and Y account for the largest shares, with 26% and 25% [[respectively]].',
    '"Respectively" is high-value and underused. "Lead the way" (Mindset’s wording) is mildly idiomatic; "account for the largest share" is more neutral.', [
      'The figures for men and women were 34% and 37% [[respectively]].',
      'Japan and Germany recorded the lowest rates, at 3% and 1% [[respectively]].',
      'Spending on housing and food rose to 34% and 22% [[respectively]].',
    ], { m: true, risk: true }),
  E('bar-no-boast', 'rule', 'comparison', BAR, 'B2', 'North America [[accounts for]] 19% of production.',
    'Mindset prints "can boast", but it is evaluative and contradicts the objectivity rule: do not use it.', [
      'North America [[accounts for]] 19% of global car production.',
      'Asia [[accounts for]] more than half of the world’s rice exports.',
      'The services sector [[accounts for]] over 70% of jobs in Japan.',
    ], { m: true, wrong: ['can boast'] }),
  E('bar-whereas', 'lexis', 'comparison', ALL, 'B2+', '[[Whereas]] North America accounts for 19%, South America manufactures just 4%.',
    'The cleanest single-sentence contrast.', [
      '[[Whereas]] car ownership in Japan levelled off, the figure for Poland continued to rise.',
      '[[Whereas]] men were more active in their twenties, women were more active after the age of 45.',
      'Agriculture uses 84% of water in Africa, [[whereas]] industry is the largest user in Europe.',
    ], { m: true }),
  E('bar-by-contrast', 'lexis', 'linking', ALL, 'B2', '[[By contrast]], very few cars are produced in the Middle East.',
    'Two words. Do not write "in contrast to this" when no contrast exists.', [
      '[[By contrast]], the number of people cycling to work fell slightly.',
      '[[By contrast]], spending on clothing remained almost unchanged.',
      '[[By contrast]], the figure for Nigeria was the lowest in every year shown.',
    ], { m: true, wrong: ['bycontrast'] }),
  E('bar-turning-to', 'lexis', 'linking', ALL, 'B2', '[[Turning next to]] the Americas, X.',
    'Paragraph-hinge markers: one per answer.', [
      '[[Turning next to]] the second chart, the proportion of energy from coal fell sharply.',
      '[[Turning to]] the older age groups, the pattern was reversed.',
      '[[Moving on to]] the summer figures, demand peaked in the afternoon.',
    ], { m: true, pattern: 'Turning next to · Turning to · Moving on to' }),
  E('bar-times-as', 'lexis', 'comparison', ALL, 'B2+', 'X is [[three times as high as]] Y.',
    'Multiplicative comparison: far stronger than "much higher than".', [
      'The figure for China was [[three times as high as]] that for India.',
      'In 2020, spending on housing was [[twice as high as]] spending on food.',
      'The number of female graduates in law was [[more than double]] the figure for men.',
    ], { pattern: 'twice / three times as high as · more than double the figure for' }),
  E('bar-modifiers', 'lexis', 'comparison', ALL, 'B2', 'China has been [[significantly more]] successful than any other country in badminton.',
    'Comparative modifiers: significantly, considerably, substantially, marginally, slightly, far, much + comparative.', [
      'Broadband speeds in South Korea were [[significantly higher]] than in the other five countries.',
      'Women were [[slightly more]] likely than men to read digital books.',
      'Spending in 2023 was [[considerably higher]] than in 2015 in all but one country.',
    ], { m: true, pattern: 'significantly / considerably / slightly / far + comparative' }),

  /* ---------- Pie charts and proportion ---------- */
  E('pie-chose', 'phrase', 'proportion', PIE, 'B1', '34% of people [[chose]] Chinese food.',
    'Correct, but repetitive if used for every segment: alternate with fractions and "account for".', [
      '22% of respondents [[chose]] the bus as their main way of getting to work.',
      'Only 6% of students [[spent]] their time exercising.',
      '41% of commuters [[travelled]] by car.',
    ]),
  E('pie-fractions', 'lexis', 'proportion', PIE, 'B2', '[[Just over a third]] of respondents preferred X.',
    'Alternating fractions with percentages is the core Lexical Resource move for pie charts.', [
      '[[Just over a third]] of household spending went on housing.',
      '[[About a quarter]] of electricity was generated from natural gas.',
      '[[One in ten]] students spent their evenings in paid work.',
    ], { m: true, pattern: 'just over a third · about a quarter · one in ten · a tiny proportion' }),
  E('pie-accounts-for', 'lexis', 'proportion', ['pie', 'bar', 'table'], 'B2+', 'X [[accounts for]] 26% of the total.',
    'The workhorse verb for proportion: safer than the alternatives.', [
      'Coal [[accounted for]] 30% of electricity generation in 2004.',
      'Housing [[accounts for]] the largest share of household spending.',
      'Tuition fees [[accounted for]] almost half of the university’s income.',
    ]),
  E('pie-constitutes', 'lexis', 'proportion', PIE, 'B2+', 'X [[constitutes]] a quarter of respondents.',
    '"Constitutes" is the most formal; "makes up" is the most casual but still acceptable.', [
      'Food waste [[constitutes]] almost a third of household rubbish.',
      'Business trips [[make up]] just 11% of international travel.',
      'Students aged under 25 [[constitute]] the majority of the sample.',
    ], { risk: true, pattern: 'constitute · make up · represent' }),
  E('pie-at-percent', 'structure', 'figures', ['pie', 'bar', 'table'], 'B2+', 'In Brazil the figure is more than half, [[at 53%]].',
    'The ", at X%" apposition supplies supporting data without a new clause.', [
      'Housing was the largest category, [[at 31%]].',
      'The smallest proportion was spent on clothing, [[at just 7%]].',
      'The figure for women was higher, [[at 42%]].',
    ], { m: true, pattern: 'clause, + at + figure' }),
  E('pie-with-ing', 'structure', 'proportion', ALL, 'C1', '…, with about two fifths of the population [[favouring]] this mode of delivery.',
    '"With" + noun + present participle: one of the highest-value Task 1 structures, and barely taught.', [
      'Cars were the most popular choice, with 41% of commuters [[driving]] to work.',
      'Housing remained the largest category, with its share [[falling]] from 38% to 34%.',
      'Spending rose in four of the five countries, with China [[being]] the only exception.',
    ], { m: true, pattern: 'with + noun phrase + -ing participle' }),
  E('pie-followed-by', 'phrase', 'proportion', ['pie', 'bar', 'table'], 'B2+', 'The most popular source is newspapers, [[followed in second place by]] television.',
    'A passive participle chains ranks: two sentences in one.', [
      'Housing was the largest category, [[followed by]] food and transport.',
      'Coal was the main source of electricity, [[followed in second place by]] natural gas.',
      'Holidays were the most common reason for travel, [[followed by]] visiting family and friends.',
    ], { m: true }),
  E('pie-more-commonly-used', 'structure', 'proportion', ALL, 'B2+', 'The internet [[is more commonly used by]] Germans than radio.',
    'A passive that keeps its agent on purpose, so the topic can be the subject.', [
      'The bus [[is more commonly used by]] students than by older commuters.',
      'Digital books [[are more frequently read by]] people under 35.',
      'Public transport [[is used more often by]] women than by men.',
    ], { m: true }),
  E('pie-approx', 'lexis', 'figures', ALL, 'B2', '[[Approximately]] 40% of respondents chose X.',
    'Approximation modifiers.', [
      '[[Approximately]] 40% of the workforce was employed in services.',
      '[[Just under]] half of all trips were made by car.',
      'The figure was [[roughly]] the same in both years.',
    ], { m: true, pattern: 'almost · about · approximately · roughly · just over · just under · around' }),
  E('pie-greatest-difference', 'phrase', 'comparison', ALL, 'B2+', 'The greatest difference [[is found in]] South and West Asia.',
    'The passive locates a superlative.', [
      'The greatest difference [[is found in]] the 18–24 age group.',
      'The largest gap between the two years [[was found in]] China.',
      'The lowest proportion [[is found in]] the oldest group.',
    ], { m: true }),
  E('pie-it-is-apparent', 'phrase', 'summary', ALL, 'B2+', '[[It is apparent that]] X.',
    'Impersonal hedging for the summary.', [
      '[[It is apparent that]] the city became far more dependent on public transport.',
      '[[In summary, it can be said that]] spending on essentials rose at the expense of leisure.',
      '[[It is apparent that]] renewable sources played a growing role in electricity generation.',
    ], { m: true, pattern: 'It is apparent that · In summary, it can be said that' }),
  E('pie-data-indicate', 'rule', 'general', ALL, 'B2+', 'The pie chart data [[indicate]] that X.',
    'The data are a legitimate active subject: "is indicated by the data" and "it is revealed by the data that" are unnatural passives.', [
      'The figures [[indicate]] that cycling became more popular.',
      'The data [[reveal]] that most students slept for around eight hours.',
      'The table [[suggests]] that older people read more printed books.',
    ], { m: true }),

  /* ---------- Two visuals ---------- */
  E('mix-while', 'lexis', 'intro', MIXED, 'B2', 'The pie chart shows X, [[while]] the bar chart shows Y.',
    'The standard dual introduction.', [
      'The line graph shows total electricity production, [[while]] the pie chart shows the sources used in 2020.',
      'The table gives the number of tourists, [[while]] the bar chart compares their spending.',
      'The first chart illustrates car ownership, [[while]] the second compares the cost of fuel.',
    ], { m: true }),
  E('mix-breaks-down', 'phrase', 'intro', MIXED, 'B2+', 'The first chart gives X; the second [[breaks this down by]] Y.',
    'Names the relationship between the two visuals, not just their contents.', [
      'The line graph gives total energy use; the pie chart [[breaks this down by]] source.',
      'The table gives the number of graduates; the bar chart [[breaks this down by]] gender.',
      'The first chart shows overall spending; the second [[breaks it down by]] category.',
    ]),
  E('mix-taken-together', 'phrase', 'overview', MIXED, 'C1', '[[Taken together]], the two charts suggest that X.',
    'The link sentence: what separates a Band 7 from a Band 6 on this variant, and most candidates omit it.', [
      '[[Taken together]], the two charts suggest that the growth in electricity demand was met mainly by renewables.',
      '[[Taken together]], the charts show that visitor numbers and spending rose in parallel.',
      '[[Taken together]], the data indicate that households spent more on housing as incomes grew.',
    ], { m: true }),
  E('mix-corresponds', 'phrase', 'comparison', MIXED, 'C1', 'The rise shown in the second chart [[corresponds to]] the dominance of X in the first.',
    'Explicit linkage without speculating about cause; "is caused by" would breach the no-speculation rule.', [
      'The rise in demand shown in the line graph [[corresponds to]] the growing share of gas in the pie chart.',
      'The fall in admissions [[corresponds to]] the period of lowest spending.',
      'The peak in 2015 [[coincides with]] the highest proportion of overseas visitors.',
    ], { wrong: ['is caused by', 'was caused by', 'is due to'] }),
];
