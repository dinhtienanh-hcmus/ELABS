export type SubjectType =
  | 'Điện tử - Viễn thông'
  | 'Mạch điện tử & Bán dẫn'
  | 'Kỹ thuật số & FPGA'
  | 'Vi điều khiển & Hệ thống nhúng'
  | 'Xử lý tín hiệu & Viễn thông'
  | 'Toán kỹ thuật'
  | 'Vật lý bán dẫn'
  | 'Toán học'
  | 'Vật lý'
  | 'Khác';

export interface QuestionOption {
  id: string; // 'A', 'B', 'C', 'D', etc.
  text: string;
}

export interface ExamSection {
  id: string;
  title: string; // e.g. 'Phần 1', 'Phần 2'
  description?: string;
  totalPoints?: number; // Tổng điểm của phần này (VD: Phần 1 = 10 điểm, Phần 2 = 0 điểm)
  isTieBreaker?: boolean; // Phần câu hỏi phụ (0 điểm, chỉ xét khi bằng điểm ở câu hỏi chính)
}

export interface Question {
  id: string;
  number: number;
  sectionId?: string; // ID of ExamSection ('part_1', 'part_2', etc.)
  content: string; // Contains text & LaTeX $math$
  options: QuestionOption[];
  correctOptionId: string; // 'A', 'B', 'C', 'D'
  points: number;
  imageUrl?: string;
  imageCaption?: string;
  tikzCode?: string;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface CandidateFieldConfig {
  id: string; // 'fullName' | 'candidateCode' | 'className' | 'phone' | 'custom_...'
  label: string;
  placeholder: string;
  required: boolean;
  enabled: boolean;
  isHalfWidth?: boolean;
  type?: 'text' | 'select'; // 'text' = Nhập chữ tự do, 'select' = Menu thả xuống (click chọn)
  options?: string[]; // Danh sách các lựa chọn trong menu thả xuống (VD: danh sách Đội thi)
  isTeamGroupField?: boolean; // Dùng trường này để gộp kết quả các bài thi cùng Đội trên Bảng xếp hạng
}

export const DEFAULT_CANDIDATE_FIELDS: CandidateFieldConfig[] = [
  {
    id: 'fullName',
    label: 'Họ và tên thí sinh',
    placeholder: 'Ví dụ: Trần Nguyễn Minh Trí',
    required: true,
    enabled: true,
    isHalfWidth: false,
    type: 'text'
  },
  {
    id: 'candidateCode',
    label: 'MSSV (Mã số sinh viên)',
    placeholder: 'Ví dụ: 22139045',
    required: true,
    enabled: true,
    isHalfWidth: true,
    type: 'text'
  },
  {
    id: 'className',
    label: 'Đội thi / Lớp / Khóa',
    placeholder: 'Ví dụ: Đội 01 hoặc 22DTV',
    required: true,
    enabled: true,
    isHalfWidth: true,
    type: 'text',
    isTeamGroupField: true
  },
  {
    id: 'phone',
    label: 'Số điện thoại hoặc Email sinh viên (HCMUS)',
    placeholder: '0912 345 678 hoặc mssv@student.hcmus.edu.vn',
    required: false,
    enabled: true,
    isHalfWidth: false,
    type: 'text'
  }
];

export const TEAM_CANDIDATE_FIELDS: CandidateFieldConfig[] = [
  {
    id: 'className',
    label: 'Đội thi (Click chọn Đội trong danh sách)',
    placeholder: '-- Bấm vào đây để chọn Đội thi của bạn --',
    required: true,
    enabled: true,
    isHalfWidth: false,
    type: 'select',
    isTeamGroupField: true,
    options: [
      'Đội 01 - ELABS Alpha',
      'Đội 02 - ELABS Beta',
      'Đội 03 - ELABS Gamma',
      'Đội 04 - ELABS Delta',
      'Đội 05 - ELABS Omega',
      'Đội 06 - ELABS Phoenix',
      'Đội 07 - ELABS Titan',
      'Đội 08 - ELABS Nova'
    ]
  },
  {
    id: 'fullName',
    label: 'Họ và tên thí sinh (Thành viên đội)',
    placeholder: 'Ví dụ: Trần Nguyễn Minh Trí',
    required: true,
    enabled: true,
    isHalfWidth: true,
    type: 'text'
  },
  {
    id: 'candidateCode',
    label: 'MSSV / Số báo danh',
    placeholder: 'Ví dụ: 22139045',
    required: true,
    enabled: true,
    isHalfWidth: true,
    type: 'text'
  },
  {
    id: 'phone',
    label: 'SĐT liên hệ / Ghi chú',
    placeholder: 'Ví dụ: 0912 345 678',
    required: false,
    enabled: false,
    isHalfWidth: false,
    type: 'text'
  }
];

export function getExamCandidateFields(exam?: Exam | null): CandidateFieldConfig[] {
  const configured = exam?.settings?.candidateFields;
  if (Array.isArray(configured) && configured.length > 0) {
    return configured;
  }
  return DEFAULT_CANDIDATE_FIELDS;
}

export interface ExamSettings {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  requireFullscreen: boolean;
  strictFullscreenLock: boolean; // Bắt buộc cố định toàn màn hình, thoát là bị chặn ngay
  trackTabSwitch: boolean;
  maxTabSwitches: number;
  autoSubmitOnMaxViolations: boolean; // Tự động thu bài khi quá số lần thoát
  showResultImmediately: boolean;
  showExplanations: boolean;
  allowReviewAnswers: boolean;
  sequentialParts?: boolean; // Làm bài lần lượt hết Phần 1 sang Phần 2
  candidateFields?: CandidateFieldConfig[]; // Cấu hình các trường thông tin thí sinh điền khi vào thi
  allowDemoFill?: boolean; // Cho phép hiển thị nút Điền nhanh mẫu sinh viên
  entryRuleNote?: string; // Nội dung quy chế hiển thị ở hộp thoại vào thi
}

export interface Exam {
  id: string;
  code: string; // e.g. "AZ-8921"
  title: string;
  subject?: SubjectType;
  sections?: ExamSection[];
  durationMinutes: number;
  totalPoints: number;
  pointDistribution: 'equal' | 'custom';
  password?: string;
  startTime?: string;
  endTime?: string;
  settings: ExamSettings;
  questions: Question[];
  status: 'published' | 'draft' | 'closed';
  createdAt: number;
  updatedAt: number;
}

export interface CandidateInfo {
  fullName: string;
  candidateCode: string; // SBD
  className: string;
  phone?: string;
  customFields?: Record<string, string>;
}

export interface CandidateAttempt {
  id: string;
  examId: string;
  candidateInfo: CandidateInfo;
  startedAt: number;
  submittedAt?: number;
  answers: Record<string, string>; // questionId -> selectedOptionId ('A', 'B', etc.)
  markedForReview: string[]; // array of questionId
  tabSwitchCount: number;
  tabSwitchLogs: { timestamp: number; message: string }[];
  isSubmitted: boolean;
  isDisqualified?: boolean;
  disqualificationReason?: string;
  timeSpentSeconds: number;
  score?: number;
  totalPoints?: number;
  correctCount?: number;
  totalQuestions?: number;
  mainCorrectCount?: number;
  mainTotalQuestions?: number;
  tieBreakerCorrectCount?: number;
  tieBreakerTotalQuestions?: number;
  status: 'in_progress' | 'submitted' | 'timed_out' | 'disqualified';
}

export interface ExamAnalytics {
  totalAttempts: number;
  completedAttempts: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  passRate: number; // percentage >= 5.0
  scoreDistribution: { range: string; count: number }[];
  questionStats: {
    questionId: string;
    number: number;
    correctRate: number;
    totalAnswers: number;
  }[];
}
