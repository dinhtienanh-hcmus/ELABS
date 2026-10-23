import { Question, QuestionOption } from '../types/exam';
import {
  extractBraceContent,
  extractBracketContent,
  renderTikzToSvgDataUrl
} from './tikzToSvg';

/**
 * Unwraps \immini[...]{mainContent}{figureContent} or \immini{mainContent}{figureContent}
 * Returns the unwrapped main text and an array of extracted figure blocks.
 */
function unwrapImmini(text: string): { unwrappedText: string; figureBlocks: string[] } {
  const figureBlocks: string[] = [];
  let result = text;
  let safety = 0;

  while (safety < 15) {
    safety++;
    const match = result.match(/\\immini(?![a-zA-Z])/);
    if (!match || match.index === undefined) break;

    const startIdx = match.index;
    let cursor = startIdx + match[0].length;

    // Skip optional [...] after \immini
    while (cursor < result.length && /\s/.test(result[cursor])) cursor++;
    if (result[cursor] === '[') {
      const optBracket = extractBracketContent(result, cursor);
      if (optBracket) {
        cursor = optBracket.endIndex;
      }
    }

    // Extract 1st brace group: {question + choices}
    const firstGroup = extractBraceContent(result, cursor);
    if (!firstGroup) {
      // Malformed \immini without balanced braces: remove the \immini{ token
      result =
        result.slice(0, startIdx) +
        result.slice(startIdx).replace(/^\\immini\s*(?:\[[^\]]*\])?\s*\{?/, '');
      break;
    }

    // Extract 2nd brace group: {tikzpicture / includegraphics}
    const secondGroup = extractBraceContent(result, firstGroup.endIndex);
    if (!secondGroup) {
      result =
        result.slice(0, startIdx) +
        firstGroup.content +
        result.slice(firstGroup.endIndex);
      break;
    }

    if (secondGroup.content.trim()) {
      figureBlocks.push(secondGroup.content.trim());
    }

    result =
      result.slice(0, startIdx) +
      firstGroup.content +
      '\n' +
      result.slice(secondGroup.endIndex);
  }

  // Final safety cleanup in case of any stray \immini{
  result = result.replace(/\\immini\s*(?:\[[^\]]*\])?\s*\{?/g, '');

  return { unwrappedText: result, figureBlocks };
}

/**
 * Extracts all \begin{tikzpicture}...\end{tikzpicture} and \begin{circuitikz}...\end{circuitikz} blocks
 */
function extractTikzBlocks(text: string): { cleanText: string; tikzBlocks: string[] } {
  const tikzBlocks: string[] = [];
  const tikzRegex = /\\begin\{(tikzpicture|circuitikz)\}[\s\S]*?\\end\{\1\}/gi;
  const cleanText = text.replace(tikzRegex, (match) => {
    tikzBlocks.push(match.trim());
    return '';
  });
  return { cleanText: cleanText.trim(), tikzBlocks };
}

/**
 * Extracts options from a \choice command:
 * \choice
 * {Option 1}
 * {\True Option 2}
 * {Option 3}
 * {Option 4}
 * Always extracts at most 4 balanced brace groups (A, B, C, D) and returns any trailing text.
 */
