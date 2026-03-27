const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'secret';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const db = new sqlite3.Database('./database.sqlite');

db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT,
    is_admin INTEGER DEFAULT 0
)`);

db.run(`CREATE TABLE IF NOT EXISTS places (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    category TEXT,
    address TEXT,
    lat REAL,
    lng REAL,
    year TEXT,
    description TEXT,
    full_history TEXT,
    old_image TEXT,
    new_image TEXT
)`);

bcrypt.hash('admin2026', 10, (err, hash) => {
    db.run("INSERT OR IGNORE INTO users (email, password, name, is_admin) VALUES (?, ?, ?, 1)", 
        ['admin@mogilev.by', hash, 'Администратор']);
});

db.get("SELECT COUNT(*) as count FROM places", (err, row) => {
    if (row.count === 0) {
        db.run(`INSERT INTO places (name, category, address, lat, lng, year, description, full_history, old_image, new_image) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['Ратуша Могилева', 'monument', 'ул. Ленинская, 1А', 53.8945, 30.3310, '1679-1681',
             'Символ города', 'Могилевская ратуша построена в 1679-1681 годах',
             'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Mogilev_Ratusha_1918.jpg/800px-Mogilev_Ratusha_1918.jpg',
             'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Mogilev_Ratusha_2020.jpg/800px-Mogilev_Ratusha_2020.jpg']);
    }
});

app.post('/api/register', async (req, res) => {
    const { email, password, name } = req.body;
    const hash = await bcrypt.hash(password, 10);
    db.run("INSERT INTO users (email, password, name) VALUES (?, ?, ?)", [email, hash, name], function(err) {
        if (err) return res.status(400).json({ error: 'Email уже существует' });
        const token = jwt.sign({ id: this.lastID, email, name, is_admin: 0 }, JWT_SECRET);
        res.json({ token, user: { id: this.lastID, email, name, is_admin: 0 } });
    });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
        if (!user) return res.status(400).json({ error: 'Неверные данные' });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(400).json({ error: 'Неверные данные' });
        const token = jwt.sign({ id: user.id, email: user.email, name: user.name, is_admin: user.is_admin }, JWT_SECRET);
        res.json({ token, user });
    });
});

app.get('/api/places', (req, res) => {
    db.all("SELECT * FROM places", [], (err, rows) => {
        res.json(rows.map(p => ({ ...p, coords: [p.lat, p.lng] })));
    });
});

app.get('/api/me', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Нет токена' });
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Неверный токен' });
        res.json({ user });
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Админ: admin@mogilev.by / admin2026`);
});
