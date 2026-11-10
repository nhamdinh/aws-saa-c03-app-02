import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Layers3,
  Maximize,
  Moon,
  RotateCcw,
  Send,
  Settings2,
  Shuffle,
  Sun,
  Trophy,
  X,
} from 'lucide-react';
import type { ExamFile, PracticeSettings, Question, Session } from './types';

type CertificationConfig = {
  id: string;
  title: string;
  description: string;
  exams: { id: string; path: string }[];
};

type LoadedExam = { certificationId: string; file: ExamFile };
type SessionContext = {
  certificationId: string;
  examId: string;
};

// Add future certifications/exams here. Each JSON file represents one complete exam.
const CERTIFICATIONS: CertificationConfig[] = [
  // {
  //   id: 'claude-certified-developer-foundations',
  //   title: 'Claude Certified Developer – Foundations',
  //   description: 'Claude development, API and developer workflows',
  //   exams: [
  //     { id: 'claude-foundations-exam-01', path: '/data/claude-developer-foundations-exam-01.json' },
  //   ],
  // },
  // {
  //   id: 'claude-certified-associate',
  //   title: 'Claude Certified Associate – Foundations',
  //   description: 'Claude AI fluency, prompt engineering and responsible use',
  //   exams: [
  //     { id: 'claude-associate-exam-01', path: '/data/claude-associate-foundations-exam-01.json' },
  //   ],
  // },
  {
    id: 'aws-saa-c03',
    title: 'AWS Certified Solutions Architect – Associate',
    description: 'AWS Certified Solutions Architect – Associate',
    exams: [
      { id: 'aws-saa-exam-01', path: '/data/aws-saa-exam-01.json' },
      { id: 'aws-saa-exam-02', path: '/data/aws-saa-exam-02.json' },
      { id: 'aws-saa-exam-03', path: '/data/aws-saa-exam-03.json' },
      { id: 'aws-saa-exam-04', path: '/data/aws-saa-exam-04.json' },
      { id: 'aws-saa-exam-05', path: '/data/aws-saa-exam-05.json' },
      { id: 'aws-saa-exam-06', path: '/data/aws-saa-exam-06.json' },
    ],
  },
];

