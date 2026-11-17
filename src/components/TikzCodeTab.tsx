import React, { useMemo } from 'react';
import { Check, Copy, Info } from 'lucide-react';
import { highlightTikzLine } from '../utils/tikzHighlighter';

interface TikzCodeTabProps {
  code: string;
  libraryNotice: string;
  copied: boolean;
  onCopy: () => void;
}

export const TikzCodeTab: React.FC<TikzCodeTabProps> = ({
  code,
  libraryNotice,
  copied,
  onCopy,
}) => {
  const lines = useMemo(() => {
    const raw = code.endsWith('\n') ? code.slice(0, -1) : code;
    return raw ? raw.split('\n') : [];
  }, [code]);

  return (
    <div className="flex h-full min-h-[420px] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700">
        <div className="flex items-start gap-2 leading-relaxed">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden="true" />
          <span>{libraryNotice}</span>
        </div>
        <button
          type="button"
          onClick={onCopy}
          disabled={!code.trim()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              <span>Đã sao chép ✓</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <span>Sao chép mã</span>
            </>
          )}
        </button>
      </div>

      <div className="relative flex-1 overflow-auto rounded-lg border border-slate-200 bg-white">
        {lines.length === 0 ? (
          <div className="flex h-full min-h-[300px] items-center justify-center p-6 text-sm text-slate-500">
            Chưa có mã TikZ — hãy nhập ít nhất một bất phương trình hợp lệ hoặc sửa khung nhìn.
          </div>
        ) : (
          <pre
            aria-label="Mã nguồn TikZ"
            data-testid="tikz-code-output"
            className="m-0 min-w-max p-4 font-mono text-[13px] leading-6"
            style={{ tabSize: 4 }}
          >
            <code>
              {lines.map((line, lineIdx) => {
                // Convert leading tabs to explicit 0.6cm-equivalent indentation (~24px) for consistent cross-browser display
                const spans = highlightTikzLine(line);
                return (
                  <div key={lineIdx} className="flex hover:bg-slate-50/80">
                    <span
                      aria-hidden="true"
                      className="mr-4 inline-block w-8 select-none text-right text-slate-400 tabular-nums"
                    >
                      {lineIdx + 1}
                    </span>
                    <span className="whitespace-pre">
                      {spans.map((sp, sIdx) => (
                        <span key={sIdx} className={sp.className}>
                          {sp.text}
                        </span>
                      ))}
                    </span>
                  </div>
                );
              })}
            </code>
          </pre>
        )}
      </div>
    </div>
  );
};
