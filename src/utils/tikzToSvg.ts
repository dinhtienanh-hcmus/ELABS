/**
 * Lightweight client-side TikZ & CircuiTikZ to SVG renderer for ELABS exams.
 * Converts \begin{tikzpicture}...\end{tikzpicture} and \begin{circuitikz}...\end{circuitikz}
 * into clean, scalable SVG Data URLs.
 */

interface Point {
  x: number;
  y: number;
}

function isEscaped(str: string, index: number): boolean {
  let count = 0;
  let i = index - 1;
  while (i >= 0 && str[i] === '\\') {
    count++;
    i--;
  }
  return count % 2 === 1;
}

export function extractBraceContent(
  str: string,
  startIndex: number
): { content: string; endIndex: number } | null {
  let i = startIndex;
  while (i < str.length && /\s/.test(str[i])) i++;
  if (i >= str.length || str[i] !== '{') return null;

  let depth = 0;
  let content = '';
  for (; i < str.length; i++) {
    const ch = str[i];
    if (ch === '{' && !isEscaped(str, i)) {
      if (depth > 0) content += ch;
      depth++;
    } else if (ch === '}' && !isEscaped(str, i)) {
      depth--;
      if (depth === 0) {
        return { content, endIndex: i + 1 };
      }
      content += ch;
    } else if (depth > 0) {
      content += ch;
    }
  }
  return null;
}

