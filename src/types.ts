export type Option = { id: string; text: string };
export type Question = {
  explanation?: string;
  id: string;
  type: 'single-select' | 'multi-select';
  question: string;
  options: Option[];
  correctAnswers: string[];
  selectCount?: number;
  metadata?: { domain?: string; difficulty?: string; tags?: string[] };
};
export type ExamFile = {
  schemaVersion: string;
  id: string;
  certificationId: string;
  title: string;
  description: string;
  settings: { durationMinutes?: number; passingScorePercent?: number };
  questions: Question[];
};
export type PracticeSettings = {
  shuffleQuestions: boolean;
  autoSubmit: boolean;
  examMode: boolean;
};
export type Session = {
  setNumber: number;
  questions: Question[];
  globalIndexes: number[];
  answers: Record<string, string[]>;
  optionOrders?: Record<string, string[]>;
  confirmed: string[];
  currentIndex: number;
  startedAt: number;
  durationSeconds: number;
  settings: PracticeSettings;
  submitted: boolean;
};
