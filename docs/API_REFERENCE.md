# API Reference

## Authentication

### POST /api/auth/login
Authenticate user and issue session cookie.

**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response (200):**
```json
{
  "ok": true,
  "user": {
    "id": "u_admin",
    "username": "admin",
    "role": "admin",
    "name": "Admin Operator"
  }
}
```

**Response (401):**
```json
{"error": "Invalid credentials"}
```

**Cookies Set:**
- `auth_token`: JWT token, 7-day expiry, httpOnly, sameSite=lax

---

### POST /api/auth/logout
Clear session cookie.

**Request:** (no body)

**Response (200):**
```json
{"ok": true}
```

---

### GET /api/auth/me
Get current user and settings.

**Request:** (auth required)

**Response (200):**
```json
{
  "ok": true,
  "user": {
    "id": "u_admin",
    "username": "admin",
    "role": "admin",
    "name": "Admin Operator"
  },
  "settings": {
    "theme": "dark",
    "density": "compact",
    "lastPreset": "detailed"
  }
}
```

---

## Analysis

### POST /api/analysis/analyze
Analyze text for sentiment, readability, credibility, and more.

**Request:**
```json
{
  "text": "Your text to analyze here...",
  "depth": "detailed",
  "domain": "general",
  "focus": "balanced",
  "mode": "analyze"
}
```

**Parameters:**
- `text` (string, required) — Text to analyze (min 20 chars)
- `depth` (string) — 'brief', 'detailed', or 'expert'
- `domain` (string) — 'general', 'business', 'academic', 'technical', 'media'
- `focus` (string) — 'balanced', 'critical', or 'supportive'
- `mode` (string) — 'analyze' (default)

**Response (200):**
```json
{
  "ok": true,
  "id": "abc123",
  "report": {
    "one_liner": "Positive, persuasive product review with strong credibility.",
    "scores": {
      "sentiment": 67,
      "readability": 72,
      "objectivity": 58,
      "complexity": 45,
      "credibility": 75,
      "persuasion": 82
    },
    "summary": "This review demonstrates strong persuasive intent with...",
    "insight": "The writer uses emotional language and specific claims...",
    "recommendations": [
      "Balance emotional language with more objective examples",
      "Add third-party sources or citations to strengthen credibility"
    ],
    "emotions": [
      {"name": "Joy", "intensity": 78},
      {"name": "Trust", "intensity": 65}
    ],
    "entities": [
      {"text": "Apple", "type": "ORG", "sentiment": "pos"},
      {"text": "$3,499", "type": "MONEY", "sentiment": "neu"}
    ],
    "topics": [
      {"name": "Technology", "relevance": 85},
      {"name": "Business", "relevance": 42}
    ],
    "keywords": [
      {"word": "processor", "weight": 82},
      {"word": "performance", "weight": 76}
    ]
  },
  "createdAt": "2026-05-20T21:06:00Z"
}
```

**Response (400):**
```json
{"error": "Provide at least 20 characters."}
```

---

### POST /api/analysis/compare
Compare two texts and identify differences.

**Request:**
```json
{
  "leftText": "First document text...",
  "rightText": "Second document text..."
}
```

**Response (200):**
```json
{
  "ok": true,
  "comparison": {
    "left": { /* full report */ },
    "right": { /* full report */ },
    "deltas": {
      "sentiment": { "left": 45, "right": 78, "diff": 33 },
      "readability": { "left": 62, "right": 55, "diff": -7 },
      "credibility": { "left": 68, "right": 89, "diff": 21 }
    },
    "summary": "Right document is more positive and credible but slightly less readable."
  }
}
```

---

### POST /api/analysis/rewrite
Generate rewritten version of text.

**Request:**
```json
{
  "text": "Original text to rewrite...",
  "rewriteMode": "professional"
}
```

**Parameters:**
- `rewriteMode` (string) — 'professional', 'clear', 'neutral', or 'concise'

**Response (200):**
```json
{
  "ok": true,
  "rewrite": "Rewritten text appears here..."
}
```

---

## File Operations

