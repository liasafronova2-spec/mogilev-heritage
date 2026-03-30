const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'mogilev-secret-key-2026';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// База данных
const db = new sqlite3.Database('./database.sqlite');

// Создание таблиц
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
        new_image TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        place_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        parent_id INTEGER,
        text TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        edited BOOLEAN DEFAULT 0,
        FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
});

// Создание администратора
bcrypt.hash('admin2026', 10, (err, hash) => {
    if (!err) {
        db.run("INSERT OR IGNORE INTO users (email, password, name, is_admin) VALUES (?, ?, ?, 1)",
            ['admin@mogilev.by', hash, 'Администратор']);
        console.log('✅ Админ создан');
    }
});

// Добавление тестовых мест
db.get("SELECT COUNT(*) as count FROM places", (err, row) => {
    if (!err && row && row.count === 0) {
        const places = [
            ['Ратуша Могилева', 'monument', 'ул. Ленинская, 1А', 53.8945, 30.3310, '1679-1681',
             'Символ магдебургского права', 'Могилевская ратуша построена в 1679-1681 годах...',
             'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Mogilev_Ratusha_1918.jpg/800px-Mogilev_Ratusha_1918.jpg',
             'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Mogilev_Ratusha_2020.jpg/800px-Mogilev_Ratusha_2020.jpg'],
            ['Собор Трех Святителей', 'monument', 'ул. Первомайская, 75', 53.9002, 30.3325, '1903-1914',
             'Уникальный храм', 'Строительство собора началось в 1903 году...',
             'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Mogilev_Three_Saints_Cathedral_old.jpg/800px-Mogilev_Three_Saints_Cathedral_old.jpg',
             'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Mogilev_Three_Saints_Cathedral.jpg/800px-Mogilev_Three_Saints_Cathedral.jpg']
        ];
        const stmt = db.prepare("INSERT INTO places (name, category, address, lat, lng, year, description, full_history, old_image, new_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        places.forEach(p => stmt.run(p));
        stmt.finalize();
    }
});

// ============ API ============

// Регистрация
app.post('/api/register', (req, res) => {
    const { email, password, name } = req.body;
    console.log('📝 Регистрация:', { email, name });
    
    if (!email || !password || !name) {
        return res.status(400).json({ error: 'Заполните все поля' });
    }
    
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка сервера' });
        }
        
        db.run("INSERT INTO users (email, password, name) VALUES (?, ?, ?)",
            [email, hash, name],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(400).json({ error: 'Email уже зарегистрирован' });
                    }
                    return res.status(500).json({ error: 'Ошибка сервера' });
                }
                
                const token = jwt.sign(
                    { id: this.lastID, email, name, is_admin: 0 },
                    JWT_SECRET,
                    { expiresIn: '7d' }
                );
                
                res.json({
                    token,
                    user: { id: this.lastID, email, name, is_admin: 0 }
                });
            }
        );
    });
});

// Вход
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    console.log('🔑 Вход:', { email });
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Заполните все поля' });
    }
    
    db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
        if (err || !user) {
            return res.status(400).json({ error: 'Неверный email или пароль' });
        }
        
        bcrypt.compare(password, user.password, (err, valid) => {
            if (err || !valid) {
                return res.status(400).json({ error: 'Неверный email или пароль' });
            }
            
            const token = jwt.sign(
                { id: user.id, email: user.email, name: user.name, is_admin: user.is_admin },
                JWT_SECRET,
                { expiresIn: '7d' }
            );
            
            res.json({
                token,
                user: { id: user.id, email: user.email, name: user.name, is_admin: user.is_admin }
            });
        });
    });
});

// Получить текущего пользователя
app.get('/api/me', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Нет токена' });
    }
    
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Неверный токен' });
        }
        res.json({ user });
    });
});

// Получить все места
app.get('/api/places', (req, res) => {
    db.all("SELECT * FROM places ORDER BY id", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows.map(p => ({ ...p, coords: [p.lat, p.lng] })));
    });
});

// Получить отзывы
app.get('/api/reviews', (req, res) => {
    db.all(`
        SELECT r.*, u.name as user_name
        FROM reviews r
        JOIN users u ON r.user_id = u.id
        ORDER BY r.created_at DESC
    `, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Добавить отзыв
app.post('/api/reviews', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Неверный токен' });
        }
        
        const { place_id, text, parent_id } = req.body;
        if (!place_id || !text) {
            return res.status(400).json({ error: 'Заполните все поля' });
        }
        
        db.run("INSERT INTO reviews (place_id, user_id, text, parent_id) VALUES (?, ?, ?, ?)",
            [place_id, user.id, text, parent_id || null],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                res.json({ id: this.lastID, message: 'Отзыв добавлен' });
            }
        );
    });
});

// Редактировать отзыв
app.put('/api/reviews/:id', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Неверный токен' });
        }
        
        const reviewId = req.params.id;
        const { text } = req.body;
        
        db.get("SELECT * FROM reviews WHERE id = ?", [reviewId], (err, review) => {
            if (err || !review) {
                return res.status(404).json({ error: 'Отзыв не найден' });
            }
            if (review.user_id !== user.id && user.is_admin !== 1) {
                return res.status(403).json({ error: 'Нет прав' });
            }
            
            db.run("UPDATE reviews SET text = ?, edited = 1 WHERE id = ?",
                [text, reviewId], function(err) {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    res.json({ message: 'Отзыв обновлен' });
                }
            );
        });
    });
});

// Удалить отзыв
app.delete('/api/reviews/:id', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Неверный токен' });
        }
        
        const reviewId = req.params.id;
        
        db.get("SELECT * FROM reviews WHERE id = ?", [reviewId], (err, review) => {
            if (err || !review) {
                return res.status(404).json({ error: 'Отзыв не найден' });
            }
            if (review.user_id !== user.id && user.is_admin !== 1) {
                return res.status(403).json({ error: 'Нет прав' });
            }
            
            db.run("DELETE FROM reviews WHERE id = ?", [reviewId], function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                res.json({ message: 'Отзыв удален' });
            });
        });
    });
});

// Админ: добавить место
app.post('/api/admin/places', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Неверный токен' });
        }
        if (user.is_admin !== 1) {
            return res.status(403).json({ error: 'Требуются права администратора' });
        }
        
        const { name, category, address, lat, lng, year, description, full_history, old_image, new_image } = req.body;
        
        if (!name || !address || lat === undefined || lng === undefined) {
            return res.status(400).json({ error: 'Заполните название, адрес и координаты' });
        }
        
        db.run(`INSERT INTO places (name, category, address, lat, lng, year, description, full_history, old_image, new_image)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, category, address, lat, lng, year || '', description || '', full_history || '', old_image || '', new_image || ''],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                res.json({ id: this.lastID, message: 'Место добавлено' });
            }
        );
    });
});

// Админ: удалить место
app.delete('/api/admin/places/:id', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }
    
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Неверный токен' });
        }
        if (user.is_admin !== 1) {
            return res.status(403).json({ error: 'Требуются права администратора' });
        }
        
        db.run("DELETE FROM places WHERE id = ?", [req.params.id], function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'Место удалено' });
        });
    });
});

app.post('/api/logout', (req, res) => {
    res.json({ message: 'Выход выполнен' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`🔑 Админ: admin@mogilev.by / admin2026\n`);
});
