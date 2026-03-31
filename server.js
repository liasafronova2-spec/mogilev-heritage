const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'mogilev-secret-key-2026';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

const db = new sqlite3.Database('./database.sqlite');

function logActivity(userId, action, details) {
    db.run("INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)",
        [userId, action, details], (err) => {
            if (err) console.error('Ошибка логирования:', err.message);
        });
}

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        is_admin INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS places (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        address TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        year TEXT,
        description TEXT,
        full_history TEXT,
        old_image TEXT,
        new_image TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        place_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        parent_id INTEGER,
        text TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        edited BOOLEAN DEFAULT 0,
        edited_at DATETIME,
        FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES reviews(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )`);
});

bcrypt.hash('admin2026', 10, (err, hash) => {
    if (!err) {
        db.run("INSERT OR IGNORE INTO users (email, password, name, is_admin) VALUES (?, ?, ?, 1)",
            ['admin@mogilev.by', hash, 'Администратор']);
    }
});

// Добавление тестовых мест
db.get("SELECT COUNT(*) as count FROM places", (err, row) => {
    if (!err && row && row.count === 0) {
        const places = [
            ['Ратуша Могилева', 'monument', 'ул. Ленинская, 1А', 53.8945, 30.3310, '1679-1681',
             'Символ магдебургского права, жемчужина архитектуры XVII века.',
             'Могилевская ратуша построена в 1679-1681 годах...',
             'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Mogilev_Ratusha_1918.jpg/800px-Mogilev_Ratusha_1918.jpg',
             'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Mogilev_Ratusha_2020.jpg/800px-Mogilev_Ratusha_2020.jpg'],
            ['Собор Трех Святителей', 'monument', 'ул. Первомайская, 75', 53.9002, 30.3325, '1903-1914',
             'Уникальный храм в неорусском стиле.',
             'Строительство собора началось в 1903 году...',
             'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Mogilev_Three_Saints_Cathedral_old.jpg/800px-Mogilev_Three_Saints_Cathedral_old.jpg',
             'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Mogilev_Three_Saints_Cathedral.jpg/800px-Mogilev_Three_Saints_Cathedral.jpg'],
            ['Архиерейский дворец', 'monument', 'ул. Комсомольская, 4', 53.8967, 30.3292, '1780',
             'Бывшая резиденция архиепископа.',
             'Дворец построен в 1780 году для Екатерины II...',
             'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Mogilev_Bishop_Palace_old.jpg/800px-Mogilev_Bishop_Palace_old.jpg',
             'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Mogilev_Bishop_Palace.jpg/800px-Mogilev_Bishop_Palace.jpg'],
            ['Памятник Звездочету', 'monument', 'ул. Ленинская, 22', 53.8938, 30.3330, '2003',
             'Современный символ Могилева.',
             'Памятник установлен в 2003 году...',
             'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect width="400" height="300" fill="%238b7355"/%3E%3Ctext x="200" y="150" fill="white" text-anchor="middle"%3EЛенинская улица%3C/text%3E%3C/svg%3E',
             'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Mogilev_Astrologer.jpg/800px-Mogilev_Astrologer.jpg'],
            ['Николаевский монастырь', 'monument', 'ул. Болдина, 5', 53.8985, 30.3278, '1669',
             'Древний монастырский комплекс.',
             'Монастырь основан в 1669 году...',
             'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Mogilev_St_Nicholas_Monastery_old.jpg/800px-Mogilev_St_Nicholas_Monastery_old.jpg',
             'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Mogilev_St_Nicholas_Monastery.jpg/800px-Mogilev_St_Nicholas_Monastery.jpg'],
            ['Ленинская улица', 'street', 'ул. Ленинская', 53.8940, 30.3320, 'XVI век',
             'Главная пешеходная улица города...',
             'Бывшая Замковая улица...',
             'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect width="400" height="300" fill="%238b7355"/%3E%3Ctext x="200" y="150" fill="white" text-anchor="middle"%3EЛенинская улица%3C/text%3E%3C/svg%3E',
             'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Mogilev_Astrologer.jpg/800px-Mogilev_Astrologer.jpg'],
            ['Первомайская улица', 'street', 'ул. Первомайская', 53.8995, 30.3330, 'XIX век',
             'Одна из старейших улиц...',
             'Проходит через исторический центр...',
             'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect width="400" height="300" fill="%238b7355"/%3E%3Ctext x="200" y="150" fill="white" text-anchor="middle"%3EПервомайская улица%3C/text%3E%3C/svg%3E',
             'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Mogilev_Three_Saints_Cathedral.jpg/800px-Mogilev_Three_Saints_Cathedral.jpg']
        ];
        const stmt = db.prepare("INSERT INTO places (name, category, address, lat, lng, year, description, full_history, old_image, new_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        places.forEach(p => stmt.run(p));
        stmt.finalize();
    }
});

// ============ API ============

app.post('/api/register', async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Заполните все поля' });
    try {
        const hash = await bcrypt.hash(password, 10);
        db.run("INSERT INTO users (email, password, name) VALUES (?, ?, ?)", [email, hash, name], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Email уже зарегистрирован' });
                return res.status(500).json({ error: 'Ошибка сервера' });
            }
            const token = jwt.sign({ id: this.lastID, email, name, is_admin: 0 }, JWT_SECRET, { expiresIn: '7d' });
            logActivity(this.lastID, 'REGISTER', `Новый пользователь: ${name} (${email})`);
            res.json({ token, user: { id: this.lastID, email, name, is_admin: 0 } });
        });
    } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Заполните все поля' });
    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'Неверный email или пароль' });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(400).json({ error: 'Неверный email или пароль' });
        const token = jwt.sign({ id: user.id, email: user.email, name: user.name, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
        logActivity(user.id, 'LOGIN', `Вход в систему`);
        res.json({ token, user: { id: user.id, email: user.email, name: user.name, is_admin: user.is_admin } });
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

app.get('/api/places', (req, res) => {
    db.all("SELECT * FROM places ORDER BY id", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const places = rows.map(p => ({ ...p, coords: [p.lat, p.lng] }));
        res.json(places);
    });
});

app.get('/api/reviews', (req, res) => {
    db.all(`
        SELECT r.*, u.name as user_name, u.email as user_email
        FROM reviews r
        JOIN users u ON r.user_id = u.id
        ORDER BY r.created_at DESC
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/reviews', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Требуется авторизация' });
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Неверный токен' });
        const { place_id, text, parent_id } = req.body;
        if (!place_id || !text) return res.status(400).json({ error: 'Заполните все поля' });
        db.run("INSERT INTO reviews (place_id, user_id, text, parent_id) VALUES (?, ?, ?, ?)",
            [place_id, user.id, text, parent_id || null], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                logActivity(user.id, 'ADD_REVIEW', `Добавлен отзыв к месту #${place_id}`);
                res.json({ id: this.lastID, message: 'Отзыв добавлен' });
            });
    });
});

