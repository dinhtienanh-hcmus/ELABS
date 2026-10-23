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
 * Formats LaTeX label text (e.g. "$R_1 = 10\Omega$", "\textbf{A}") into SVG <tspan> markup
 */
function formatLatexToSvgText(raw: string): string {
  let s = raw.trim();
  if (!s) return '';

  // Remove outer $...$
  s = s.replace(/\$/g, '');

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
    '\\angle': '∠'
  };

  for (const [k, v] of Object.entries(symbolMap)) {
    s = s.split(k).join(v);
  }

  // Handle \frac{a}{b} or \dfrac{a}{b} -> a/b
  s = s.replace(/\\d?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1/$2)');
  // Handle \sqrt{x} -> √(x)
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)');
  // Handle \overline{x} or \bar{x}
  s = s.replace(/\\(?:overline|bar|vec|overrightarrow)\s*\{([^{}]*)\}/g, '$1');
  // Comma inside braces {,} -> ,
  s = s.replace(/\{,\}/g, ',');

  // Parse subscripts and superscripts into <tspan>
  let result = '';
  let i = 0;
  while (i < s.length) {
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
      result += `<tspan font-size="75%" dy="${dy}">${escapeXml(subContent)}</tspan><tspan dy="${resetDy}">&#8203;</tspan>`;
    } else if (s[i] === '{' || s[i] === '}') {
      i++;
    } else {
      result += escapeXml(s[i]);
      i++;
    }
  }

  return result;
}

/**
 * Expand simple \foreach loops in TikZ code
 */
function expandForeach(tikz: string): string {
  const foreachRegex = /\\foreach\s+(\\[a-zA-Z]+(?:\s*\/\s*\\[a-zA-Z]+)?)\s+in\s+\{([^{}]+)\}\s*\{/g;
  let result = tikz;
  let match: RegExpExecArray | null;
  let safety = 0;

  while ((match = foreachRegex.exec(result)) !== null && safety < 20) {
    safety++;
    const vars = match[1].split('/').map((v) => v.trim());
    const listRaw = match[2].trim();
    const bodyStart = match.index + match[0].length - 1; // at '{'
    const bodyGroup = extractBraceContent(result, bodyStart);
    if (!bodyGroup) break;

    // Expand list (handle a,...,b or comma-separated)
    let items = listRaw.split(',').map((x) => x.trim());
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
      if (vars.length === 2 && item.includes('/')) {
        const [val1, val2] = item.split('/').map((v) => v.trim());
        instance = instance.split(vars[0]).join(val1).split(vars[1]).join(val2);
      } else {
        instance = instance.split(vars[0]).join(item);
      }
      expanded += instance + '\n';
    }

    result = result.substring(0, match.index) + expanded + result.substring(bodyGroup.endIndex);
    foreachRegex.lastIndex = 0;
  }

  return result;
}

/**
 * Evaluates simple math expressions in TikZ coordinates like "2*1.5" or "3+0.5"
 */
