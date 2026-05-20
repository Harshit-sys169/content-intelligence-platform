const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { analyzeText, compareReports, makeRewrite, parseComparables } = require('./lib/analyzer');
const { authenticate, issueToken, authCookieOptions, authMiddleware, verifyToken, getUsersFromEnv } = require('./lib/auth');
const { saveAnalysis, listAnalyses, getAnalysis, deleteAnalysis, saveSettings, getSettings, ensureStore } = require('./lib/store');

ensureStore();

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
const PORT = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/api/', rateLimit({ windowMs: 60 * 1000, max: 120 }));

app.use(express.static(path.join(__dirname, 'public')));

function getPublicUserFromReq(req) {
  return req.user ? { id: req.user.id, username: req.user.username, role: req.user.role, name: req.user.name } : null;
}

function sampleText(kind) {
  switch (kind) {
    case 'news':
      return `Apple's new AI chip marks a significant leap in on-device processing, executives said at Tuesday's event in Cupertino. The M4 Ultra processor delivers 38 trillion operations per second — the fastest chip Apple has ever built for consumer devices. Critics argue the $3,499 starting price remains prohibitive, and environmental advocates raised concerns about increased power consumption. CEO Tim Cook called it a historic moment in personal computing, while analysts noted the move widens Apple's lead over rivals in silicon performance.`;
    case 'review':
      return `I've been using these noise-cancelling headphones for three weeks and have genuinely mixed feelings. The sound quality is phenomenal — bass is tight, mids warm, highs never harsh even at volume. ANC works brilliantly on planes and busy cafes. However, Bluetooth has been frustratingly inconsistent, dropping at least twice daily. Build quality feels premium but ear cups get uncomfortably warm after 90 minutes. Battery life is impressive at 30 hours. At $350, I expected perfection, not near-perfection. Still recommend — but know what you're getting into.`;
    case 'social':
      return `Just got back from the most incredible trip to Kyoto 🇯🇵 Honestly changed my entire perspective on travel. The temples at dawn, the silence, the way light hits the bamboo forest — no filter does it justice. If you're thinking about going: stop thinking and just book it. Life is too short for someday. Had an amazing time with @tokyofoodguide's ramen rec — absolutely next level. Follow them for the best hidden gems in Japan! #travel #kyoto #japan`;
    case 'academic':
      return `This study examines the correlation between sleep deprivation and cognitive performance in university students (n=247). Using standardized psychometric assessments over a 12-week longitudinal design, we found a statistically significant negative correlation (r=−0.67, p<0.001) between average nightly sleep duration and executive function scores. These findings align with prior research (Walker, 2017; Tononi & Cirelli, 2014) while extending the literature by controlling for socioeconomic variables previously unexamined in this population. Limitations include self-reported sleep data and a predominantly Western sample.`;
    default:
      return '';
  }
}

function requireText(value) {
  return String(value || '').trim();
}

function saveAndRespond(req, res, report, meta = {}) {
  const saved = saveAnalysis({
    id: meta.id,
    userId: req.user.id,
    createdAt: new Date().toISOString(),
    kind: meta.kind || 'analysis',
    title: meta.title || report.one_liner,
    input: meta.input || '',
    report,
    meta
  });
  res.json({ ok: true, id: saved.id, report: saved.report, createdAt: saved.createdAt });
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    status: 'ready',
    version: '1.0.0',
    users: getUsersFromEnv().map((u) => ({ username: u.username, role: u.role }))
  });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const settings = getSettings(req.user.id);
  res.json({ ok: true, user: getPublicUserFromReq(req), settings });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = authenticate(username, password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const token = issueToken(user);
  res.cookie('auth_token', token, authCookieOptions());
  res.json({ ok: true, user });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('auth_token', { path: '/' });
  res.json({ ok: true });
});

app.get('/api/samples/:kind', authMiddleware, (req, res) => {
  const text = sampleText(req.params.kind);
  if (!text) return res.status(404).json({ error: 'Unknown sample' });
  res.json({ ok: true, text });
});

app.post('/api/import', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const name = req.file.originalname || 'file';
  const ext = path.extname(name).toLowerCase();
  const raw = req.file.buffer.toString('utf8');
  let text = raw;

  if (ext === '.json') {
    try {
      const parsed = JSON.parse(raw);
      text = JSON.stringify(parsed, null, 2);
    } catch {
      text = raw;
    }
  } else if (ext === '.csv') {
    text = raw
      .split(/\r?\n/g)
      .map((row) => row.replace(/,/g, ' | '))
      .join('\n');
  }

  res.json({
    ok: true,
    filename: name,
    text,
    chars: text.length,
    words: text.trim() ? text.trim().split(/\s+/).length : 0
  });
});