app.put('/api/reviews/:id', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Требуется авторизация' });
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Неверный токен' });
        const reviewId = req.params.id;
        const { text } = req.body;
        db.get("SELECT * FROM reviews WHERE id = ?", [reviewId], (err, review) => {
            if (err || !review) return res.status(404).json({ error: 'Отзыв не найден' });
            if (review.user_id !== user.id && user.is_admin !== 1) return res.status(403).json({ error: 'Нет прав' });
            db.run("UPDATE reviews SET text = ?, edited = 1, edited_at = CURRENT_TIMESTAMP WHERE id = ?",
                [text, reviewId], function(err) {
                    if (err) return res.status(500).json({ error: err.message });
                    logActivity(user.id, 'EDIT_REVIEW', `Отредактирован отзыв #${reviewId}`);
                    res.json({ message: 'Отзыв обновлен' });
                });
        });
    });
});

app.delete('/api/reviews/:id', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Требуется авторизация' });
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Неверный токен' });
        const reviewId = req.params.id;
        db.get("SELECT * FROM reviews WHERE id = ?", [reviewId], (err, review) => {
            if (err || !review) return res.status(404).json({ error: 'Отзыв не найден' });
            if (review.user_id !== user.id && user.is_admin !== 1) return res.status(403).json({ error: 'Нет прав' });
            db.run("DELETE FROM reviews WHERE id = ?", [reviewId], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                logActivity(user.id, 'DELETE_REVIEW', `Удален отзыв #${reviewId}`);
                res.json({ message: 'Отзыв удален' });
            });
        });
    });
});

