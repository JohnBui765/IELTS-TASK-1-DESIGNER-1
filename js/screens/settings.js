// Settings tab: practice and writing options, pronunciation, appearance,
// backup and help.
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { screen, section, row, segmented, toggle, slider, sheet, actionSheet, confirm, toast } from '../ui/components.js';
import { englishVoices, allVoicesRaw, speak, supported as speechSupported, voiceQuality, voiceName, voiceAccent, currentVoice, QUALITY_LABEL } from '../ui/speech.js';
import { copyText } from '../ui/clipboard.js';
import { resetTo, push } from '../ui/router.js';
import * as store from '../data/store.js';
import { saveJson, pickFile, localDate } from '../ui/files.js';

const VERSION = '1.0';

function controlRow(title, control, subtitle) {
  return h(
    'div',
    { class: 'row settings-control' },
    h('span', { class: 'row-main' }, h('span', { class: 'row-title', style: { display: 'block' } }, title), subtitle ? h('span', { class: 'row-subtitle', style: { display: 'block' } }, subtitle) : null),
    control,
  );
}

function stackedRow(title, control) {
  return h('div', { class: 'row settings-stacked' }, h('div', { class: 'row-title' }, title), control);
}

function formatBytes(n) {
  if (!n) return '0 KB';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function exportBackup() {
  const data = await store.exportAll();
  if (await saveJson(`task1-studio-backup-${localDate()}.json`, data, { title: 'Task 1 Studio backup' })) toast('Backup saved', { icon: 'download' });
}

async function importBackup() {
  const text = await pickFile({ accept: 'application/json,.json' });
  if (text === null) return;
  let data;
  try {
    data = JSON.parse(text);
    store.validateBackup(data);
  } catch (err) {
    toast(err.message && !/JSON/.test(err.message) ? err.message : 'That file is not a valid backup.', { icon: 'xCircle', tone: 'red', duration: 3500 });
    return;
  }
  const mode = await actionSheet({
    title: `Restore ${data.tasks.length} tasks and ${data.entries.length} knowledge entries?`,
    message: 'Merge keeps what is on this phone and adds anything newer from the backup. Replace deletes what is on this phone first.',
    actions: [
      { label: 'Merge', value: 'merge' },
      { label: 'Replace everything', value: 'replace', style: 'destructive' },
    ],
  });
  if (!mode) return;
  if (mode === 'replace' && !(await confirm({ title: 'Replace all data?', message: 'Tasks, answers, knowledge and progress on this phone will be deleted.', confirmLabel: 'Replace', destructive: true }))) return;
  try {
    await store.importAll(data, { mode });
    await resetTo('settings');
    toast('Backup restored');
  } catch (err) {
    toast(err.message || 'Could not restore the backup.', { icon: 'xCircle', tone: 'red', duration: 3500 });
  }
}

function knowledgeHelp() {
  infoSheet('How adding knowledge works', [
    'Claude reads your coursebook pages and turns everything a Task 1 writer can reuse into entries. Each entry has the words to drill, a level, a note and at least three examples.',
    [
      'In Knowledge, tap + and Add knowledge from Claude. Copy the project instructions into a Claude Project once.',
      'In that project, start a chat, attach one unit (up to 100 pages) and its answer key, and send it.',
      'Copy Claude’s JSON reply, come back, paste it, check the review, and tap Add.',
    ],
    'An entry you already have is never added twice; its new examples are added to it. Every import can be undone in Knowledge › Imports.',
  ]);
}

function infoSheet(title, paragraphs) {
  sheet({
    title,
    content: h(
      'div',
      { class: 'settings-help' },
      paragraphs.map((p) =>
        Array.isArray(p)
          ? h('ol', null, p.map((li) => h('li', null, li)))
          : typeof p === 'string'
            ? h('p', null, p)
            : p,
      ),
    ),
  });
}

function installHelp() {
  infoSheet('Install on iPhone', [
    'Task 1 Studio works like a normal app once it is on your Home Screen: full screen, offline, and it keeps your tasks, answers and knowledge.',
    [
      h('span', null, 'Open this page in ', h('strong', null, 'Safari'), '.'),
      h('span', null, 'Tap the ', h('strong', null, 'Share'), ' button ', icon('share', { size: 16, className: 'inline-icon' }), ' in the toolbar.'),
      h('span', null, 'Scroll down and tap ', h('strong', null, 'Add to Home Screen'), '.'),
      h('span', null, 'Tap ', h('strong', null, 'Add'), '. Open it from the new icon.'),
    ],
    'Everything is stored only on this phone. Use Export backup now and then to keep a copy in Files or iCloud Drive.',
  ]);
}

// Voices can take up to 1.5 s to load on a cold start: ignore taps meanwhile.
let voiceSheetOpening = false;
async function voiceSheet(onPicked) {
  if (voiceSheetOpening) return;
  voiceSheetOpening = true;
  let voices;
  try {
    voices = await englishVoices();
  } finally {
    voiceSheetOpening = false;
  }
  const current = store.settings().voiceURI;
  let s;
  const pick = async (uri) => {
    await store.setSetting('voiceURI', uri);
    onPicked();
    s.close();
  };
  const preview = (v) => speak('This is how your sentences will sound.', { voiceURI: v ? v.voiceURI : '', rate: store.settings().speechRate });
  const describe = (v) => `${QUALITY_LABEL[voiceQuality(v)]} · ${voiceAccent(v)}`;
  const auto = currentVoice('');
  const voiceRow = (v) =>
    row({
      title: v ? voiceName(v) : 'Automatic',
      subtitle: v ? describe(v) : auto ? `Best on this iPhone: ${voiceName(auto)} · ${QUALITY_LABEL[voiceQuality(auto)]}` : 'Picks the clearest English voice',
      accessory: (v ? v.voiceURI : '') === current ? h('span', { class: 'check-mark' }, icon('check')) : h('span', { class: 'check-mark' }),
      onTap: () => {
        preview(v);
        pick(v ? v.voiceURI : '');
      },
    });
  const best = voices.filter((v) => voiceQuality(v) === 'premium' || voiceQuality(v) === 'enhanced');
  const standard = voices.filter((v) => voiceQuality(v) === 'default');
  const howTo = 'Download one in iPhone Settings › Accessibility › Spoken Content › Voices › English (pick a voice marked Premium or Enhanced). Then close Task 1 Studio completely — swipe it away in the app switcher — and open it again so it can see the new voice.';
  s = sheet({
    title: 'Voice',
    content: [
      section({ children: [voiceRow(null)] }),
      best.length
        ? section({ header: 'Best quality', footer: 'Premium and Enhanced voices sound much more natural and work offline.', children: best.map(voiceRow) })
        : section({ header: 'Best quality', children: [h('div', { class: 'row voice-empty' }, h('span', { class: 'row-main' }, h('span', { class: 'row-title', style: { display: 'block' } }, 'No Premium or Enhanced voices found'), h('span', { class: 'row-subtitle', style: { display: 'block' } }, howTo)))] }),
      standard.length ? section({ header: 'Standard', footer: best.length ? 'Standard voices are the small built-in ones and sound robotic.' : null, children: standard.map(voiceRow) }) : null,
      section({ children: [row({ title: 'Every voice this iPhone shares', subtitle: 'The raw list, all languages, for troubleshooting', onTap: () => voiceDiagnostics() })] }),
      !voices.length ? h('p', { class: 'muted small', style: { padding: '0 16px' } }, 'No English voices were found on this device.') : null,
    ],
  });
}

// Shows exactly what speechSynthesis.getVoices() returns, unfiltered, with a
// Copy button so the list can be shared when a downloaded voice is missing.
async function voiceDiagnostics() {
  const raw = await allVoicesRaw();
  const english = raw.filter((v) => /^en([-_]|$)/i.test(v.lang || ''));
  const ua = navigator.userAgent;
  const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  const report = [
    `Task 1 Studio voice report`,
    `Voices reported: ${raw.length} (English: ${english.length})`,
    `Home Screen app: ${standalone ? 'yes' : 'no'}`,
    `Browser: ${ua}`,
    '',
    ...raw.map((v) => `${v.name} | ${v.lang} | ${v.voiceURI}${v.localService ? '' : ' | online'}${v.default ? ' | default' : ''}`),
  ].join('\n');
  const voiceLine = (v) =>
    row({
      title: v.name,
      subtitle: `${v.lang} · ${v.voiceURI}`,
      detail: QUALITY_LABEL[voiceQuality(v)],
      accessory: 'none',
    });
  sheet({
    title: 'Every voice',
    right: { label: 'Copy', strong: true, onTap: async () => toast((await copyText(report)) ? 'Voice list copied' : 'Could not copy', { icon: 'copy', tone: 'accent' }) },
    content: [
      h(
        'p',
        { class: 'muted small', style: { margin: '0 4px 14px' } },
        `Safari gave the app ${raw.length} voices (${english.length} English). This is everything the app can use — a voice missing here cannot be reached from a web app.`,
      ),
      english.length ? section({ header: 'English', children: english.map(voiceLine) }) : null,
      raw.length > english.length ? section({ header: 'Other languages', children: raw.filter((v) => !english.includes(v)).map(voiceLine) }) : null,
    ],
  });
}

export default async function create() {
  const st = store.settings();
  const voiceDetail = h('span', null, 'Automatic');
  const refreshVoiceName = async () => {
    const uri = store.settings().voiceURI;
    await englishVoices();
    const v = currentVoice(uri);
    voiceDetail.textContent = v ? `${uri ? '' : 'Auto · '}${voiceName(v)}${voiceQuality(v) === 'default' ? '' : ` (${QUALITY_LABEL[voiceQuality(v)]})`}` : 'Automatic';
  };
  refreshVoiceName();
  const set = (key) => (value) => store.setSetting(key, value);
  const storageRowDetail = h('span', null, '…');
  store.storageStatus().then((s) => {
    storageRowDetail.textContent = s.durable ? `${formatBytes(s.usage)}${s.persistent ? ' · protected' : ''}` : 'Temporary';
    if (!s.durable) storageRowDetail.classList.add('settings-warn');
  });

  const body = [
    section({
      header: 'Practice',
      footer: 'Typing makes you produce the exact words; choosing is quicker on a phone.',
      children: [
        stackedRow('Answer by', segmented({ options: [{ value: 'type', label: 'Typing' }, { value: 'choose', label: 'Choosing' }], value: st.answerMode, onChange: set('answerMode') })),
        stackedRow('Phrases per review', segmented({ options: [10, 20, 30, 50].map((n) => ({ value: n, label: String(n) })), value: st.reviewLimit, onChange: set('reviewLimit') })),
      ],
    }),
    section({
      header: 'Writing',
      footer: 'The exam gives about 20 minutes for Task 1. The timer starts with your first keystroke.',
      children: [stackedRow('Timer', segmented({ options: [15, 20, 25, 30].map((n) => ({ value: n, label: `${n} min` })), value: st.writeMinutes, onChange: set('writeMinutes') }))],
    }),
    section({
      header: 'Pronunciation',
      footer: speechSupported ? null : 'Speech is not available in this browser.',
      children: [
        row({ title: 'Voice', detail: voiceDetail, onTap: () => voiceSheet(refreshVoiceName) }),
        stackedRow(
          'Speed',
          slider({
            min: 0.5,
            max: 1.2,
            step: 0.05,
            value: st.speechRate,
            format: (v) => `${Math.round(v * 100)}%`,
            onChange: (v) => {
              store.setSetting('speechRate', v);
              speak('The figure rose sharply.', { rate: v, voiceURI: store.settings().voiceURI });
            },
            ariaLabel: 'Speech speed',
          }),
        ),
        controlRow('Read the sentence after answering', toggle({ checked: st.autoSpeak, onChange: set('autoSpeak'), label: 'Read the sentence after answering' })),
        row({
          title: 'Test voice',
          accent: true,
          accessory: h('span', { class: 'row-chevron' }, icon('speaker')),
          onTap: () => speak('Overall, coal exports rose steadily, peaking at 352 million tonnes in 2020.', { rate: store.settings().speechRate, voiceURI: store.settings().voiceURI }),
        }),
      ],
    }),
    section({
      header: 'Appearance',
      children: [stackedRow('Theme', segmented({ options: [{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }], value: st.theme, onChange: set('theme') }))],
    }),
    section({
      header: 'Backup',
      footer: 'Everything lives only on this phone. Export a backup to Files or iCloud Drive now and then.',
      children: [
        row({ icon: 'upload', iconBg: 'var(--blue)', title: 'Export backup', onTap: () => exportBackup() }),
        row({ icon: 'download', iconBg: 'var(--green)', title: 'Restore from backup', onTap: () => importBackup() }),
        row({
          icon: 'info',
          iconBg: store.isPersistentStorage() ? 'var(--gray)' : 'var(--red)',
          title: 'Storage',
          subtitle: store.isPersistentStorage() ? null : 'Unavailable: data is lost when the app closes',
          detail: storageRowDetail,
        }),
      ],
    }),
    section({
      header: 'Help',
      children: [
        row({ icon: 'phone', iconBg: 'var(--accent)', title: 'Install on iPhone', onTap: installHelp }),
        row({ icon: 'sparkles', iconBg: 'var(--orange)', title: 'How adding knowledge works', onTap: knowledgeHelp }),
        row({ icon: 'download', iconBg: 'var(--teal)', title: 'Imports', onTap: () => push('packs') }),
      ],
    }),
    h('p', { class: 'settings-version' }, `Task 1 Studio ${VERSION}`),
  ];

  const s = screen({ title: 'Settings', tab: 'settings', body });
  return { el: s.el, title: 'Settings' };
}
