require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const app = express();
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'flashcards',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'flashcards',
  charset: 'utf8mb4',
  connectionLimit: 10,
});
const hash = (v) => crypto.createHash('sha256').update(v).digest('hex');
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const fail = (status, message) =>
  Object.assign(new Error(message), {
    status,
  });
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const id = (v) => {
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n < 1) throw fail(400, 'Invalid ID');
  return n;
};
const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  language: u.language,
  points: u.points,
});
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
      },
    },
  }),
);
app.use(
  express.json({
    limit: '1mb',
  }),
);
app.use(cookieParser());
// Reject cross-origin write requests before processing API routes.
app.use('/api', (req, res, next) => {
  if (!['GET', 'HEAD'].includes(req.method) && req.get('origin')) {
    try {
      if (new URL(req.get('origin')).host !== req.get('host')) throw Error();
    } catch {
      return res.status(403).json({
        error: 'Invalid origin',
      });
    }
  }
  next();
});
// Look up the signed-in user using a hash of the opaque session token.
app.use(
  '/api',
  wrap(async (req, res, next) => {
    if (req.cookies.session) {
      const [rows] = await db.query(
        'SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>NOW()',
        [hash(req.cookies.session)],
      );
      req.user = rows[0];
    }
    next();
  }),
);
const auth = (req, res, next) =>
  req.user
    ? next()
    : res.status(401).json({
        error: 'Please sign in',
      });
const staff = (req, res, next) =>
  ['admin', 'teacher'].includes(req.user.role)
    ? next()
    : res.status(403).json({
        error: 'Not allowed',
      });
const admin = (req, res, next) =>
  req.user.role === 'admin'
    ? next()
    : res.status(403).json({
        error: 'Not allowed',
      });
async function session(res, user) {
  const token = crypto.randomBytes(32).toString('hex');
  await db.query('INSERT INTO sessions VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))', [
    hash(token),
    user.id,
  ]);
  res.cookie('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: 30 * 86400000,
  });
}
app.post(
  '/api/register',
  wrap(async (req, res) => {
    const name = str(req.body.name, 100),
      email = str(req.body.email, 255).toLowerCase(),
      password = req.body.password;
    if (
      !name ||
      !/^\S+@\S+\.\S+$/.test(email) ||
      typeof password !== 'string' ||
      password.length < 8 ||
      password.length > 72
    )
      throw fail(400, 'Enter a name, valid email and password of 8–72 characters');
    try {
      const [r] = await db.query('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)', [
        name,
        email,
        await bcrypt.hash(password, 12),
      ]);
      const user = {
        id: r.insertId,
        name,
        email,
        role: 'student',
        language: 'en',
        points: 0,
      };
      await session(res, user);
      res.json(user);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') throw fail(409, 'Email already registered');
      throw e;
    }
  }),
);
app.post(
  '/api/login',
  wrap(async (req, res) => {
    const [rows] = await db.query('SELECT * FROM users WHERE email=?', [
      str(req.body.email, 255).toLowerCase(),
    ]);
    const u = rows[0];
    if (
      !u ||
      typeof req.body.password !== 'string' ||
      !(await bcrypt.compare(req.body.password, u.password_hash))
    )
      throw fail(401, 'Invalid email or password');
    await session(res, u);
    res.json(publicUser(u));
  }),
);
app.post(
  '/api/logout',
  auth,
  wrap(async (req, res) => {
    await db.query('DELETE FROM sessions WHERE token_hash=?', [hash(req.cookies.session)]);
    res.clearCookie('session');
    res.json({
      ok: true,
    });
  }),
);
app.get('/api/me', auth, (req, res) => res.json(publicUser(req.user)));
app.patch(
  '/api/me',
  auth,
  wrap(async (req, res) => {
    if (!['en', 'fa', 'ko'].includes(req.body.language)) throw fail(400, 'Invalid language');
    await db.query('UPDATE users SET language=? WHERE id=?', [req.body.language, req.user.id]);
    res.json({
      ok: true,
    });
  }),
);
app.get(
  '/api/users',
  auth,
  admin,
  wrap(async (req, res) => {
    const [rows] = await db.query('SELECT id,name,email,role FROM users ORDER BY id');
    res.json(rows);
  }),
);
app.patch(
  '/api/users/:id',
  auth,
  admin,
  wrap(async (req, res) => {
    const uid = id(req.params.id),
      role = req.body.role;
    if (!['admin', 'teacher', 'student'].includes(role) || uid === req.user.id)
      throw fail(400, 'Invalid role change');
    const [r] = await db.query('UPDATE users SET role=? WHERE id=?', [role, uid]);
    if (!r.affectedRows) throw fail(404, 'User not found');
    res.json({
      ok: true,
    });
  }),
);
app.get(
  '/api/folders',
  auth,
  wrap(async (req, res) => {
    const [rows] = await db.query(
      'SELECT f.id,f.name,COUNT(c.id) card_count,COALESCE(SUM(c.important),0) important_count FROM folders f LEFT JOIN cards c ON c.folder_id=f.id WHERE f.user_id=? GROUP BY f.id ORDER BY f.id DESC',
      [req.user.id],
    );
    res.json(rows);
  }),
);
app.post(
  '/api/folders',
  auth,
  wrap(async (req, res) => {
    const name = str(req.body.name, 120);
    if (!name) throw fail(400, 'Folder name required');
    const [r] = await db.query('INSERT INTO folders (user_id,name) VALUES (?,?)', [
      req.user.id,
      name,
    ]);
    res.json({
      id: r.insertId,
      name,
    });
  }),
);
// All personal folder operations must check ownership. The optional lock
// serializes changes that need to enforce the 300-card limit.
async function ownFolder(uid, fid, conn = db, lock = false) {
  const [rows] = await conn.query(
    'SELECT * FROM folders WHERE id=? AND user_id=?' + (lock ? ' FOR UPDATE' : ''),
    [id(fid), uid],
  );
  if (!rows.length) throw fail(404, 'Folder not found');
  return rows[0];
}
app.delete(
  '/api/folders/:id',
  auth,
  wrap(async (req, res) => {
    await ownFolder(req.user.id, req.params.id);
    await db.query('DELETE FROM folders WHERE id=?', [id(req.params.id)]);
    res.json({
      ok: true,
    });
  }),
);
app.get(
  '/api/folders/:id/cards',
  auth,
  wrap(async (req, res) => {
    await ownFolder(req.user.id, req.params.id);
    const [rows] = await db.query('SELECT * FROM cards WHERE folder_id=? ORDER BY id', [
      id(req.params.id),
    ]);
    res.json(rows);
  }),
);

