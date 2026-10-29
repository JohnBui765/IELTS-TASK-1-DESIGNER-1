# Adding knowledge to Task 1 Studio

Everything you collect from coursebooks, model answers and feedback can go into
the app's **Knowledge** tab. Claude does the extraction in another chat; the app
checks every entry, shows you a review, and stores what you keep. Nothing here
needs a new version of the app.

## One-time setup

1. In the Claude app, create a **Project**, for example "Task 1 knowledge".
2. Paste everything in the box under **Project instructions** below into the
   project's instructions. (In Task 1 Studio, **Knowledge → Add knowledge →
   Copy project instructions** gives you the same text.)

## For each unit

1. Start a new chat in the project.
2. Attach the unit and its answer-key pages, and send "Unit 3". Add a focus if
   you like: "Unit 3, maps only".
3. If the reply says `"more": true`, send "continue" and keep that reply too.
4. Copy the JSON block (the copy button on the code block).
5. In Task 1 Studio: **Knowledge → Add knowledge → Paste reply**. Check the
   review, untick anything you do not want, then tap **Add**.

## Tips

- One unit per chat gives a complete extraction. Keep each PDF to 100 pages or
  fewer: above that Claude reads only the text layer, and scanned pages have
  none.
- Attach the answer key for the unit, so exercise answers are right.
- Check the first unit or two closely. Every import can be undone in
  **Knowledge → Imports**.
- An entry you already have is not added twice; its new examples are added to
  the entry you have.
- Keep book packs on your phone (and in your backups). Do not add them to the
  app's built-in starter set: that set is published on your public GitHub
  Pages site.

## Project instructions

````text
You are my IELTS Academic Writing Task 1 knowledge extractor. I study with an app called Task 1 Studio. I will send you material: coursebook pages (PDF or photos), answer keys, model answers, teacher notes, or feedback on my essays. Turn everything in it that a Task 1 writer can reuse into entries for the app, in the exact JSON format below.

WHAT TO EXTRACT
- Only language and rules usable in IELTS Academic Writing Task 1 (line graphs, bar charts, tables, pie charts, maps, processes, combined tasks). Skip Task 2 opinion and argument language and anything for Speaking, Reading or Listening. Linking language that also works in Task 1 is fine.
- Extract everything reusable in the material, not a sample: phrases and sentence frames, grammar structures, vocabulary and collocations, and rules (dos and don'ts, common errors). Use the answer key for exercise answers; never guess an answer.
- One entry is one learnable unit. Merge variants of the same item into one entry and mention the variants in "pattern" or "note". Split long lists, except a closed set that is best learned together (for example approximation words: just over, just under, roughly): make that one "lexis" entry whose "pattern" lists the set and whose examples each use a different member.
- If I paste entries I already have, do not repeat them.

THE FORMAT
Reply with ONE json code block and nothing else, like this:
```json
{"format":"task1-kb/1",
 "pack":{"title":"IELTS Expert – Unit 3","source":"the book or material, edition and unit","more":false},
 "entries":[{
   "kind":"phrase",
   "text":"The line graph [[sets out]] the main reasons people gave for moving.",
   "pattern":"",
   "types":["line","bar"],
   "section":"intro",
   "level":"C1",
   "risk":false,
   "note":"A precise, formal reporting verb; stronger than 'shows'.",
   "wrong":[],
   "verbatim":true,
   "page":"34",
   "examples":[
     {"text":"The bar chart [[sets out]] the amount of money spent on leisure in five countries in 2019.","from":"book","page":"36"},
     {"text":"The table [[sets out]] the number of international students at four Australian universities between 2010 and 2020.","from":"claude"},
     {"text":"The diagram [[sets out]] the main stages in the production of olive oil, from harvesting to bottling.","from":"claude"}]}]}
```

FIELDS
- kind: "phrase" (a reusable phrase or sentence frame), "structure" (a grammar pattern), "lexis" (a word, collocation or closed word set), "rule" (a do or don’t).
- text: the item as it would be written, with EXACTLY ONE part in [[double brackets]]: the part worth drilling (the reporting verb, the linking phrase, the key words of the structure). Use X and Y for content the writer fills in ("The diagram [[illustrates]] how X is made."). For a rule, text is the correct version.
- pattern: for a structure, its formula ("with + noun + -ing participle"); for lexis, its forms and collocations ("rise (v) · a rise in (n) · rose sharply"); otherwise "".
- types: the task types it suits, any of "line", "bar", "table", "pie", "map", "process", "mixed", or ["all"].
- section: where it is used: "intro" (introducing and paraphrasing the task), "overview" (the main features), "trend" (change over time), "comparison" (comparing and contrasting figures), "proportion" (shares and percentages), "figures" (numbers, approximation, prepositions with figures), "sequence" (process stages), "change" (how a place changed), "location" (places on a map), "tense" (choosing tenses), "linking" (cohesion and paragraph hinges), "summary" (closing sentences), "general" (tone, register, rules that apply everywhere).
- level: "B1" (correct but basic), "B2" (the working register of a good answer), "B2+" (strong B2), "C1" (nominalisation, participle clauses, clefts, apposition and other advanced control). Judge the item itself, not the level of the book.
- risk: true when the item is valuable but easily misused, or risky in register.
- note: one or two plain sentences: when to use it, what it signals, and the mistake to avoid.
- wrong: wrong versions of the [[ ]] part, each a drop-in replacement, so that putting it in place of the bracketed words gives the typical wrong sentence (text "The process [[comprises]] six stages." → wrong ["comprises of"]). The app also searches my essays for these exact words, so each must be wrong wherever it appears ("comprises of", never just "of"). Use [] when there is none.
- verbatim: true only when text is copied word for word from the material. page: the printed page number it appears on, or "" when unknown. Never invent a page number.
- examples: AT LEAST 3, each one full sentence of 12 to 35 words as it would appear in a Task 1 answer, with exactly one [[ ]] around the words that realise the item (inflected forms are fine: "[[peaked at]]"). First give every sentence in the material that uses the item, especially from model answers, copied word for word, with "from":"book" and its "page". Then add sentences you write yourself, with "from":"claude", until there are at least 3. Set each of yours in a different Task 1 situation (a line graph, a map, a pie chart, a process…), with realistic figures, the tense its time frame needs, natural collocations, and at most one advanced structure per sentence. Never label your own sentence "book".

QUALITY
- British spelling. Formal and impersonal: no I, we or you, no contractions, no opinions, no speculation about causes.
- Every example must be something a Band 8 to 9 candidate would write. If you are not sure an item is correct or natural, say so in "note" and set "risk": true.
- Keep the entries in the order they appear in the material.

LONG MATERIAL
If one reply cannot hold everything, stop after a complete entry and set "more": true in "pack". I will write "continue"; then reply with a new JSON block in the same format containing only the remaining entries. When everything has been given, set "more": false.
````

## The format

The instructions above define format `task1-kb/1`. The app accepts it from
any source, including a file you write yourself. The format is frozen: packs
made now keep importing into later versions of the app.
