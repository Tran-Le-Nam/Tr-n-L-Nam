import React from 'react';
import { ArrowDown, ArrowUp, Crosshair, Trash2 } from 'lucide-react';
import { BANG_MAU } from '../math/inequality';

export interface RowModel {
  id: string;
  text: string;
  colorIndex: number;
  angle: number; // -1 = Tự động, 0..179
  spacing: number; // pt
  labelPosition: number; // 0..100 %
  showLabel: boolean;
  fill: boolean;
  opacity: number; // 5..100 %
}

interface InequalityRowProps {
  index: number;
  total: number;
  row: RowModel;
  error?: string;
  isSelecting: boolean;
  onChange: (id: string, patch: Partial<RowModel>) => void;
  onMove: (id: string, delta: -1 | 1) => void;
  onDelete: (id: string) => void;
  onToggleSelect: (id: string) => void;
}

export const InequalityRow: React.FC<InequalityRowProps> = ({
  index,
  total,
  row,
  error,
  isSelecting,
  onChange,
  onMove,
  onDelete,
  onToggleSelect,
}) => {
  const colorDef = BANG_MAU[row.colorIndex] ?? BANG_MAU[3];
  const [r, g, b] = colorDef.rgb;
  const isBright = 0.299 * r + 0.587 * g + 0.114 * b > 140;
  const textHex = isBright ? '#0f172a' : `rgb(${r}, ${g}, ${b})`;
  const swatchHex = `rgb(${r}, ${g}, ${b})`;

  return (
    <div
      className={`rounded-lg border p-2.5 transition-colors ${
        error
          ? 'border-rose-300 bg-rose-50/40'
          : isSelecting
          ? 'border-pink-400 bg-pink-50/30'
          : 'border-slate-200 bg-white'
      }`}
      data-testid={`inequality-row-${index}`}
    >
      {/* Line 1: label, expression input, 3-point button, up/down/delete */}
      <div className="flex flex-wrap items-center gap-1.5">
        <label
          htmlFor={`expr-${row.id}`}
          className="w-14 shrink-0 text-xs font-semibold text-slate-700"
        >
          Hàm {index + 1}
        </label>

        <input
          id={`expr-${row.id}`}
          type="text"
          value={row.text}
          placeholder="vd: 2x+3y<6"
          onChange={(e) => {
            const val = e.target.value.replace(/[^-+*/0-9xyXY><. ()]/g, '');
            onChange(row.id, { text: val });
          }}
          style={{ color: error ? '#9f1239' : textHex }}
          title={error || 'Nhập bất phương trình bậc nhất hai ẩn, ví dụ 2x+3y<6'}
          aria-invalid={Boolean(error)}
          className={`min-w-[140px] flex-1 rounded-md border px-2.5 py-1.5 font-mono text-sm font-medium outline-none transition-colors focus-visible:ring-2 ${
            error
              ? 'border-rose-400 bg-rose-50 focus-visible:ring-rose-300'
              : 'border-slate-300 bg-white focus-visible:border-sky-500 focus-visible:ring-sky-200'
          }`}
        />

        <button
          type="button"
          onClick={() => onToggleSelect(row.id)}
          aria-pressed={isSelecting}
          title="Nhập hàm bằng cách click 2 điểm trên đường biên và 1 điểm trong miền nghiệm trên hình xem trước"
          className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
            isSelecting
              ? 'border-pink-600 bg-pink-600 text-white hover:bg-pink-700'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{isSelecting ? 'Đang chọn…' : 'Chọn 3 điểm'}</span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(row.id, -1)}
            aria-label={`Chuyển Hàm ${index + 1} lên trên`}
            title="Chuyển lên trên"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={index >= total - 1}
            onClick={() => onMove(row.id, 1)}
            aria-label={`Chuyển Hàm ${index + 1} xuống dưới`}
            title="Chuyển xuống dưới"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(row.id)}
            aria-label={`Xóa Hàm ${index + 1}`}
            title="Xóa hàm này"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-1.5 pl-14 text-xs font-medium text-rose-700" role="alert">
          {error}
        </p>
      )}

      {/* Line 2: color, style (hatch vs fill), opacity */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2 pl-14 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-4 w-4 shrink-0 rounded border border-slate-400"
            style={{ backgroundColor: swatchHex }}
          />
          <select
            aria-label={`Màu cho Hàm ${index + 1}`}
            value={row.colorIndex}
            onChange={(e) => onChange(row.id, { colorIndex: Number(e.target.value) })}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus-visible:border-sky-500"
          >
            {BANG_MAU.map((m, idx) => (
              <option key={m.tikz} value={idx}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-1.5">
          <span>Kiểu:</span>
          <select
            aria-label={`Kiểu thể hiện Hàm ${index + 1}`}
            value={row.fill ? 'fill' : 'hatch'}
            onChange={(e) => onChange(row.id, { fill: e.target.value === 'fill' })}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus-visible:border-sky-500"
          >
            <option value="hatch">Gạch sọc</option>
            <option value="fill">Tô màu</option>
          </select>
        </label>

        {row.fill && (
          <label className="flex items-center gap-1.5">
            <span>Độ đậm:</span>
            <input
              type="number"
              min={5}
              max={100}
              step={5}
              value={row.opacity}
              onChange={(e) => {
                const v = Math.min(100, Math.max(5, Math.round(Number(e.target.value) || 25)));
                onChange(row.id, { opacity: v });
              }}
              className="w-14 rounded border border-slate-300 bg-white px-1.5 py-1 text-right font-mono text-xs text-slate-800 tabular-nums outline-none focus-visible:border-sky-500"
            />
            <span>%</span>
          </label>
        )}
      </div>

      {/* Line 3: hatch controls when Gạch sọc */}
      {!row.fill && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 pl-14 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <span>Góc sọc:</span>
            <select
              aria-label={`Chế độ góc sọc Hàm ${index + 1}`}
              value={row.angle < 0 ? 'auto' : 'custom'}
              onChange={(e) =>
                onChange(row.id, { angle: e.target.value === 'auto' ? -1 : 60 })
              }
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus-visible:border-sky-500"
            >
              <option value="auto">Tự động</option>
              <option value="custom">Tùy chỉnh</option>
            </select>
            {row.angle >= 0 && (
              <label className="flex items-center gap-1">
                <input
                  type="number"
                  aria-label={`Giá trị góc sọc Hàm ${index + 1}`}
                  min={0}
                  max={179}
                  value={row.angle}
                  onChange={(e) => {
                    const v = Math.min(179, Math.max(0, Math.round(Number(e.target.value) || 0)));
                    onChange(row.id, { angle: v });
                  }}
                  className="w-14 rounded border border-slate-300 bg-white px-1.5 py-1 text-right font-mono text-xs text-slate-800 tabular-nums outline-none focus-visible:border-sky-500"
                />
                <span>°</span>
              </label>
            )}
          </div>

          <label className="flex items-center gap-1.5">
            <span>Cách nhau:</span>
            <input
              type="number"
              min={0.5}
              max={30}
              step={0.5}
              value={row.spacing}
              onChange={(e) => {
                const v = Math.min(30, Math.max(0.5, Number(e.target.value) || 3));
                onChange(row.id, { spacing: v });
              }}
              className="w-14 rounded border border-slate-300 bg-white px-1.5 py-1 text-right font-mono text-xs text-slate-800 tabular-nums outline-none focus-visible:border-sky-500"
            />
            <span>pt</span>
          </label>
        </div>
      )}

      {/* Line 4: label visibility + position */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 pl-14 text-xs text-slate-600">
        <label className="flex cursor-pointer items-center gap-1.5 select-none">
          <input
            type="checkbox"
            checked={row.showLabel}
            onChange={(e) => onChange(row.id, { showLabel: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          <span>Hiện nhãn trên đường</span>
        </label>

        <label className="flex items-center gap-1.5">
          <span className={row.showLabel ? '' : 'text-slate-400'}>Vị trí nhãn:</span>
          <input
            type="number"
            min={0}
            max={100}
            step={5}
            disabled={!row.showLabel}
            value={row.labelPosition}
            onChange={(e) => {
              const v = Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0)));
              onChange(row.id, { labelPosition: v });
            }}
            className="w-14 rounded border border-slate-300 bg-white px-1.5 py-1 text-right font-mono text-xs text-slate-800 tabular-nums outline-none focus-visible:border-sky-500 disabled:bg-slate-50 disabled:text-slate-400"
          />
          <span className={row.showLabel ? '' : 'text-slate-400'}>%</span>
        </label>
      </div>
    </div>
  );
};