function parseChoiceBlock(choiceText: string): {
  options: QuestionOption[];
  correctOptionId: string;
  remainingText: string;
} {
  const options: QuestionOption[] = [];
  let correctOptionId = 'A';
  let cursor = 0;

  // Skip optional [...] after \choice (e.g., \choice[2] or \haicot[1])
  while (cursor < choiceText.length && /\s/.test(choiceText[cursor])) cursor++;
  if (choiceText[cursor] === '[') {
    const br = extractBracketContent(choiceText, cursor);
    if (br) {
      cursor = br.endIndex;
    }
  }

  // Strategy 1: Extract up to 4 balanced brace groups {A}{B}{C}{D}
  const chunks: string[] = [];
  for (let count = 0; count < 4; count++) {
    const grp = extractBraceContent(choiceText, cursor);
    if (!grp) break;
    chunks.push(grp.content.trim());
    cursor = grp.endIndex;
  }

  const remainingText = choiceText.slice(cursor).trim();
  const optionLetters = ['A', 'B', 'C', 'D'];

  if (chunks.length >= 2) {
    chunks.slice(0, 4).forEach((chunk, idx) => {
      const letter = optionLetters[idx];
      let isCorrect = false;
      let text = chunk;

      // Check \True or \true marker (or leading *)
      if (/\\True(?![a-zA-Z])|\\true(?![a-zA-Z])/i.test(text) || /^\*\s*/.test(text)) {
        isCorrect = true;
        text = text
          .replace(/\\True\s*/gi, '')
          .replace(/^\*\s*/, '');
      }

      if (isCorrect) {
        correctOptionId = letter;
      }

      options.push({
        id: letter,
        text: text.trim()
      });
    });
  } else {
    // Strategy 2: Check for A. B. C. D. lines
    const optionMatches = choiceText.match(/(?:^|\n|\s*)\*?[A-D][\.\)]\s*([^\n]+)/g);
    if (optionMatches && optionMatches.length >= 2) {
      optionMatches.slice(0, 4).forEach((line) => {
        const match = line.trim().match(/^(\*?)([A-D])[\.\)]\s*(.*)$/);
        if (match) {
          const hasStar = Boolean(match[1]);
          const letter = match[2];
          let text = match[3];
          if (hasStar || /\\True(?![a-zA-Z])/i.test(text) || text.startsWith('*')) {
            correctOptionId = letter;
            text = text.replace(/\\True\s*/gi, '').replace(/^\*\s*/, '');
          }
          options.push({
            id: letter,
            text: text.trim()
          });
        }
      });
    }
  }

  // Fallback default 4 options if none found
  if (options.length === 0) {
    options.push(
      { id: 'A', text: 'Phương án A' },
      { id: 'B', text: 'Phương án B' },
      { id: 'C', text: 'Phương án C' },
      { id: 'D', text: 'Phương án D' }
    );
  }

  return { options, correctOptionId, remainingText };
}

/**
 * Extracts image url if \includegraphics{...} or \includegraphics[...]{...} is present
 */
function extractImageUrl(text: string): { cleanText: string; imageUrl?: string } {
  const imgRegex = /\\includegraphics(?:\s*\[[^\]]*\])?\s*\{([^}]+)\}/i;
  const match = text.match(imgRegex);
  if (match) {
    const urlOrPath = match[1].trim();
    const cleanText = text.replace(imgRegex, '').trim();
    return { cleanText, imageUrl: urlOrPath };
  }
  return { cleanText: text };
}

/**
 * Extracts explanation from \loigiai{...} or Lời giải: ...
 */
function extractExplanation(text: string): { cleanText: string; explanation?: string } {
  const loigiaiMatch = text.match(/\\loigiai(?![a-zA-Z])/);
  if (loigiaiMatch && loigiaiMatch.index !== undefined) {
    const startIdx = loigiaiMatch.index;
    const afterCmdIdx = startIdx + loigiaiMatch[0].length;
    const grp = extractBraceContent(text, afterCmdIdx);
    if (grp) {
      const cleanText = (text.slice(0, startIdx) + '\n' + text.slice(grp.endIndex)).trim();
      // Also clean any tikzpicture inside explanation if needed
      const { cleanText: expClean } = extractTikzBlocks(grp.content);
      return { cleanText, explanation: expClean.trim() };
    }
  }

  // Check Lời giải: or Hướng dẫn giải:
  const lgMatch = text.match(/(?:Lời giải|Hướng dẫn giải|Giải chi tiết)\s*:\s*([\s\S]+)$/i);
  if (lgMatch) {
    const cleanText = text.replace(/(?:Lời giải|Hướng dẫn giải|Giải chi tiết)\s*:\s*[\s\S]+$/i, '').trim();
    return { cleanText, explanation: lgMatch[1].trim() };
  }

  return { cleanText: text };
}

