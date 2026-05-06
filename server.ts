import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import { getLlama, LlamaChatSession, LlamaModel, LlamaContext } from "node-llama-cpp";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

// Initialize Database
const db = new Database("mathtales.db");
db.pragma("journal_mode = WAL");

// Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    grade INTEGER DEFAULT 1,
    current_theme TEXT DEFAULT 'fantasy',
    xp INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT,
    topic TEXT,
    difficulty INTEGER,
    correct INTEGER,
    response_time INTEGER,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES students(id)
  );

  CREATE TABLE IF NOT EXISTS model_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt TEXT,
    response TEXT,
    is_rag BOOLEAN,
    latency INTEGER,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT,
    badge_name TEXT,
    awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES students(id)
  );
`);

// Load Math Knowledge Base
const mathKg = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "math_kb.json"), "utf-8"));

async function startServer() {
  const app = express();
  app.use(express.json());

  // --- LLM Setup ---
  let model: any = null;
  let llama: any = null;
  const MODEL_PATH = path.join(__dirname, "models", "model.gguf");

  if (fs.existsSync(MODEL_PATH)) {
    try {
      console.log("Found local model, initializing llama...");
      llama = await getLlama("lastBuild");
      model = await llama.loadModel({ modelPath: MODEL_PATH });
    } catch (e) {
      console.error("Failed to load local model:", e);
    }
  } else {
    console.warn("Local model not found. Using MockLLM for preview. Run 'npm run download-model' to use real inference.");
  }

  // --- Persistent Session Pool ---
  // Keeps LlamaChatSession alive per student so the KV cache stays warm.
  // Subsequent turns skip re-tokenizing the full conversation history.
  interface SessionEntry {
    context: any;        // LlamaContext
    session: any;        // LlamaChatSession
    theme: string;
    grade: number;
    lastUsed: number;
  }
  const sessionPool = new Map<string, SessionEntry>();
  const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

  // Cleanup stale sessions every 2 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of sessionPool) {
      if (now - entry.lastUsed > SESSION_TTL_MS) {
        console.log(`[session-pool] Disposing idle session for ${id}`);
        try { entry.context.dispose(); } catch { /* already disposed */ }
        sessionPool.delete(id);
      }
    }
  }, 2 * 60 * 1000);

  async function getOrCreateSession(studentId: string, theme: string, grade: number): Promise<SessionEntry> {
    const existing = sessionPool.get(studentId);
    // Reuse if same theme/grade and session is still valid
    if (existing && existing.theme === theme && existing.grade === grade) {
      existing.lastUsed = Date.now();
      console.log(`[session-pool] Reusing cached session for ${studentId}`);
      return existing;
    }
    // Dispose old session if theme/grade changed
    if (existing) {
      console.log(`[session-pool] Theme/grade changed for ${studentId}, creating new session`);
      try { existing.context.dispose(); } catch { /* ok */ }
      sessionPool.delete(studentId);
    }
    // Create new session with system prompt baked in
    console.log(`[session-pool] Creating new session for ${studentId} (theme=${theme}, grade=${grade})`);
    const ctx = await model.createContext({ contextSize: 2048 });
    const session = new LlamaChatSession({
      contextSequence: ctx.getSequence(),
      systemPrompt: buildSystemPrompt(theme, grade),
    });
    const entry: SessionEntry = { context: ctx, session, theme, grade, lastUsed: Date.now() };
    sessionPool.set(studentId, entry);
    return entry;
  }

  function disposeSession(studentId: string) {
    const entry = sessionPool.get(studentId);
    if (entry) {
      try { entry.context.dispose(); } catch { /* ok */ }
      sessionPool.delete(studentId);
    }
  }

  // --- API Routes ---

  // Get student info
  app.get("/api/student/:id", (req, res) => {
    const student = db.prepare("SELECT * FROM students WHERE id = ?").get(req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found" });
    res.json(student);
  });

  // Create student
  app.post("/api/student", (req, res) => {
    const { id, name, grade } = req.body;
    db.prepare("INSERT INTO students (id, name, grade) VALUES (?, ?, ?)").run(id, name, grade);
    res.json({ success: true });
  });

  // --- Prefetch cache for background pre-generation ---
  const prefetchCache = new Map<string, { text: string; ready: boolean; generating: boolean }>();

  // Diverse storytelling elements for prompt variety
  const narrativeStyles = [
    "Use suspenseful cliffhanger pacing — build tension before revealing the math challenge.",
    "Write like a funny narrator who makes silly observations and puns.",
    "Use a mysterious, whispered tone as if sharing ancient secrets.",
    "Write with excitement and energy, using exclamation points and dramatic reveals!",
    "Use a gentle, poetic style with beautiful imagery and metaphors.",
    "Write like a nature documentary narrator discovering something amazing.",
  ];

  const mathProblemTypes: Record<number, string[]> = {
    1: ["simple addition", "simple subtraction", "counting objects", "comparing numbers (greater/less)"],
    2: ["two-digit addition", "two-digit subtraction", "skip counting", "simple word problems with addition"],
    3: ["multiplication basics", "simple division", "telling time problems", "measurement comparisons"],
    4: ["multi-step word problems", "fractions basics", "area and perimeter", "patterns and sequences"],
    5: ["decimal operations", "fraction addition", "volume problems", "order of operations"],
  };

  const uniqueHooks = [
    "The world has low gravity—objects float if not tied down.",
    "Everything in this world is made of candy and sweets.",
    "The inhabitants communicate only through musical whistles.",
    "A giant mechanical clock in the sky controls the weather.",
    "Ancient crystals provide light but change color based on your mood.",
    "Shadows have a life of their own and sometimes wander off.",
    "The floor is a giant mirror reflecting a different world.",
    "Tiny invisible fairies move objects around when no one is looking.",
    "Water flows upwards and fire feels cold like ice.",
    "Everyone travels on the backs of giant, friendly insects.",
    "The wind carries whispers of secrets from the future.",
    "All buildings are grown from magic seeds, not built.",
    "Animals can talk, but they only tell jokes.",
    "The sun is a giant glowing gear that needs occasional oiling.",
    "Every time you sneeze, a flower blooms nearby."
  ];

  const themeDescriptions: Record<string, string> = {
    fantasy: "a magical kingdom with wizards, dragons, enchanted forests, and ancient castles",
    "sci-fi": "outer space with alien planets, starships, robots, and futuristic technology",
    mystery: "a tropical desert island with hidden treasures, jungle puzzles, and mysterious caves",
    underwater: "an underwater kingdom with merfolk, coral palaces, sunken ships, and talking sea creatures",
    dinosaur: "a prehistoric world with friendly dinosaurs, volcanic islands, and ancient puzzles",
    pirate: "the high seas with pirate ships, treasure maps, tropical islands, and sea monsters",
  };

  // System prompt — sent ONCE when a session is created (stays in KV cache)
  function buildSystemPrompt(theme: string, grade: number): string {
    const themeDesc = themeDescriptions[theme] || `a world themed around: ${theme}`;
    const hook = uniqueHooks[Math.floor(Math.random() * uniqueHooks.length)];

    return `You are a world-class children's author and math educator. You write highly imaginative, unique stories set in ${themeDesc}.

