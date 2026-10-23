import { Exam, CandidateAttempt } from '../types/exam';
import { parseTexExam, SAMPLE_TEX_EXAM } from './texParser';

const initialElabsQuestions = parseTexExam(SAMPLE_TEX_EXAM, 10);

export const DEFAULT_EXAMS: Exam[] = [
  {
    id: 'exam_elabs_2026_round1',
    code: 'ELABS-2026',
    title: 'ELABS 2026: Vòng Sơ Loại Học Thuật - Khoa Điện Tử - Viễn Thông (HCMUS)',
    subject: 'Điện tử - Viễn thông',
    durationMinutes: 45,
    totalPoints: 10,
    pointDistribution: 'equal',
    password: '',
    settings: {
      shuffleQuestions: false,
      shuffleOptions: false,
      requireFullscreen: true,
      strictFullscreenLock: true, // Cố định full-screen trong lúc thi!
      trackTabSwitch: true,
      maxTabSwitches: 3,
      autoSubmitOnMaxViolations: true,
      showResultImmediately: true,
      showExplanations: true,
      allowReviewAnswers: true
    },
    questions: initialElabsQuestions,
    status: 'published',
    createdAt: Date.now() - 3600000 * 24,
    updatedAt: Date.now() - 3600000 * 2
  },
  {
    id: 'exam_elabs_embedded_fpga',
    code: 'ELABS-EMBED',
    title: 'ELABS 2026: Chuyên Đề Hệ Thống Nhúng, FPGA & Xử Lý Tín Hiệu Số',
    subject: 'Vi điều khiển & Hệ thống nhúng',
    durationMinutes: 30,
    totalPoints: 10,
    pointDistribution: 'equal',
    password: '',
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
      {
        id: 'q_elabs_emb_1',
        number: 1,
        content: 'Trong giao thức truyền thông SPI (Serial Peripheral Interface), khi cấu hình $\\text{CPOL} = 0$ và $\\text{CPHA} = 1$, dữ liệu được chốt mẫu (sample) tại cạnh nào của xung nhịp $\\text{SCK}$?',
        options: [
          { id: 'A', text: 'Cạnh xuống (Falling edge)' },
          { id: 'B', text: 'Cạnh lên (Rising edge)' },
          { id: 'C', text: 'Khi mức tín hiệu ở mức thấp (Low level)' },
          { id: 'D', text: 'Khi mức tín hiệu ở mức cao (High level)' }
        ],
        correctOptionId: 'A',
        points: 2.5,
        explanation: 'Khi $\\text{CPOL} = 0$, mức nghỉ của $\\text{SCK}$ là 0 (Low). Với $\\text{CPHA} = 1$, dữ liệu được thay đổi tại cạnh thứ nhất (cạnh lên) và được chốt mẫu tại cạnh thứ hai (cạnh xuống - falling edge).',
        difficulty: 'medium'
      },
      {
        id: 'q_elabs_emb_2',
        number: 2,
        content: 'Cho sơ đồ giải thuật biến đổi Fourier nhanh (FFT) Radix-2 như hình vẽ bên dưới. Số phép nhân phức cần thiết để tính toán biến đổi FFT cho một tín hiệu có độ dài $N = 1024$ mẫu xấp xỉ bằng',
        imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80',
        imageCaption: 'Hình 1: Đồ hình cánh bướm (Butterfly diagram) FFT Radix-2',
        options: [
          { id: 'A', text: '$5120\\text{ phép nhân phức}$' },
          { id: 'B', text: '$1048576\\text{ phép nhân phức}$' },
          { id: 'C', text: '$10240\\text{ phép nhân phức}$' },
          { id: 'D', text: '$2048\\text{ phép nhân phức}$' }
        ],
        correctOptionId: 'A',
        points: 2.5,
        explanation: 'Số phép nhân phức trong giải thuật FFT Radix-2 là $\\frac{N}{2} \\log_2 N = \\frac{1024}{2} \\cdot 10 = 512 \\cdot 10 = 5120$ phép nhân phức, giảm đáng kể so với $N^2 = 1024^2 = 1048576$ phép nhân của DFT trực tiếp.',
        difficulty: 'hard'
      },
      {
        id: 'q_elabs_emb_3',
        number: 3,
        content: 'Trong kiến trúc ngôn ngữ mô tả phần cứng Verilog/VHDL, phát biểu nào sau đây là ĐÚNG khi thiết kế mạch tuần tự (Sequential logic) kích khởi theo cạnh xung nhịp?',
        options: [
          { id: 'A', text: 'Phải sử dụng phép gán không chặn (Non-blocking assignment `<=`) trong khối `always @(posedge clk)`' },
          { id: 'B', text: 'Phải sử dụng phép gán có chặn (Blocking assignment `=`) trong mọi trường hợp' },
          { id: 'C', text: 'Chỉ được sử dụng cổng logic nguyên thủy `and`, `or`, `not`' },
          { id: 'D', text: 'Không được phép sử dụng tín hiệu Reset bất đồng bộ' }
        ],
        correctOptionId: 'A',
        points: 2.5,
        explanation: 'Trong Verilog, để tránh hiện tượng tranh chấp (race conditions) và đảm bảo thanh ghi Flip-Flop được tổng hợp chính xác, chuẩn thiết kế bắt buộc sử dụng phép gán không chặn (Non-blocking `<=`) cho mạch tuần tự.',
        difficulty: 'easy'
      },
      {
        id: 'q_elabs_emb_4',
        number: 4,
        content: 'Cho bộ chuyển đổi tương tự sang số ADC 12-bit có điện áp tham chiếu $V_{ref} = 3{,}3\\text{ V}$. Độ phân giải điện áp (LSB) của ADC xấp xỉ bằng',
        options: [
          { id: 'A', text: '$0{,}806\\text{ mV}$' },
          { id: 'B', text: '$3{,}22\\text{ mV}$' },
          { id: 'C', text: '$1{,}61\\text{ mV}$' },
          { id: 'D', text: '$0{,}403\\text{ mV}$' }
        ],
        correctOptionId: 'A',
        points: 2.5,
        explanation: 'Độ phân giải $1\\text{ LSB} = \\frac{V_{ref}}{2^{12} - 1} = \\frac{3{,}3\\text{ V}}{4095} \\approx 0{,}80586\\text{ mV} \\approx 0{,}806\\text{ mV}$.',
        difficulty: 'easy'
      }
    ],
    status: 'published',
    createdAt: Date.now() - 3600000 * 12,
    updatedAt: Date.now() - 3600000
  }
];