### POST /api/import
Import text from file (.txt, .md, .csv, .json).

**Request:**
```
Content-Type: multipart/form-data
Body: FormData with 'file' field
```

**Response (200):**
```json
{
  "ok": true,
  "filename": "document.txt",
  "text": "Extracted and normalized text...",
  "chars": 2847,
  "words": 482
}
```

**Response (400):**
```json
{"error": "No file uploaded"}
```

**Supported formats:**
- `.txt` — Plain text (as-is)
- `.md` — Markdown (as-is)
- `.csv` — Comma-separated (convert to pipe-separated)
- `.json` — JSON (pretty-print)

---

## History Management

### GET /api/history
List all analyses for current user.

**Query parameters:**
- `limit` (number, default: 20) — Max results (0-100)

**Response (200):**
```json
{
  "ok": true,
  "items": [
    {
      "id": "abc123",
      "createdAt": "2026-05-20T21:06:00Z",
      "kind": "analysis",
      "title": "Positive, persuasive product review",
      "userId": "u_admin"
    }
  ]
}
```

---

### GET /api/history/:id
Retrieve specific analysis.

**Response (200):**
```json
{
  "ok": true,
  "item": {
    "id": "abc123",
    "userId": "u_admin",
    "createdAt": "2026-05-20T21:06:00Z",
    "kind": "analysis",
    "title": "Positive, persuasive review",
    "input": "Original text...",
    "report": { /* full analysis */ },
    "meta": {}
  }
}
```

**Response (404):**
```json
{"error": "Not found"}
```

---

### DELETE /api/history/:id
Delete analysis record.

**Response (200):**
```json
{"ok": true}
```

**Response (404):**
```json
{"error": "Not found"}
```

---

## Export

### GET /api/export/:id
Export analysis in specified format.

**Query parameters:**
- `format` (string) — 'json' (default), 'md', or 'txt'

**Response (200) - JSON:**
```
Content-Type: application/json
Content-Disposition: attachment; filename="analysis-abc123.json"

(Full analysis JSON)
```

**Response (200) - Markdown:**
```
Content-Type: text/markdown; charset=utf-8
Content-Disposition: attachment; filename="analysis-abc123.md"

# Content Analysis Report

**Title:** Positive, persuasive review
**Created:** 2026-05-20T21:06:00Z

## Scores
- Sentiment: 67
- Readability: 72/100
...
```

**Response (200) - Text:**
```
Content-Type: text/plain; charset=utf-8
Content-Disposition: attachment; filename="analysis-abc123.txt"

(Formatted as JSON)
```

---

## Utilities

### GET /api/health
Health check and system status.

**Response (200):**
```json
{
  "ok": true,
  "status": "ready",
  "version": "1.0.0",
  "users": [
    {"username": "admin", "role": "admin"},
    {"username": "demo", "role": "demo"}
  ]
}
```

---

### GET /api/samples/:kind
Get sample text for testing.

**Parameters:**
- `kind` (string) — 'news', 'review', 'social', or 'academic'

**Response (200):**
```json
{
  "ok": true,
  "text": "Apple's new AI chip marks a significant leap..."
}
```

---

### GET /api/examples
Get all example texts.

**Response (200):**
```json
{
  "ok": true,
  "examples": {
    "news": "Apple's new AI chip...",
    "review": "I've been using these headphones...",
    "social": "Just got back from the most incredible trip...",
    "academic": "This study examines the correlation..."
  }
}
```

---

## Error Responses

**401 Unauthorized:**
```json
{"error": "Not authenticated"}
```

**401 Session Expired:**
```json
{"error": "Session expired or invalid"}
```

**429 Rate Limited:**
```
Status: 429
(After 120 requests/minute to /api/*)
```

**500 Server Error:**
```json
{
  "error": "Server error",
  "detail": "Error message details"
}
```

---

## Rate Limiting

- **Limit:** 120 requests per minute
- **Scope:** All `/api/*` endpoints
- **Window:** 60 seconds
- **Applied at:** Express middleware

---

**Last updated:** May 2026  
**Version:** 1.0.0
