import React, { useMemo } from 'react';
import katex from 'katex';

interface MathViewProps {
  content: string;
  className?: string;
  displayMode?: boolean;
}

// Memory cache to avoid re-rendering KaTeX strings multiple times
const mathCache = new Map<string, string>();

const EX_TEST_MACROS: Record<string, string> = {
  '\\heva': '\\left\\{\\begin{aligned}#1\\end{aligned}\\right.',
  '\\hoac': '\\left[\\begin{aligned}#1\\end{aligned}\\right.',
  '\\wideparen': '\\widehat{#1}',
  '\\degree': '^\\circ',
  '\\celsius': '^\\circ\\text{C}',
  '\\vn': '\\varnothing',
  '\\bar': '\\overline{#1}'
};

function renderKatexSafe(math: string, displayMode: boolean): string {
  const cacheKey = `${displayMode ? 'd' : 'i'}_${math}`;
  if (mathCache.has(cacheKey)) {
    return mathCache.get(cacheKey)!;
  }
  try {
    const rendered = katex.renderToString(math, {
      displayMode,
      throwOnError: false,
      strict: false,
      output: 'html',
      macros: EX_TEST_MACROS
    });
    mathCache.set(cacheKey, rendered);
    return rendered;
  } catch {
    return `<span class="text-red-500 font-mono text-xs">${math}</span>`;
  }
}

/**
 * Formats plain-text segments (outside $...$) that contain LaTeX text macros
 * such as \textbf{...}, \textit{...}, \emph{...}, \underline{...}, \texttt{...}, \\, \item, etc.
 */
function formatLatexTextSegment(rawText: string): string {
  // 1. Clean any stray \immini{ or environment wrappers
  let s = rawText
    .replace(/\\immini\s*(?:\[[^\]]*\])?\s*\{?/g, '')
    .replace(/\\begin\{(?:center|flushleft|flushright|itemize|enumerate)\}/g, '')
    .replace(/\\end\{(?:center|flushleft|flushright|itemize|enumerate)\}/g, '');

  // 2. Escape HTML special characters first
  s = s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 3. Handle escaped LaTeX special chars in text mode
  s = s
    .replace(/\\%/g, '%')
    .replace(/\\&amp;/g, '&amp;')
    .replace(/\\_/g, '_')
    .replace(/\\#/g, '#')
    .replace(/\\dots\b|\\ldots\b/g, '...');

  // 4. Iteratively replace nested \textbf{...}, \textit{...}, \emph{...}, \underline{...}, \texttt{...}
  let prev = '';
  let safety = 0;
  while (prev !== s && safety < 10) {
    prev = s;
    safety++;
    s = s
      .replace(/\\textbf\s*\{([^{}]*)\}/g, '<strong class="font-bold text-slate-900">$1</strong>')
      .replace(/\\(?:textit|emph)\s*\{([^{}]*)\}/g, '<em class="italic">$1</em>')
      .replace(/\\underline\s*\{([^{}]*)\}/g, '<u class="underline underline-offset-2">$1</u>')
      .replace(/\\(?:overline|bar)\s*\{([^{}]*)\}/g, '<span class="inline-block border-t-2 border-slate-900 pt-0.5 leading-none">$1</span>')
      .replace(
        /\\texttt\s*\{([^{}]*)\}/g,
        '<code class="px-1 py-0.5 bg-slate-100 rounded font-mono text-[0.92em]">$1</code>'
      )
      .replace(/\\textsc\s*\{([^{}]*)\}/g, '<span class="uppercase text-[0.92em]">$1</span>')
      .replace(/\\textsuperscript\s*\{([^{}]*)\}/g, '<sup>$1</sup>')
      .replace(/\\textsubscript\s*\{([^{}]*)\}/g, '<sub>$1</sub>')
      .replace(/\\textcolor\s*\{[^{}]*\}\s*\{([^{}]*)\}/g, '$1')
      .replace(/\{\\bf\s+([^{}]*)\}/g, '<strong class="font-bold text-slate-900">$1</strong>')
      .replace(/\{\\it\s+([^{}]*)\}/g, '<em class="italic">$1</em>');
  }

  // 5. Handle \item in itemize/enumerate lists
  s = s.replace(/(?:^|\n)\s*\\item\b\s*/g, '<br />• ');

  // 6. Handle line breaks \\ and \newline and \par
  s = s
    .replace(/\\\\(?:\s*\[[^\]]*\])?/g, '<br />')
    .replace(/\\newline\b|\\par\b/g, '<br />')
    .replace(/\\(?:noindent|centering|hfill|vfill)\b\s*/g, '')
    .replace(/\\(?:vspace|hspace)\*?\s*\{[^{}]*\}/g, '');

  // 7. Handle LaTeX quotes ``...'' and ~
  s = s
    .replace(/``/g, '“')
    .replace(/''/g, '”')
    .replace(/~/g, '&nbsp;')
    .replace(/\n/g, '<br />');

  return s;
}

/**
 * Parses mixed text containing LaTeX formulas ($math$, $$math$$, \[math\], \(math\)) and LaTeX text commands
 */
export const MathView: React.FC<MathViewProps> = React.memo(({ content, className = '', displayMode = false }) => {
  const parsedHtml = useMemo(() => {
    if (!content) return '';

    // If whole string is displayMode
    if (displayMode) {
      return renderKatexSafe(content, true);
    }

    // Normalize \[...\] to $$...$$ and \(...\) to $...$
    const normalized = content
      .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$')
      .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

    // Split text by $$display$$ first, then $inline$
    const mathRegex = /(\$\$[\s\S]+?\$\$|\$[^\$]+?\$)/g;
    const parts = normalized.split(mathRegex);

    return parts
      .map((part) => {
        if (!part) return '';
        if (part.startsWith('$$') && part.endsWith('$$') && part.length >= 4) {
          const rawMath = part.slice(2, -2).trim();
          return `<div class="my-2 overflow-x-auto text-center">${renderKatexSafe(rawMath, true)}</div>`;
        } else if (part.startsWith('$') && part.endsWith('$') && part.length >= 2) {
          const rawMath = part.slice(1, -1).trim();
          return `<span class="inline-math px-0.5">${renderKatexSafe(rawMath, false)}</span>`;
        } else {
          return formatLatexTextSegment(part);
        }
      })
      .join('');
  }, [content, displayMode]);

  return (
    <div
      className={`math-rendered leading-relaxed text-slate-800 ${className}`}
      dangerouslySetInnerHTML={{ __html: parsedHtml }}
    />
  );
});