export const DEFAULT_ATTEMPTS: CandidateAttempt[] = [
  {
    id: 'att_elabs_1',
    examId: 'exam_elabs_2026_round1',
    candidateInfo: {
      fullName: 'Trần Gia Bảo',
      candidateCode: '22139001',
      className: '22DTV01 (Khoa ĐTVT - HCMUS)',
      phone: '0912345678'
    },
    startedAt: Date.now() - 3600000 * 5,
    submittedAt: Date.now() - 3600000 * 5 + 1800000,
    answers: {
      [initialElabsQuestions[0]?.id || 'q1']: 'A',
      [initialElabsQuestions[1]?.id || 'q2']: 'A',
      [initialElabsQuestions[2]?.id || 'q3']: 'A',
      [initialElabsQuestions[3]?.id || 'q4']: 'A',
      [initialElabsQuestions[4]?.id || 'q5']: 'A'
    },
    markedForReview: [],
    tabSwitchCount: 0,
    tabSwitchLogs: [],
    isSubmitted: true,
    timeSpentSeconds: 1820,
    score: 10.0,
    totalPoints: 10,
    correctCount: 5,
    totalQuestions: 5,
    status: 'submitted'
  },
  {
    id: 'att_elabs_2',
    examId: 'exam_elabs_2026_round1',
    candidateInfo: {
      fullName: 'Lê Hoàng Yến Nhi',
      candidateCode: '22139045',
      className: '22DTV_CLC (Khoa ĐTVT - HCMUS)',
      phone: '0987654321'
    },
    startedAt: Date.now() - 3600000 * 4,
    submittedAt: Date.now() - 3600000 * 4 + 2100000,
    answers: {
      [initialElabsQuestions[0]?.id || 'q1']: 'A',
      [initialElabsQuestions[1]?.id || 'q2']: 'A',
      [initialElabsQuestions[2]?.id || 'q3']: 'B',
      [initialElabsQuestions[3]?.id || 'q4']: 'A',
      [initialElabsQuestions[4]?.id || 'q5']: 'A'
    },
    markedForReview: [],
    tabSwitchCount: 1,
    tabSwitchLogs: [{ timestamp: Date.now() - 3600000 * 4 + 600000, message: 'Thoát toàn màn hình lần 1 (đã khôi phục sau 3s)' }],
    isSubmitted: true,
    timeSpentSeconds: 2150,
    score: 8.0,
    totalPoints: 10,
    correctCount: 4,
    totalQuestions: 5,
    status: 'submitted'
  },
  {
    id: 'att_elabs_3',
    examId: 'exam_elabs_2026_round1',
    candidateInfo: {
      fullName: 'Nguyễn Đăng Khôi',
      candidateCode: '23139120',
      className: '23DTV02 (Khoa ĐTVT - HCMUS)',
      phone: '0903332211'
    },
    startedAt: Date.now() - 3600000 * 3,
    submittedAt: Date.now() - 3600000 * 3 + 2400000,
    answers: {
      [initialElabsQuestions[0]?.id || 'q1']: 'A',
      [initialElabsQuestions[1]?.id || 'q2']: 'B',
      [initialElabsQuestions[2]?.id || 'q3']: 'C',
      [initialElabsQuestions[3]?.id || 'q4']: 'A',
      [initialElabsQuestions[4]?.id || 'q5']: 'A'
    },
    markedForReview: [],
    tabSwitchCount: 2,
    tabSwitchLogs: [
      { timestamp: Date.now() - 3600000 * 3 + 300000, message: 'Thoát toàn màn hình lần 1' },
      { timestamp: Date.now() - 3600000 * 3 + 800000, message: 'Mất tiêu điểm cửa sổ thi' }
    ],
    isSubmitted: true,
    timeSpentSeconds: 2400,
    score: 6.0,
    totalPoints: 10,
    correctCount: 3,
    totalQuestions: 5,
    status: 'submitted'
  }
];
