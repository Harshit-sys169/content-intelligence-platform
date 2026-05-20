# Architecture Overview

## System Design

Content Intelligence Platform is a full-stack Node.js application with client-side analysis UI and server-side scoring engine.

```
┌─────────────────┐
│  Browser Client │
│  (app.js)       │
└────────┬────────┘
         │ JSON/REST
         ▼
┌─────────────────────────────┐
│  Express Server             │
│  ├─ /api/analysis/*         │
│  ├─ /api/auth/*             │
│  ├─ /api/history/*          │
│  └─ /api/export/*           │
└──────┬──────────────────────┘
       │
   ┌───┼───┐
   ▼   ▼   ▼
  ┌─────────────────┐
  │ Analysis Engine │ (lib/analyzer.js)
  │ - Sentiment     │
  │ - Readability   │
  │ - Credibility   │
  │ - Bias          │
  │ - Entity extract│
  └────────┬────────┘
           │
         Result
           │
           ▼
  ┌─────────────────┐
  │ JSON Storage    │ (lib/store.js)
  │ data/store.json │
  └─────────────────┘
```

---

## Key Components

### 1. server.js (Express Server)
Main application entry point. Handles:
- HTTP routing
- Authentication middleware
- Request validation
- File upload processing
- Response formatting

**Key endpoints:**
- `POST /api/analysis/analyze` — Run full analysis
- `POST /api/analysis/compare` — Compare two texts
- `POST /api/analysis/rewrite` — Generate rewrite
- `POST /api/auth/login` — Authenticate user
- `GET /api/history` — Retrieve analysis history

### 2. lib/analyzer.js (Analysis Engine)
Deterministic text analysis. No external dependencies (local engine).

**Scoring dimensions:**
- **Sentiment** (-100 to +100) — Positive/negative word frequency
- **Readability** (0-100) — Flesch-Kincaid grade level
- **Objectivity** (0-100) — Presence of first-person, hedges, bias markers
- **Complexity** (0-100) — Vocabulary sophistication, terminology density
- **Credibility** (0-100) — Citations, links, numbers, authority words
- **Persuasion** (0-100) — CTAs, urgency, scarcity, emotional language

**Analysis functions:**
- `analyzeText(text, options)` — Full analysis with all dimensions
- `compareReports(left, right)` — Side-by-side comparison
- `makeRewrite(text, style)` — Generate rewritten version
- `extractEntities(text)` — Named entity recognition (people, orgs, places, URLs, emails, money, dates)
- `detectEmotions(words)` — 6-emotion classification (joy, anger, fear, sadness, trust, surprise)

### 3. lib/auth.js (Authentication)
Cookie-based authentication with JWT tokens.

**Flow:**
1. User provides username/password
2. Hash password with SHA256
3. Compare with env-provided hash
4. If match: sign JWT with user metadata
5. Set httpOnly cookie with 7-day expiry
6. Middleware validates on each request

**Security:**
- httpOnly cookies prevent XSS
- sameSite=lax prevents CSRF
- JWT prevents tampering
- 7-day expiry enforces re-auth

### 4. lib/store.js (Persistence)
File-based JSON storage. Single-user or small team ready.

**Data structure:**
```json
{
  "version": 1,
  "users": [],
  "analyses": [
    {
      "id": "nanoid-string",
      "userId": "u_admin",
      "createdAt": "2026-05-20T21:06:00Z",
      "kind": "analysis|comparison|rewrite",
      "title": "Document title",
      "input": "Original text",
      "report": { /* full analysis output */ },
      "meta": {}
    }
  ],
  "settings": {
    "u_admin": { "theme": "dark", "density": "compact" }
  }
}
```

**Atomicity:**
- Write to temp file first
- Atomic rename (no partial writes)
- Limit to 1000 most recent analyses

### 5. public/app.js (Client Logic)
Vanilla JavaScript client. ~2000 LOC.

**Responsibilities:**
- UI state management
- API communication
- Analysis rendering (tabs, charts, tables)
- File upload handling
- Export triggering

**Key features:**
- Real-time character/word counter
- Live pipeline logging
- Radar chart visualization (6 dimensions)
- Tabbed report view (overview, sentiment, content, style, signals)
- Comparison mode side-by-side

### 6. public/styles.css (UI)
Responsive dark theme. CSS Grid + Flexbox.

**Design system:**
- 6-color palette (accent, accent2, accent3, good, warn, danger)
- 18px base radius, 24px large
- Deep dark background with subtle radial gradients
- System font stack for performance

---

## Data Flow

