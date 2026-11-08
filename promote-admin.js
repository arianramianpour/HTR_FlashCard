require('dotenv').config();
const mysql = require('mysql2/promise');
(async () => {
  const email = process.argv[2];
  if (!email) throw Error('Usage: node promote-admin.js email@example.com');
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'flashcards',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'flashcards',
  });
  const [result] = await db.query('UPDATE users SET role=? WHERE email=?', [
    'admin',
    email.toLowerCase(),
  ]);
  await db.end();
  if (!result.affectedRows) throw Error('Account not found. Register first.');
  console.log('Account promoted to admin.');
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