app.post('/api/analysis/analyze', authMiddleware, (req, res) => {
  const text = requireText(req.body?.text);
  if (text.length < 20) return res.status(400).json({ error: 'Provide at least 20 characters.' });
  const report = analyzeText(text, {
    mode: req.body?.mode || 'analyze',
    depth: req.body?.depth || 'detailed',
    domain: req.body?.domain || 'general',
    focus: req.body?.focus || 'balanced'
  });
  saveAndRespond(req, res, report, {
    kind: 'analysis',
    title: report.one_liner,
    input: text,
    mode: req.body?.mode || 'analyze'
  });
});

app.post('/api/analysis/compare', authMiddleware, (req, res) => {
  const leftText = requireText(req.body?.leftText);
  const rightText = requireText(req.body?.rightText);
  if (leftText.length < 20 || rightText.length < 20) {
    return res.status(400).json({ error: 'Both texts must be at least 20 characters.' });
  }
  const left = analyzeText(leftText, { mode: 'compare-left' });
  const right = analyzeText(rightText, { mode: 'compare-right' });
  const comparison = compareReports(left, right);
  saveAnalysis({
    userId: req.user.id,
    createdAt: new Date().toISOString(),
    kind: 'comparison',
    title: 'Document comparison',
    input: `${leftText}\n\n---COMPARE---\n\n${rightText}`,
    report: comparison
  });
  res.json({ ok: true, comparison });
});

app.post('/api/analysis/rewrite', authMiddleware, (req, res) => {
  const text = requireText(req.body?.text);
  if (text.length < 20) return res.status(400).json({ error: 'Provide some text to rewrite.' });
  const rewrite = makeRewrite(text, { rewriteMode: req.body?.rewriteMode || 'professional' });
  res.json({ ok: true, rewrite });
});

app.post('/api/settings', authMiddleware, (req, res) => {
  const settings = saveSettings(req.user.id, {
    theme: req.body?.theme,
    density: req.body?.density,
    lastPreset: req.body?.lastPreset
  });
  res.json({ ok: true, settings });
});

app.get('/api/history', authMiddleware, (req, res) => {
  const limit = Math.min(100, Number(req.query.limit || 20));
  res.json({ ok: true, items: listAnalyses(req.user.id, limit) });
});

app.get('/api/history/:id', authMiddleware, (req, res) => {
  const item = getAnalysis(req.params.id, req.user.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true, item });
});

app.delete('/api/history/:id', authMiddleware, (req, res) => {
  const ok = deleteAnalysis(req.params.id, req.user.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

app.get('/api/export/:id', authMiddleware, (req, res) => {
  const item = getAnalysis(req.params.id, req.user.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  const format = String(req.query.format || 'json').toLowerCase();
  const report = item.report;

  if (format === 'md') {
    const body = [
      `# Content Analysis Report`,
      ``,
      `**Title:** ${item.title || 'Untitled'}`,
      `**Created:** ${item.createdAt}`,
      `**Kind:** ${item.kind}`,
      ``,
      `## Scores`,
      `- Sentiment: ${report.scores?.sentiment}`,
      `- Readability: ${report.scores?.readability}/100`,
      `- Objectivity: ${report.scores?.objectivity}/100`,
      `- Complexity: ${report.scores?.complexity}/100`,
      `- Credibility: ${report.scores?.credibility}/100`,
      `- Persuasion: ${report.scores?.persuasion}/100`,
      ``,
      `## Summary`,
      report.summary || '',
      ``,
      `## Insight`,
      report.insight || '',
      ``,
      `## Recommendations`,
      ...(report.recommendations || []).map((r) => `- ${r}`)
    ].join('\n');
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="analysis-${item.id}.md"`);
    return res.send(body);
  }

  if (format === 'txt') {
    const body = JSON.stringify(report, null, 2);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="analysis-${item.id}.txt"`);
    return res.send(body);
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="analysis-${item.id}.json"`);
  res.send(JSON.stringify(item, null, 2));
});

app.get('/api/examples', authMiddleware, (_req, res) => {
  res.json({
    ok: true,
    examples: {
      news: sampleText('news'),
      review: sampleText('review'),
      social: sampleText('social'),
      academic: sampleText('academic')
    }
  });
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error', detail: String(err.message || err) });
});

app.listen(PORT, () => {
  console.log(`Content Intelligence Platform running on http://localhost:${PORT}`);
});