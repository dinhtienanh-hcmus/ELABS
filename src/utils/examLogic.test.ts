import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTexExam, distributePointsEvenly, SAMPLE_TEX_EXAM } from './texParser.ts';
import { gradeAttempt, calculateExamAnalytics } from './scoring.ts';
import { Exam } from '../types/exam.ts';

test('parseTexExam parses ELABS sample TeX exam successfully', () => {
  const questions = parseTexExam(SAMPLE_TEX_EXAM, 10);
  assert.equal(questions.length, 5);

  // Check question 1 (Op-Amp)
  assert.equal(questions[0].number, 1);
  assert.equal(questions[0].correctOptionId, 'A');
  assert.ok(questions[0].content.includes('Op-Amp') || questions[0].content.includes('khuếch đại'));
  assert.ok(questions[0].imageUrl?.includes('unsplash'));

  // Check question 2 (Digital logic)
  assert.equal(questions[1].number, 2);
  assert.equal(questions[1].correctOptionId, 'A');
  assert.ok(questions[1].content.includes('Boolean') || questions[1].content.includes('logic'));
});

test('distributePointsEvenly distributes target 10 points correctly', () => {
  const mockQuestions: any[] = [
    { id: '1', number: 1, points: 0 },
    { id: '2', number: 2, points: 0 },
    { id: '3', number: 3, points: 0 }
  ];
  const distributed = distributePointsEvenly(mockQuestions, 10);
  const sum = distributed.reduce((acc, q) => acc + q.points, 0);
  assert.equal(+sum.toFixed(2), 10);
});

test('gradeAttempt grades candidate answers accurately and handles disqualification', () => {
  const mockExam: Exam = {
    id: 'exam_elabs',
    code: 'ELABS-01',
    title: 'Đề thi ELABS',
    subject: 'Điện tử - Viễn thông',
    durationMinutes: 45,
    totalPoints: 10,
    pointDistribution: 'equal',
    settings: {
      shuffleQuestions: false,
      shuffleOptions: false,
      requireFullscreen: true,
      strictFullscreenLock: true,
      trackTabSwitch: true,
      maxTabSwitches: 3,
      autoSubmitOnMaxViolations: true,
      showResultImmediately: true,
      showExplanations: true,
      allowReviewAnswers: true
    },
    questions: [
      { id: 'q1', number: 1, content: 'OpAmp?', options: [{ id: 'A', text: '10' }, { id: 'B', text: '20' }], correctOptionId: 'A', points: 5 },
      { id: 'q2', number: 2, content: 'Logic?', options: [{ id: 'A', text: 'NAND' }, { id: 'B', text: 'NOR' }], correctOptionId: 'A', points: 5 }
    ],
    status: 'published',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const attempt1 = gradeAttempt(
    mockExam,
    { q1: 'A', q2: 'A' },
    120,
    { fullName: 'Trần Gia Bảo', candidateCode: '22139001', className: '22DTV01' },
    0
  );
  assert.equal(attempt1.score, 10);
  assert.equal(attempt1.correctCount, 2);
  assert.equal(attempt1.status, 'submitted');

  // Test disqualification
  const attemptDisqualified = gradeAttempt(
    mockExam,
    { q1: 'A', q2: 'A' },
    60,
    { fullName: 'Lê Vi Phạm', candidateCode: '22139999', className: '22DTV02' },
    4,
    [{ timestamp: Date.now(), message: 'Thoát toàn màn hình quá 3 lần' }],
    true,
    'Đình chỉ thi do thoát toàn màn hình quá số lần quy định'
  );
  assert.equal(attemptDisqualified.score, 0);
  assert.equal(attemptDisqualified.status, 'disqualified');
  assert.equal(attemptDisqualified.isDisqualified, true);

  const analytics = calculateExamAnalytics(mockExam, [attempt1, attemptDisqualified]);
  assert.equal(analytics.completedAttempts, 2);
  assert.equal(analytics.highestScore, 10);
  assert.equal(analytics.lowestScore, 0);
});
