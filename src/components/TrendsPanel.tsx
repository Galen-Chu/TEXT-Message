import { useMemo, useState } from 'react';
import { PLATFORM_LIST, PLATFORM_META, TRENDS_COPY } from '../constants';
import type { SocialPost } from '../types';
import { buildTrendSummary, TRENDS_THRESHOLD } from '../utils/trends';

/**
 * 發文趨勢面板(文管庫深化第三期)。資料來源僅 publishedHistory(真實記錄);
 * 未達門檻時 full 型顯示累積提示、compact 型不渲染。
 * 視覺:單一色相(品牌紫)長條表量級,平台識別由每列 badge+文字攜帶——
 * 不以平台色作長條填充(近黑/低對比在深色模式不可見,見 LIBRARY-PLAN 設計原則)。
 */

function BarRow({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 && count > 0 ? Math.max(4, Math.round((count / max) * 100)) : 0;
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}
      title={`${label}:${count} ${TRENDS_COPY.postsUnit}`}
    >
      <div style={{ width: 92, flexShrink: 0, fontSize: 11.5, color: 'var(--text-sub)' }}>{label}</div>
      <div
        style={{
          flex: 1,
          height: 10,
          borderRadius: 5,
          background: 'var(--bg)',
          border: '1px solid var(--border-2)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: 'var(--brand)',
            borderRadius: '2px 4px 4px 2px',
          }}
        />
      </div>
      <div
        style={{
          width: 34,
          flexShrink: 0,
          fontSize: 11.5,
          fontWeight: 700,
          color: 'var(--text-sub)',
          textAlign: 'right',
        }}
      >
        {count}
      </div>
    </div>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--border-2)',
        borderRadius: 12,
        padding: '12px 14px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-main)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-weak)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function TrendsPanel({
  posts,
  variant = 'full',
}: {
  posts: SocialPost[];
  variant?: 'full' | 'compact';
}) {
  const [period, setPeriod] = useState<30 | 90>(30);
  const summary = useMemo(() => buildTrendSummary(posts), [posts]);

  if (posts.length < TRENDS_THRESHOLD) {
    if (variant === 'compact') return null;
    return (
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>
          {TRENDS_COPY.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          {TRENDS_COPY.accumulating(posts.length, TRENDS_THRESHOLD)}
        </div>
      </div>
    );
  }

  const counts = period === 30 ? summary.counts30 : summary.counts90;
  const platformRows = PLATFORM_LIST.map((p) => ({
    label: PLATFORM_META[p.key].label,
    count: counts[p.key] ?? 0,
  }));
  const platformMax = Math.max(...platformRows.map((r) => r.count));
  const hourMax = Math.max(...summary.hourBuckets, 1);

  if (variant === 'compact') {
    return (
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
            {TRENDS_COPY.dashboardTitle}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            {TRENDS_COPY.streakLabel} {TRENDS_COPY.daysUnit(summary.currentStreak)} ·{' '}
            {TRENDS_COPY.totalLabel(summary.total)}
          </div>
        </div>
        {platformRows.map((r) => (
          <BarRow key={r.label} label={r.label} count={r.count} max={platformMax} />
        ))}
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 18, marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
          {TRENDS_COPY.title}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {([30, 90] as const).map((p) => {
            const active = period === p;
            const label = p === 30 ? TRENDS_COPY.period30 : TRENDS_COPY.period90;
            return (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 8,
                  fontSize: 11.5,
                  fontWeight: 600,
                  background: active ? 'var(--pill-purple-bg)' : 'var(--card)',
                  color: active ? 'var(--brand)' : 'var(--text-faint)',
                  border: `1px solid ${active ? 'var(--brand)' : 'var(--border-3)'}`,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 14 }}>
        {TRENDS_COPY.note} · {TRENDS_COPY.totalLabel(summary.total)}
      </div>

      <div className="trends-grid" style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="field-label" style={{ marginBottom: 10 }}>
            {TRENDS_COPY.platformCountsTitle}
          </div>
          {platformRows.map((r) => (
            <BarRow key={r.label} label={r.label} count={r.count} max={platformMax} />
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div className="field-label" style={{ marginBottom: 10 }}>
            {TRENDS_COPY.hourTitle}
          </div>
          {TRENDS_COPY.hourLabels.map((label, i) => (
            <BarRow key={label} label={label} count={summary.hourBuckets[i]} max={hourMax} />
          ))}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
          marginTop: 16,
        }}
      >
        <StatTile value={TRENDS_COPY.daysUnit(summary.currentStreak)} label={TRENDS_COPY.streakLabel} />
        <StatTile value={TRENDS_COPY.daysUnit(summary.longestStreak)} label={TRENDS_COPY.longestLabel} />
        <StatTile
          value={String(summary.singlePlatformDays)}
          label={`${TRENDS_COPY.dayMixTitle} · ${TRENDS_COPY.singleDay}`}
        />
        <StatTile
          value={String(summary.crossPlatformDays)}
          label={`${TRENDS_COPY.dayMixTitle} · ${TRENDS_COPY.multiDay}`}
        />
      </div>
    </div>
  );
}