/**
 * Repairs any previously-imported question that had \immini{ or >4 options (E/F from tikzpicture)
 */
export function sanitizeQuestion(q: Question): Question {
  let content = q.content || '';

  // Remove any leftover \immini{ prefix
  content = content.replace(/^\\immini\s*(?:\[[^\]]*\])?\s*\{?\s*/i, '');
  // Remove any raw tikzpicture block accidentally left in content
  const { cleanText, tikzBlocks } = extractTikzBlocks(content);
  content = cleanText;

  // Trim options to at most 4 (A, B, C, D) and filter out bogus tikzpicture options
  let options = (q.options || []).filter(
    (opt) =>
      opt.id !== 'E' &&
      opt.id !== 'F' &&
      opt.text !== 'tikzpicture' &&
      opt.text !== 'circuitikz' &&
      !opt.text.startsWith('every node/.style')
  );
  if (options.length > 4) {
    options = options.slice(0, 4);
  }

  let tikzCode = q.tikzCode || tikzBlocks[0];
  let imageUrl = q.imageUrl;
  if (tikzCode && (!imageUrl || imageUrl.startsWith('data:image/svg+xml;utf8,'))) {
    imageUrl = renderTikzToSvgDataUrl(tikzCode) || imageUrl;
  }

  return {
    ...q,
    content: content.trim(),
    options,
    tikzCode,
    imageUrl
  };
}

/**
 * Parse an entire TeX document or raw string into structured Question array
 */