WORLD RULE: ${hook}

Rules:
- Cinematic, vivid, original. No cliches.
- Math must be a PHYSICAL obstacle (unlock a door, fix a machine, cross a bridge).
- Every turn: new character or twist.
- 2-3 short paragraphs only.
- End with:
[HINT: strategy clue, NOT the answer]
[ANSWER: number]`;
  }

  // Turn prompt — lightweight, sent each turn (only this gets tokenized fresh)
  function buildTurnPrompt(userAction: string, ragSection: string, grade: number): string {
    const style = narrativeStyles[Math.floor(Math.random() * narrativeStyles.length)];
    const problemTypes = mathProblemTypes[grade] || mathProblemTypes[1];
    const chosenProblemType = problemTypes[Math.floor(Math.random() * problemTypes.length)];

    return `Style: ${style}
Hero's action: "${userAction}"
Math type: ${chosenProblemType}
${ragSection}

Continue the story (2-3 paragraphs). New obstacle requiring ${chosenProblemType}. End with [HINT: ...] and [ANSWER: ...].`;
  }

  // Legacy full prompt (used for mock LLM and logging)
  function buildFullPrompt(context: any, userAction: string, ragSection: string, theme: string): string {
    return `${buildSystemPrompt(theme, context.grade || 1)}\n\n${buildTurnPrompt(userAction, ragSection, context.grade || 1)}`;
  }

  function getRagSection(studentId: string, useRag: boolean): string {
    if (!useRag) return "";
    const student = db.prepare("SELECT grade FROM students WHERE id = ?").get(studentId) as any;
    if (!student) return "";
    const gradeData = mathKg.curriculum.find((c: any) => c.grade === student.grade);
    if (!gradeData) return "";
    const topic = gradeData.topics[Math.floor(Math.random() * gradeData.topics.length)];
    return `\n**Math Topic to Weave In (from curriculum):**
