import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  BarChart3,
  Settings,
  Trophy,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Sparkles,
  Zap,
  User as UserIcon,
  LogOut,
  ChevronRight,
  Brain,
  HelpCircle
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

// --- Types ---
interface Student {
  id: string;
  name: string;
  grade: number;
  xp: number;
  current_theme: string;
}

interface ProgressLog {
  topic: string;
  difficulty: number;
  correct: number;
  timestamp: string;
}

interface ModelPerf {
  avg_latency: number;
  is_rag: number;
}

// --- Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false }: any) => {
  const base = "px-6 py-3 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: any = {
    primary: "bg-amber-400 text-amber-900 hover:bg-amber-300 shadow-lg hover:shadow-amber-200/50",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    accent: "bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg hover:shadow-indigo-200/50",
    outline: "border-2 border-slate-200 text-slate-600 hover:border-slate-300"
  };

  return (
    <button id={`btn-${variant}`} onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Card = ({ children, className = "" }: any) => (
  <div className={`bg-white rounded-3xl p-6 shadow-sm border border-slate-100 ${className}`}>
    {children}
  </div>
);

// --- Main App ---

export default function App() {
  const [student, setStudent] = useState<Student | null>(null);
  const [view, setView] = useState<'onboarding' | 'story' | 'dashboard' | 'oversight'>('onboarding');
  const [isLoading, setIsLoading] = useState(false);
  const [useRag, setUseRag] = useState(true);
  const [useThinking, setUseThinking] = useState(true);

  // Persistence (Simulated login)
  useEffect(() => {
    const savedId = localStorage.getItem('studentId');
    if (savedId) {
      fetchStudent(savedId);
    }
  }, []);

  const fetchStudent = async (id: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/student/${id}`);
      if (res.ok) {
        const data = await res.json();
        setStudent(data);
        setView('story');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('studentId');
    setStudent(null);
    setView('onboarding');
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-slate-900 font-sans selection:bg-amber-100 italic-small:font-serif">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-10 left-10 w-64 h-64 bg-amber-200 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-200 rounded-full blur-3xl" />
      </div>

      <nav className="relative z-10 max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setView(student ? 'story' : 'onboarding')}>
          <div className="w-12 h-12 bg-amber-400 rounded-2xl flex items-center justify-center rotate-3 group-hover:rotate-6 transition-transform">
            <BookOpen className="text-amber-900 w-6 h-6" />
          </div>
          <span className="font-bold text-2xl tracking-tight text-slate-800 italic-small:font-serif">MathTales</span>
        </div>

        {student && (
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-2xl border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="font-bold text-slate-700">{student.xp} XP</span>
              </div>
              <div className="w-[1px] h-4 bg-slate-200" />
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-indigo-500" />
                <span className="font-medium text-slate-600">Grade {student.grade}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant={view === 'story' ? 'primary' : 'secondary'} className="px-3" onClick={() => setView('story')}><BookOpen className="w-5 h-5" /></Button>
              <Button variant={view === 'dashboard' ? 'primary' : 'secondary'} className="px-3" onClick={() => setView('dashboard')}><BarChart3 className="w-5 h-5" /></Button>
              <Button variant={view === 'oversight' ? 'primary' : 'secondary'} className="px-3" onClick={() => setView('oversight')}><Settings className="w-5 h-5" /></Button>
              <Button variant="outline" className="px-3" onClick={handleLogout}><LogOut className="w-5 h-5" /></Button>
            </div>
          </div>
        )}
      </nav>

      <main className="relative z-10 max-w-4xl mx-auto px-6 pb-24">
        <AnimatePresence mode="wait">
          {view === 'onboarding' && <Onboarding key="onboarding" onComplete={fetchStudent} />}
          {view === 'dashboard' && student && <StudentDashboard key="dashboard" studentId={student.id} onBack={() => setView('story')} />}
          {view === 'oversight' && student && <OversightPanel key="oversight" studentId={student.id} useRag={useRag} setUseRag={setUseRag} useThinking={useThinking} setUseThinking={setUseThinking} onBack={() => setView('story')} />}
        </AnimatePresence>

        {/* StorySession stays mounted so state is preserved */}
        {student && (
          <div style={{ display: view === 'story' ? 'block' : 'none' }}>
            <StorySession student={student} useRag={useRag} useThinking={useThinking} onUpdateXP={(v) => setStudent(s => s ? { ...s, xp: s.xp + v } : null)} />
          </div>
        )}
      </main>
    </div>
  );
}

// --- Sub-Views ---

function Onboarding({ onComplete }: { onComplete: (id: string) => void }) {
  const [name, setName] = useState('');
  const [grade, setGrade] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const id = name.toLowerCase().replace(/\s/g, '-') + '-' + Math.floor(Math.random() * 1000);
    try {
      const res = await fetch('/api/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, grade })
      });
      if (res.ok) {
        localStorage.setItem('studentId', id);
        onComplete(id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="pt-20 text-center">
      <h1 className="text-5xl font-bold mb-6 text-slate-800">Welcome to Adventure!</h1>
      <p className="text-xl text-slate-600 mb-12 max-w-lg mx-auto">Ready to learn math through epic stories? Tell us a bit about yourself.</p>

      <Card className="max-w-md mx-auto p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="text-left space-y-2">
            <label className="text-sm font-bold text-slate-500 uppercase tracking-widest ml-1">Hero Name</label>
            <input
              id="hero-name"
              type="text"
              required
              placeholder="E.g., Captain Math"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-5 py-4 border-2 border-slate-100 rounded-2xl focus:border-amber-400 outline-none transition-all text-lg font-medium"
            />
          </div>

          <div className="text-left space-y-2">
            <label className="text-sm font-bold text-slate-500 uppercase tracking-widest ml-1">Learning Level</label>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map(g => (
                <button
                  key={g}
                  type="button"
                  id={`grade-${g}`}
                  onClick={() => setGrade(g)}
                  className={`py-3 rounded-xl font-bold transition-all ${grade === g ? 'bg-indigo-500 text-white shadow-md' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                >
                  G{g}
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full py-4 text-xl">
            {isLoading ? 'Creating Hero...' : 'Start My Journey'}
            <ArrowRight className="w-6 h-6" />
          </Button>
        </form>
      </Card>
    </motion.div>
  );
}

function StorySession({ student, useRag, useThinking, onUpdateXP }: { student: Student, useRag: boolean, useThinking: boolean, onUpdateXP: (v: number) => void }) {
  const [history, setHistory] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [userAnswer, setUserAnswer] = useState('');
  const [expectedAnswer, setExpectedAnswer] = useState<string | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong'>('none');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [theme, setTheme] = useState('');
  const [customTheme, setCustomTheme] = useState('');
  const [currentHint, setCurrentHint] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const streamTextRef = useRef('');
  const rafRef = useRef<number | null>(null);
  const prefetchTriggered = useRef(false);

  const themes = [
    { id: 'fantasy', name: 'Magic Kingdom', icon: '🏰' },
    { id: 'sci-fi', name: 'Space Explorer', icon: '🚀' },
    { id: 'mystery', name: 'Desert Island', icon: '🏝️' },
    { id: 'underwater', name: 'Ocean Deep', icon: '🌊' },
    { id: 'dinosaur', name: 'Dino World', icon: '🦕' },
    { id: 'pirate', name: 'Pirate Seas', icon: '🏴\u200d\u2620\ufe0f' },
  ];

  // Batched UI update — only updates DOM once per animation frame for smooth streaming
  const flushStreamText = useCallback(() => {
    const cleaned = streamTextRef.current
      .replace(/\[QUESTION:.*?\]/gi, '')
      .replace(/\[HINT:.*?\]/gi, '')
      .replace(/\[ANSWER:.*?\]/gi, '')
      .trim();
    setCurrentStep(cleaned);
    rafRef.current = null;
  }, []);

  // Build a clean story summary from history for continuity
  const buildStorySummary = useCallback(() => {
    // history alternates: [action0, response0, action1, response1, ...]
    // Take the last few exchanges and extract clean story text
    const recentPairs = [];
    for (let i = Math.max(0, history.length - 8); i < history.length; i += 2) {
      const storyText = (history[i + 1] || '')
        .replace(/\[QUESTION:.*?\]/gi, '')
        .replace(/\[HINT:.*?\]/gi, '')
        .replace(/\[ANSWER:.*?\]/gi, '')
        .trim();
      if (storyText) {
        recentPairs.push(storyText);
      }
    }
    return recentPairs.join(' \n');
  }, [history]);

  // Trigger background prefetch so next story part is ready while user solves the puzzle
  const triggerPrefetch = useCallback(() => {
    if (prefetchTriggered.current) return;
    prefetchTriggered.current = true;
    fetch('/api/story/prefetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: student.id,
        useRag,
        useThinking,
        context: {
          grade: student.grade,
          theme,
          history: buildStorySummary()
        }
      })
    }).catch(() => { /* silent */ });
  }, [student, useRag, useThinking, theme, history, buildStorySummary]);

  const generateStep = async (action: string) => {
    setIsLoading(true);
    setIsStreaming(true);
    setHasStarted(true);
    setCurrentStep('');
    setIsAnswering(false);
    setExpectedAnswer(null);
    setUserAnswer('');
    setFeedback('none');
    setCurrentHint(null);
    setCurrentQuestion(null);
    setShowHint(false);
    streamTextRef.current = '';
    prefetchTriggered.current = false;

    // Reset server-side LLM session when starting a brand new adventure
    if (action === "Begin my adventure!") {
      await fetch('/api/session/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id }),
      }).catch(() => { /* silent */ });
    }
    try {
      const res = await fetch('/api/story/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          userAction: action,
          useRag,
          useThinking,
          context: {
            grade: student.grade,
            theme,
            history: buildStorySummary()
          }
        })
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'chunk') {
              streamTextRef.current += event.text;
              // Batch UI updates to one per animation frame for smooth text appearance
              if (!rafRef.current) {
                rafRef.current = requestAnimationFrame(flushStreamText);
              }
            } else if (event.type === 'done') {
              // Cancel any pending RAF and do final update
              if (rafRef.current) cancelAnimationFrame(rafRef.current);
              rafRef.current = null;
              setIsStreaming(false);

              const fullText = streamTextRef.current;
              const match = fullText.match(/\[ANSWER:\s*(.*?)\]/i);
              const hintMatch = fullText.match(/\[HINT:\s*(.*?)\]/i);
              const questionMatch = fullText.match(/\[QUESTION:\s*(.*?)\]/i);

              if (match) {
                setExpectedAnswer(match[1]);
                setCurrentHint(hintMatch ? hintMatch[1] : null);
                setCurrentQuestion(questionMatch ? questionMatch[1] : null);
                setShowHint(false);
                
                const cleaned = fullText
                  .replace(/\[QUESTION:.*?\]/gi, '')
                  .replace(/\[HINT:.*?\]/gi, '')
                  .replace(/\[ANSWER:.*?\]/gi, '')
                  .trim();
                setCurrentStep(cleaned);
                setIsAnswering(true);
                // Start prefetching next story part while user solves the puzzle
                setTimeout(() => triggerPrefetch(), 500);
              } else {
                setCurrentStep(fullText.replace(/\[QUESTION:.*?\]/gi, '').replace(/\[HINT:.*?\]/gi, '').trim());
              }
              setHistory(prev => [...prev, action, fullText]);
            } else if (event.type === 'error') {
              setCurrentStep(`Error: ${event.text}`);
            }
          } catch { /* skip malformed lines */ }
        }
      }
    } catch (e) {
      console.error(e);
      setCurrentStep('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const handleAnswer = async () => {
    const isCorrect = userAnswer.toLowerCase() === expectedAnswer?.toLowerCase();
    setFeedback(isCorrect ? 'correct' : 'wrong');

    // Log progress
    await fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: student.id,
        isCorrect,
        difficulty: student.grade,
        topic: 'Word Problem'
      })
    });

    if (isCorrect) onUpdateXP(10);

    setTimeout(() => {
      setFeedback('none');
      if (isCorrect) {
        setIsAnswering(false);
        setUserAnswer('');
        setExpectedAnswer(null);
        setCurrentHint(null);
        setCurrentQuestion(null);
        setShowHint(false);
        // Auto-continue the story!
        generateStep('The hero solved the puzzle and continues onward.');
      }
    }, 2000);
  };

  if (!hasStarted && !currentStep && !isLoading) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-20 max-w-2xl mx-auto px-6">
        <h2 className="text-3xl font-bold mb-8 text-center text-slate-800">Choose Your Adventure</h2>
        <div className="grid grid-cols-2 gap-4 mb-6">
          {themes.map(t => (
            <button
              key={t.id}
              onClick={() => { setTheme(t.id); setCustomTheme(''); generateStep("Begin my adventure!"); }}
              className="flex items-center gap-4 p-5 bg-white border-2 border-slate-100 rounded-2xl hover:border-amber-400 hover:shadow-md transition-all group"
            >
              <span className="text-4xl">{t.icon}</span>
              <div className="text-left">
                <p className="font-bold text-lg text-slate-800">{t.name}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="text-center text-slate-400 font-medium mb-4">or create your own</div>
        <div className="flex gap-3">
          <input
            id="custom-theme-input"
            type="text"
            placeholder="Type your own adventure theme... (e.g., candy land, ninja village, robot city)"
            value={customTheme}
            onChange={e => setCustomTheme(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && customTheme.trim()) {
                setTheme(customTheme.trim());
                generateStep("Begin my adventure!");
              }
            }}
            className="flex-1 px-5 py-4 bg-white border-2 border-slate-200 rounded-2xl outline-none focus:border-amber-400 font-medium text-lg"
          />
          <Button
            disabled={!customTheme.trim()}
            onClick={() => {
              if (customTheme.trim()) {
                setTheme(customTheme.trim());
                generateStep("Begin my adventure!");
              }
            }}
          >
            Go <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8 pt-10 pb-20">
      <Card className="min-h-[300px] flex flex-col justify-between p-10 relative overflow-hidden">
        {/* Progress indicator */}
        <div className="absolute top-0 left-0 h-1 bg-amber-400 transition-all duration-500" style={{ width: `${(history.length / 20) * 100}%` }} />

        <div className="prose prose-lg max-w-none text-slate-700 font-medium leading-relaxed">
          {currentStep ? (
            <div className="space-y-4">
              {currentStep.split(/\n\n+/).map((para, i) => (
                <p key={i} className="whitespace-pre-line">{para.trim()}</p>
              ))}
              {isStreaming && <span className="inline-block w-2 h-5 bg-amber-400 ml-1 animate-pulse rounded-sm" />}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
              <Zap className="w-12 h-12 text-amber-300 mb-4 animate-bounce" />
              <p className="font-bold text-slate-400">The narrator is thinking...</p>
            </div>
          )}
        </div>

        {isAnswering && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mt-12 p-8 bg-indigo-50 rounded-3xl border-2 border-indigo-100">
            {currentQuestion && (
              <div className="mb-6 p-5 bg-white rounded-2xl border-2 border-amber-200 shadow-sm">
                <p className="font-bold text-lg text-amber-900 flex items-center gap-2">
                  <span className="text-2xl">🧩</span> {currentQuestion}
                </p>
              </div>
            )}
            <h3 className="font-bold text-indigo-900 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5" /> Quick! Solve the puzzle:
            </h3>
            <div className="flex gap-4">
              <input
                id="answer-input"
                type="text"
                placeholder="Enter your answer"
                value={userAnswer}
                onChange={e => setUserAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAnswer()}
                className="flex-1 px-5 py-4 border-2 border-white rounded-2xl focus:border-indigo-400 outline-none font-bold text-xl shadow-sm"
              />
              <Button onClick={handleAnswer} variant="accent" className="px-8 shadow-indigo-100">Submit</Button>
            </div>

            {currentHint && (
              <div className="mt-4 flex flex-col items-start">
                {!showHint ? (
                  <button 
                    onClick={() => setShowHint(true)}
                    className="text-indigo-600 font-bold flex items-center gap-1 hover:underline text-sm"
                  >
                    <HelpCircle className="w-4 h-4" /> Need a hint?
                  </button>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }} 
                    animate={{ opacity: 1, x: 0 }}
                    className="flex gap-3 items-start bg-indigo-50 p-4 rounded-2xl border border-indigo-100"
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-400 flex items-center justify-center text-white shrink-0 mt-1">
                      <HelpCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-indigo-900 font-bold text-sm mb-1">Narrator's Hint:</p>
                      <p className="text-indigo-800 text-sm italic">"{currentHint}"</p>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            <AnimatePresence>
              {feedback === 'correct' && (
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="mt-4 flex items-center gap-2 text-green-600 font-bold">
                  <CheckCircle2 className="w-6 h-6" /> Correct! You're brilliant! +10 XP
                </motion.div>
              )}
              {feedback === 'wrong' && (
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="mt-4 flex items-center gap-2 text-red-500 font-bold">
                  <XCircle className="w-6 h-6" /> Not quite... try again!
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </Card>
    </div>
  );
}

function StudentDashboard({ studentId, onBack }: { studentId: string; onBack: () => void }) {
  const [logs, setLogs] = useState<ProgressLog[]>([]);

  useEffect(() => {
    fetch(`/api/oversight/${studentId}`)
      .then(res => res.json())
      .then(data => setLogs(data.logs));
  }, []);

  const chartData = logs.slice().reverse().map((l, i) => ({
    round: i + 1,
    correct: l.correct ? 1 : 0
  }));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 pt-10">
      <div className="flex items-center justify-between">
        <h2 className="text-4xl font-bold text-slate-800">Your Progress Journey</h2>
        <Button variant="secondary" onClick={onBack} className="gap-2">
          <ChevronRight className="w-5 h-5 rotate-180" /> Back to Story
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-500 uppercase tracking-widest">
            <Zap className="w-5 h-5 text-amber-500" /> Recent Performance
          </h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="round" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line type="monotone" dataKey="correct" stroke="#6366F1" strokeWidth={4} dot={{ r: 6, fill: '#6366F1', strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="flex flex-col items-center justify-center text-center p-12">
          <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mb-6 border-4 border-amber-200">
            <Trophy className="w-12 h-12 text-amber-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800">Explorer Badge</h3>
          <p className="text-slate-500 mt-2">You've solved 10 problems in a row! Keep going to unlock the Legend badge.</p>
        </Card>
      </div>

      <Card>
        <h3 className="font-bold text-lg mb-6 text-slate-500 uppercase tracking-widest">All Adventures</h3>
        <div className="space-y-3">
          {logs.map((log, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-xl ${log.correct ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}>
                  {log.correct ? <CheckCircle2 /> : <XCircle />}
                </div>
                <div>
                  <p className="font-bold text-slate-700">{log.topic}</p>
                  <p className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleDateString()}</p>
                </div>
              </div>
              <span className="font-bold bg-white px-3 py-1 rounded-lg border border-slate-100">G{log.difficulty}</span>
            </div>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}

function OversightPanel({ studentId, useRag, setUseRag, useThinking, setUseThinking, onBack }: any) {
  const [modelPerf, setModelPerf] = useState<ModelPerf[]>([]);

  useEffect(() => {
    fetch(`/api/oversight/${studentId}`)
      .then(res => res.json())
      .then(data => setModelPerf(data.modelPerf));
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 pt-10">
      <div className="flex items-center justify-between">
        <h2 className="text-4xl font-bold text-slate-800">Teacher Oversight</h2>
        <div className="flex items-center gap-4">
          <Button variant="secondary" onClick={onBack} className="gap-2">
            <ChevronRight className="w-5 h-5 rotate-180" /> Back to Story
          </Button>
        </div>
      </div>

      {/* Toggles Row */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-sm font-bold text-slate-500 px-2">RAG MODE</span>
          <button
            id="rag-toggle"
            onClick={() => setUseRag(!useRag)}
            className={`w-14 h-8 rounded-full relative transition-all ${useRag ? 'bg-indigo-500' : 'bg-slate-200'}`}
          >
            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${useRag ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
        <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-sm font-bold text-slate-500 px-2 flex items-center gap-1">
            <Brain className="w-4 h-4" /> THINKING
          </span>
          <button
            id="thinking-toggle"
            onClick={() => setUseThinking(!useThinking)}
            className={`w-14 h-8 rounded-full relative transition-all ${useThinking ? 'bg-amber-500' : 'bg-slate-200'}`}
          >
            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${useThinking ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <h3 className="font-bold text-lg mb-6 text-slate-500 uppercase tracking-widest">Inference Latency (ms)</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modelPerf}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey={(d) => d.is_rag ? 'With RAG' : 'Base Model'} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="avg_latency" fill="#6366F1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="bg-indigo-900 text-white border-none shadow-indigo-100">
          <h3 className="font-bold text-lg mb-6 opacity-60 uppercase tracking-widest text-indigo-200">System Status</h3>
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 font-medium"><Sparkles className="w-5 h-5 text-amber-400" /> Model</span>
              <span className="px-3 py-1 bg-green-400 text-green-950 font-bold rounded-lg text-sm">Gemma 4 E2B</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 font-medium"><Brain className="w-5 h-5 text-amber-400" /> Thinking</span>
              <span className={`px-3 py-1 font-bold rounded-lg text-sm ${useThinking ? 'bg-amber-400 text-amber-950' : 'bg-slate-600 text-slate-300'}`}>
                {useThinking ? 'ON — Smarter, Slower' : 'OFF — Faster'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2 font-medium"><Database className="w-5 h-5 text-amber-400" /> Database</span>
              <span className="px-3 py-1 bg-green-400 text-green-950 font-bold rounded-lg text-sm">OFFLINE-OK</span>
            </div>
            <div className="pt-4 border-t border-indigo-800">
              <p className="text-sm opacity-70 mb-2 italic">RAG Mode injects Grade-specific math curriculum data into prompts.</p>
              <p className="text-sm opacity-70 mb-4 italic">Thinking Mode lets the model reason step-by-step before responding. Turning it off makes stories generate faster but may reduce quality.</p>
              <Button variant="primary" className="w-full bg-amber-400 text-amber-950">Download Performance Report</Button>
            </div>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}

function Database({ className }: any) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
    </svg>
  );
}