export function parseTexExam(texSource: string, totalPoints: number = 10): Question[] {
  if (!texSource || !texSource.trim()) return [];

  // Strip unescaped LaTeX line comments (% ...) while keeping \%
  const cleanedSource = texSource
    .split('\n')
    .map((line) => line.replace(/(?<!\\)%.*$/, ''))
    .join('\n');

  const rawQuestions: { content: string }[] = [];

  // Match \begin{ex} ... \end{ex} or \begin{bt} ... \end{bt} or \begin{vd} ... \end{vd} or \begin{cauhoi} or \begin{question}
  const blockRegex = /\\begin\{(ex|bt|vd|cauhoi|question)\}([\s\S]*?)\\end\{\1\}/gi;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockRegex.exec(cleanedSource)) !== null) {
    rawQuestions.push({ content: blockMatch[2].trim() });
  }

  // If no environment blocks found, try splitting by "Câu X." or "Câu X:" or "\textbf{Câu" or "Question X"
  if (rawQuestions.length === 0) {
    const questionSplitRegex = /(?:^|\n)\s*(?:\\textbf\{|\\bf\s*)?(?:Câu|Bài|Question)\s*\d+[\.:\)\s\}]/gi;
    const parts = cleanedSource.split(questionSplitRegex);
    for (let i = 1; i < parts.length; i++) {
      if (parts[i].trim()) {
        rawQuestions.push({ content: parts[i].trim() });
      }
    }
  }

  // Fallback: try splitting by numbered items like "1. " at start of line if choices exist
  if (rawQuestions.length === 0) {
    const numSplitRegex = /(?:^|\n)\s*\d+[\.\)]\s+/g;
    const parts = cleanedSource.split(numSplitRegex);
    if (parts.length > 2) {
      for (let i = 1; i < parts.length; i++) {
        if (parts[i].trim()) {
          rawQuestions.push({ content: parts[i].trim() });
        }
      }
    }
  }

  // Fallback: If still nothing, treat entire text as single question if choice commands exist
  if (rawQuestions.length === 0 && /\\(choice|motcot|haicot|boncot|baicot)/i.test(cleanedSource)) {
    rawQuestions.push({ content: cleanedSource.trim() });
  }

  const pointPerQuestion = rawQuestions.length > 0 ? +(totalPoints / rawQuestions.length).toFixed(2) : 1;

  const parsedQuestions: Question[] = rawQuestions.map((q, idx) => {
    let content = q.content;
    const questionNumber = idx + 1;

    // 1. Extract explanation (\loigiai{...}) first so its braces/TikZ don't interfere
    const { cleanText: textWithoutExplanation, explanation } = extractExplanation(content);
    content = textWithoutExplanation;

    // 2. Unwrap \immini{main}{figure} or \immini[...]{main}{figure}
    const { unwrappedText, figureBlocks } = unwrapImmini(content);
    content = unwrappedText;

    // 3. Extract any \begin{tikzpicture}...\end{tikzpicture} or \begin{circuitikz}...\end{circuitikz}
    const { cleanText: textWithoutTikz, tikzBlocks } = extractTikzBlocks(content);
    content = textWithoutTikz;

    const allTikzBlocks: string[] = [...tikzBlocks];
    let imageUrl: string | undefined;

    for (const fig of figureBlocks) {
      const { tikzBlocks: figTikz } = extractTikzBlocks(fig);
      allTikzBlocks.push(...figTikz);
      const { imageUrl: figImg } = extractImageUrl(fig);
      if (figImg && !imageUrl) imageUrl = figImg;
    }

    // 4. Check for \includegraphics in main content
    const { cleanText: textWithoutImage, imageUrl: inlineImg } = extractImageUrl(content);
    content = textWithoutImage;
    if (inlineImg && !imageUrl) {
      imageUrl = inlineImg;
    }

    // 5. If we have TikZ/CircuiTikZ code and no external image URL, auto-render TikZ to SVG Data URL
    const primaryTikz = allTikzBlocks[0];
    if (!imageUrl && primaryTikz) {
      imageUrl = renderTikzToSvgDataUrl(primaryTikz);
    }

    // 6. Extract choices (\choice, \choice*, \motcot, \haicot, \boncot, \baicot, \choicefix, \choiceTF)
    let options: QuestionOption[] = [];
    let correctOptionId = 'A';

    const choiceCmdMatch = content.match(/\\(choice(?:TF|fix|\*)?|motcot|haicot|boncot|baicot)(?![a-zA-Z])/i);
    let promptText = content;

    if (choiceCmdMatch && choiceCmdMatch.index !== undefined) {
      promptText = content.substring(0, choiceCmdMatch.index).trim();
      const choicePart = content.substring(choiceCmdMatch.index + choiceCmdMatch[0].length).trim();
      const parsedChoices = parseChoiceBlock(choicePart);
      options = parsedChoices.options;
      correctOptionId = parsedChoices.correctOptionId;
    } else {
      // Check for A. B. C. D. or *A. in promptText
      const optSplit = promptText.search(/(?:^|\n|\s+)\*?[A-D][\.\)]\s+/);
      if (optSplit !== -1) {
        const beforeChoices = promptText.substring(0, optSplit).trim();
        const choicesText = promptText.substring(optSplit).trim();
        const parsedChoices = parseChoiceBlock(choicesText);
        options = parsedChoices.options;
        correctOptionId = parsedChoices.correctOptionId;
        promptText = beforeChoices;
      }
    }

    // Check for explicit "Đáp án: X" in prompt or explanation
    const daMatch = q.content.match(/(?:Đáp án|Đáp án đúng|Chọn đáp án)\s*[:=]?\s*([A-D])(?![a-zA-Z])/i);
    if (daMatch) {
      correctOptionId = daMatch[1].toUpperCase();
    }

    // Clean leading "Câu X." or "\textbf{Câu X:}" if present in promptText
    promptText = promptText.replace(/^(?:\\textbf\{)?(?:Câu|Bài|Question)\s*\d+[\.:\)\s\}]*/i, '').trim();

    // Clean common TeX environment wrappers and stray trailing braces from unwrapped blocks
    promptText = promptText
      .replace(/\\begin\{(?:flushleft|center|minipage)\}(?:\{[^}]*\})?|\\end\{(?:flushleft|center|minipage)\}/g, '')
      .trim();

    return {
      id: `q_${Date.now()}_${questionNumber}_${Math.random().toString(36).substring(2, 7)}`,
      number: questionNumber,
      content: promptText,
      options: options.length > 0 ? options : [
        { id: 'A', text: 'Đáp án A' },
        { id: 'B', text: 'Đáp án B' },
        { id: 'C', text: 'Đáp án C' },
        { id: 'D', text: 'Đáp án D' }
      ],
      correctOptionId,
      points: pointPerQuestion,
      imageUrl,
      tikzCode: primaryTikz,
      explanation
    };
  });

  return distributePointsEvenly(parsedQuestions, totalPoints);
}

