import { Star } from 'lucide-react';

export function Rating({ value, size = 16, showValue = false, count }: { value: number; size?: number; showValue?: boolean; count?: number }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <div className="inline-flex items-center gap-1">
      <div className="flex items-center">
        {[0, 1, 2, 3, 4].map((i) => {
          const isFull = i < full;
          const isHalf = i === full && half;
          return (
            <Star
              key={i}
              width={size}
              height={size}
              className={
                isFull
                  ? 'fill-amber-400 text-amber-400'
                  : isHalf
                    ? 'fill-amber-400/50 text-amber-400'
                    : 'fill-slate-200 text-slate-200'
              }
            />
          );
        })}
      </div>
      {showValue && <span className="text-sm font-medium text-slate-700">{value.toFixed(1)}</span>}
      {count !== undefined && <span className="text-xs text-slate-500">({count})</span>}
    </div>
  );
}