export function extractBracketContent(
  str: string,
  startIndex: number
): { content: string; endIndex: number } | null {
  let i = startIndex;
  while (i < str.length && /\s/.test(str[i])) i++;
  if (i >= str.length || str[i] !== '[') return null;

  let bracketDepth = 0;
  let braceDepth = 0;
  let content = '';
  for (; i < str.length; i++) {
    const ch = str[i];
    if (ch === '{' && !isEscaped(str, i)) {
      braceDepth++;
      content += ch;
    } else if (ch === '}' && !isEscaped(str, i)) {
      braceDepth = Math.max(0, braceDepth - 1);
      content += ch;
    } else if (ch === '[' && !isEscaped(str, i) && braceDepth === 0) {
      if (bracketDepth > 0) content += ch;
      bracketDepth++;
    } else if (ch === ']' && !isEscaped(str, i) && braceDepth === 0) {
      bracketDepth--;
      if (bracketDepth === 0) {
        return { content, endIndex: i + 1 };
      }
      content += ch;
    } else if (bracketDepth > 0) {
      content += ch;
    }
  }
  return null;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Formats LaTeX label text (e.g. "$R_1 = 10\Omega$", "\textbf{A}", "$\overline{CS}$") into SVG <tspan> markup
 */
function formatLatexToSvgText(raw: string): string {
  let s = raw.trim();
  if (!s) return '';

  // Remove outer $...$
  s = s.replace(/\$/g, '');

  // Unescape common LaTeX escapes
  s = s
    .replace(/\\\{/g, '{')
    .replace(/\\\}/g, '}')
    .replace(/\\%/g, '%')
    .replace(/\\&/g, '&')
    .replace(/\\_/g, '_')
    .replace(/\\#/g, '#');

  // Mark \overline{...} and \bar{...} with a temporary token so we can render overline tspan
  s = s.replace(/\\(?:overline|bar)\s*\{([^{}]*)\}/g, '⟪OVERLINE:$1⟫');
  s = s.replace(/\\(?:vec|overrightarrow)\s*\{([^{}]*)\}/g, '$1');

  // Strip \textbf, \textit, \mathrm, \text, \mathbf, \mathit
  let prev = '';
  while (prev !== s) {
    prev = s;
    s = s.replace(/\\(?:textbf|textit|textrm|text|mathrm|mathbf|mathit|emph|underline)\s*\{([^{}]*)\}/g, '$1');
    s = s.replace(/\\(?:bf|it|rm|small|footnotesize|scriptsize|tiny|large|Large)\b\s*/g, '');
  }

  // Common LaTeX symbols
  const symbolMap: Record<string, string> = {
    '\\Omega': 'Ω',
    '\\omega': 'ω',
    '\\alpha': 'α',
    '\\beta': 'β',
    '\\gamma': 'γ',
    '\\delta': 'δ',
    '\\Delta': 'Δ',
    '\\theta': 'θ',
    '\\lambda': 'λ',
    '\\mu': 'μ',
    '\\pi': 'π',
    '\\rho': 'ρ',
    '\\sigma': 'σ',
    '\\tau': 'τ',
    '\\varphi': 'φ',
    '\\phi': 'φ',
    '\\Phi': 'Φ',
    '\\psi': 'ψ',
    '\\infty': '∞',
    '\\sim': '~',
    '\\pm': '±',
    '\\mp': '∓',
    '\\times': '×',
    '\\cdot': '·',
    '\\div': '÷',
    '\\leq': '≤',
    '\\le': '≤',
    '\\geq': '≥',
    '\\ge': '≥',
    '\\neq': '≠',
    '\\ne': '≠',
    '\\approx': '≈',
    '\\equiv': '≡',
    '\\rightarrow': '→',
    '\\to': '→',
    '\\leftarrow': '←',
    '\\leftrightarrow': '↔',
    '\\Rightarrow': '⇒',
    '\\degree': '°',
    '\\circ': '°',
    '\\celsius': '°C',
    '\\parallel': '∥',
    '\\perp': '⊥',
    '\\angle': '∠',
    '\\quad': '  ',
    '\\qquad': '    '
  };

  for (const [k, v] of Object.entries(symbolMap)) {
    s = s.split(k).join(v);
  }

  // Handle \frac{a}{b} or \dfrac{a}{b} -> a/b
  s = s.replace(/\\d?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1/$2)');
  // Handle \sqrt{x} -> √(x)
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)');
  // Comma inside braces {,} -> ,
  s = s.replace(/\{,\}/g, ',');

  // Parse subscripts, superscripts, and overlines into <tspan>
  let result = '';
  let i = 0;
  let inOverline = false;
  while (i < s.length) {
    if (s.startsWith('⟪OVERLINE:', i)) {
      inOverline = true;
      result += '<tspan text-decoration="overline">';
      i += 10;
      continue;
    }
    if (s[i] === '⟫' && inOverline) {
      inOverline = false;
      result += '</tspan>';
      i++;
      continue;
    }
    if ((s[i] === '_' || s[i] === '^') && i + 1 < s.length) {
      const isSub = s[i] === '_';
      i++;
      let subContent = '';
      if (s[i] === '{') {
        const grp = extractBraceContent(s, i);
        if (grp) {
          subContent = grp.content;
          i = grp.endIndex;
        } else {
          subContent = s[i];
          i++;
        }
      } else {
        subContent = s[i];
        i++;
      }
      const dy = isSub ? '4' : '-5';
      const resetDy = isSub ? '-4' : '5';
      result += `<tspan font-size="78%" dy="${dy}">${escapeXml(subContent)}</tspan><tspan dy="${resetDy}">&#8203;</tspan>`;
    } else if (s[i] === '{' || s[i] === '}') {
      i++;
    } else {
      result += escapeXml(s[i]);
      i++;
    }
  }
  if (inOverline) result += '</tspan>';

  return result;
}

/**
 * Formats a single line of C / Verilog / assembly code inside a TikZ \node[align=left] block into SVG tspans
 */
function formatCodeLineToSvgTspans(rawLine: string): { svgTspans: string; plainLength: number } {
  let s = rawLine;

  // Replace \qquad and \quad with indentation spaces
  s = s.replace(/\\qquad\s*/g, '        ').replace(/\\quad\s*/g, '    ');

  // Replace math-wrapped operators like $\sim$, $<<$, $|$, $<=$
  s = s
    .replace(/\$\\sim\$/g, '~')
    .replace(/\$(<<|>>|\||<=|>=|==|!=|\+|-|\*|\/)\$/g, '$1')
    .replace(/\$/g, '');

  // Replace escaped LaTeX characters used in C/Verilog code
  s = s
    .replace(/\\\{/g, '{')
    .replace(/\\\}/g, '}')
    .replace(/\\%/g, '%')
    .replace(/\\&/g, '&')
    .replace(/\\_/g, '_')
    .replace(/\\#/g, '#')
    .replace(/\\sim\b\s*/g, '~');

  // Tokenize \textbf{...} so keywords are highlighted in bold blue/slate
  let svgTspans = '';
  let plainLength = 0;
  let cursor = 0;

  while (cursor < s.length) {
    const bfMatch = s.slice(cursor).match(/^\\textbf\s*\{([^{}]*)\}/);
    if (bfMatch) {
      const kw = bfMatch[1];
      svgTspans += `<tspan font-weight="700" fill="#1d4ed8">${escapeXml(kw)}</tspan>`;
      plainLength += kw.length;
      cursor += bfMatch[0].length;
      continue;
    }
    const ch = s[cursor];
    if (ch === ' ') {
      svgTspans += '&#160;';
      plainLength += 1;
    } else {
      svgTspans += escapeXml(ch);
      plainLength += 1;
    }
    cursor++;
  }

  return { svgTspans, plainLength };
}

/**
 * Strips \tikzset{...} blocks (which often lack a trailing semicolon)
 */
function stripTikzset(tikz: string): string {
  let result = tikz;
  let safety = 0;
  while (safety < 20) {
    safety++;
    const match = result.match(/\\tikzset(?![a-zA-Z])/);
    if (!match || match.index === undefined) break;
    const startIdx = match.index;
    const grp = extractBraceContent(result, startIdx + match[0].length);
    if (!grp) {
      result = result.slice(0, startIdx) + result.slice(startIdx + match[0].length);
      break;
    }
    let endIdx = grp.endIndex;
    while (endIdx < result.length && /\s/.test(result[endIdx])) endIdx++;
    if (result[endIdx] === ';') endIdx++;
    result = result.slice(0, startIdx) + '\n' + result.slice(endIdx);
  }
  return result;
}

/**
 * Expand \foreach loops in TikZ code (supports 1 to N slash-separated variables)
 */
function expandForeach(tikz: string): string {
  const foreachRegex = /\\foreach\s+(\\[a-zA-Z]+(?:\s*\/\s*\\[a-zA-Z]+)*)\s+in\s+\{([^{}]+)\}\s*\{/g;
  let result = tikz;
  let match: RegExpExecArray | null;
  let safety = 0;

  while ((match = foreachRegex.exec(result)) !== null && safety < 30) {
    safety++;
    const vars = match[1].split('/').map((v) => v.trim());
    const listRaw = match[2].trim();
    const bodyStart = match.index + match[0].length - 1; // at '{'
    const bodyGroup = extractBraceContent(result, bodyStart);
    if (!bodyGroup) break;

    // Expand list (handle a,...,b or comma-separated)
    let items = listRaw.split(',').map((x) => x.trim()).filter(Boolean);
    if (items.length === 3 && items[1] === '...') {
      const startNum = parseFloat(items[0]);
      const endNum = parseFloat(items[2]);
      if (!isNaN(startNum) && !isNaN(endNum) && Math.abs(endNum - startNum) <= 50) {
        items = [];
        const step = endNum >= startNum ? 1 : -1;
        for (let n = startNum; step > 0 ? n <= endNum : n >= endNum; n += step) {
          items.push(String(n));
        }
      }
    }

    let expanded = '';
    for (const item of items) {
      let instance = bodyGroup.content;
      if (vars.length > 1 && item.includes('/')) {
        const vals = item.split('/').map((v) => v.trim());
        for (let k = 0; k < vars.length; k++) {
          const escapedVar = vars[k].replace(/\\/g, '\\\\');
          const varRegex = new RegExp(escapedVar + '(?![a-zA-Z])', 'g');
          instance = instance.replace(varRegex, vals[k] ?? '');
        }
      } else {
        const escapedVar = vars[0].replace(/\\/g, '\\\\');
        const varRegex = new RegExp(escapedVar + '(?![a-zA-Z])', 'g');
        instance = instance.replace(varRegex, item);
      }
      expanded += instance + '\n';
    }

    result = result.substring(0, match.index) + expanded + result.substring(bodyGroup.endIndex);
    foreachRegex.lastIndex = 0;
  }

  return result;
}

/**
 * Converts \begin{scope}[...] ... \end{scope} into __SCOPE_PUSH__[...]; ... __SCOPE_POP__;
 * so statement splitting and coordinate shifts work seamlessly.
 */
function transformScopes(tikz: string): string {
  let result = tikz;
  let safety = 0;
  while (safety < 40) {
    safety++;
    const match = result.match(/\\begin\{scope\}/);
    if (!match || match.index === undefined) break;
    const startIdx = match.index;
    let afterBegin = startIdx + match[0].length;
    let scopeOpts = '';
    while (afterBegin < result.length && /\s/.test(result[afterBegin])) afterBegin++;
    if (result[afterBegin] === '[') {
      const br = extractBracketContent(result, afterBegin);
      if (br) {
        scopeOpts = br.content;
        afterBegin = br.endIndex;
      }
    }
    result =
      result.slice(0, startIdx) +
      `; __SCOPE_PUSH__[${scopeOpts}]; ` +
      result.slice(afterBegin);
  }
  result = result.replace(/\\end\{scope\}/g, '; __SCOPE_POP__; ');
  return result;
}

/**
 * Evaluates simple math expressions in TikZ coordinates like "1.25+0.15", "1.25-0.2", "2*1.5"
 */
function evalSimpleMath(expr: string): number {
  const cleaned = expr.replace(/\s+/g, '');
  if (!cleaned) return 0;
  // Tokenize numbers and + - * /
  if (/^[+-]?\d+(?:\.\d+)?(?:[+-/*]\d+(?:\.\d+)?)*$/.test(cleaned)) {
    try {
      // Safe evaluation for simple arithmetic
      const terms = cleaned.split(/(?=[+-])/);
      let sum = 0;
      for (const term of terms) {
        if (!term) continue;
        if (term.includes('*')) {
          const parts = term.split('*');
          sum += parts.reduce((acc, p) => acc * parseFloat(p), 1);
        } else if (term.includes('/')) {
          const parts = term.split('/');
          sum += parts.slice(1).reduce((acc, p) => acc / (parseFloat(p) || 1), parseFloat(parts[0]));
        } else {
          sum += parseFloat(term);
        }
      }
      return isNaN(sum) ? 0 : sum;
    } catch {
      return parseFloat(cleaned) || 0;
    }
  }
  return parseFloat(cleaned) || 0;
}

function evalNum(expr: string, unitScale: number): number {
  let s = expr.trim();
  let factor = unitScale;
  if (s.endsWith('pt')) {
    factor = 1.45;
    s = s.slice(0, -2).trim();
  } else if (s.endsWith('cm')) {
    factor = unitScale;
    s = s.slice(0, -2).trim();
  } else if (s.endsWith('mm')) {
    factor = unitScale / 10;
    s = s.slice(0, -2).trim();
  }
  const val = evalSimpleMath(s);
  return (isNaN(val) ? 0 : val) * factor;
}

/**
 * Evaluates a TikZ plot function f(x) at numeric x (e.g. "0.35*(\x-1)^2" or "1.8*sin(\x r)")
 */
function evalPlotFunction(fnExpr: string, xVal: number): number {
  try {
    let js = fnExpr.trim();
    // Replace \x with (xVal)
    js = js.replace(/\\x(?![a-zA-Z])/g, `(${xVal})`);
    // Handle sin(... r) and cos(... r) in radians vs degrees
    js = js.replace(/sin\s*\(([^()]*?)\s+r\)/gi, 'Math.sin($1)');
    js = js.replace(/cos\s*\(([^()]*?)\s+r\)/gi, 'Math.cos($1)');
    js = js.replace(/sin\s*\(/gi, 'Math.sin((Math.PI/180)*');
    js = js.replace(/cos\s*\(/gi, 'Math.cos((Math.PI/180)*');
    js = js.replace(/exp\s*\(/gi, 'Math.exp(');
    js = js.replace(/sqrt\s*\(/gi, 'Math.sqrt(');
    js = js.replace(/abs\s*\(/gi, 'Math.abs(');
    js = js.replace(/\^/g, '**');

    // Guard against unsafe characters
    if (/[^0-9xX+\-*/().\sMathsincoexpqrtabPI,]/.test(js)) {
      return 0;
    }
    const fn = new Function(`return (${js});`);
    const res = Number(fn());
    return isFinite(res) ? res : 0;
  } catch {
    return 0;
  }
}

function resolveStrokeColor(opts: string): string {
  const lower = opts.toLowerCase();
  if (/\bblue\b/.test(lower)) return '#2563eb';
  if (/\bred\b/.test(lower)) return '#dc2626';
  if (/\bteal\b/.test(lower)) return '#0d9488';
  if (/\bgreen\b/.test(lower)) return '#16a34a';
  if (/\borange\b/.test(lower)) return '#ea580c';
  if (/\bpurple\b|\bviolet\b/.test(lower)) return '#7c3aed';
  if (/\bgray\b|\bgrey\b/.test(lower)) return '#64748b';
  return '#1e293b';
}

function resolveFillColor(opts: string, cmdType: string): string {
  const lower = opts.toLowerCase();
  if (/fill\s*=\s*white/.test(lower)) return '#ffffff';
  if (/fill\s*=\s*teal!(\d+)/.test(lower)) return 'rgba(13, 148, 136, 0.22)';
  if (/fill\s*=\s*blue!(\d+)/.test(lower)) return 'rgba(37, 99, 235, 0.18)';
  if (/fill\s*=\s*red!(\d+)/.test(lower)) return 'rgba(220, 38, 38, 0.18)';
  if (/fill\s*=\s*gray!(\d+)/.test(lower)) return '#f1f5f9';
  if (cmdType === 'fill') return resolveStrokeColor(opts) === '#1e293b' ? '#0f172a' : resolveStrokeColor(opts);
  if (cmdType === 'filldraw' && /fill\s*=/.test(lower)) return '#f8fafc';
  return 'none';
}

/**
 * Renders TikZ / CircuiTikZ code into an SVG data URL
 */
export function renderTikzToSvgDataUrl(tikzSource: string): string | undefined {
  if (!tikzSource || !tikzSource.trim()) return undefined;

  const SCALE = 52; // 1 TikZ unit (1cm) = 52px in SVG
  const namedCoords = new Map<string, Point>();
  const svgElements: string[] = [];
  const labelElements: string[] = [];
  const allPoints: Point[] = [];

  const scopeStack: Point[] = [];
  let currentShift: Point = { x: 0, y: 0 };

  // Track whether axes with arrows cross the origin (0,0) so we can position the '0' origin label cleanly
  let hasHorizontalAxisThroughOrigin = false;
  let hasVerticalAxisThroughOrigin = false;
  let hasExplicitOriginZeroLabel = false;

  const trackPoint = (x: number, y: number, pad: number = 0) => {
    allPoints.push({ x: x - pad, y: y - pad });
    allPoints.push({ x: x + pad, y: y + pad });
  };

  // Transform TikZ (x, y) where +Y is up into SVG (x, -y) where +Y is down
  const toSvg = (p: Point): Point => ({ x: p.x, y: -p.y });

  // Clean comments and outer \begin{tikzpicture}...\end{tikzpicture}
  let body = tikzSource
    .split('\n')
    .map((line) => line.replace(/(?<!\\)%.*$/, ''))
    .join('\n');

  body = body.replace(/\\begin\{(?:tikzpicture|circuitikz)\}(?:\s*\[[\s\S]*?\])?/gi, '');
  body = body.replace(/\\end\{(?:tikzpicture|circuitikz)\}/gi, '');
  body = stripTikzset(body);
  body = expandForeach(body);
  body = transformScopes(body);

  // Split into semicolon-terminated statements (respecting unescaped braces)
  const statements: string[] = [];
  let currentStmt = '';
  let braceDepth = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '{' && !isEscaped(body, i)) braceDepth++;
    else if (ch === '}' && !isEscaped(body, i)) braceDepth = Math.max(0, braceDepth - 1);

    if (ch === ';' && braceDepth === 0) {
      if (currentStmt.trim()) statements.push(currentStmt.trim());
      currentStmt = '';
    } else {
      currentStmt += ch;
    }
  }
  if (currentStmt.trim()) statements.push(currentStmt.trim());

  // Parse a coordinate token like "(2, 3)" or "(A)" or "(45:2)"
  const parseCoord = (rawCoord: string, lastPoint?: Point, isRelative?: boolean): Point | null => {
    const inner = rawCoord.trim().replace(/^\(|\)$/g, '').trim();
    if (!inner) return null;

    if (namedCoords.has(inner)) {
      const found = namedCoords.get(inner)!;
      return { ...found };
    }

    // Polar coordinate (angle:radius)
    if (inner.includes(':') && !inner.includes(',')) {
      const [angStr, radStr] = inner.split(':');
      const ang = (evalSimpleMath(angStr) * Math.PI) / 180;
      const rad = evalNum(radStr, SCALE);
      const dx = Math.cos(ang) * rad;
      const dy = Math.sin(ang) * rad;
      if (isRelative && lastPoint) {
        return { x: lastPoint.x + dx, y: lastPoint.y + dy };
      }
      return { x: currentShift.x + dx, y: currentShift.y + dy };
    }

    // Cartesian (x, y)
    if (inner.includes(',')) {
      const parts = inner.split(',');
      const x = evalNum(parts[0], SCALE);
      const y = evalNum(parts[1], SCALE);
      if (isRelative && lastPoint) {
        return { x: lastPoint.x + x, y: lastPoint.y + y };
      }
      return { x: currentShift.x + x, y: currentShift.y + y };
    }

    return null;
  };

  // Helper to place a label at TikZ coordinate p with position option (above, below, left, right, etc.)
  const addLabel = (p: Point, text: string, opts: string = '') => {
    const formatted = formatLatexToSvgText(text);
    if (!formatted) return;

    const plainText = formatted.replace(/<[^>]+>/g, '').trim();
    const isAtOrigin = Math.abs(p.x) < 1 && Math.abs(p.y) < 1;
    if (isAtOrigin && (plainText === '0' || plainText === 'O')) {
      hasExplicitOriginZeroLabel = true;
    }

    const sp = toSvg(p);
    let dx = 0;
    let dy = 5;
    let anchor = 'middle';

    const lowerOpts = opts.toLowerCase();
    const isAbove = lowerOpts.includes('above');
    const isBelow = lowerOpts.includes('below');
    let isLeft = lowerOpts.includes('left');
    const isRight = lowerOpts.includes('right');

    // If '0' is placed at (0,0) with [below] on a coordinate graph where a vertical axis passes through x=0,
    // shift it to 'below left' so the vertical axis doesn't cut right through the '0' digit.
    if (isAtOrigin && plainText === '0' && isBelow && !isLeft && !isRight && hasVerticalAxisThroughOrigin) {
      isLeft = true;
    }

    if (isAbove && isLeft) {
      dx = -8;
      dy = -8;
      anchor = 'end';
    } else if (isAbove && isRight) {
      dx = 8;
      dy = -8;
      anchor = 'start';
    } else if (isBelow && isLeft) {
      dx = -8;
      dy = 16;
      anchor = 'end';
    } else if (isBelow && isRight) {
      dx = 8;
      dy = 16;
      anchor = 'start';
    } else if (isAbove) {
      dy = -10;
    } else if (isBelow) {
      dy = 18;
    } else if (isLeft) {
      dx = -10;
      dy = 4;
      anchor = 'end';
    } else if (isRight) {
      dx = 10;
      dy = 4;
      anchor = 'start';
    }

    const tx = sp.x + dx;
    const ty = sp.y + dy;
    trackPoint(tx, -ty, 26);

    const textColor = resolveStrokeColor(opts) === '#1e293b' ? '#0f172a' : resolveStrokeColor(opts);
    const fontSize = /\btiny\b/i.test(rawTextOrOpts(text, opts)) ? '10.5' : '13';

    const hasFillWhite = lowerOpts.includes('fill=white');
    if (hasFillWhite) {
      const estW = Math.max(18, plainText.length * 8 + 8);
      labelElements.push(
        `<rect x="${(tx - estW / 2).toFixed(1)}" y="${(ty - 13).toFixed(1)}" width="${estW}" height="18" rx="3" fill="#ffffff" />`
      );
    }

    // Use a subtle white halo stroke so labels never become unreadable when close to wires/axes
    labelElements.push(
      `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${anchor}" font-family="Inter, system-ui, sans-serif" font-size="${fontSize}" font-weight="600" fill="${textColor}" stroke="#ffffff" stroke-width="3" paint-order="stroke fill">${formatted}</text>`
    );
  };

  function rawTextOrOpts(text: string, opts: string): string {
    return `${text} ${opts}`;
  }

  // Helper to render a multi-line code box (C code, Verilog code, etc.) or boxed node
  const renderCodeOrBoxNode = (pt: Point, rawContent: string, nodeOpts: string) => {
    const sp = toSvg(pt);
    const lines = rawContent
      .split(/\\\\/)
      .map((l) => l.replace(/^\s*\n+|\n+\s*$/g, ''))
      .filter((l, idx, arr) => !(idx === arr.length - 1 && !l.trim()));

    const isCodeBlock =
      lines.length > 1 ||
      /\balign\s*=\s*left\b/i.test(nodeOpts) ||
      /\\textbf\{(int|void|char|return|if|else|for|while|module|always|begin|end|endmodule)\}/.test(rawContent) ||
      /PORTA|printf|posedge/.test(rawContent);

    if (isCodeBlock) {
      const parsedLines = lines.map((line) => formatCodeLineToSvgTspans(line));
      const maxChars = Math.max(12, ...parsedLines.map((l) => l.plainLength));
      const lineHeight = 22;
      const padX = 16;
      const padY = 14;
      const boxW = Math.max(180, maxChars * 8.4 + padX * 2);
      const boxH = parsedLines.length * lineHeight + padY * 2;
      const boxX = sp.x - boxW / 2;
      const boxY = sp.y - boxH / 2;

      trackPoint(pt.x - boxW / 2, pt.y - boxH / 2, 12);
      trackPoint(pt.x + boxW / 2, pt.y + boxH / 2, 12);

      svgElements.push(
        `<rect x="${boxX.toFixed(1)}" y="${boxY.toFixed(1)}" width="${boxW.toFixed(1)}" height="${boxH.toFixed(1)}" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.8" />`,
        `<rect x="${boxX.toFixed(1)}" y="${boxY.toFixed(1)}" width="4.5" height="${boxH.toFixed(1)}" rx="2" fill="#2563eb" />`
      );

      parsedLines.forEach((pl, idx) => {
        const ly = boxY + padY + (idx + 0.78) * lineHeight;
        const lx = boxX + padX + 4;
        labelElements.push(
          `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="start" font-family="'JetBrains Mono', 'Fira Code', Consolas, monospace" font-size="13.5" font-weight="500" fill="#0f172a">${pl.svgTspans}</text>`
        );
      });
      return;
    }

    // Single-line boxed node
    const formatted = formatLatexToSvgText(rawContent);
    const plainLen = formatted.replace(/<[^>]+>/g, '').length;
    const boxW = Math.max(36, plainLen * 8.5 + 20);
    const boxH = 28;
    trackPoint(pt.x, pt.y, Math.max(boxW, boxH) / 2 + 8);
    svgElements.push(
      `<rect x="${(sp.x - boxW / 2).toFixed(1)}" y="${(sp.y - boxH / 2).toFixed(1)}" width="${boxW.toFixed(1)}" height="${boxH.toFixed(1)}" rx="5" fill="#f8fafc" stroke="#1e293b" stroke-width="1.8" />`
    );
    labelElements.push(
      `<text x="${sp.x.toFixed(1)}" y="${(sp.y + 4.5).toFixed(1)}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="600" fill="#0f172a">${formatted}</text>`
    );
  };

  // Helper to draw a two-terminal circuit component between p1 and p2
  const drawCircuitComponent = (p1: Point, p2: Point, compSpec: string) => {
    const s1 = toSvg(p1);
    const s2 = toSvg(p2);
    trackPoint(p1.x, p1.y, 24);
    trackPoint(p2.x, p2.y, 24);

    const dx = s2.x - s1.x;
    const dy = s2.y - s1.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;

    const ux = dx / len;
    const uy = dy / len;
    const nx = uy;
    const ny = -ux;
    const midX = (s1.x + s2.x) / 2;
    const midY = (s1.y + s2.y) / 2;
    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

    let label = '';
    const labelMatch =
      compSpec.match(/(?:l[_^]?|v[_^]?|i[_^]?)\s*=\s*(\{[^}]*\}|[^,\]]+)/) ||
      compSpec.match(/(?:R|C|L|V|I|battery\d*|vsource|isource|american\s+\w+\s+\w+|european\s+\w+\s+\w+)\s*=\s*(\{[^}]*\}|[^,\]]+)/i);
    if (labelMatch) {
      label = labelMatch[1].trim().replace(/^\{|\}$/g, '');
    }

    const head = compSpec.split(',')[0].split('=')[0].trim();
    const isResistor = /^(?:R|vR|european\s+resistor|american\s+resistor|generic)$/i.test(head);
    const isCapacitor = /^(?:C|cC|capacitor|ecapacitor)$/i.test(head);
    const isInductor = /^(?:L|inductor|cute\s+inductor|american\s+inductor)$/i.test(head);
    const isVoltage = /^(?:V|vsource|vsourceAM|american\s+voltage\s+source|european\s+voltage\s+source|battery|battery1|battery2|dcisource)$/i.test(head);
    const isCurrent = /^(?:I|isource|isourceAM|american\s+current\s+source|european\s+current\s+source)$/i.test(head);
    const isDiode = /^(?:D|Do|D\*|diode|empty\s+diode|led|leD|zD|zener)$/i.test(head);
    const isSwitch = /^(?:nos|ncs|switch|closing\s+switch|opening\s+switch|spst)$/i.test(head);

    if (isResistor) {
      const halfW = Math.min(18, len * 0.3);
      const halfH = 7;
      const aX = midX - ux * halfW;
      const aY = midY - uy * halfW;
      const bX = midX + ux * halfW;
      const bY = midY + uy * halfW;
      svgElements.push(
        `<line x1="${s1.x.toFixed(1)}" y1="${s1.y.toFixed(1)}" x2="${aX.toFixed(1)}" y2="${aY.toFixed(1)}" stroke="#1e293b" stroke-width="2" />`,
        `<line x1="${bX.toFixed(1)}" y1="${bY.toFixed(1)}" x2="${s2.x.toFixed(1)}" y2="${s2.y.toFixed(1)}" stroke="#1e293b" stroke-width="2" />`,
        `<g transform="translate(${midX.toFixed(1)}, ${midY.toFixed(1)}) rotate(${angleDeg.toFixed(1)})">
          <rect x="${-halfW}" y="${-halfH}" width="${halfW * 2}" height="${halfH * 2}" fill="#ffffff" stroke="#1e293b" stroke-width="2" rx="1.5" />
        </g>`
      );
    } else if (isCapacitor) {
      const gap = 4.5;
      const plateH = 12;
      const aX = midX - ux * gap;
      const aY = midY - uy * gap;
      const bX = midX + ux * gap;
      const bY = midY + uy * gap;
      svgElements.push(
        `<line x1="${s1.x.toFixed(1)}" y1="${s1.y.toFixed(1)}" x2="${aX.toFixed(1)}" y2="${aY.toFixed(1)}" stroke="#1e293b" stroke-width="2" />`,
        `<line x1="${bX.toFixed(1)}" y1="${bY.toFixed(1)}" x2="${s2.x.toFixed(1)}" y2="${s2.y.toFixed(1)}" stroke="#1e293b" stroke-width="2" />`,
        `<g transform="translate(${midX.toFixed(1)}, ${midY.toFixed(1)}) rotate(${angleDeg.toFixed(1)})">
          <line x1="${-gap}" y1="${-plateH}" x2="${-gap}" y2="${plateH}" stroke="#1e293b" stroke-width="2.4" />
          <line x1="${gap}" y1="${-plateH}" x2="${gap}" y2="${plateH}" stroke="#1e293b" stroke-width="2.4" />
        </g>`
      );
    } else if (isInductor) {
      const halfW = Math.min(20, len * 0.32);
      const aX = midX - ux * halfW;
      const aY = midY - uy * halfW;
      const bX = midX + ux * halfW;
      const bY = midY + uy * halfW;
      const w = halfW * 2;
      const step = w / 4;
      svgElements.push(
        `<line x1="${s1.x.toFixed(1)}" y1="${s1.y.toFixed(1)}" x2="${aX.toFixed(1)}" y2="${aY.toFixed(1)}" stroke="#1e293b" stroke-width="2" />`,
        `<line x1="${bX.toFixed(1)}" y1="${bY.toFixed(1)}" x2="${s2.x.toFixed(1)}" y2="${s2.y.toFixed(1)}" stroke="#1e293b" stroke-width="2" />`,
        `<g transform="translate(${midX.toFixed(1)}, ${midY.toFixed(1)}) rotate(${angleDeg.toFixed(1)})">
          <path d="M ${-halfW} 0 A ${step / 2} 7 0 0 1 ${-halfW + step} 0 A ${step / 2} 7 0 0 1 ${-halfW + step * 2} 0 A ${step / 2} 7 0 0 1 ${-halfW + step * 3} 0 A ${step / 2} 7 0 0 1 ${halfW} 0" fill="none" stroke="#1e293b" stroke-width="2" />
        </g>`
      );
    } else if (isVoltage || isCurrent) {
      const r = 14;
      const aX = midX - ux * r;
      const aY = midY - uy * r;
      const bX = midX + ux * r;
      const bY = midY + uy * r;
      svgElements.push(
        `<line x1="${s1.x.toFixed(1)}" y1="${s1.y.toFixed(1)}" x2="${aX.toFixed(1)}" y2="${aY.toFixed(1)}" stroke="#1e293b" stroke-width="2" />`,
        `<line x1="${bX.toFixed(1)}" y1="${bY.toFixed(1)}" x2="${s2.x.toFixed(1)}" y2="${s2.y.toFixed(1)}" stroke="#1e293b" stroke-width="2" />`,
        `<circle cx="${midX.toFixed(1)}" cy="${midY.toFixed(1)}" r="${r}" fill="#ffffff" stroke="#1e293b" stroke-width="2" />`
      );
      if (isCurrent) {
        svgElements.push(
          `<g transform="translate(${midX.toFixed(1)}, ${midY.toFixed(1)}) rotate(${angleDeg.toFixed(1)})">
            <line x1="-8" y1="0" x2="6" y2="0" stroke="#1e293b" stroke-width="1.8" />
            <polygon points="8,0 2,-3.5 2,3.5" fill="#1e293b" />
          </g>`
        );
      } else {
        svgElements.push(
          `<g transform="translate(${midX.toFixed(1)}, ${midY.toFixed(1)}) rotate(${angleDeg.toFixed(1)})">
            <line x1="-8" y1="-3" x2="-8" y2="3" stroke="#1e293b" stroke-width="1.6" />
            <line x1="6" y1="-3.5" x2="6" y2="3.5" stroke="#1e293b" stroke-width="1.6" />
            <line x1="2.5" y1="0" x2="9.5" y2="0" stroke="#1e293b" stroke-width="1.6" />
          </g>`
        );
      }
    } else if (isDiode) {
      const s = 9;
      const aX = midX - ux * s;
      const aY = midY - uy * s;
      const bX = midX + ux * s;
      const bY = midY + uy * s;
      svgElements.push(
        `<line x1="${s1.x.toFixed(1)}" y1="${s1.y.toFixed(1)}" x2="${aX.toFixed(1)}" y2="${aY.toFixed(1)}" stroke="#1e293b" stroke-width="2" />`,
        `<line x1="${bX.toFixed(1)}" y1="${bY.toFixed(1)}" x2="${s2.x.toFixed(1)}" y2="${s2.y.toFixed(1)}" stroke="#1e293b" stroke-width="2" />`,
        `<g transform="translate(${midX.toFixed(1)}, ${midY.toFixed(1)}) rotate(${angleDeg.toFixed(1)})">
          <polygon points="${-s},${-s} ${-s},${s} ${s},0" fill="#ffffff" stroke="#1e293b" stroke-width="2" />
          <line x1="${s}" y1="${-s}" x2="${s}" y2="${s}" stroke="#1e293b" stroke-width="2.2" />
        </g>`
      );
    } else if (isSwitch) {
      const halfW = 12;
      const aX = midX - ux * halfW;
      const aY = midY - uy * halfW;
      const bX = midX + ux * halfW;
      const bY = midY + uy * halfW;
      svgElements.push(
        `<line x1="${s1.x.toFixed(1)}" y1="${s1.y.toFixed(1)}" x2="${aX.toFixed(1)}" y2="${aY.toFixed(1)}" stroke="#1e293b" stroke-width="2" />`,
        `<line x1="${bX.toFixed(1)}" y1="${bY.toFixed(1)}" x2="${s2.x.toFixed(1)}" y2="${s2.y.toFixed(1)}" stroke="#1e293b" stroke-width="2" />`,
        `<g transform="translate(${midX.toFixed(1)}, ${midY.toFixed(1)}) rotate(${angleDeg.toFixed(1)})">
          <circle cx="${-halfW}" cy="0" r="2.5" fill="#ffffff" stroke="#1e293b" stroke-width="1.8" />
          <circle cx="${halfW}" cy="0" r="2.5" fill="#ffffff" stroke="#1e293b" stroke-width="1.8" />
          <line x1="${-halfW + 2}" y1="-1" x2="${halfW - 2}" y2="-9" stroke="#1e293b" stroke-width="2" />
        </g>`
      );
    } else {
      svgElements.push(
        `<line x1="${s1.x.toFixed(1)}" y1="${s1.y.toFixed(1)}" x2="${s2.x.toFixed(1)}" y2="${s2.y.toFixed(1)}" stroke="#1e293b" stroke-width="2" />`
      );
    }

    const poleMatch = compSpec.match(/(?:^|,)\s*([*o])-([*o]?)|(?:^|,)\s*-([*o])/);
    if (poleMatch || compSpec.includes('*-*') || compSpec.includes('o-o')) {
      const startPole = compSpec.includes('*-') ? '*' : compSpec.includes('o-') ? 'o' : '';
      const endPole = compSpec.includes('-*') ? '*' : compSpec.includes('-o') ? 'o' : '';
      if (startPole === '*') {
        svgElements.push(`<circle cx="${s1.x.toFixed(1)}" cy="${s1.y.toFixed(1)}" r="3.5" fill="#0f172a" />`);
      } else if (startPole === 'o') {
        svgElements.push(`<circle cx="${s1.x.toFixed(1)}" cy="${s1.y.toFixed(1)}" r="3.5" fill="#ffffff" stroke="#0f172a" stroke-width="1.8" />`);
      }
      if (endPole === '*') {
        svgElements.push(`<circle cx="${s2.x.toFixed(1)}" cy="${s2.y.toFixed(1)}" r="3.5" fill="#0f172a" />`);
      } else if (endPole === 'o') {
        svgElements.push(`<circle cx="${s2.x.toFixed(1)}" cy="${s2.y.toFixed(1)}" r="3.5" fill="#ffffff" stroke="#0f172a" stroke-width="1.8" />`);
      }
    }

    if (label) {
      const formatted = formatLatexToSvgText(label);
      const offsetDist = 20;
      const lx = midX + nx * offsetDist;
      const ly = midY + ny * offsetDist + 4;
      trackPoint(lx, -ly, 25);
      labelElements.push(
        `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="600" fill="#0f172a" stroke="#ffffff" stroke-width="3" paint-order="stroke fill">${formatted}</text>`
      );
    }
  };

  // Process each statement
  for (const stmt of statements) {
    // Scope push / pop markers
    if (stmt.startsWith('__SCOPE_PUSH__[')) {
      const opts = stmt.slice(15, -1);
      scopeStack.push({ ...currentShift });
      const shiftMatch = opts.match(/shift\s*=\s*\{\s*\(([^,]+),([^)]+)\)\s*\}/);
      if (shiftMatch) {
        currentShift = {
          x: currentShift.x + evalNum(shiftMatch[1], SCALE),
          y: currentShift.y + evalNum(shiftMatch[2], SCALE)
        };
      }
      const xshiftMatch = opts.match(/xshift\s*=\s*([^,\]]+)/);
      if (xshiftMatch) {
        currentShift = { ...currentShift, x: currentShift.x + evalNum(xshiftMatch[1], SCALE) };
      }
      const yshiftMatch = opts.match(/yshift\s*=\s*([^,\]]+)/);
      if (yshiftMatch) {
        currentShift = { ...currentShift, y: currentShift.y + evalNum(yshiftMatch[1], SCALE) };
      }
      continue;
    }
    if (stmt === '__SCOPE_POP__') {
      const prev = scopeStack.pop();
      if (prev) currentShift = prev;
      continue;
    }

    // 1. \coordinate (name) at (x,y)
    const coordDefMatch = stmt.match(/^\\coordinate(?:\s*\[[^\]]*\])?\s*\(([^)]+)\)\s*at\s*\(([^)]+)\)/);
    if (coordDefMatch) {
      const name = coordDefMatch[1].trim();
      const pt = parseCoord(`(${coordDefMatch[2]})`);
      if (pt) {
        namedCoords.set(name, pt);
        trackPoint(pt.x, pt.y, 8);
      }
      continue;
    }

    // 2. Standalone \node (both with "at (x,y)" and without "at (x,y)")
    if (stmt.startsWith('\\node')) {
      let rest = stmt.slice(5).trim();
      let nodeOpts = '';
      if (rest.startsWith('[')) {
        const br = extractBracketContent(rest, 0);
        if (br) {
          nodeOpts = br.content;
          rest = rest.slice(br.endIndex).trim();
        }
      }
      let nodeName = '';
      if (rest.startsWith('(')) {
        const parenEnd = rest.indexOf(')');
        if (parenEnd !== -1) {
          nodeName = rest.slice(1, parenEnd).trim();
          rest = rest.slice(parenEnd + 1).trim();
        }
      }
      if (rest.startsWith('[')) {
        const br = extractBracketContent(rest, 0);
        if (br) {
          nodeOpts += ',' + br.content;
          rest = rest.slice(br.endIndex).trim();
        }
      }

      let pt: Point | null = { x: currentShift.x, y: currentShift.y };
      const atMatch = rest.match(/^at\s*\(([^)]+)\)/);
      if (atMatch) {
        pt = parseCoord(`(${atMatch[1]})`);
        rest = rest.slice(atMatch[0].length).trim();
      }
      if (rest.startsWith('[')) {
        const br = extractBracketContent(rest, 0);
        if (br) {
          nodeOpts += ',' + br.content;
          rest = rest.slice(br.endIndex).trim();
        }
      }

      const textGrp = extractBraceContent(rest, 0);
      if (pt) {
        if (nodeName) namedCoords.set(nodeName, pt);
        trackPoint(pt.x, pt.y, 12);

        if (/\bground\b/i.test(nodeOpts)) {
          const sp = toSvg(pt);
          svgElements.push(
            `<line x1="${sp.x}" y1="${sp.y}" x2="${sp.x}" y2="${sp.y + 8}" stroke="#1e293b" stroke-width="2" />`,
            `<line x1="${sp.x - 10}" y1="${sp.y + 8}" x2="${sp.x + 10}" y2="${sp.y + 8}" stroke="#1e293b" stroke-width="2" />`,
            `<line x1="${sp.x - 6}" y1="${sp.y + 12}" x2="${sp.x + 6}" y2="${sp.y + 12}" stroke="#1e293b" stroke-width="2" />`,
            `<line x1="${sp.x - 2.5}" y1="${sp.y + 16}" x2="${sp.x + 2.5}" y2="${sp.y + 16}" stroke="#1e293b" stroke-width="2" />`
          );
        } else if (/\bcirc\b/i.test(nodeOpts)) {
          const sp = toSvg(pt);
          svgElements.push(`<circle cx="${sp.x.toFixed(1)}" cy="${sp.y.toFixed(1)}" r="3.5" fill="#0f172a" />`);
        } else if (/\bocirc\b/i.test(nodeOpts)) {
          const sp = toSvg(pt);
          svgElements.push(
            `<circle cx="${sp.x.toFixed(1)}" cy="${sp.y.toFixed(1)}" r="3.5" fill="#ffffff" stroke="#0f172a" stroke-width="1.8" />`
          );
        }

        if (textGrp && textGrp.content.trim()) {
          if (/\bdraw\b/i.test(nodeOpts) && /\bcircle\b/i.test(nodeOpts)) {
            const sp = toSvg(pt);
            svgElements.push(
              `<circle cx="${sp.x.toFixed(1)}" cy="${sp.y.toFixed(1)}" r="14" fill="#ffffff" stroke="#1e293b" stroke-width="2" />`
            );
            addLabel(pt, textGrp.content, nodeOpts);
          } else if (
            /\bdraw\b/i.test(nodeOpts) ||
            /\balign\s*=\s*left\b/i.test(nodeOpts) ||
            textGrp.content.includes('\\\\')
          ) {
            renderCodeOrBoxNode(pt, textGrp.content, nodeOpts);
          } else {
            addLabel(pt, textGrp.content, nodeOpts);
          }
        }
      }
      continue;
    }

    // 3. \draw, \fill, \filldraw, \path
    const cmdMatch = stmt.match(/^\\(draw|filldraw|fill|path)\b/);
    if (cmdMatch) {
      const cmdType = cmdMatch[1];
      let rest = stmt.slice(cmdMatch[0].length).trim();
      let cmdOpts = '';
      if (rest.startsWith('[')) {
        const br = extractBracketContent(rest, 0);
        if (br) {
          cmdOpts = br.content;
          rest = rest.slice(br.endIndex).trim();
        }
      }

      const strokeColor = resolveStrokeColor(cmdOpts);
      const fillColor = resolveFillColor(cmdOpts, cmdType);
      const strokeWidth = /\bvery\s+thick\b/i.test(cmdOpts) ? '2.8' : /\bthin\b/i.test(cmdOpts) ? '1.3' : '2';
      const isDashed = /\bdashed\b/i.test(cmdOpts);
      const isDotted = /\bdotted\b/i.test(cmdOpts);
      const hasArrowEnd = /(?:->|-stealth|-latex)/i.test(cmdOpts);
      const hasArrowStart = /(?:<-|stealth-|latex-)/i.test(cmdOpts);
      const strokeDash = isDashed ? ' stroke-dasharray="6,4"' : isDotted ? ' stroke-dasharray="2,3"' : '';
      const isFilledWhite = /fill\s*=\s*white/i.test(cmdOpts);
      const isSolidFill = cmdType === 'fill' || (cmdType === 'filldraw' && !isFilledWhite) || fillColor !== 'none';

      // Special check: plot (\x, {expr})
      const plotMatch = rest.match(/plot\s*(?:\[[^\]]*\])?\s*\(\s*\\x\s*,\s*\{([^}]+)\}\s*\)/);
      if (plotMatch) {
        const fnExpr = plotMatch[1];
        const domainMatch = (cmdOpts + ' ' + rest).match(/domain\s*=\s*([+-]?\d+(?:\.\d+)?)\s*:\s*([+-]?\d+(?:\.\d+)?)/);
        const xMin = domainMatch ? parseFloat(domainMatch[1]) : 0;
        const xMax = domainMatch ? parseFloat(domainMatch[2]) : 4;
        const samples = 60;
        const polyPts: string[] = [];
        for (let k = 0; k <= samples; k++) {
          const xv = xMin + ((xMax - xMin) * k) / samples;
          const yv = evalPlotFunction(fnExpr, xv);
          const pt: Point = { x: currentShift.x + xv * SCALE, y: currentShift.y + yv * SCALE };
          trackPoint(pt.x, pt.y, 8);
          const sp = toSvg(pt);
          polyPts.push(`${sp.x.toFixed(1)},${sp.y.toFixed(1)}`);
        }
        svgElements.push(
          `<polyline points="${polyPts.join(' ')}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}"${strokeDash} />`
        );
        continue;
      }

      // Tokenize path operations sequentially
      let cursor = 0;
      let currentPt: Point | null = null;
      let pathStartPt: Point | null = null;
      let polyChain: Point[] = [];
      let pendingOp: '--' | '|-' | '-|' | 'to' | 'rectangle' | 'grid' | null = null;
      let pendingToOpts = '';
      let pendingSegmentLabel: { text: string; opts: string } | null = null;

      const recordAxisCheck = (p1: Point, p2: Point) => {
        if (!hasArrowEnd && !hasArrowStart) return;
        // Horizontal axis along y = 0 passing through or starting at x = 0
        if (Math.abs(p1.y) < 1 && Math.abs(p2.y) < 1 && Math.min(p1.x, p2.x) <= 1 && Math.max(p1.x, p2.x) >= -1) {
          hasHorizontalAxisThroughOrigin = true;
        }
        // Vertical axis along x = 0 passing through or starting at y = 0
        if (Math.abs(p1.x) < 1 && Math.abs(p2.x) < 1 && Math.min(p1.y, p2.y) <= 1 && Math.max(p1.y, p2.y) >= -1) {
          hasVerticalAxisThroughOrigin = true;
        }
      };

      while (cursor < rest.length) {
        while (cursor < rest.length && /\s/.test(rest[cursor])) cursor++;
        if (cursor >= rest.length) break;

        // Relative coordinate ++(x,y) or +(x,y)
        if (rest.startsWith('++(', cursor) || rest.startsWith('+(', cursor)) {
          const isUpdate = rest.startsWith('++(', cursor);
          const pStart = cursor + (isUpdate ? 2 : 1);
          const pEnd = rest.indexOf(')', pStart);
          if (pEnd !== -1) {
            const rawC = rest.slice(pStart, pEnd + 1);
            const nextPt = parseCoord(rawC, currentPt || { x: currentShift.x, y: currentShift.y }, true);
            cursor = pEnd + 1;
            if (nextPt) {
              if (currentPt && pendingOp) {
                const s1 = toSvg(currentPt);
                const s2 = toSvg(nextPt);
                trackPoint(currentPt.x, currentPt.y, 10);
                trackPoint(nextPt.x, nextPt.y, 10);
                if (pendingOp === 'to') {
                  drawCircuitComponent(currentPt, nextPt, pendingToOpts);
                } else if (pendingOp === 'rectangle') {
                  const rx = Math.min(s1.x, s2.x);
                  const ry = Math.min(s1.y, s2.y);
                  const rw = Math.abs(s2.x - s1.x);
                  const rh = Math.abs(s2.y - s1.y);
                  const rectFill = fillColor !== 'none' ? fillColor : isFilledWhite ? '#ffffff' : isSolidFill ? '#0f172a' : 'none';
                  svgElements.push(
                    `<rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" fill="${rectFill}" stroke="${strokeColor}" stroke-width="${strokeWidth}"${strokeDash} />`
                  );
                } else {
                  recordAxisCheck(currentPt, nextPt);
                  const markerEnd = hasArrowEnd ? ' marker-end="url(#tikz-arrow)"' : '';
                  const markerStart = hasArrowStart ? ' marker-start="url(#tikz-arrow-start)"' : '';
                  svgElements.push(
                    `<line x1="${s1.x.toFixed(1)}" y1="${s1.y.toFixed(1)}" x2="${s2.x.toFixed(1)}" y2="${s2.y.toFixed(1)}" stroke="${strokeColor}" stroke-width="${strokeWidth}"${strokeDash}${markerStart}${markerEnd} />`
                  );
                  polyChain.push(nextPt);
                  if (pendingSegmentLabel) {
                    const mid: Point = {
                      x: (currentPt.x + nextPt.x) / 2,
                      y: (currentPt.y + nextPt.y) / 2
                    };
                    addLabel(mid, pendingSegmentLabel.text, pendingSegmentLabel.opts);
                    pendingSegmentLabel = null;
                  }
                }
                pendingOp = null;
              } else {
                polyChain = [nextPt];
              }
              if (isUpdate || !currentPt) {
                currentPt = nextPt;
              }
              if (!pathStartPt) pathStartPt = nextPt;
            }
            continue;
          }
        }

        // Standard coordinate (x,y) or (Name)
        if (rest[cursor] === '(') {
          const pEnd = rest.indexOf(')', cursor);
          if (pEnd !== -1) {
            const rawC = rest.slice(cursor, pEnd + 1);
            const nextPt = parseCoord(rawC, currentPt || undefined, false);
            cursor = pEnd + 1;
            if (nextPt) {
              trackPoint(nextPt.x, nextPt.y, 10);
              if (currentPt && pendingOp) {
                const s1 = toSvg(currentPt);
                const s2 = toSvg(nextPt);
                if (pendingOp === 'to') {
                  drawCircuitComponent(currentPt, nextPt, pendingToOpts);
                } else if (pendingOp === 'rectangle') {
                  const rx = Math.min(s1.x, s2.x);
                  const ry = Math.min(s1.y, s2.y);
                  const rw = Math.abs(s2.x - s1.x);
                  const rh = Math.abs(s2.y - s1.y);
                  const rectFill = fillColor !== 'none' ? fillColor : isFilledWhite ? '#ffffff' : '#ffffff';
                  const rectStroke = cmdType === 'fill' && !/draw/.test(cmdOpts) ? 'none' : strokeColor;
                  svgElements.push(
                    `<rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" fill="${rectFill}" stroke="${rectStroke}" stroke-width="${strokeWidth}"${strokeDash} />`
                  );
                } else if (pendingOp === 'grid') {
                  // Draw grid from currentPt to nextPt
                  const gx1 = Math.min(currentPt.x, nextPt.x);
                  const gx2 = Math.max(currentPt.x, nextPt.x);
                  const gy1 = Math.min(currentPt.y, nextPt.y);
                  const gy2 = Math.max(currentPt.y, nextPt.y);
                  const spanX = (gx2 - gx1) / SCALE;
                  // Auto-detect 1.2cm step for 3.6x3.6 3x3 grids (e.g. Q17/Q58), else 1.0cm
                  let stepCm = 1.0;
                  const stepMatch = cmdOpts.match(/step\s*=\s*([^,\]]+)/);
                  if (stepMatch) {
                    stepCm = evalNum(stepMatch[1], 1);
                  } else if (Math.abs(spanX - 3.6) < 0.05) {
                    stepCm = 1.2;
                  }
                  const stepPx = stepCm * SCALE;
                  for (let x = gx1; x <= gx2 + 0.5; x += stepPx) {
                    const pA = toSvg({ x, y: gy1 });
                    const pB = toSvg({ x, y: gy2 });
                    svgElements.push(
                      `<line x1="${pA.x.toFixed(1)}" y1="${pA.y.toFixed(1)}" x2="${pB.x.toFixed(1)}" y2="${pB.y.toFixed(1)}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />`
                    );
                  }
                  for (let y = gy1; y <= gy2 + 0.5; y += stepPx) {
                    const pA = toSvg({ x: gx1, y });
                    const pB = toSvg({ x: gx2, y });
                    svgElements.push(
                      `<line x1="${pA.x.toFixed(1)}" y1="${pA.y.toFixed(1)}" x2="${pB.x.toFixed(1)}" y2="${pB.y.toFixed(1)}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />`
                    );
                  }
                } else if (pendingOp === '|-') {
                  const corner: Point = { x: currentPt.x, y: nextPt.y };
                  const sc = toSvg(corner);
                  svgElements.push(
                    `<polyline points="${s1.x.toFixed(1)},${s1.y.toFixed(1)} ${sc.x.toFixed(1)},${sc.y.toFixed(1)} ${s2.x.toFixed(1)},${s2.y.toFixed(1)}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}"${strokeDash} />`
                  );
                } else if (pendingOp === '-|') {
                  const corner: Point = { x: nextPt.x, y: currentPt.y };
                  const sc = toSvg(corner);
                  svgElements.push(
                    `<polyline points="${s1.x.toFixed(1)},${s1.y.toFixed(1)} ${sc.x.toFixed(1)},${sc.y.toFixed(1)} ${s2.x.toFixed(1)},${s2.y.toFixed(1)}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}"${strokeDash} />`
                  );
                } else {
                  recordAxisCheck(currentPt, nextPt);
                  const markerEnd = hasArrowEnd ? ' marker-end="url(#tikz-arrow)"' : '';
                  const markerStart = hasArrowStart ? ' marker-start="url(#tikz-arrow-start)"' : '';
                  svgElements.push(
                    `<line x1="${s1.x.toFixed(1)}" y1="${s1.y.toFixed(1)}" x2="${s2.x.toFixed(1)}" y2="${s2.y.toFixed(1)}" stroke="${strokeColor}" stroke-width="${strokeWidth}"${strokeDash}${markerStart}${markerEnd} />`
                  );
                  polyChain.push(nextPt);
                  if (pendingSegmentLabel) {
                    const mid: Point = {
                      x: (currentPt.x + nextPt.x) / 2,
                      y: (currentPt.y + nextPt.y) / 2
                    };
                    addLabel(mid, pendingSegmentLabel.text, pendingSegmentLabel.opts);
                    pendingSegmentLabel = null;
                  }
                }
                pendingOp = null;
              } else {
                // Start of a new disconnected sub-path within the same \draw command
                pathStartPt = nextPt;
                polyChain = [nextPt];
              }
              currentPt = nextPt;
              if (!pathStartPt) pathStartPt = nextPt;
            }
            continue;
          }
        }

        // Operators: --, |-, -|, rectangle, grid, arc, circle, to[...], node[...]{...}, cycle
        if (rest.startsWith('--', cursor)) {
          pendingOp = '--';
          cursor += 2;
          continue;
        }
        if (rest.startsWith('|-', cursor)) {
          pendingOp = '|-';
          cursor += 2;
          continue;
        }
        if (rest.startsWith('-|', cursor)) {
          pendingOp = '-|';
          cursor += 2;
          continue;
        }
        if (rest.startsWith('cycle', cursor)) {
          if (currentPt && pathStartPt) {
            if (fillColor !== 'none' && polyChain.length >= 3) {
              const ptsAttr = polyChain
                .map((pt) => {
                  const sp = toSvg(pt);
                  return `${sp.x.toFixed(1)},${sp.y.toFixed(1)}`;
                })
                .join(' ');
              const polyStroke = cmdType === 'fill' && !/draw/.test(cmdOpts) ? 'none' : strokeColor;
              svgElements.push(
                `<polygon points="${ptsAttr}" fill="${fillColor}" stroke="${polyStroke}" stroke-width="${strokeWidth}" />`
              );
            } else if (pendingOp === '--') {
              const s1 = toSvg(currentPt);
              const s2 = toSvg(pathStartPt);
              svgElements.push(
                `<line x1="${s1.x.toFixed(1)}" y1="${s1.y.toFixed(1)}" x2="${s2.x.toFixed(1)}" y2="${s2.y.toFixed(1)}" stroke="${strokeColor}" stroke-width="${strokeWidth}"${strokeDash} />`
              );
            }
            currentPt = pathStartPt;
          }
          pendingOp = null;
          cursor += 5;
          continue;
        }
        if (rest.startsWith('rectangle', cursor)) {
          pendingOp = 'rectangle';
          cursor += 9;
          continue;
        }
        if (rest.startsWith('grid', cursor) && (cursor + 4 >= rest.length || /[\s\(]/.test(rest[cursor + 4]))) {
          pendingOp = 'grid';
          cursor += 4;
          continue;
        }
        if (rest.startsWith('arc', cursor) && (cursor + 3 >= rest.length || /[\s\(\[]/.test(rest[cursor + 3]))) {
          cursor += 3;
          while (cursor < rest.length && /\s/.test(rest[cursor])) cursor++;
          if (rest[cursor] === '(') {
            const pEnd = rest.indexOf(')', cursor);
            if (pEnd !== -1) {
              const arcSpec = rest.slice(cursor + 1, pEnd).trim();
              cursor = pEnd + 1;
              const parts = arcSpec.split(':');
              if (parts.length === 3 && currentPt) {
                const startDeg = evalSimpleMath(parts[0]);
                const endDeg = evalSimpleMath(parts[1]);
                const rPx = evalNum(parts[2], SCALE);
                const startRad = (startDeg * Math.PI) / 180;
                const cx = currentPt.x - rPx * Math.cos(startRad);
                const cy = currentPt.y - rPx * Math.sin(startRad);
                const steps = 18;
                const arcPts: string[] = [];
                let lastArcPt = currentPt;
                for (let s = 0; s <= steps; s++) {
                  const deg = startDeg + ((endDeg - startDeg) * s) / steps;
                  const rad = (deg * Math.PI) / 180;
                  const px = cx + rPx * Math.cos(rad);
                  const py = cy + rPx * Math.sin(rad);
                  lastArcPt = { x: px, y: py };
                  trackPoint(px, py, 6);
                  polyChain.push(lastArcPt);
                  const sp = toSvg(lastArcPt);
                  arcPts.push(`${sp.x.toFixed(1)},${sp.y.toFixed(1)}`);
                }
                svgElements.push(
                  `<polyline points="${arcPts.join(' ')}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}"${strokeDash} />`
                );
                currentPt = lastArcPt;
                pendingOp = null;
              }
              continue;
            }
          }
          continue;
        }
        if (rest.startsWith('to', cursor) && (cursor + 2 >= rest.length || /[\s\[]/.test(rest[cursor + 2]))) {
          cursor += 2;
          while (cursor < rest.length && /\s/.test(rest[cursor])) cursor++;
          pendingToOpts = 'short';
          if (rest[cursor] === '[') {
            const br = extractBracketContent(rest, cursor);
            if (br) {
              pendingToOpts = br.content;
              cursor = br.endIndex;
            }
          }
          pendingOp = 'to';
          continue;
        }
        if (rest.startsWith('circle', cursor)) {
          cursor += 6;
          while (cursor < rest.length && /\s/.test(rest[cursor])) cursor++;
          let radius = 3.5;
          if (rest[cursor] === '(') {
            const pEnd = rest.indexOf(')', cursor);
            if (pEnd !== -1) {
              const rStr = rest.slice(cursor + 1, pEnd).trim();
              radius = evalNum(rStr, SCALE);
              cursor = pEnd + 1;
            }
          } else if (rest[cursor] === '[') {
            const br = extractBracketContent(rest, cursor);
            if (br) {
              const rMatch = br.content.match(/radius\s*=\s*([^,\]]+)/);
              if (rMatch) radius = evalNum(rMatch[1], SCALE);
              cursor = br.endIndex;
            }
          }
          if (currentPt) {
            const sp = toSvg(currentPt);
            trackPoint(currentPt.x, currentPt.y, radius + 6);
            const cFill = fillColor !== 'none' ? fillColor : isFilledWhite ? '#ffffff' : cmdType === 'fill' ? '#0f172a' : 'none';
            const strokeAttr = cmdType === 'fill' ? 'none' : strokeColor;
            svgElements.push(
              `<circle cx="${sp.x.toFixed(1)}" cy="${sp.y.toFixed(1)}" r="${Math.max(2.5, radius).toFixed(1)}" fill="${cFill}" stroke="${strokeAttr}" stroke-width="${strokeWidth}"${strokeDash} />`
            );
          }
          continue;
        }
        if (rest.startsWith('node', cursor) && (cursor + 4 >= rest.length || /[\s\[\{\(]/.test(rest[cursor + 4]))) {
          cursor += 4;
          let nOpts = '';
          while (cursor < rest.length && /\s/.test(rest[cursor])) cursor++;
          if (rest[cursor] === '[') {
            const br = extractBracketContent(rest, cursor);
            if (br) {
              nOpts = br.content;
              cursor = br.endIndex;
            }
          }
          while (cursor < rest.length && /\s/.test(rest[cursor])) cursor++;
          if (rest[cursor] === '(') {
            const pEnd = rest.indexOf(')', cursor);
            if (pEnd !== -1) {
              const nName = rest.slice(cursor + 1, pEnd).trim();
              if (nName && currentPt) namedCoords.set(nName, { ...currentPt });
              cursor = pEnd + 1;
            }
          }
          while (cursor < rest.length && /\s/.test(rest[cursor])) cursor++;
          if (rest[cursor] === '[') {
            const br = extractBracketContent(rest, cursor);
            if (br) {
              nOpts += ',' + br.content;
              cursor = br.endIndex;
            }
          }
          while (cursor < rest.length && /\s/.test(rest[cursor])) cursor++;
          if (rest[cursor] === '{') {
            const grp = extractBraceContent(rest, cursor);
            if (grp) {
              cursor = grp.endIndex;
              if (/\bcirc\b/i.test(nOpts) && currentPt) {
                const sp = toSvg(currentPt);
                svgElements.push(`<circle cx="${sp.x.toFixed(1)}" cy="${sp.y.toFixed(1)}" r="3.5" fill="#0f172a" />`);
              } else if (/\bocirc\b/i.test(nOpts) && currentPt) {
                const sp = toSvg(currentPt);
                svgElements.push(
                  `<circle cx="${sp.x.toFixed(1)}" cy="${sp.y.toFixed(1)}" r="3.5" fill="#ffffff" stroke="#0f172a" stroke-width="1.8" />`
                );
              }
              if (grp.content.trim()) {
                if (pendingOp === '--' || /\bmidway\b|pos\s*=/i.test(nOpts)) {
                  pendingSegmentLabel = { text: grp.content, opts: nOpts };
                } else if (currentPt) {
                  if (/\bcircle\b/i.test(nOpts) && /\bdraw\b/i.test(nOpts)) {
                    const sp = toSvg(currentPt);
                    svgElements.push(
                      `<circle cx="${sp.x.toFixed(1)}" cy="${sp.y.toFixed(1)}" r="13" fill="#ffffff" stroke="#1e293b" stroke-width="2" />`
                    );
                  }
                  addLabel(currentPt, grp.content, nOpts);
                }
              }
              continue;
            }
          }
          continue;
        }
        if (rest.startsWith('coordinate', cursor)) {
          cursor += 10;
          while (cursor < rest.length && /\s/.test(rest[cursor])) cursor++;
          if (rest[cursor] === '[') {
            const br = extractBracketContent(rest, cursor);
            if (br) cursor = br.endIndex;
          }
          while (cursor < rest.length && /\s/.test(rest[cursor])) cursor++;
          if (rest[cursor] === '(') {
            const pEnd = rest.indexOf(')', cursor);
            if (pEnd !== -1) {
              const cName = rest.slice(cursor + 1, pEnd).trim();
              if (cName && currentPt) namedCoords.set(cName, { ...currentPt });
              cursor = pEnd + 1;
              continue;
            }
          }
        }

        // Advance 1 char if unrecognized token
        cursor++;
      }
    }
  }

  // If this diagram is a 2D coordinate graph with horizontal & vertical axes meeting at (0,0)
  // and no explicit '0' label was placed at (0,0), automatically add '0' at the origin.
  if (hasHorizontalAxisThroughOrigin && hasVerticalAxisThroughOrigin && !hasExplicitOriginZeroLabel) {
    addLabel({ x: 0, y: 0 }, '0', 'below left');
  }

  if (svgElements.length === 0 && labelElements.length === 0) {
    return undefined;
  }

  // Compute SVG bounding box
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pt of allPoints) {
    const sp = toSvg(pt);
    if (sp.x < minX) minX = sp.x;
    if (sp.y < minY) minY = sp.y;
    if (sp.x > maxX) maxX = sp.x;
    if (sp.y > maxY) maxY = sp.y;
  }

  if (!isFinite(minX) || !isFinite(minY)) {
    minX = -50;
    minY = -50;
    maxX = 250;
    maxY = 180;
  }

  const pad = 22;
  const vbX = Math.floor(minX - pad);
  const vbY = Math.floor(minY - pad);
  const vbW = Math.max(120, Math.ceil(maxX - minX + pad * 2));
  const vbH = Math.max(75, Math.ceil(maxY - minY + pad * 2));

  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="${Math.min(540, Math.max(240, vbW))}" height="${Math.min(400, Math.max(110, vbH))}" style="background:#ffffff;border-radius:12px;">
    <defs>
      <marker id="tikz-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#1e293b" />
      </marker>
      <marker id="tikz-arrow-start" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M 10 1.5 L 1 5 L 10 8.5 z" fill="#1e293b" />
      </marker>
    </defs>
    ${svgElements.join('\n    ')}
    ${labelElements.join('\n    ')}
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
}
