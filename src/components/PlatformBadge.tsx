import { PLATFORM_META } from '../constants';
import type { PlatformKey } from '../types';

export default function PlatformBadge({
  platform,
  size = 34,
  radius = 9,
  fontSize = 12,
}: {
  platform: PlatformKey;
  size?: number;
  radius?: number;
  fontSize?: number;
}) {
  const meta = PLATFORM_META[platform];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: meta.color,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize,
        flexShrink: 0,
      }}
    >
      {meta.badge}
    </div>
  );
}