const SESSION_KEY = 'certlab-practice-session-v2';
const SESSION_CONTEXT_KEY = 'certlab-practice-session-context-v2';
const SETTINGS_KEY = 'certlab-practice-settings-v2';
const DEFAULT_SETTINGS: PracticeSettings = {
  shuffleQuestions: true,
  autoSubmit: true,
  examMode: false,
};

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function formatTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return `${hours > 0 ? `${String(hours).padStart(2, '0')}:` : ''}${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function sameAnswers(selected: string[], correct: string[]): boolean {
  return (
    selected.length > 0 &&
    correct.length > 0 &&
    selected.length === correct.length &&
    selected.every((answer) => correct.includes(answer))
  );
}

function getWrongQuestions(session: Session): { question: Question; globalIndex: number }[] {
  return session.questions.flatMap((question, index) => {
    const selected = session.answers[question.id] ?? [];
    if (selected.length === 0 || sameAnswers(selected, question.correctAnswers)) return [];
    return [{ question, globalIndex: session.globalIndexes[index] ?? index }];
  });
}

function App() {
  const [loadedExams, setLoadedExams] = useState<LoadedExam[]>([]);
  const [loadError, setLoadError] = useState('');
  const [settings, setSettings] = useState<PracticeSettings>(() =>
    loadStored(SETTINGS_KEY, DEFAULT_SETTINGS),
  );
  const [session, setSession] = useState<Session | null>(null);
  const [savedSession, setSavedSession] = useState<Session | null>(() =>
    loadStored<Session | null>(SESSION_KEY, null),
  );
  const [sessionContext, setSessionContext] = useState<SessionContext | null>(() =>
    loadStored<SessionContext | null>(SESSION_CONTEXT_KEY, null),
  );
  const [selectedCertificationId, setSelectedCertificationId] = useState(
    () =>
      loadStored<SessionContext | null>(SESSION_CONTEXT_KEY, null)?.certificationId ??
      CERTIFICATIONS[0].id,
  );
  const [selectedExamId, setSelectedExamId] = useState(
    () =>
      loadStored<SessionContext | null>(SESSION_CONTEXT_KEY, null)?.examId ??
      CERTIFICATIONS[0].exams[0].id,
  );
  const [remaining, setRemaining] = useState(0);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      CERTIFICATIONS.flatMap((certification) =>
        certification.exams.map(async (exam) => {
          const response = await fetch(exam.path);
          if (!response.ok) throw new Error(`Không thể tải dữ liệu ${exam.path}`);
          const file = (await response.json()) as ExamFile;
          if (
            !Array.isArray(file.questions) ||
            file.questions.length < 60 ||
            file.questions.length > 200
          ) {
            throw new Error(
              `${file.title}: mỗi đề phải có từ 60 đến 200 câu hỏi (hiện có ${file.questions?.length ?? 0}).`,
            );
          }
          if (file.certificationId !== certification.id) {
            throw new Error(
              `certificationId trong ${exam.path} không khớp cấu hình ${certification.id}.`,
            );
          }
          return { certificationId: certification.id, file };
        }),
      ),
    )
      .then((files) => {
        if (!cancelled) {
          setLoadedExams(files);
          const initialCert =
            CERTIFICATIONS.find((item) => item.id === selectedCertificationId) ?? CERTIFICATIONS[0];
          const examExists = files.some(
            (item) => item.certificationId === initialCert.id && item.file.id === selectedExamId,
          );
          if (!examExists)
            setSelectedExamId(
              files.find((item) => item.certificationId === initialCert.id)?.file.id ?? '',
            );
        }
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setLoadError(error instanceof Error ? error.message : 'Không thể tải dữ liệu đề thi.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);
  useEffect(() => {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      if (sessionContext) localStorage.setItem(SESSION_CONTEXT_KEY, JSON.stringify(sessionContext));
      setSavedSession(session);
    }
  }, [session, sessionContext]);

  const selectedCertification =
    CERTIFICATIONS.find((item) => item.id === selectedCertificationId) ?? CERTIFICATIONS[0];
  const availableExams = loadedExams.filter(
    (item) => item.certificationId === selectedCertificationId,
  );
  const selectedExam =
    availableExams.find((item) => item.file.id === selectedExamId)?.file ?? availableExams[0]?.file;
  const activeCertification = sessionContext
    ? (CERTIFICATIONS.find((item) => item.id === sessionContext.certificationId) ??
      selectedCertification)
    : selectedCertification;
  const activeExam = sessionContext
    ? loadedExams.find(
        (item) =>
          item.certificationId === sessionContext.certificationId &&
          item.file.id === sessionContext.examId,
      )?.file
    : selectedExam;

  const submitSession = useCallback((current: Session) => {
    setSession({ ...current, submitted: true });
    setShowSubmitDialog(false);
  }, []);

  useEffect(() => {
    if (!session || session.submitted) return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - session.startedAt) / 1000);
      const nextRemaining = Math.max(0, session.durationSeconds - elapsed);
      setRemaining(nextRemaining);
      if (nextRemaining === 0 && session.settings.autoSubmit) submitSession(session);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [session, submitSession]);

  const startSession = (exam: ExamFile, certificationId: string, existing?: Session) => {
    const context = { certificationId, examId: exam.id };
    setSelectedCertificationId(certificationId);
    setSelectedExamId(exam.id);
    setSessionContext(context);
    if (existing) {
      setSession(existing);
      setRemaining(
        Math.max(
          0,
          existing.durationSeconds - Math.floor((Date.now() - existing.startedAt) / 1000),
        ),
      );
      return;
    }

    const questions = exam.questions;
    const indexed = questions.map((question, index) => ({ question, globalIndex: index }));
    const ordered = settings.shuffleQuestions ? shuffle(indexed) : indexed;
    const durationSeconds = (exam.settings?.durationMinutes ?? 130) * 60;
    setSession({
      setNumber: 1,
      questions: ordered.map((item) => item.question),
      globalIndexes: ordered.map((item) => item.globalIndex),
      answers: {},
      optionOrders: Object.fromEntries(
        ordered.map(({ question }) => [
          question.id,
          settings.examMode
            ? shuffle(question.options).map((option) => option.id)
            : question.options.map((option) => option.id),
        ]),
      ),
      confirmed: [],
      currentIndex: 0,
      startedAt: Date.now(),
      durationSeconds,
      settings: { ...settings },
      submitted: false,
    });
    setRemaining(durationSeconds);
  };

  const updateSession = (updater: (current: Session) => Session) => {
    setSession((current) => (current ? updater(current) : current));
  };

  const activeQuestion = session?.questions[session.currentIndex];
  const activeAnswer = activeQuestion ? (session?.answers[activeQuestion.id] ?? []) : [];
  const isConfirmed = Boolean(activeQuestion && session?.confirmed.includes(activeQuestion.id));
  const answeredCount = session
    ? Object.values(session.answers).filter((answers) => answers.length > 0).length
    : 0;
  const correctCount = session
    ? session.questions.filter((question) =>
        sameAnswers(session.answers[question.id] ?? [], question.correctAnswers),
      ).length
    : 0;
  const scorePercent = session?.questions.length
    ? Math.round((correctCount / session.questions.length) * 100)
    : 0;
  const isDark = darkMode;

  const chooseOption = (optionId: string) => {
    if (
      !activeQuestion ||
      !session ||
      session.submitted ||
      (session.settings.examMode && isConfirmed)
    )
      return;
    updateSession((current) => {
      const existing = current.answers[activeQuestion.id] ?? [];
      let next: string[];
      if (activeQuestion.type === 'multi-select') {
        next = existing.includes(optionId)
          ? existing.filter((id) => id !== optionId)
          : [...existing, optionId];
      } else {
        next = [optionId];
      }
      return { ...current, answers: { ...current.answers, [activeQuestion.id]: next } };
    });
  };

  const confirmAnswer = () => {
    if (!activeQuestion || !session || activeAnswer.length === 0) return;
    updateSession((current) => ({
      ...current,
      confirmed: current.confirmed.includes(activeQuestion.id)
        ? current.confirmed
        : [...current.confirmed, activeQuestion.id],
    }));
  };

  const goToQuestion = (index: number) =>
    updateSession((current) => ({
      ...current,
      currentIndex: Math.max(0, Math.min(index, current.questions.length - 1)),
    }));
  const nextQuestion = () => {
    if (!session) return;
    if (session.currentIndex < session.questions.length - 1) goToQuestion(session.currentIndex + 1);
    else setShowSubmitDialog(true);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter') return;
      if (isConfirmed) {
        event.preventDefault();
        nextQuestion();
      } else if (activeAnswer.length > 0) {
        event.preventDefault();
        confirmAnswer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeAnswer, isConfirmed, session]);

  const beginExam = (exam: ExamFile) => {
    const inProgress = (session && !session.submitted) || (savedSession && !savedSession.submitted);
    if (
      inProgress &&
      !window.confirm(
        'Bài thi hiện tại chưa nộp. Bắt đầu đề mới sẽ thay thế tiến độ đang làm. Bạn có muốn tiếp tục?',
      )
    )
      return;
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_CONTEXT_KEY);
    setSavedSession(null);
    setSession(null);
    window.setTimeout(() => startSession(exam, selectedCertificationId), 0);
  };

  const exitToHome = () => {
    if (
      session &&
      !session.submitted &&
      !window.confirm(
        'Tiến độ sẽ được lưu để bạn có thể tiếp tục sau. Quay về trang chọn chứng chỉ?',
      )
    )
      return;
    if (session?.submitted) {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_CONTEXT_KEY);
      setSavedSession(null);
      setSessionContext(null);
    } else if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setSavedSession(session);
    }
    setSession(null);
  };

  const clearSessionAndReturnHome = () => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_CONTEXT_KEY);
    setSavedSession(null);
    setSessionContext(null);
    setSession(null);
  };

  const retryWrongQuestions = () => {
    if (!session?.submitted || !sessionContext) return;
    const wrongItems = getWrongQuestions(session);
    if (wrongItems.length === 0) return;
    const ordered = session.settings.shuffleQuestions ? shuffle(wrongItems) : wrongItems;
    const durationSeconds = Math.max(30 * 60, Math.ceil(ordered.length * 2.0 * 60));
    const retrySession: Session = {
      ...session,
      questions: ordered.map((item) => item.question),
      globalIndexes: ordered.map((item) => item.globalIndex),
      answers: {},
      optionOrders: Object.fromEntries(
        ordered.map(({ question }) => [
          question.id,
          session.settings.examMode
            ? shuffle(question.options).map((option) => option.id)
            : question.options.map((option) => option.id),
        ]),
      ),
      confirmed: [],
      currentIndex: 0,
      startedAt: Date.now(),
      durationSeconds,
      submitted: false,
    };
    setSession(retrySession);
    setRemaining(durationSeconds);
    setShowSubmitDialog(false);
    setSidebarOpen(true);
  };

  if (loadError) {
    return (
      <main className="load-state">
        <div className="load-card">
          <CircleHelp size={34} />
          <h1>Không tải được bộ câu hỏi</h1>
          <p>{loadError}</p>
          <p>Hãy chạy ứng dụng qua Vite, không mở trực tiếp file HTML.</p>
        </div>
      </main>
    );
  }
  if (loadedExams.length === 0) {
    return (
      <main className="load-state">
        <div className="load-card">
          <div className="loader" />
          <h1>Đang tải bộ câu hỏi...</h1>
          <p>
            Đang chuẩn bị {CERTIFICATIONS.reduce((count, item) => count + item.exams.length, 0)}{' '}
            file JSON.
          </p>
        </div>
      </main>
    );
  }

  if (!session) {
    const resumeCertification = sessionContext
      ? CERTIFICATIONS.find((item) => item.id === sessionContext.certificationId)
      : undefined;
    const resumeExam = sessionContext
      ? loadedExams.find(
          (item) =>
            item.certificationId === sessionContext.certificationId &&
            item.file.id === sessionContext.examId,
        )?.file
      : undefined;
    return (
      <main className={`app-shell home-shell ${isDark ? 'dark' : ''}`}>
        <header className="home-header">
          <div className="eyebrow">
            <Layers3 size={15} /> PRACTICE EXAMS
          </div>
          <div className="header-row">
            <div>
              <h1>CERTLAB Practice Center</h1>
              <p className="subtitle">Chọn chứng chỉ và đề thi để bắt đầu luyện tập.</p>
            </div>
            <button
              className="icon-button theme-button"
              aria-label="Đổi giao diện"
              onClick={() => setDarkMode(!darkMode)}
            >
              {isDark ? <Sun /> : <Moon />}
            </button>
          </div>
        </header>

        {savedSession && !savedSession.submitted && resumeExam && resumeCertification && (
          <section className="resume-banner">
            <div className="resume-icon">
              <CircleHelp size={22} />
            </div>
            <div className="resume-copy">
              <strong>Bạn có bài thi chưa hoàn thành — {resumeCertification.title}</strong>
              <span>
                {resumeExam.title} ·{' '}
                {Object.values(savedSession.answers).filter((answers) => answers.length > 0).length}
                /{savedSession.questions.length} câu đã trả lời
              </span>
            </div>
            <button
              className="primary-button"
              onClick={() => startSession(resumeExam, resumeCertification.id, savedSession)}
            >
              <ArrowRight size={18} /> Tiếp tục
            </button>
          </section>
        )}

        <section className="panel">
          <div className="panel-heading">
            <div className="section-icon">
              <Layers3 size={21} />
            </div>
            <div>
              <h2>1. Chọn chứng chỉ</h2>
              <p>{CERTIFICATIONS.length} chứng chỉ hiện có · Có thể mở rộng bằng cấu hình</p>
            </div>
          </div>
          <div className="set-grid">
            {CERTIFICATIONS.map((certification) => (
              <button
                key={certification.id}
                className={`set-card ${selectedCertificationId === certification.id ? 'selected' : ''}`}
                onClick={() => {
                  setSelectedCertificationId(certification.id);
                  const firstExam = loadedExams.find(
                    (item) => item.certificationId === certification.id,
                  )?.file;
                  setSelectedExamId(firstExam?.id ?? certification.exams[0]?.id ?? '');
                }}
              >
                <strong>{certification.title}</strong>
                <span>{certification.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div className="section-icon">
              <Layers3 size={21} />
            </div>
            <div>
              <h2>2. Chọn đề thi</h2>
              <p>{availableExams.length} đề thuộc chứng chỉ đã chọn · Mỗi đề gồm 60–200 câu hỏi</p>
            </div>
          </div>
          <div className="set-grid">
            {availableExams.map(({ file }) => (
              <button
                key={file.id}
                className={`set-card ${selectedExam?.id === file.id ? 'selected' : ''}`}
                onClick={() => setSelectedExamId(file.id)}
              >
                <strong>{file.title}</strong>
                <span>
                  {file.questions.length} câu hỏi · {file.settings?.durationMinutes ?? 130} phút
                </span>
              </button>
            ))}
            {availableExams.length === 0 && <p>Chưa có đề thi cho chứng chỉ này.</p>}
          </div>
          <div className="selected-set-footer">
            <span>
              Đã chọn: <strong>{selectedExam?.title ?? 'Chưa có đề thi'}</strong>
              {selectedExam ? ` · ${selectedExam.questions.length} câu hỏi` : ''}
            </span>
            <button
              className="primary-button"
              disabled={!selectedExam}
              onClick={() => selectedExam && beginExam(selectedExam)}
            >
              <ArrowRight size={18} /> Bắt đầu đề thi
            </button>
          </div>
        </section>

        <section className="panel settings-panel">
          <div className="panel-heading">
            <div className="section-icon">
              <Settings2 size={21} />
            </div>
            <div>
              <h2>3. Tùy chọn bài thi</h2>
              <p>Điều chỉnh cách luyện tập trước khi bắt đầu</p>
            </div>
          </div>
          <div className="settings-grid">
            <SettingCard
              icon={<Shuffle size={21} />}
              title="Shuffle Questions"
              description="Randomise question order every session"
              active={settings.shuffleQuestions}
              onToggle={() =>
                setSettings((current) => ({
                  ...current,
                  shuffleQuestions: !current.shuffleQuestions,
                }))
              }
              color="blue"
            />
            <SettingCard
              icon={<Send size={21} />}
              title="Auto-Submit"
              description="Submit automatically when time runs out"
              active={settings.autoSubmit}
              onToggle={() =>
                setSettings((current) => ({ ...current, autoSubmit: !current.autoSubmit }))
              }
              color="coral"
            />
            <SettingCard
              icon={<CircleHelp size={21} />}
              title="Exam Mode"
              description="Hide answers until you submit, and shuffle answer order"
              active={settings.examMode}
              onToggle={() =>
                setSettings((current) => ({ ...current, examMode: !current.examMode }))
              }
              color="purple"
            />
          </div>
        </section>
        <footer className="home-footer">
          CERTLAB · Dữ liệu câu hỏi được lưu cục bộ trên trình duyệt của bạn.
        </footer>
      </main>
    );
  }

  if (session.submitted) {
    const wrongItems = getWrongQuestions(session);
    const skippedCount = session.questions.filter(
      (question) => (session.answers[question.id] ?? []).length === 0,
    ).length;
    const reviewItems = session.questions.map((question, index) => ({
      question,
      index,
      selected: session.answers[question.id] ?? [],
      correct: sameAnswers(session.answers[question.id] ?? [], question.correctAnswers),
    }));
    return (
      <main className={`app-shell results-shell ${isDark ? 'dark' : ''}`}>
        <header className="results-header">
          <div className="brand-mark">
            CERT<span>LAB</span>
          </div>
          <button className="secondary-button" onClick={clearSessionAndReturnHome}>
            <ArrowLeft size={17} /> Về trang chủ
          </button>
        </header>
        <section className="results-card">
          <div className="trophy-icon">
            <Trophy size={32} />
          </div>
          <p className="result-kicker">{activeExam?.title ?? 'EXAM'} COMPLETED</p>
          <h1>
            {scorePercent >= (activeExam?.settings?.passingScorePercent ?? 72)
              ? 'Làm tốt lắm!'
              : 'Hãy tiếp tục luyện tập!'}
          </h1>
          <p className="result-subtitle">{activeCertification.title}</p>
          <div className="score-ring" style={{ '--score': `${scorePercent}%` } as CSSProperties}>
            <div>
              <strong>{scorePercent}%</strong>
              <span>Điểm số</span>
            </div>
          </div>
          <div className="result-stats">
            <div>
              <strong>{correctCount}</strong>
              <span>Đúng</span>
            </div>
            <div>
              <strong>{wrongItems.length}</strong>
              <span>Sai</span>
            </div>
            <div>
              <strong>{skippedCount}</strong>
              <span>Bỏ qua</span>
            </div>
          </div>
          <div className="result-actions">
            <button
              className="secondary-button"
              disabled={wrongItems.length === 0}
              onClick={retryWrongQuestions}
            >
              <RotateCcw size={17} /> Làm lại câu sai ({wrongItems.length})
            </button>
            <button className="primary-button" onClick={() => activeExam && beginExam(activeExam)}>
              <RotateCcw size={17} /> Làm lại đề này
            </button>
            <button className="secondary-button" onClick={clearSessionAndReturnHome}>
              Chọn đề khác
            </button>
          </div>
        </section>
        <section className="panel review-panel">
          <div className="panel-heading">
            <div className="section-icon">
              <CheckCircle2 size={21} />
            </div>
            <div>
              <h2>Review câu trả lời</h2>
              <p>Tổng hợp đáp án đã chọn và trạng thái đúng/sai của từng câu.</p>
            </div>
          </div>
          <div className="review-list">
            {reviewItems.map(({ question, index, selected, correct }) => (
              <div
                className={`review-row ${correct ? 'is-correct' : selected.length === 0 ? 'is-skipped' : 'is-wrong'}`}
                key={question.id}
              >
                <span className="review-status">
                  {correct ? <Check size={16} /> : selected.length === 0 ? '–' : <X size={16} />}
                </span>
                <span className="review-text">
                  <strong>Câu {index + 1}</strong>
                  <span>{question.question}</span>
                </span>
                <span className="review-answer">
                  {selected.length ? selected.join(', ') : 'Chưa trả lời'}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    );
  }

  if (!activeQuestion) return null;
  const correct = sameAnswers(activeAnswer, activeQuestion.correctAnswers);
  const revealAnswer = !session.settings.examMode && isConfirmed;
  const questionStatus = (question: Question) => {
    if (session.confirmed.includes(question.id) && !session.settings.examMode)
      return sameAnswers(session.answers[question.id] ?? [], question.correctAnswers)
        ? 'correct'
        : 'wrong';
    return (session.answers[question.id] ?? []).length > 0 ? 'answered' : 'empty';
  };
  const optionOrder = session.optionOrders?.[activeQuestion.id];
  const visibleOptions = optionOrder
    ? [...activeQuestion.options].sort(
        (a, b) => optionOrder.indexOf(a.id) - optionOrder.indexOf(b.id),
      )
    : activeQuestion.options;

  return (
    <main className={`app-shell exam-shell ${isDark ? 'dark' : ''}`}>
      <header className="exam-topbar">
        <button className="brand-mark" onClick={exitToHome} aria-label="Về trang chủ">
          CERT<span>LAB</span>
        </button>
        <div className={`timer-pill ${remaining < 300 ? 'timer-warning' : ''}`}>
          <Clock3 size={18} /> {formatTime(remaining)}
        </div>
        <div className="top-actions">
          <button
            className="icon-button"
            aria-label="Đổi giao diện"
            onClick={() => setDarkMode(!darkMode)}
          >
            {isDark ? <Sun /> : <Moon />}
          </button>
          <button
            className="secondary-button fullscreen-button"
            onClick={() =>
              document.fullscreenElement
                ? document.exitFullscreen()
                : document.documentElement.requestFullscreen?.()
            }
          >
            <Maximize size={16} /> Fullscreen
          </button>
        </div>
      </header>
      <div className={`exam-layout ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
        {sidebarOpen && (
          <aside className="question-sidebar">
            <div className="sidebar-heading">
              <span>▥ &nbsp; QUESTION MAP</span>
              <button onClick={() => setSidebarOpen(false)} aria-label="Thu gọn danh sách">
                <ArrowLeft size={17} />
              </button>
            </div>
            <div className="progress-area">
              <div>
                <span>PROGRESS</span>
                <strong>
                  {answeredCount}
                  <small>/{session.questions.length}</small>
                </strong>
              </div>
              <div className="progress-track">
                <span style={{ width: `${(answeredCount / session.questions.length) * 100}%` }} />
              </div>
            </div>
            <div className="question-map">
              {session.questions.map((question, index) => (
                <button
                  key={question.id}
                  onClick={() => goToQuestion(index)}
                  className={`map-number ${index === session.currentIndex ? 'current' : ''} ${questionStatus(question)}`}
                  title={`Câu ${index + 1}`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <div className="map-legend">
              <span>
                <i className="legend-current" />
                Current
              </span>
              <span>
                <i className="legend-correct" />
                Correct
              </span>
              <span>
                <i className="legend-wrong" />
                Wrong
              </span>
              <span>
                <i className="legend-empty" />
                Not done
              </span>
            </div>
            <button className="submit-sidebar" onClick={() => setShowSubmitDialog(true)}>
              <Send size={16} /> SUBMIT
            </button>
          </aside>
        )}
        {!sidebarOpen && (
          <button className="reopen-sidebar" onClick={() => setSidebarOpen(true)}>
            <Layers3 size={17} /> Câu hỏi
          </button>
        )}
        <section className="question-card">
          <div className="question-card-header">
            <span className="certification-chip">
              <Layers3 size={14} /> {activeCertification.title}
            </span>
            <span className="answered-chip">
              <CheckCircle2 size={14} /> {answeredCount} answered
            </span>
            <strong>
              Q{session.currentIndex + 1} / {session.questions.length}
            </strong>
          </div>
          <div className="question-content">
            <div className="question-meta">
              <span>
                {activeExam?.title ?? 'EXAM'} · CÂU {session.currentIndex + 1}/
                {session.questions.length}
              </span>
              {activeQuestion.type === 'multi-select' && (
                <span className="select-hint">
                  Choose {activeQuestion.selectCount ?? activeQuestion.correctAnswers.length}
                </span>
              )}
            </div>
            <h1>{activeQuestion.question}</h1>
            {activeQuestion.type === 'multi-select' && (
              <p className="multi-hint">
                Select {activeQuestion.selectCount ?? activeQuestion.correctAnswers.length} answers.
              </p>
            )}
            <div className="options-list">
              {visibleOptions.map((option) => {
                const selected = activeAnswer.includes(option.id);
                const isCorrectOption =
                  revealAnswer && activeQuestion.correctAnswers.includes(option.id);
                const isWrongOption =
                  revealAnswer && selected && !activeQuestion.correctAnswers.includes(option.id);
                return (
                  <button
                    key={option.id}
                    disabled={session.settings.examMode && isConfirmed}
                    className={`option-row ${selected ? 'selected' : ''} ${isCorrectOption ? 'option-correct' : ''} ${isWrongOption ? 'option-wrong' : ''}`}
                    onClick={() => chooseOption(option.id)}
                  >
                    <span className="option-letter">{option.id}</span>
                    <span className="option-text">{option.text}</span>
                    {selected && !revealAnswer && (
                      <span className="selected-check">
                        <Check size={16} />
                      </span>
                    )}
                    {isCorrectOption && <Check size={17} className="result-check" />}
                    {isWrongOption && <X size={17} className="result-x" />}
                  </button>
                );
              })}
            </div>
            {revealAnswer && (
              <div className={`answer-feedback ${correct ? 'feedback-correct' : 'feedback-wrong'}`}>
                <strong>
                  {correct ? (
                    <>
                      <CheckCircle2 size={17} /> Correct!
                    </>
                  ) : (
                    <>
                      <X size={17} /> Not quite
                    </>
                  )}
                </strong>
                {!correct && <span>Đáp án đúng: {activeQuestion.correctAnswers.join(', ')}</span>}
                {!correct && <span>{activeQuestion?.explanation}</span>}
              </div>
            )}
            <div className="question-actions">
              <button
                className="secondary-button question-map-button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <Layers3 size={17} /> Question map
              </button>
              <div className="center-actions">
                <button
                  className="round-button"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  aria-label="Question map"
                >
                  <span>▦</span>
                </button>

                {!session.settings.examMode && !isConfirmed ? (
                  <button
                    className="confirm-button"
                    disabled={activeAnswer.length === 0}
                    onClick={confirmAnswer}
                  >
                    <CheckCircle2 size={17} /> Confirm
                  </button>
                ) : (
                  <button className="next-button" onClick={nextQuestion}>
                    {session.currentIndex === session.questions.length - 1 ? 'Submit' : 'Next'}{' '}
                    <ArrowRight size={17} />
                  </button>
                )}
              </div>
              <div className="right-actions">
                <button
                  className="ask-ai-button"
                  onClick={() =>
                    window.alert(
                      'Tính năng Ask AI chưa được kết nối. Bạn có thể bổ sung API backend sau.',
                    )
                  }
                >
                  <span className="ai-mark">✳</span> Ask AI
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
      {showSubmitDialog && (
        <div className="modal-backdrop" role="presentation">
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-title"
          >
            <button
              className="modal-close"
              onClick={() => setShowSubmitDialog(false)}
              aria-label="Đóng"
            >
              <X size={18} />
            </button>
            <div className="modal-icon">
              <Send size={22} />
            </div>
            <h2 id="submit-title">Nộp bài thi?</h2>
            <p>
              Bạn đã trả lời {answeredCount}/{session.questions.length} câu. Sau khi nộp, hệ thống
              sẽ hiển thị kết quả và cho phép xem lại đáp án.
            </p>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setShowSubmitDialog(false)}>
                Tiếp tục làm bài
              </button>
              <button className="primary-button" onClick={() => submitSession(session)}>
                Nộp bài
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SettingCard({
  icon,
  title,
  description,
  active,
  onToggle,
  color,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  active: boolean;
  onToggle: () => void;
  color: string;
}) {
  return (
    <button className={`setting-card ${active ? 'active' : ''}`} onClick={onToggle}>
      <span className={`setting-icon ${color}`}>{icon}</span>
      <span className="setting-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      <span className={`toggle ${active ? 'on' : ''}`}>
        <i />
      </span>
    </button>
  );
}

export default App;
