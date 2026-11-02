import { describe, expect, it } from 'vitest';
import type { AutoPipeline } from '../../types';
import {
  buildLibraryPayload,
  isPipelineSettings,
  isValidLibraryPayload,
  LIBRARY_SCHEMA_VERSION,
  pipelineSettingsOf,
} from './payload';

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

  it('pipelineSettings 欄位(2026-11-02 折衷):選用——payload 層鬆驗(物件即可),壞形狀由還原端嚴格擋', () => {
    const full: AutoPipeline = {
      enabled: true,
      platform: 'threads',
      time: '08:30',
      daysOfWeek: [],
      source: 'journal-ai',
      horizonDays: 14,
      queuedThrough: '2026-11-05',
      lastFilledAt: 123,
      journalFileId: 'doc-1',
      journalFileName: '夢境日誌',
      usedJournalDates: ['2026-10-20'],
      sourceCategory: '日常分享',
      usedTemplateIds: ['t1'],
    };
    // 投影只含設定+素材游標——enabled/queuedThrough/lastFilledAt 刻意不帶
    const ps = pipelineSettingsOf(full);
    expect(ps).toEqual({
      platform: 'threads',
      time: '08:30',
      daysOfWeek: [],
      source: 'journal-ai',
      horizonDays: 14,
      journalFileId: 'doc-1',
      journalFileName: '夢境日誌',
      usedJournalDates: ['2026-10-20'],
      sourceCategory: '日常分享',
      usedTemplateIds: ['t1'],
    });
    const p = buildLibraryPayload({ ...base, pipelineSettings: ps });
    expect(isValidLibraryPayload(p)).toBe(true);
    expect(p.pipelineSettings?.time).toBe('08:30');
    expect(isValidLibraryPayload(buildLibraryPayload(base))).toBe(true); // 舊備份(無此欄)照樣通過
    expect(isValidLibraryPayload({ ...p, pipelineSettings: 'nope' })).toBe(false); // 非物件擋下
    expect(isValidLibraryPayload({ ...p, pipelineSettings: { time: '08:30' } })).toBe(true); // 鬆驗:半套也通過(嚴格與否是還原端的事)
  });

  it('isPipelineSettings(還原端嚴格驗證):完整形狀通過;任一欄壞即整份不套用', () => {
    const ok = pipelineSettingsOf({
      enabled: false,
      platform: 'threads',
      time: '09:00',
      daysOfWeek: [],
      source: 'templates',
      horizonDays: 7,
      queuedThrough: '',
      lastFilledAt: 0,
      journalFileId: '',
      journalFileName: '',
      usedJournalDates: [],
      usedTemplateIds: [],
    });
    expect(isPipelineSettings(ok)).toBe(true);
    expect(isPipelineSettings(undefined)).toBe(false);
    expect(isPipelineSettings(null)).toBe(false);
    expect(isPipelineSettings({ ...ok, platform: 'plurk' })).toBe(false); // 不在 PLATFORM_META
    expect(isPipelineSettings({ ...ok, time: '9:00' })).toBe(false); // 非 HH:mm
    expect(isPipelineSettings({ ...ok, time: '0800' })).toBe(false);
    expect(isPipelineSettings({ ...ok, source: 'rss' })).toBe(false);
    expect(isPipelineSettings({ ...ok, horizonDays: '14' })).toBe(false);
    expect(isPipelineSettings({ ...ok, horizonDays: Number.NaN })).toBe(false);
    expect(isPipelineSettings({ ...ok, journalFileId: 123 })).toBe(false);
    expect(isPipelineSettings({ ...ok, usedJournalDates: ['2026-10-20', 7] })).toBe(false);
    expect(isPipelineSettings({ ...ok, usedTemplateIds: 't1' })).toBe(false);
    expect(isPipelineSettings({ ...ok, daysOfWeek: ['一'] })).toBe(false);
    expect(isPipelineSettings({ ...ok, sourceCategory: 3 })).toBe(false);
    expect(isPipelineSettings({ ...ok, sourceCategory: '日常分享' })).toBe(true); // 選用欄位合法值
  });

  it('notes 欄位(POST-PLAN D2,2026-11-01):選用——舊備份無此欄仍通過;有帶則須為陣列', () => {
    expect(isValidLibraryPayload(buildLibraryPayload(base))).toBe(true); // 舊備份形狀(無 notes)
    expect(isValidLibraryPayload(buildLibraryPayload({ ...base, notes: [] }))).toBe(true);
    expect(isValidLibraryPayload({ ...buildLibraryPayload(base), notes: 'nope' })).toBe(false);
    // 兩個選用欄位互不牽連:只有日記的備份照樣有效(便條端以 null 表示「此備份不含」)
    expect(isValidLibraryPayload(buildLibraryPayload({ ...base, diary: [] }))).toBe(true);
  });
});
