import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { taskPrompt, readTaskReply } from '../../js/core/task-import.js';
import { MAP_PROMPT_RULES, MAP_FORMAT_EXAMPLE, validateMap } from '../../js/core/maps.js';
import { verbPhrase } from '../../js/core/english.js';

const reply = (prompt) => prompt.match(/```json\n([\s\S]*?)\n```/)[1];

describe('tasks written by Claude', () => {
  test('the map prompt carries the map rules and an example the reader accepts', () => {
    const prompt = taskPrompt('map', 'a fishing village', { rules: MAP_PROMPT_RULES, example: MAP_FORMAT_EXAMPLE });
    assert.match(prompt, /12 × 8 grid/);
    assert.match(prompt, /on this topic: a fishing village/);
    assert.doesNotMatch(prompt, /measureAlt|projectedFrom/);
    const { task, problems } = readTaskReply('Here you are:\n```json\n' + reply(prompt) + '\n```', { validateMap });
    assert.deepEqual(problems, []);
    assert.equal(task.type, 'map');
    assert.equal(task.rubric, 'The maps below show the village of Ashford.');
    assert.equal(task.visuals[0].after.features.length, 8);
  });

  test('every chart prompt example reads back as a task of its type', () => {
    for (const type of ['line', 'bar', 'pie', 'table', 'process', 'mixed']) {
      const { task, problems } = readTaskReply(reply(taskPrompt(type)));
      assert.ok(task, `${type}: ${problems.join('; ')}`);
      assert.equal(task.type, type);
    }
  });

  test('a map reply is refused without the map reader, and junk gives a reason', () => {
    assert.deepEqual(readTaskReply(MAP_FORMAT_EXAMPLE.replace(/^/, '{"task":{"visuals":[').concat(']}}')).problems, ['Maps cannot be read here.']);
    assert.equal(readTaskReply('no json here').task, null);
  });
});

test('plural "be" agrees in every tense', () => {
  const be = (tense) => verbPhrase('be', { tense, plural: true });
  assert.deepEqual(['present', 'past', 'presentPerfect', 'future', 'expected'].map(be), ['are', 'were', 'have been', 'will be', 'are expected to be']);
  assert.equal(verbPhrase('be', { tense: 'past' }), 'was');
  assert.equal(verbPhrase('level off', { tense: 'past' }), 'levelled off');
  assert.equal(verbPhrase('demolish', { tense: 'presentPerfect', voice: 'passive', plural: true, adverb: 'completely' }), 'have been completely demolished');
});
