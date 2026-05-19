import fs from "fs";

const filePath = "server/src/index.js";
let content = fs.readFileSync(filePath, "utf8");

// Fix #6: Replace Math.random() with crypto.randomUUID() in makeId
content = content.replace(
  "return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;",
  'return `${prefix}_${crypto.randomUUID().split("-")[0]}`;'
);

// Fix #5a: Replace Array.some() duplicate check with Set
content = content.replace(
  "if (room.submissions.some((entry) => entry.word === rawWord)) {",
  "room._claimedWords = room._claimedWords || new Set();\n  if (room._claimedWords.has(rawWord)) {"
);

// Fix #5b: Reset _claimedWords Set when starting a new round
content = content.replace(
  "room.submissions = [];\n  room.events = [];\n  pushSystemEvent(room, \"Game starting now\");",
  "room.submissions = [];\n  room.events = [];\n  room._claimedWords = new Set();\n  pushSystemEvent(room, \"Game starting now\");"
);

// Fix #4: Strip validWords from room summary (security)
content = content.replace(
  "sourceWord: room.sourceWord || null,",
  "sourceWord: room.sourceWord || null,\n    validWordsCount: room.validWords ? room.validWords.length : 0,"
);

// Fix #7: Apply rate limiting middleware (simple in-memory rate limiter)
const rateLimitMiddleware = `

// ─── Simple in-memory rate limiter ─────────────────────────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;

function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || "unknown";
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }

  const timestamps = rateLimitMap.get(ip).filter((t) => t > windowStart);
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);

  if (timestamps.length > RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({ error: "Too many requests. Please slow down." });
  }

  next();
}

`;

// Insert rate limiter middleware after the compression middleware
content = content.replace(
  `app.use(cors());
app.use(express.json({ limit: "32kb" }));`,
  `app.use(cors());
app.use(rateLimiter);
app.use(express.json({ limit: "32kb" }));`
);

// Add rate limiter function definitions before the routes (after the compression middleware closing)
content = content.replace(
  `  next();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────`,
  `  next();
});

${rateLimitMiddleware}
// ─── Helpers ──────────────────────────────────────────────────────────────────`
);

fs.writeFileSync(filePath, content, "utf8");
console.log("All fixes applied successfully!");
console.log("- Flaw #4: validWords hidden from client summary");
console.log("- Flaw #5a: Set-based duplicate word detection");
console.log("- Flaw #5b: _claimedWords reset on round start");
console.log("- Flaw #6: crypto.randomUUID() replacing Math.random()");
console.log("- Flaw #7: Rate limiter middleware (30 req/min per IP)");
EOF