- Topic: ${topic.name}
- Key concepts: ${topic.concepts.join(", ")}
- Example at this level: "${topic.examples[0].question}" (Answer: ${topic.examples[0].answer})
Use this topic naturally in the story challenge. Do NOT repeat the example verbatim — create a new, original problem inspired by it.`;
  }

  // Story generation — SSE streaming endpoint
  app.post("/api/story/stream", async (req, res) => {
    const { studentId, userAction, useRag, context } = req.body;
    const startTime = Date.now();

    // Check if we have a prefetched response ready
    const cached = prefetchCache.get(studentId);
    if (cached && cached.ready) {
      prefetchCache.delete(studentId);
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      // Stream the cached response word by word for a natural feel
      const words = cached.text.split(/(\s+)/);
      for (const word of words) {
        res.write(`data: ${JSON.stringify({ type: "chunk", text: word })}\n\n`);
        await new Promise((r) => setTimeout(r, 15));
      }
      const latency = Date.now() - startTime;

      // Parse hint and answer from cached text
      const hintMatch = cached.text.match(/\[HINT:\s*(.*?)\]/i);
      const answerMatch = cached.text.match(/\[ANSWER:\s*([\w\/\.\-]+)\]/i);

      res.write(`data: ${JSON.stringify({
        type: "done",
        latency,
        hint: hintMatch ? hintMatch[1] : null,
        answer: answerMatch ? answerMatch[1] : null
      })}\n\n`);
      res.end();
      db.prepare("INSERT INTO model_logs (prompt, response, is_rag, latency) VALUES (?, ?, ?, ?)").run("[prefetched]", cached.text, useRag ? 1 : 0, latency);
      return;
    }
    // Clear any stale cache
    prefetchCache.delete(studentId);

    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const theme = context.theme || "fantasy";
    const grade = context.grade || 1;
    const ragSection = getRagSection(studentId, useRag);
    const turnPrompt = buildTurnPrompt(userAction, ragSection, grade);

    let fullResponse = "";

    if (model) {
      try {
        const entry = await getOrCreateSession(studentId, theme, grade);

        const response = await entry.session.prompt(turnPrompt, {
          temperature: 0.8,
          maxTokens: 300,
          onTextChunk(chunk: string) {
            fullResponse += chunk;
            res.write(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`);
          },
        });

        fullResponse = response;
        entry.lastUsed = Date.now();
      } catch (err: any) {
        // If session is corrupted, dispose and retry once with a fresh session
        console.error(`[session-pool] Error for ${studentId}, disposing session:`, err.message);
        disposeSession(studentId);
        res.write(`data: ${JSON.stringify({ type: "error", text: err.message })}\n\n`);
      }
    } else {
      // Mock LLM — simulate streaming
      const mockStories = [
        `Deep in the Whispering Woods, a tiny fox named Clover dashes across your path! She's carrying a scroll with strange markings. "Help me!" she squeaks. "The Bridge Keeper won't let me cross unless I count the golden acorns correctly. I collected 5 baskets with 3 acorns each. How many acorns do I have altogether?"\n\n[ANSWER: 15]`,
        `You stumble upon a bubbling brook where an old turtle named Captain Sheldon is stuck. "My raft needs exactly the right number of logs to float!" he grumbles. "I have 12 logs but the river carried away 4. How many logs do I have left to build with?"\n\n[ANSWER: 8]`,
        `A shooting star crashes into the meadow ahead! When the dust settles, you find a baby dragon named Ember, counting her glittering scales. "Oh no, some fell off during my landing! I had 20 scales and lost 7. Can you tell me how many I have now? I need to know before I can fly again!"\n\n[ANSWER: 13]`,
      ];
      const mockText = mockStories[Math.floor(Math.random() * mockStories.length)];
      const words = mockText.split(/((?<=\s))/);
      for (const word of words) {
        fullResponse += word;
        res.write(`data: ${JSON.stringify({ type: "chunk", text: word })}\n\n`);
        await new Promise((r) => setTimeout(r, 30));
      }
    }

    const latency = Date.now() - startTime;

    const hintMatch = fullResponse.match(/\[HINT:\s*(.*?)\]/i);
    const answerMatch = fullResponse.match(/\[ANSWER:\s*([\w\/\.\-]+)\]/i);

    res.write(`data: ${JSON.stringify({
      type: "done",
      latency,
      hint: hintMatch ? hintMatch[1] : null,
      answer: answerMatch ? answerMatch[1] : null
    })}\n\n`);
    res.end();

    const logPrompt = model ? `[session-cached] ${turnPrompt.slice(0, 200)}...` : buildFullPrompt(context, userAction, ragSection, theme);
    db.prepare("INSERT INTO model_logs (prompt, response, is_rag, latency) VALUES (?, ?, ?, ?)").run(logPrompt, fullResponse, useRag ? 1 : 0, latency);
  });

  // Background prefetch — starts generating next story step
  app.post("/api/story/prefetch", async (req, res) => {
    const { studentId, useRag, context } = req.body;

    // Don't prefetch if already generating
    const existing = prefetchCache.get(studentId);
    if (existing && (existing.generating || existing.ready)) {
      return res.json({ status: "already_generating" });
    }

    if (!model) {
      return res.json({ status: "no_model" });
    }

    const entry = { text: "", ready: false, generating: true };
    prefetchCache.set(studentId, entry);
    res.json({ status: "started" });

    // Generate in background using the student's cached session
    const theme = context.theme || "fantasy";
    const grade = context.grade || 1;
    const ragSection = getRagSection(studentId, useRag);
    const turnPrompt = buildTurnPrompt("The hero solved the puzzle and continues onward.", ragSection, grade);

    try {
      const sessionEntry = await getOrCreateSession(studentId, theme, grade);
      const response = await sessionEntry.session.prompt(turnPrompt, {
        temperature: 0.8,
        maxTokens: 300,
        onTextChunk(chunk: string) {
          entry.text += chunk;
        },
      });
      entry.text = response;
      entry.ready = true;
      entry.generating = false;
      sessionEntry.lastUsed = Date.now();
    } catch (err) {
      prefetchCache.delete(studentId);
      disposeSession(studentId);
    }
  });

  // Check if prefetched content is ready
  app.get("/api/story/prefetch/:studentId", (req, res) => {
    const cached = prefetchCache.get(req.params.studentId);
    if (!cached) return res.json({ status: "none" });
    if (cached.ready) return res.json({ status: "ready" });
    return res.json({ status: "generating" });
  });

  // Reset a student's cached session (e.g., when starting a new adventure)
  app.post("/api/session/reset", (req, res) => {
    const { studentId } = req.body;
    disposeSession(studentId);
    prefetchCache.delete(studentId);
    console.log(`[session-pool] Session reset for ${studentId}`);
    res.json({ success: true });
  });

  // Submit Answer & Update Progress
  app.post("/api/progress", (req, res) => {
    const { studentId, isCorrect, difficulty, topic } = req.body;
    db.prepare("INSERT INTO progress (student_id, topic, difficulty, correct) VALUES (?, ?, ?, ?)").run(
      studentId, topic, difficulty, isCorrect ? 1 : 0
    );

    // Adaptive logic: If 3 correct in a row, suggest leveling up or increase XP
    if (isCorrect) {
      db.prepare("UPDATE students SET xp = xp + 10 WHERE id = ?").run(studentId);
    }

    res.json({ success: true });
  });

  // Oversight Dashboard
  app.get("/api/oversight/:studentId", (req, res) => {
    const logs = db.prepare("SELECT * FROM progress WHERE student_id = ? ORDER BY timestamp DESC LIMIT 50").all(req.params.studentId);
    const modelPerf = db.prepare("SELECT AVG(latency) as avg_latency, is_rag FROM model_logs GROUP BY is_rag").all();
    res.json({ logs, modelPerf });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: ['**/mathtales.db*', '**/*.db', '**/*.db-wal', '**/*.db-shm'],
        },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
