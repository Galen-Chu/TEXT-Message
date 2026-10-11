import { FAMILY_COPY, PLATFORM_META } from '../constants';
import type { AppStore } from '../hooks/useAppStore';
import { PEER_URL } from '../services/family/config';
import type { PlatformKey } from '../types';
import { shortDateTimeLabel } from '../utils/date';

/**
 * 家族串接卡(U2–U4,2026-10-12)。放在文庫 Library——IA-D7 ② 把深層串接定在
 * 文庫 Library ↔ 媒庫 Library 之間;側欄只放常駐切換連結。
 *
 * 零後端:全部走同源 localStorage 的 `family:*` 契約鍵,因此**不受 backendEnabled 影響**,
 * 示範模式建置也會出現。
 */
export default function FamilyCard({ store }: { store: AppStore }) {
  const feed = store.familyPeerFeed;

  return (
    <div className="card" style={{ padding: 16, marginBottom: 20 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          marginBottom: 4,
        }}
      >
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-main)' }}>
          {FAMILY_COPY.cardTitle}
        </div>
        <a
          className="btn btn-ghost"
          href={PEER_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'none', flexShrink: 0 }}
        >
          {FAMILY_COPY.openPeerButton}
        </a>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginBottom: 12 }}>
        {FAMILY_COPY.cardDesc}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        {/* U3:本機送出、對方尚未取用的交接 */}
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-sub)', marginBottom: 4 }}>
            {store.familyPendingCount > 0
              ? FAMILY_COPY.pendingLabel(store.familyPendingCount)
              : FAMILY_COPY.pendingNone}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{FAMILY_COPY.pendingHint}</div>
        </div>

        {/* U4:對方的唯讀排程摘要;陳舊或從未發佈即整區降級為說明文字 */}
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-sub)' }}>
              {FAMILY_COPY.peerFeedTitle}
            </span>
            {feed && (
              <span style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
                {FAMILY_COPY.peerFeedAsOf(shortDateTimeLabel(feed.updatedAt))}
              </span>
            )}
          </div>
          {!feed && (
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              {FAMILY_COPY.peerFeedUnavailable}
            </div>
          )}
          {feed && feed.items.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{FAMILY_COPY.peerFeedEmpty}</div>
          )}
          {feed && feed.items.length > 0 && (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {feed.items.map((item, idx) => (
                <li
                  key={`${item.when}-${idx}`}
                  style={{ display: 'flex', gap: 8, fontSize: 11.5, color: 'var(--text-sub)' }}
                >
                  <span style={{ color: 'var(--text-faint)', flexShrink: 0 }}>
                    {shortDateTimeLabel(item.when)}
                  </span>
                  {/* 平台識別字由對方產品提供,未知值照原字串顯示(不假設兩邊平台集合一致) */}
                  <span style={{ fontWeight: 700, flexShrink: 0 }}>
                    {PLATFORM_META[item.platform as PlatformKey]?.label ?? item.platform}
                  </span>
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.snippet}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