function cleanCards(items) {
  if (!Array.isArray(items) || !items.length || items.length > 300)
    throw fail(400, 'Provide 1 to 300 cards');
  return items.map((c) => {
    const word = str(c.word, 1000),
      meaning = str(c.meaning, 1000),
      example = str(c.example, 2000);
    if (!word || !meaning) throw fail(400, 'Every card needs a word and meaning');
    return {
      word,
      meaning,
      example,
    };
  });
}
app.post(
  '/api/folders/:id/cards',
  auth,
  wrap(async (req, res) => {
    const cards = cleanCards(req.body.cards),
      conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await ownFolder(req.user.id, req.params.id, conn, true);
      const [[count]] = await conn.query('SELECT COUNT(*) n FROM cards WHERE folder_id=?', [
        id(req.params.id),
      ]);
      if (count.n + cards.length > 300) throw fail(400, 'A folder can contain at most 300 cards');
      await conn.query('INSERT INTO cards (folder_id,word,meaning,example) VALUES ?', [
        cards.map((c) => [id(req.params.id), c.word, c.meaning, c.example]),
      ]);
      await conn.commit();
      res.json({
        added: cards.length,
      });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }),
);
app.patch(
  '/api/cards/:id',
  auth,
  wrap(async (req, res) => {
    const cid = id(req.params.id);
    const [rows] = await db.query(
      'SELECT c.id FROM cards c JOIN folders f ON f.id=c.folder_id WHERE c.id=? AND f.user_id=?',
      [cid, req.user.id],
    );
    if (!rows.length) throw fail(404, 'Card not found');
    if (typeof req.body.important === 'boolean')
      await db.query('UPDATE cards SET important=? WHERE id=?', [req.body.important, cid]);
    else {
      const [c] = cleanCards([req.body]);
      await db.query('UPDATE cards SET word=?,meaning=?,example=? WHERE id=?', [
        c.word,
        c.meaning,
        c.example,
        cid,
      ]);
    }
    res.json({
      ok: true,
    });
  }),
);
app.delete(
  '/api/cards/:id',
  auth,
  wrap(async (req, res) => {
    const [r] = await db.query(
      'DELETE c FROM cards c JOIN folders f ON f.id=c.folder_id WHERE c.id=? AND f.user_id=?',
      [id(req.params.id), req.user.id],
    );
    if (!r.affectedRows) throw fail(404, 'Card not found');
    res.json({
      ok: true,
    });
  }),
);
app.get(
  '/api/templates',
  auth,
  wrap(async (req, res) => {
    const [rows] = await db.query(
      'SELECT t.id,t.creator_id,t.title,t.description,u.name creator,COUNT(c.id) card_count FROM templates t JOIN users u ON u.id=t.creator_id LEFT JOIN template_cards c ON c.template_id=t.id GROUP BY t.id ORDER BY t.id DESC',
    );
    res.json(rows);
  }),
);
app.post(
  '/api/templates',
  auth,
  staff,
  wrap(async (req, res) => {
    const title = str(req.body.title, 120),
      description = str(req.body.description, 500),
      fid = id(req.body.folderId);
    if (!title) throw fail(400, 'Template title required');
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await ownFolder(req.user.id, fid, conn, true);
      const [cards] = await conn.query('SELECT word,meaning,example FROM cards WHERE folder_id=?', [
        fid,
      ]);
      if (!cards.length) throw fail(400, 'Folder is empty');
      const [r] = await conn.query(
        'INSERT INTO templates (creator_id,title,description) VALUES (?,?,?)',
        [req.user.id, title, description],
      );
      await conn.query('INSERT INTO template_cards (template_id,word,meaning,example) VALUES ?', [
        cards.map((c) => [r.insertId, c.word, c.meaning, c.example]),
      ]);
      await conn.commit();
      res.json({
        id: r.insertId,
      });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }),
);
app.delete(
  '/api/templates/:id',
  auth,
  staff,
  wrap(async (req, res) => {
    const [r] = await db.query(
      'DELETE FROM templates WHERE id=?' + (req.user.role === 'admin' ? '' : ' AND creator_id=?'),
      req.user.role === 'admin' ? [id(req.params.id)] : [id(req.params.id), req.user.id],
    );
    if (!r.affectedRows) throw fail(404, 'Template not found');
    res.json({
      ok: true,
    });
  }),
);
app.post(
  '/api/templates/:id/copy',
  auth,
  wrap(async (req, res) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [templates] = await conn.query('SELECT * FROM templates WHERE id=?', [
        id(req.params.id),
      ]);
      if (!templates.length) throw fail(404, 'Template not found');
      const [cards] = await conn.query(
        'SELECT word,meaning,example FROM template_cards WHERE template_id=?',
        [id(req.params.id)],
      );
      if (cards.length > 300) throw fail(400, 'Template is too large');
      const [r] = await conn.query('INSERT INTO folders (user_id,name) VALUES (?,?)', [
        req.user.id,
        templates[0].title,
      ]);
      if (cards.length)
        await conn.query('INSERT INTO cards (folder_id,word,meaning,example) VALUES ?', [
          cards.map((c) => [r.insertId, c.word, c.meaning, c.example]),
        ]);
      await conn.commit();
      res.json({
        id: r.insertId,
      });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }),
);
// Record card statistics, session totals, and points in one transaction.
app.post(
  '/api/study',
  auth,
  wrap(async (req, res) => {
    const fid = id(req.body.folderId),
      results = req.body.results;
    if (!Array.isArray(results) || !results.length || results.length > 300)
      throw fail(400, 'Invalid results');
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await ownFolder(req.user.id, fid, conn, true);
      let correct = 0,
        incorrect = 0;
      const seen = new Set();
      for (const item of results) {
        const cid = id(item.id);
        if (
          seen.has(cid) ||
          !Number.isInteger(item.correct) ||
          !Number.isInteger(item.incorrect) ||
          item.correct < 0 ||
          item.incorrect < 0 ||
          item.correct + item.incorrect > 1000
        )
          throw fail(400, 'Invalid results');
        seen.add(cid);
        const [r] = await conn.query(
          'UPDATE cards SET correct_count=correct_count+?,incorrect_count=incorrect_count+?,last_reviewed=NOW() WHERE id=? AND folder_id=?',
          [item.correct, item.incorrect, cid, fid],
        );
        if (!r.affectedRows) throw fail(400, 'Invalid card');
        correct += item.correct;
        incorrect += item.incorrect;
      }
      const points = correct + 5;
      await conn.query('UPDATE users SET points=points+? WHERE id=?', [points, req.user.id]);
      await conn.query(
        'INSERT INTO study_sessions (user_id,folder_id,correct_count,incorrect_count,points) VALUES (?,?,?,?,?)',
        [req.user.id, fid, correct, incorrect, points],
      );
      await conn.commit();
      res.json({
        points,
        correct,
        incorrect,
      });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }),
);
app.use(express.static('public'));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.status ? err.message : 'Something went wrong',
  });
});
if (require.main === module)
  app.listen(Number(process.env.PORT || 3000), () =>
    console.log(`Little Cards running on port ${process.env.PORT || 3000}`),
  );
module.exports = {
  app,
  db,
};
