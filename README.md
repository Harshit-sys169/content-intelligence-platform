# Content Intelligence Platform

Full-stack content analysis workspace. Sentiment, readability, objectivity, complexity, credibility, persuasion scoring.

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js)](https://nodejs.org/) [![Express](https://img.shields.io/badge/Express-4.21-000?style=flat-square&logo=express)](https://expressjs.com/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

## Features

- **6 scoring dimensions:** Sentiment, readability, objectivity, complexity, credibility, persuasion
- **Comparison mode:** Analyze two texts side-by-side
- **Rewrite mode:** Generate alternative text in different styles (professional, casual, academic, persuasive)
- **File import:** .txt, .md, .csv, .json support
- **Entity extraction:** Keywords, topics, sentiment entities, mentions
- **Persistent history:** Per-user analysis history
- **Export:** JSON, Markdown, plain text formats
- **Authentication:** Cookie-based with JWT tokens, rate limiting
- **Docker ready:** Included docker-compose setup

## Tech Stack

**Backend:** Node.js, Express, helmet security, JWT auth, cookie-parser, multer  
**Frontend:** Vanilla JavaScript, responsive CSS  
**Storage:** JSON file-based (no database required)  
**Security:** Rate limiting, helmet headers, CSRF protection, XSS escaping  

## Quick Start

```bash
git clone https://github.com/Harshit-sys169/content-intelligence-platform.git
cd content-intelligence-platform
npm install
cp .env.example .env
# Configure .env (change JWT_SECRET, credentials)
npm start
```

Open http://localhost:3000

**Demo credentials:**
- `admin` / `admin123`
- `demo` / `demo123`

## API Endpoints

### Authentication
- `POST /api/auth/login` — Login with username/password
- `POST /api/auth/logout` — Clear session
- `GET /api/auth/me` — Current user & settings

### Analysis
- `POST /api/analysis/analyze` — Analyze text (returns 6 scores + summary)
- `POST /api/analysis/compare` — Compare two texts
- `POST /api/analysis/rewrite` — Generate rewrite in specified style

### Data
- `POST /api/import` — Import file (.txt, .md, .csv, .json)
- `GET /api/history` — List user's analyses
- `GET /api/history/:id` — Get specific analysis
- `DELETE /api/history/:id` — Delete analysis
- `GET /api/export/:id?format=json|md|txt` — Export analysis

### Utilities
- `GET /api/health` — Service health check
- `GET /api/samples/:kind` — Get sample texts (news, review, social, academic)

## Scoring System

### Sentiment (-1 to +1)
Positive/negative word frequency, emotional language, sentiment entities.

### Readability (0-100)
Avg sentence length, syllables per word, vocabulary complexity.

### Objectivity (0-100)
Bias markers, hedging language, authority citations, balanced perspective.

### Complexity (0-100)
Vocabulary sophistication, sentence structure, technical terminology density.

### Credibility (0-100)
Citations, data references, expert mentions, money/dates/specificity markers.

### Persuasion (0-100)
Scarcity language, urgency markers, social proof, emotional appeals, CTAs.

## Docker

```bash
docker build -t content-intelligence-platform .
docker run -p 3000:3000 --env-file .env content-intelligence-platform
```

## Workflow

1. Login with demo/admin credentials
2. Paste text or import file
3. View scores, entity extraction, one-liner summary
4. Compare with other text or generate rewrite
5. Export analysis (JSON/Markdown/text)
6. View analysis history

## Architecture

- **lib/analyzer.js** — Analysis engine with scoring algorithms
- **lib/auth.js** — JWT & cookie authentication
- **lib/store.js** — Persistent JSON storage
- **server.js** — Express API routes
- **public/app.js** — Client-side logic
- **public/styles.css** — Responsive UI

## Environment Variables

```
PORT — Server port (default: 3000)
JWT_SECRET — Secret for token signing (required, min 32 chars)
ADMIN_USER — Admin username (default: admin)
ADMIN_PASSWORD — Admin password
DEMO_USER — Demo username (default: demo)
DEMO_PASSWORD — Demo password
COOKIE_SECURE — Use secure cookies in production (true/false)
```

## Development

```bash
# Syntax check
npm run check

# Development server (auto-restart on changes)
npm run dev
```

## Security Notes

- Change default credentials before deploying
- Set strong JWT_SECRET (32+ chars recommended)
- Enable COOKIE_SECURE=true for HTTPS
- Use rate limiting in production (currently 120 req/min)
- Analysis engine runs locally (no external API calls)

## Limitations & Future

**Current:**
- Local analysis only (no LLM integration yet)
- Single-server (file-based storage)
- Demo credentials shared

**Roadmap:**
- OpenAI/Claude integration for advanced rewrites
- PostgreSQL backend for multi-user
- Webhook exports
- Bulk analysis
- Custom scoring rules

## License

MIT — see [LICENSE](LICENSE)

## Support

For issues or questions: [GitHub Issues](https://github.com/Harshit-sys169/content-intelligence-platform/issues)

---

Built by [Harshit Saini](https://github.com/Harshit-sys169)
