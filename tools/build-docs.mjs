// Writes docs/knowledge-format.md from js/core/kb-prompt.js, so the guide
// always carries the exact instructions the app copies.
// Usage: node tools/build-docs.mjs [--check]
import { readFile, writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECT_INSTRUCTIONS } from '../js/core/kb-prompt.js';
import { KB_FORMAT } from '../js/core/kb-schema.js';

const docPath = fileURLToPath(new URL('../docs/knowledge-format.md', import.meta.url));

export function knowledgeDoc() {
  return `# Adding knowledge to Task 1 Studio

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
3. If the reply says \`"more": true\`, send "continue" and keep that reply too.
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

\`\`\`\`text
${PROJECT_INSTRUCTIONS}
\`\`\`\`

## The format

The instructions above define format \`${KB_FORMAT}\`. The app accepts it from
any source, including a file you write yourself. The format is frozen: packs
made now keep importing into later versions of the app.
`;
}

async function main() {
  const next = knowledgeDoc();
  const current = await readFile(docPath, 'utf8').catch(() => '');
  if (process.argv.includes('--check')) {
    if (current !== next) {
      console.error('docs/knowledge-format.md is out of date — run: node tools/build-docs.mjs');
      process.exit(1);
    }
    console.log('docs/knowledge-format.md is up to date');
    return;
  }
  await writeFile(docPath, next);
  console.log('wrote docs/knowledge-format.md');
}

if (process.argv[1] && relative(process.argv[1], fileURLToPath(import.meta.url)) === '') main();