function evalNum(expr: string, unitScale: number): number {
  let s = expr.trim();
  let factor = unitScale;
  if (s.endsWith('pt')) {
    factor = 1.5;
    s = s.slice(0, -2).trim();
  } else if (s.endsWith('cm')) {
    factor = unitScale;
    s = s.slice(0, -2).trim();
  } else if (s.endsWith('mm')) {
    factor = unitScale / 10;
    s = s.slice(0, -2).trim();
  }
  const val = parseFloat(s);
  return (isNaN(val) ? 0 : val) * factor;
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
  body = expandForeach(body);

  // Split into semicolon-terminated statements (respecting braces)
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
      const ang = (parseFloat(angStr) * Math.PI) / 180;
      const rad = evalNum(radStr, SCALE);
      const dx = Math.cos(ang) * rad;
      const dy = Math.sin(ang) * rad;
      if (isRelative && lastPoint) {
        return { x: lastPoint.x + dx, y: lastPoint.y + dy };
      }
      return { x: dx, y: dy };
    }

    // Cartesian (x, y)
    if (inner.includes(',')) {
      const parts = inner.split(',');
      const x = evalNum(parts[0], SCALE);
      const y = evalNum(parts[1], SCALE);
      if (isRelative && lastPoint) {
        return { x: lastPoint.x + x, y: lastPoint.y + y };
      }
      return { x, y };
    }

    return null;
  };

  // Helper to place a label at TikZ coordinate p with position option (above, below, left, right, etc.)
  const addLabel = (p: Point, text: string, opts: string = '') => {
    const formatted = formatLatexToSvgText(text);
    if (!formatted) return;

    const sp = toSvg(p);
    let dx = 0;
    let dy = 5;
    let anchor = 'middle';

    const lowerOpts = opts.toLowerCase();
    const isAbove = lowerOpts.includes('above');
    const isBelow = lowerOpts.includes('below');
    const isLeft = lowerOpts.includes('left');
    const isRight = lowerOpts.includes('right');

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
    trackPoint(tx, -ty, 28);

    const hasFillWhite = lowerOpts.includes('fill=white');
    if (hasFillWhite) {
      const estW = Math.max(18, formatted.replace(/<[^>]+>/g, '').length * 8 + 8);
      labelElements.push(
        `<rect x="${(tx - estW / 2).toFixed(1)}" y="${(ty - 13).toFixed(1)}" width="${estW}" height="18" rx="3" fill="#ffffff" />`
      );
    }

    labelElements.push(
      `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${anchor}" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="600" fill="#0f172a">${formatted}</text>`
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
    // Perpendicular unit vector (pointing "above" for horizontal left-to-right segment)
    const nx = uy;
    const ny = -ux;
    const midX = (s1.x + s2.x) / 2;
    const midY = (s1.y + s2.y) / 2;
    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

    // Extract label from l=..., l_=..., l^=..., or =...
    let label = '';
    const labelMatch =
      compSpec.match(/(?:l[_^]?|v[_^]?|i[_^]?)\s*=\s*(\{[^}]*\}|[^,\]]+)/) ||
      compSpec.match(/(?:R|C|L|V|I|battery\d*|vsource|isource|american\s+\w+\s+\w+|european\s+\w+\s+\w+)\s*=\s*(\{[^}]*\}|[^,\]]+)/i);
    if (labelMatch) {
      label = labelMatch[1].trim().replace(/^\{|\}$/g, '');
    }

    // Determine component type
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
      // Plain wire (short)
      svgElements.push(
        `<line x1="${s1.x.toFixed(1)}" y1="${s1.y.toFixed(1)}" x2="${s2.x.toFixed(1)}" y2="${s2.y.toFixed(1)}" stroke="#1e293b" stroke-width="2" />`
      );
    }

    // Check terminal poles (*-*, *-o, o-*, etc.)
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

    // Render component label offset perpendicular to segment
    if (label) {
      const formatted = formatLatexToSvgText(label);
      const offsetDist = 20;
      const lx = midX + nx * offsetDist;
      const ly = midY + ny * offsetDist + 4;
      trackPoint(lx, -ly, 25);
      labelElements.push(
        `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="600" fill="#0f172a">${formatted}</text>`
      );
    }
  };

  // Process each statement
  for (const stmt of statements) {
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

    // 2. Standalone \node
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
      const atMatch = rest.match(/^at\s*\(([^)]+)\)/);
      if (atMatch) {
        const pt = parseCoord(`(${atMatch[1]})`);
        rest = rest.slice(atMatch[0].length).trim();
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

          // Check if ground symbol or circ/ocirc
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
            // Check if node is a drawn box/circle shape
            if (/\bdraw\b/i.test(nodeOpts) && /\bcircle\b/i.test(nodeOpts)) {
              const sp = toSvg(pt);
              svgElements.push(
                `<circle cx="${sp.x.toFixed(1)}" cy="${sp.y.toFixed(1)}" r="14" fill="#ffffff" stroke="#1e293b" stroke-width="2" />`
              );
            }
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

      const isDashed = /\bdashed\b/i.test(cmdOpts);
      const isDotted = /\bdotted\b/i.test(cmdOpts);
      const hasArrowEnd = /(?:->|-stealth|-latex)/i.test(cmdOpts);
      const hasArrowStart = /(?:<-|stealth-|latex-)/i.test(cmdOpts);
      const strokeDash = isDashed ? ' stroke-dasharray="6,4"' : isDotted ? ' stroke-dasharray="2,3"' : '';
      const isFilledWhite = /fill\s*=\s*white/i.test(cmdOpts);
      const isSolidFill = cmdType === 'fill' || (cmdType === 'filldraw' && !isFilledWhite);

      // Tokenize path operations sequentially
      let cursor = 0;
      let currentPt: Point | null = null;
      let pathStartPt: Point | null = null;
      let pendingOp: '--' | '|-' | '-|' | 'to' | 'rectangle' | null = null;
      let pendingToOpts = '';
      let pendingSegmentLabel: { text: string; opts: string } | null = null;

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
            const nextPt = parseCoord(rawC, currentPt || { x: 0, y: 0 }, true);
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
                  const fillAttr = isFilledWhite ? '#ffffff' : isSolidFill ? '#0f172a' : 'none';
                  svgElements.push(
                    `<rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" fill="${fillAttr}" stroke="#1e293b" stroke-width="2"${strokeDash} />`
                  );
                } else {
                  const markerEnd = hasArrowEnd ? ' marker-end="url(#tikz-arrow)"' : '';
                  const markerStart = hasArrowStart ? ' marker-start="url(#tikz-arrow-start)"' : '';
                  svgElements.push(
                    `<line x1="${s1.x.toFixed(1)}" y1="${s1.y.toFixed(1)}" x2="${s2.x.toFixed(1)}" y2="${s2.y.toFixed(1)}" stroke="#1e293b" stroke-width="2"${strokeDash}${markerStart}${markerEnd} />`
                  );
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
                  const fillAttr = isFilledWhite ? '#ffffff' : isSolidFill ? '#0f172a' : '#ffffff';
                  svgElements.push(
                    `<rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" fill="${fillAttr}" stroke="#1e293b" stroke-width="2"${strokeDash} />`
                  );
                } else if (pendingOp === '|-') {
                  const corner: Point = { x: currentPt.x, y: nextPt.y };
                  const sc = toSvg(corner);
                  svgElements.push(
                    `<polyline points="${s1.x.toFixed(1)},${s1.y.toFixed(1)} ${sc.x.toFixed(1)},${sc.y.toFixed(1)} ${s2.x.toFixed(1)},${s2.y.toFixed(1)}" fill="none" stroke="#1e293b" stroke-width="2"${strokeDash} />`
                  );
                } else if (pendingOp === '-|') {
                  const corner: Point = { x: nextPt.x, y: currentPt.y };
                  const sc = toSvg(corner);
                  svgElements.push(
                    `<polyline points="${s1.x.toFixed(1)},${s1.y.toFixed(1)} ${sc.x.toFixed(1)},${sc.y.toFixed(1)} ${s2.x.toFixed(1)},${s2.y.toFixed(1)}" fill="none" stroke="#1e293b" stroke-width="2"${strokeDash} />`
                  );
                } else {
                  const markerEnd = hasArrowEnd ? ' marker-end="url(#tikz-arrow)"' : '';
                  const markerStart = hasArrowStart ? ' marker-start="url(#tikz-arrow-start)"' : '';
                  svgElements.push(
                    `<line x1="${s1.x.toFixed(1)}" y1="${s1.y.toFixed(1)}" x2="${s2.x.toFixed(1)}" y2="${s2.y.toFixed(1)}" stroke="#1e293b" stroke-width="2"${strokeDash}${markerStart}${markerEnd} />`
                  );
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
              }
              currentPt = nextPt;
              if (!pathStartPt) pathStartPt = nextPt;
            }
            continue;
          }
        }

        // Operators: --, |-, -|, rectangle, circle, to[...], node[...]{...}, cycle
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
          if (currentPt && pathStartPt && pendingOp === '--') {
            const s1 = toSvg(currentPt);
            const s2 = toSvg(pathStartPt);
            svgElements.push(
              `<line x1="${s1.x.toFixed(1)}" y1="${s1.y.toFixed(1)}" x2="${s2.x.toFixed(1)}" y2="${s2.y.toFixed(1)}" stroke="#1e293b" stroke-width="2"${strokeDash} />`
            );
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
            const fillColor = isFilledWhite ? '#ffffff' : isSolidFill ? '#0f172a' : 'none';
            const strokeAttr = cmdType === 'fill' ? 'none' : '#1e293b';
            svgElements.push(
              `<circle cx="${sp.x.toFixed(1)}" cy="${sp.y.toFixed(1)}" r="${Math.max(2.5, radius).toFixed(1)}" fill="${fillColor}" stroke="${strokeAttr}" stroke-width="2"${strokeDash} />`
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
              if ( /\bcirc\b/i.test(nOpts) && currentPt) {
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

  const pad = 24;
  const vbX = Math.floor(minX - pad);
  const vbY = Math.floor(minY - pad);
  const vbW = Math.max(120, Math.ceil(maxX - minX + pad * 2));
  const vbH = Math.max(90, Math.ceil(maxY - minY + pad * 2));

  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" width="${Math.min(520, Math.max(240, vbW))}" height="${Math.min(380, Math.max(150, vbH))}" style="background:#ffffff;border-radius:12px;">
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