app.post('/api/admin/places', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Требуется авторизация' });
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Неверный токен' });
        if (user.is_admin !== 1) return res.status(403).json({ error: 'Требуются права администратора' });
        const { name, category, address, lat, lng, year, description, full_history, old_image, new_image } = req.body;
        if (!name || !address || lat === undefined || lng === undefined) return res.status(400).json({ error: 'Заполните название, адрес и координаты' });
        db.run(`INSERT INTO places (name, category, address, lat, lng, year, description, full_history, old_image, new_image)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, category, address, lat, lng, year || '', description || '', full_history || '', old_image || '', new_image || ''],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });
                logActivity(user.id, 'ADD_PLACE', `Добавлено место: ${name}`);
                res.json({ id: this.lastID, message: 'Место добавлено' });
            });
    });
});

app.put('/api/admin/places/:id', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Требуется авторизация' });
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Неверный токен' });
        if (user.is_admin !== 1) return res.status(403).json({ error: 'Требуются права администратора' });
        const placeId = req.params.id;
        const { name, category, address, lat, lng, year, description, full_history, old_image, new_image } = req.body;
        if (!name || !address || lat === undefined || lng === undefined) return res.status(400).json({ error: 'Заполните название, адрес и координаты' });
        
        let sql = `UPDATE places SET name = ?, category = ?, address = ?, lat = ?, lng = ?, year = ?, description = ?, full_history = ?, updated_at = CURRENT_TIMESTAMP`;
        const params = [name, category, address, lat, lng, year, description, full_history];
        
        if (old_image && old_image !== '') {
            sql += `, old_image = ?`;
            params.push(old_image);
        }
        if (new_image && new_image !== '') {
            sql += `, new_image = ?`;
            params.push(new_image);
        }
        sql += ` WHERE id = ?`;
        params.push(placeId);
        
        db.run(sql, params, function(err) {
            if (err) return res.status(500).json({ error: err.message });
            logActivity(user.id, 'EDIT_PLACE', `Обновлено место: ${name} (ID: ${placeId})`);
            res.json({ message: 'Место обновлено' });
        });
    });
});

app.delete('/api/admin/places/:id', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Требуется авторизация' });
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Неверный токен' });
        if (user.is_admin !== 1) return res.status(403).json({ error: 'Требуются права администратора' });
        db.get("SELECT name FROM places WHERE id = ?", [req.params.id], (err, place) => {
            if (place) logActivity(user.id, 'DELETE_PLACE', `Удалено место: ${place.name} (ID: ${req.params.id})`);
            db.run("DELETE FROM places WHERE id = ?", [req.params.id], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Место удалено' });
            });
        });
    });
});

app.get('/api/admin/logs', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Требуется авторизация' });
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Неверный токен' });
        if (user.is_admin !== 1) return res.status(403).json({ error: 'Доступ запрещен' });
        db.all(`
            SELECT l.*, u.name as user_name 
            FROM activity_logs l
            LEFT JOIN users u ON l.user_id = u.id
            ORDER BY l.created_at DESC
            LIMIT 200
        `, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });
});

app.get('/api/admin/stats', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Требуется авторизация' });
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Неверный токен' });
        if (user.is_admin !== 1) return res.status(403).json({ error: 'Доступ запрещен' });
        db.get("SELECT COUNT(*) as users FROM users", [], (err, users) => {
            db.get("SELECT COUNT(*) as places FROM places", [], (err, places) => {
                db.get("SELECT COUNT(*) as reviews FROM reviews", [], (err, reviews) => {
                    db.get("SELECT COUNT(*) as logs FROM activity_logs", [], (err, logs) => {
                        res.json({
                            users: users?.users || 0,
                            places: places?.places || 0,
                            reviews: reviews?.reviews || 0,
                            logs: logs?.logs || 0
                        });
                    });
                });
            });
        });
    });
});

app.post('/api/logout', (req, res) => {
    res.json({ message: 'Выход выполнен' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Сервер запущен!`);
    console.log(`📱 Локально: http://localhost:${PORT}`);
    console.log(`🔑 Админ: admin@mogilev.by / admin2026`);
    console.log(`📸 Поддержка base64 изображений включена`);
    console.log(`✏️ Редактирование мест доступно\n`);
});
