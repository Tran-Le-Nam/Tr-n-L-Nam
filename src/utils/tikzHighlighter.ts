/**
 * Syntax highlighter tokenizer for TikZ output matching TikzHighlighter in the PyQt6 app.
 */

export interface HighlightSpan {
  text: string;
  className: string;
}

const RULES: Array<{ regex: RegExp; className: string }> = [
  { regex: /--|;|[\[\]{}()]/g, className: 'text-slate-500' },
  {
    regex: /(?<![A-Za-z\\])-?\d+(?:\.\d+)?(?:cm|pt)?(?![A-Za-z])/g,
    className: 'text-amber-700',
  },
  {
    regex: /(?<![\\A-Za-z])[A-Za-z][A-Za-z ]*(?==)/g,
    className: 'text-teal-700',
  },
  {
    regex: /\b(?:node|cycle|circle|sloped|above|below|in)\b/g,
    className: 'text-cyan-800 font-semibold',
  },
  {
    regex: /\\[A-Za-z@]+/g,
    className: 'text-blue-700 font-semibold',
  },
  {
    regex: /\\(?:x|y|nhan)(?![A-Za-z])/g,
    className: 'text-purple-700 font-semibold',
  },
  {
    regex: /\$[^$]*\$/g,
    className: 'text-rose-700',
  },
  {
    regex: /(?<!\\)%.*$/g,
    className: 'text-emerald-700 italic',
  },
];

export function highlightTikzLine(line: string): HighlightSpan[] {
  if (!line) return [{ text: '', className: '' }];
  const classes = new Array<string>(line.length).fill('text-slate-800');

  for (const rule of RULES) {
    rule.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.regex.exec(line)) !== null) {
      if (m[0].length === 0) {
        rule.regex.lastIndex++;
        continue;
      }
      for (let idx = m.index; idx < m.index + m[0].length; idx++) {
        classes[idx] = rule.className;
      }
    }
  }

  const spans: HighlightSpan[] = [];
  let start = 0;
  for (let i = 1; i <= line.length; i++) {
    if (i === line.length || classes[i] !== classes[start]) {
      spans.push({
        text: line.slice(start, i),
        className: classes[start],
      });
      start = i;
    }
  }
  return spans;
}
