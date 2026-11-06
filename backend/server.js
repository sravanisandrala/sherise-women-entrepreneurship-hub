require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { createClient } = require('@supabase/supabase-js');
const routes = require('./routes');

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key] || process.env[key].startsWith('YOUR_') || process.env[key].startsWith('REPLACE_'));
if (missing.length) {
  console.error(`Missing or placeholder environment values: ${missing.join(', ')}. Edit backend/.env.`);
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must contain at least 32 characters.');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], scriptSrc: ["'self'"], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"] } } }));
app.use(express.json({ limit: '30kb' }));
app.use(cookieParser());
app.use((req, res, next) => {
  if (['POST','PUT','PATCH','DELETE'].includes(req.method) && req.headers.origin) {
    const expected = `${req.protocol}://${req.get('host')}`;
    if (req.headers.origin !== expected) return res.status(403).json({ error: 'Request origin not allowed.' });
  }
  next();
});
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'SheRise API' }));
app.use('/api', routes({ supabase }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));
app.use((err, _req, res, _next) => {
  console.error('Request failed:', err.message);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong. Please try again.' });
});
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`SheRise is running at http://localhost:${port}`));
