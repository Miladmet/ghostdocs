// lib/sample-vault.ts
// SYNTHETIC DEMO DATA. Every document below is entirely fictional: the people,
// projects, figures and events are invented for demonstration purposes and do
// not refer to any real organisation or person. Files are built in memory, so
// loading the sample vault needs no network request.

export type SampleVaultFile = { name: string; type: string; content: string };

const SAMPLE_MD = [
  '# Project Specter Architecture Review',
  'Author: Evelyn Cross',
  '',
  '## Overview',
  'This review describes the architecture of Project Specter, a fictional internal platform that catalogues legacy engineering records. The platform has three layers: an intake layer, an indexing layer and a presentation layer. Following the merger in September 2021, the two engineering groups combined their record systems into one shared archive. The archive now serves about forty teams.',
  '',
  '## Funding',
  'The Q3 FY2024 budget allocation of $450,000 covers storage and tooling.',
  '',
  '## Governance',
  'The security constitution was ratified on 14 September 2024. It requires encrypted storage, regular access reviews and written sign-off for every new data source. Reviewers should confirm that each new data source follows the constitution before it joins the archive.',
  '',
].join('\n');

const SAMPLE_TXT = [
  'Organizational Memory Field Report',
  'Prepared by: Marcus Sterling',
  '',
  '== Findings ==',
  'In the previous quarter, revenues fell by twelve percent. The finance team linked the drop to delayed renewals and a slower intake of new work. Management asked for a closer review of how funds are assigned.',
  '',
  'The Q3 FY2024 budget allocation of $310,000 was recorded in the finance ledger.',
  '',
  '== Legacy Engineering Audit Notes ==',
  'Note one: the nightly batch scheduler has no retry logic after a failed run. Note two: the records index is rebuilt by hand whenever a source folder is renamed. Note three: several old interface documents have no named owner.',
  '',
].join('\n');

export const SAMPLE_VAULT_FILES: ReadonlyArray<SampleVaultFile> = [
  { name: 'sample.md', type: 'text/markdown', content: SAMPLE_MD },
  { name: 'q3-audit.txt', type: 'text/plain', content: SAMPLE_TXT },
];

/** Builds the sample vault as in-memory File objects (no network access). */
export function createSampleVaultFiles(): File[] {
  return SAMPLE_VAULT_FILES.map(
    ({ name, type, content }) => new File([content], name, { type })
  );
}