/**
 * Distribute points evenly across questions to match target total without negative remainders
 */
export function distributePointsEvenly(questions: Question[], totalPoints: number): Question[] {
  if (questions.length === 0) return [];
  if (!totalPoints || totalPoints <= 0) {
    return questions.map((q) => ({
      ...q,
      points: 0
    }));
  }

  const count = questions.length;
  // Floor to 2 decimal places so basePoint * count <= totalPoints, then distribute +0.01 to first k questions
  const totalCents = Math.round(totalPoints * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainderCents = totalCents - baseCents * count;

  return questions.map((q, idx) => ({
    ...q,
    points: +((baseCents + (idx < remainderCents ? 1 : 0)) / 100).toFixed(2)
  }));
}

/**
 * Sample TeX Exam Templates with realistic Math formulas and diagram images
 */
export const SAMPLE_TEX_EXAM = `\\begin{ex}
  [ELABS - Mạch điện tử] Cho mạch khuếch đại đảo dùng Op-Amp lý tưởng như hình vẽ bên dưới, với điện trở vào $R_1 = 10\\text{ k}\\Omega$ và điện trở hồi tiếp $R_f = 100\\text{ k}\\Omega$. Điện áp ngõ vào $v_{in} = 0{,}2\\text{ V}$. Điện áp ngõ ra $v_{out}$ và hệ số khuếch đại điện áp $A_v$ của mạch là
  \\includegraphics{https://images.unsplash.com/photo-1517077304055-6e89abbf09b0?w=600&auto=format&fit=crop&q=80}
  \\choice
  {\\True $v_{out} = -2{,}0\\text{ V}; A_v = -10$}
  {$v_{out} = 2{,}0\\text{ V}; A_v = 10$}
  {$v_{out} = -0{,}02\\text{ V}; A_v = -0{,}1$}
  {$v_{out} = 1{,}0\\text{ V}; A_v = 5$}
  \\loigiai{
    Đối với mạch khuếch đại đảo dùng Op-Amp lý tưởng:
    Hệ số khuếch đại điện áp: $A_v = -\\frac{R_f}{R_1} = -\\frac{100\\text{ k}\\Omega}{10\\text{ k}\\Omega} = -10$.
    Điện áp ngõ ra: $v_{out} = A_v \\cdot v_{in} = -10 \\cdot 0{,}2\\text{ V} = -2{,}0\\text{ V}$.
  }
\\end{ex}

\\begin{ex}
  [ELABS - Kỹ thuật số] Cho hàm logic Boolean của một khối mạch điều khiển: $Y = A \\cdot B + \\overline{A} \\cdot C + B \\cdot C$. Dạng tối giản theo định lý đồng thuận (Consensus Theorem) hoặc bìa Karnaugh của hàm $Y$ là
  \\choice
  {\\True $Y = A \\cdot B + \\overline{A} \\cdot C$}
  {$Y = A \\cdot B + B \\cdot C$}
  {$Y = \\overline{A} \\cdot C + B \\cdot C$}
  {$Y = (A + B) \\cdot (\\overline{A} + C)$}
  \\loigiai{
    Theo định lý đồng thuận: $A \\cdot B + \\overline{A} \\cdot C + B \\cdot C = A \\cdot B + \\overline{A} \\cdot C$.
    Số hạng $B \\cdot C$ là số hạng thừa (redundant term) và có thể loại bỏ để tối ưu số cổng logic trong thiết kế FPGA/ASIC.
  }
\\end{ex}

\\begin{ex}
  [ELABS - Xử lý tín hiệu & Viễn thông] Một mạch lọc thông thấp RC bậc một có $R = 1\\text{ k}\\Omega$ và tụ điện $C = 100\\text{ nF}$. Tần số cắt $-3\\text{ dB}$ (tần số góc $\\omega_c$ và tần số $f_c$) của bộ lọc xấp xỉ bằng
  \\includegraphics{https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&auto=format&fit=crop&q=80}
  \\choice
  {\\True $f_c \\approx 1{,}59\\text{ kHz}$}
  {$f_c \\approx 15{,}9\\text{ kHz}$}
  {$f_c \\approx 159\\text{ Hz}$}
  {$f_c \\approx 10{,}0\\text{ kHz}$}
  \\loigiai{
    Tần số góc cắt: $\\omega_c = \\frac{1}{RC} = \\frac{1}{1000 \\cdot 100 \\times 10^{-9}} = 10000\\text{ rad/s}$.
    Tần số cắt: $f_c = \\frac{\\omega_c}{2\\pi} = \\frac{10000}{2\\pi} \\approx 1591{,}55\\text{ Hz} \\approx 1{,}59\\text{ kHz}$.
  }
\\end{ex}

\\begin{ex}
  [ELABS - Hệ thống nhúng & Vi điều khiển] Vi điều khiển STM32 chạy ở tần số xung nhịp hệ thống $f_{clk} = 72\\text{ MHz}$. Ta cấu hình Timer 16-bit để phát xung PWM tần số $1\\text{ kHz}$. Nếu chọn giá trị Prescaler $PSC = 71$, giá trị tự nạp lại $ARR$ (Auto-Reload Register) cần đặt là
  \\choice
  {\\True $ARR = 999$}
  {$ARR = 1000$}
  {$ARR = 719$}
  {$ARR = 99$}
  \\loigiai{
    Tần số đếm của Timer: $f_{timer} = \\frac{f_{clk}}{PSC + 1} = \\frac{72\\text{ MHz}}{71 + 1} = 1\\text{ MHz}$.
    Chu kì Timer mong muốn để có tần số $1\\text{ kHz}$:
    $f_{PWM} = \\frac{f_{timer}}{ARR + 1} \\Rightarrow 1000 = \\frac{1000000}{ARR + 1} \\Rightarrow ARR + 1 = 1000 \\Rightarrow ARR = 999$.
  }
\\end{ex}

\\begin{ex}
  [ELABS - Trường điện từ & Sóng vô tuyến] Sóng điện từ có tần số $f = 2{,}4\\text{ GHz}$ (băng tần Wi-Fi/Bluetooth) lan truyền trong không gian tự do với vận tốc $c = 3 \\times 10^8\\text{ m/s}$. Chiều dài ăng-ten lưỡng cực nửa sóng ($\\lambda / 2$) lý tưởng xấp xỉ bằng
  \\choice
  {\\True $6{,}25\\text{ cm}$}
  {$12{,}5\\text{ cm}$}
  {$3{,}125\\text{ cm}$}
  {$2{,}4\\text{ cm}$}
  \\loigiai{
    Bước sóng: $\\lambda = \\frac{c}{f} = \\frac{3 \\times 10^8}{2{,}4 \\times 10^9} = 0{,}125\\text{ m} = 12{,}5\\text{ cm}$.
    Chiều dài ăng-ten $\\lambda / 2$: $L = \\frac{12{,}5}{2} = 6{,}25\\text{ cm}$.
  }
\\end{ex}`;