### Analysis Request
```
1. User enters text in textarea
2. Clicks "Run analysis"
3. Client validates (≥20 chars)
4. POST to /api/analysis/analyze
5. Server receives text + options
6. Analyzer.analyzeText() runs locally
7. Result saved to store.json (user-scoped)
8. Response with id + scores
9. Client renders all tabs
10. Entry added to history
```

### Comparison Request
```
1. User pastes two texts
2. Clicks "Compare"
3. POST both texts to /api/analysis/compare
4. Server analyzes both separately
5. compareReports() calculates deltas
6. Results saved as "comparison" kind
7. UI shows side-by-side scores + highlights differences
```

### Export Request
```
1. User clicks "Export MD" on analysis
2. GET /api/export/{id}?format=md
3. Server retrieves from store
4. Formats as markdown or JSON
5. Sets Content-Disposition header
6. Browser downloads file
```

---

## Scoring Algorithm Details

### Sentiment
```
POS_WORDS = [good, great, excellent, ...]
NEG_WORDS = [bad, worst, poor, ...]

raw_score = count(pos_words) - count(neg_words)
scaled = raw_score / max(4, word_count * 0.045)
final = clamp(scaled * 100, -100, 100)
```

### Readability (Flesch-Kincaid)
```
avg_sentence_length = word_count / sentence_count
avg_syllables = total_syllables / word_count

ease_score = 206.835 - (1.015 * avg_sentence)
             - (84.6 * avg_syllables)
grade = (0.39 * avg_sentence) + (11.8 * avg_syllables) - 15.59
```

### Objectivity
```
detract from objectivity:
  - First-person pronouns (I, we, my)
  - Hedging language (maybe, perhaps, probably)
  - Biased assertions (clearly, undeniably)
  - Exclamation marks

add to objectivity:
  - Numbers and metrics
  - Citations and references
  - Formal language

final_score = 74 - (pronouns * 2.8) - (hedges * 2.5)
              - (biased * 4) - (exclaims * 5)
              + (numbers + citations) * 2
```

### Credibility
```
Credibility signals:
  + Citations (year in parentheses)
  + External links
  + Numeric data points
  + Authority words (research, study, expert)
  - Hedging language (maybe, perhaps)
  
base_score = 32 + (citations * 14) + (links * 10)
             + (numbers * 2) + (authority * 5)
             + (objectivity_score * 0.35)
             - (hedges * 2)
```

### Persuasion
```
Persuasion techniques:
  + Call-to-action words (join, buy, subscribe, click)
  + Urgency markers (now, limited, deadline)
  + Scarcity language (only, rare, exclusive)
  + Authority references
  + Emotional language (positive + negative)
  + Exclamation marks

score = 12 + (imperative * 10) + (urgency * 12)
        + (scarcity * 10) + (authority * 5)
        + (emotional * 2) + (exclaims * 5)
```

---

## Extensibility

### Adding a New Score Dimension

1. Add scoring function to analyzer.js:
   ```javascript
   function estimateNewDimension(words, text) {
     // Your algorithm
     return clamp(score, 0, 100);
   }
   ```

2. Include in analyzeText():
   ```javascript
   scores: {
     // ... existing
     newDimension: estimateNewDimension(wordsLower, text)
   }
   ```

3. Update client UI to display in radar chart

### Using External LLM

Replace `makeRewrite()` with LLM API:
```javascript
async function makeRewrite(text, options) {
  const response = await fetch('https://api.openai.com/v1/completions', {
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4',
      prompt: `Rewrite in ${options.rewriteMode} style: ${text}`,
      max_tokens: 1000
    })
  });
  return await response.json();
}
```

### Switching to Database

Replace `lib/store.js` functions to use PostgreSQL:
```javascript
async function saveAnalysis(record) {
  const result = await db.query(
    'INSERT INTO analyses (...) VALUES (...) RETURNING *',
    [record.userId, record.title, record.report, ...]
  );
  return result.rows[0];
}
```

---

## Performance Considerations

**Current (Local Engine):**
- Analysis time: <50ms for typical text (2000 words)
- Memory: ~2-5MB per analysis
- Storage: ~10KB per analysis record
- No network latency

**With LLM:**
- Add 500-2000ms for API call
- Cost: $0.01-0.05 per rewrite
- Rate limits: 3-20 req/min depending on tier

**Scaling:**
- Current: ~100 concurrent users on single Node.js
- With clustering: Add `cluster` module or load balance
- With DB: Switch to PostgreSQL + connection pooling

---

**Last updated:** May 2026  
**Version:** 1.0.0
