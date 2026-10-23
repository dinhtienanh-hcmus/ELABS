import { CandidateAttempt, Exam, ExamAnalytics } from '../types/exam';

/**
 * Calculates grade and correctness for a candidate's submission
 */
export function gradeAttempt(
  exam: Exam,
  answers: Record<string, string>,
  timeSpentSeconds: number,
  candidateInfo: CandidateAttempt['candidateInfo'],
  tabSwitchCount: number = 0,
  tabSwitchLogs: { timestamp: number; message: string }[] = [],
  isDisqualified: boolean = false,
  disqualificationReason?: string,
  isTimedOut: boolean = false
): CandidateAttempt {
  let correctCount = 0;
  let mainCorrectCount = 0;
  let mainTotalQuestions = 0;
  let tieBreakerCorrectCount = 0;
  let tieBreakerTotalQuestions = 0;
  let earnedScore = 0;

  const totalQuestions = exam.questions.length;
  const totalExamPoints = exam.totalPoints || 10;

  // Map sections by id to check if a question belongs to a tie-breaker / 0-point section
  const sectionMap = new Map<string, { isTieBreaker: boolean; totalPoints?: number }>();
  (exam.sections || []).forEach((sec) => {
    sectionMap.set(sec.id, {
      isTieBreaker: Boolean(sec.isTieBreaker || sec.totalPoints === 0),
      totalPoints: sec.totalPoints
    });
  });

  exam.questions.forEach((q) => {
    const secMeta = q.sectionId ? sectionMap.get(q.sectionId) : undefined;
    const isTieBreakerQuestion = Boolean(secMeta?.isTieBreaker || q.points === 0);

    if (isTieBreakerQuestion) {
      tieBreakerTotalQuestions++;
    } else {
      mainTotalQuestions++;
    }

    const candidateAnswer = answers[q.id];
    const isCorrect =
      Boolean(candidateAnswer) &&
      candidateAnswer.trim().toUpperCase() === q.correctOptionId.trim().toUpperCase();

    if (isCorrect) {
      correctCount++;
      if (isTieBreakerQuestion) {
        tieBreakerCorrectCount++;
      } else {
        mainCorrectCount++;
        const qPoints =
          typeof q.points === 'number'
            ? q.points
            : totalExamPoints / Math.max(1, mainTotalQuestions || totalQuestions);
        earnedScore += qPoints;
      }
    }
  });

  // Clamp and round to 2 decimal places (0 if disqualified)
  const finalScore = isDisqualified ? 0 : Math.min(totalExamPoints, Math.max(0, +earnedScore.toFixed(2)));

  return {
    id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    examId: exam.id,
    candidateInfo,
    startedAt: Date.now() - (timeSpentSeconds * 1000),
    submittedAt: Date.now(),
    answers,
    markedForReview: [],
    tabSwitchCount,
    tabSwitchLogs,
    isSubmitted: true,
    isDisqualified,
    disqualificationReason,
    timeSpentSeconds,
    score: finalScore,
    totalPoints: totalExamPoints,
    correctCount,
    totalQuestions,
    mainCorrectCount,
    mainTotalQuestions,
    tieBreakerCorrectCount,
    tieBreakerTotalQuestions,
    status: isDisqualified ? 'disqualified' : isTimedOut ? 'timed_out' : 'submitted'
  };
}

/**
 * Calculates analytics across all completed submissions for an exam
 */
export function calculateExamAnalytics(exam: Exam, attempts: CandidateAttempt[]): ExamAnalytics {
  const completed = attempts.filter((a) => a.isSubmitted && a.score !== undefined);
  if (completed.length === 0) {
    return {
      totalAttempts: attempts.length,
      completedAttempts: 0,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0,
      passRate: 0,
      scoreDistribution: [
        { range: '0 - 2.0', count: 0 },
        { range: '2.1 - 4.0', count: 0 },
        { range: '4.1 - 6.0', count: 0 },
        { range: '6.1 - 8.0', count: 0 },
        { range: '8.1 - 10.0', count: 0 }
      ],
      questionStats: exam.questions.map((q) => ({
        questionId: q.id,
        number: q.number,
        correctRate: 0,
        totalAnswers: 0
      }))
    };
  }

  const scores = completed.map((a) => a.score!);
  const highestScore = Math.max(...scores);
  const lowestScore = Math.min(...scores);
  const sumScore = scores.reduce((acc, s) => acc + s, 0);
  const averageScore = +(sumScore / scores.length).toFixed(2);
  const passingCount = scores.filter((s) => s >= 5.0).length;
  const passRate = +((passingCount / scores.length) * 100).toFixed(1);

  // Distribution bins (normalized to 10-scale or based on totalPoints)
  const factor = 10 / (exam.totalPoints || 10);
  const bins = [0, 0, 0, 0, 0];
  scores.forEach((s) => {
    const normalized = s * factor;
    if (normalized <= 2.0) bins[0]++;
    else if (normalized <= 4.0) bins[1]++;
    else if (normalized <= 6.0) bins[2]++;
    else if (normalized <= 8.0) bins[3]++;
    else bins[4]++;
  });

  const scoreDistribution = [
    { range: '0 - 2.0 (Kém)', count: bins[0] },
    { range: '2.1 - 4.0 (Yếu)', count: bins[1] },
    { range: '4.1 - 6.0 (TB)', count: bins[2] },
    { range: '6.1 - 8.0 (Khá)', count: bins[3] },
    { range: '8.1 - 10.0 (Giỏi)', count: bins[4] }
  ];

  // Question stats
  const questionStats = exam.questions.map((q) => {
    let correctForQ = 0;
    let answeredForQ = 0;
    completed.forEach((a) => {
      const ans = a.answers[q.id];
      if (ans) {
        answeredForQ++;
        if (ans.toUpperCase() === q.correctOptionId.toUpperCase()) {
          correctForQ++;
        }
      }
    });

    return {
      questionId: q.id,
      number: q.number,
      correctRate: answeredForQ > 0 ? +((correctForQ / completed.length) * 100).toFixed(1) : 0,
      totalAnswers: answeredForQ
    };
  });

  return {
    totalAttempts: attempts.length,
    completedAttempts: completed.length,
    averageScore,
    highestScore,
    lowestScore,
    passRate,
    scoreDistribution,
    questionStats
  };
}
