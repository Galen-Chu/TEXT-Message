import { describe, expect, it } from 'vitest';
import { LIBRARY_BACKUP_COPY } from './constants';

/**
 * 還原確認文案的誠實標示守門(2026-11-01,POST-PLAN D2)。
 * 日記與便條都是**不可再生**的第一方內容,且備份 payload 的 diary/notes 皆為選用欄位——
 * 舊備份沒帶就不動本機資料(restoreLibraryApply)。使用者按下「覆蓋本機並還原」之前,
 * 必須在同一句話裡看到「哪些有、哪些沒有、沒有的會保持不變」,否則這個刻意的偏離
 * (舊快照不清空現存日記/便條)對使用者是隱形的。文案一旦被改成只講覆蓋,這裡就紅。
 */
describe('LIBRARY_BACKUP_COPY.confirmDesc', () => {
  it('兩者皆有:標示篇數與張數,不出現「保持不變」', () => {
    const s = LIBRARY_BACKUP_COPY.confirmDesc('11/01 09:30', 3, 2);
    expect(s).toContain('11/01 09:30');
    expect(s).toContain('日記(3 篇)');
    expect(s).toContain('便條(2 張)');
    expect(s).not.toContain('保持不變');
  });

  it('只有日記(舊備份無 notes):便條明示保持不變', () => {
    const s = LIBRARY_BACKUP_COPY.confirmDesc('11/01 09:30', 1, null);
    expect(s).toContain('日記(1 篇)');
    expect(s).toContain('不含便條');
    expect(s).toContain('本機便條保持不變');
  });

  it('只有便條(舊備份無 diary):日記明示保持不變', () => {
    const s = LIBRARY_BACKUP_COPY.confirmDesc('11/01 09:30', null, 5);
    expect(s).toContain('便條(5 張)');
    expect(s).toContain('不含日記');
    expect(s).toContain('本機日記保持不變');
  });

  it('兩者皆無(最舊的備份):兩類都明示保持不變', () => {
    const s = LIBRARY_BACKUP_COPY.confirmDesc('11/01 09:30', null, null);
    expect(s).toContain('不含日記與便條');
    expect(s).toContain('本機日記與便條保持不變');
    expect(s).not.toContain('篇)');
    expect(s).not.toContain('張)');
  });

  it('零筆不等於沒有:0 要顯示篇/張數,不可講成「不含」', () => {
    const s = LIBRARY_BACKUP_COPY.confirmDesc('11/01 09:30', 0, 0);
    expect(s).toContain('日記(0 篇)');
    expect(s).toContain('便條(0 張)');
    expect(s).not.toContain('保持不變');
  });
});
