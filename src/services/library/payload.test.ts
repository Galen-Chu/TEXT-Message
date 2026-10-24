import { describe, expect, it } from 'vitest';
import { buildLibraryPayload, isValidLibraryPayload, LIBRARY_SCHEMA_VERSION } from './payload';

const base = {
  templates: [],
  copyTemplates: [],
  scheduleItems: [],
  publishedHistory: [],
  drafts: [],
  activeDraftId: null,
  activeTemplateId: null,
  draftText: '草稿',
  draftPlatforms: { fb: true, ig: true, threads: false, line: false, yt: false, linkedin: false },
  draftSourceId: 'blank',
  draftKind: 'copy' as const,
  aiRole: null,
  aiLanguage: '繁體中文' as const,
  driveStyleSamples: [],
  driveStyleEnabled: true,
};

describe('文庫雲端備份:payload(方案 A)', () => {
  it('組裝:帶 schema 版本與 savedAt', () => {
    const p = buildLibraryPayload(base);
    expect(p.schema).toBe(LIBRARY_SCHEMA_VERSION);
    expect(typeof p.savedAt).toBe('number');
    expect(p.draftText).toBe('草稿');
  });

  it('驗證:完整形狀通過;缺陣列/錯型別/版號不符拒絕', () => {
    expect(isValidLibraryPayload(buildLibraryPayload(base))).toBe(true);

    const noArr = { ...buildLibraryPayload(base), drafts: undefined };
    expect(isValidLibraryPayload(noArr)).toBe(false);
    const badText = { ...buildLibraryPayload(base), draftText: 123 };
    expect(isValidLibraryPayload(badText)).toBe(false);
    const badSchema = { ...buildLibraryPayload(base), schema: 99 };
    expect(isValidLibraryPayload(badSchema)).toBe(false);
    expect(isValidLibraryPayload(null)).toBe(false);
    expect(isValidLibraryPayload('x')).toBe(false);
  });

  it('diary 欄位(D2,2026-10-24):選用——舊備份無此欄仍通過;有帶則須為陣列', () => {
    expect(isValidLibraryPayload(buildLibraryPayload(base))).toBe(true); // 舊備份形狀(無 diary)
    expect(isValidLibraryPayload(buildLibraryPayload({ ...base, diary: [] }))).toBe(true);
    expect(isValidLibraryPayload({ ...buildLibraryPayload(base), diary: 'nope' })).toBe(false);
  });
});
