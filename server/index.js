const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const session = require('express-session');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: ['http://localhost:8080', 'http://ваш-домен.ру'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Настройка сессий
app.use(session({
    secret: process.env.SESSION_SECRET || 'bayrex-secret-key-2023',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Поставьте true если используете HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 часа
    }
}));

// Настройка загрузки файлов
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (file.fieldname === 'apk') {
            cb(null, 'uploads/apks/');
        } else if (file.fieldname === 'icon') {
            cb(null, 'uploads/icons/');
        }
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB лимит
});

// Подключение к базе данных SQLite
const db = new sqlite3.Database('database.db');

// Создание таблиц
db.serialize(() => {
    // Таблица приложений
    db.run(`CREATE TABLE IF NOT EXISTS apps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        icon_filename TEXT,
        apk_filename TEXT,
        original_apk_name TEXT,
        downloads INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица администраторов
    db.run(`CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Создаем администратора по умолчанию
    const defaultAdmin = {
        username: '@BayRex',
        password: 'admin123'
    };
    
    // Хешируем пароль и добавляем администратора
    bcrypt.hash(defaultAdmin.password, 10, (err, hash) => {
        if (err) {
            console.error('Ошибка хеширования пароля:', err);
            return;
        }
        
        // Проверяем, существует ли уже администратор
        db.get('SELECT * FROM admins WHERE username = ?', [defaultAdmin.username], (err, row) => {
            if (err) {
                console.error('Ошибка проверки администратора:', err);
                return;
            }
            
            if (!row) {
                db.run('INSERT INTO admins (username, password_hash) VALUES (?, ?)', 
                    [defaultAdmin.username, hash], 
                    (err) => {
                        if (err) {
                            console.error('Ошибка создания администратора:', err);
                        } else {
                            console.log('Администратор @BayRex создан');
                        }
                    });
            }
        });
    });
});

// Middleware для проверки авторизации
const isAdmin = (req, res, next) => {
    if (req.session && req.session.adminId) {
        next();
    } else {
        res.status(401).json({ error: 'Требуется авторизация администратора' });
    }
};

// API маршруты

// 1. Аутентификация
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    db.get('SELECT * FROM admins WHERE username = ?', [username], (err, admin) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка базы данных' });
        }
        
        if (!admin) {
            return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
        }
        
        bcrypt.compare(password, admin.password_hash, (err, match) => {
            if (err) {
                return res.status(500).json({ error: 'Ошибка проверки пароля' });
            }
            
            if (match) {
                req.session.adminId = admin.id;
                req.session.username = admin.username;
                res.json({ 
                    success: true, 
                    message: 'Вход выполнен успешно',
                    username: admin.username 
                });
            } else {
                res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
            }
        });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Выход выполнен' });
});

app.get('/api/check-auth', (req, res) => {
    if (req.session.adminId) {
        res.json({ authenticated: true, username: req.session.username });
    } else {
        res.json({ authenticated: false });
    }
});

// 2. Приложения
app.get('/api/apps', (req, res) => {
    const search = req.query.search || '';
    const query = search 
        ? 'SELECT * FROM apps WHERE name LIKE ? OR description LIKE ? ORDER BY created_at DESC'
        : 'SELECT * FROM apps ORDER BY created_at DESC';
    
    const params = search ? [`%${search}%`, `%${search}%`] : [];
    
    db.all(query, params, (err, apps) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка получения приложений' });
        }
        
        // Добавляем полные URL к файлам
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const appsWithUrls = apps.map(app => ({
            ...app,
            icon_url: `${baseUrl}/uploads/icons/${app.icon_filename}`,
            apk_url: `${baseUrl}/uploads/apks/${app.apk_filename}`
        }));
        
        res.json(appsWithUrls);
    });
});

app.get('/api/apps/:id', (req, res) => {
    const id = req.params.id;
    
    db.get('SELECT * FROM apps WHERE id = ?', [id], (err, app) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка получения приложения' });
        }
        
        if (!app) {
            return res.status(404).json({ error: 'Приложение не найдено' });
        }
        
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        app.icon_url = `${baseUrl}/uploads/icons/${app.icon_filename}`;
        app.apk_url = `${baseUrl}/uploads/apks/${app.apk_filename}`;
        
        res.json(app);
    });
});

app.post('/api/apps', isAdmin, upload.fields([
    { name: 'icon', maxCount: 1 },
    { name: 'apk', maxCount: 1 }
]), (req, res) => {
    const { name, description } = req.body;
    const iconFile = req.files['icon'] ? req.files['icon'][0] : null;
    const apkFile = req.files['apk'] ? req.files['apk'][0] : null;
    
    if (!name || !description || !iconFile || !apkFile) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }
    
    const appData = {
        name,
        description,
        icon_filename: iconFile.filename,
        apk_filename: apkFile.filename,
        original_apk_name: apkFile.originalname
    };
    
    db.run('INSERT INTO apps (name, description, icon_filename, apk_filename, original_apk_name) VALUES (?, ?, ?, ?, ?)',
        [appData.name, appData.description, appData.icon_filename, appData.apk_filename, appData.original_apk_name],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Ошибка сохранения приложения' });
            }
            
            appData.id = this.lastID;
            appData.downloads = 0;
            
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            appData.icon_url = `${baseUrl}/uploads/icons/${appData.icon_filename}`;
            appData.apk_url = `${baseUrl}/uploads/apks/${appData.apk_filename}`;
            
            res.status(201).json(appData);
        });
});

app.put('/api/apps/:id', isAdmin, upload.fields([
    { name: 'icon', maxCount: 1 },
    { name: 'apk', maxCount: 1 }
]), (req, res) => {
    const id = req.params.id;
    const { name, description } = req.body;
    const iconFile = req.files['icon'] ? req.files['icon'][0] : null;
    const apkFile = req.files['apk'] ? req.files['apk'][0] : null;
    
    if (!name || !description) {
        return res.status(400).json({ error: 'Название и описание обязательны' });
    }
    
    // Сначала получаем текущее приложение
    db.get('SELECT * FROM apps WHERE id = ?', [id], (err, app) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка получения приложения' });
        }
        
        if (!app) {
            return res.status(404).json({ error: 'Приложение не найдено' });
        }
        
        // Подготавливаем данные для обновления
        const updateData = {
            name,
            description,
            icon_filename: iconFile ? iconFile.filename : app.icon_filename,
            apk_filename: apkFile ? apkFile.filename : app.apk_filename,
            original_apk_name: apkFile ? apkFile.originalname : app.original_apk_name,
            updated_at: new Date().toISOString()
        };
        
        db.run(`UPDATE apps SET 
                name = ?, description = ?, icon_filename = ?, apk_filename = ?, 
                original_apk_name = ?, updated_at = ? 
                WHERE id = ?`,
            [updateData.name, updateData.description, updateData.icon_filename, 
             updateData.apk_filename, updateData.original_apk_name, 
             updateData.updated_at, id],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Ошибка обновления приложения' });
                }
                
                updateData.id = parseInt(id);
                updateData.downloads = app.downloads;
                
                const baseUrl = `${req.protocol}://${req.get('host')}`;
                updateData.icon_url = `${baseUrl}/uploads/icons/${updateData.icon_filename}`;
                updateData.apk_url = `${baseUrl}/uploads/apks/${updateData.apk_filename}`;
                
                res.json(updateData);
            });
    });
});

app.delete('/api/apps/:id', isAdmin, (req, res) => {
    const id = req.params.id;
    
    // Сначала получаем информацию о файлах
    db.get('SELECT icon_filename, apk_filename FROM apps WHERE id = ?', [id], (err, app) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка получения приложения' });
        }
        
        if (!app) {
            return res.status(404).json({ error: 'Приложение не найдено' });
        }
        
        // Удаляем из базы данных
        db.run('DELETE FROM apps WHERE id = ?', [id], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Ошибка удаления приложения' });
            }
            
            // Здесь можно добавить удаление физических файлов
            // fs.unlink(`uploads/icons/${app.icon_filename}`, () => {});
            // fs.unlink(`uploads/apks/${app.apk_filename}`, () => {});
            
            res.json({ success: true, message: 'Приложение удалено' });
        });
    });
});

// 3. Статистика скачиваний
app.post('/api/apps/:id/download', (req, res) => {
    const id = req.params.id;
    
    db.run('UPDATE apps SET downloads = downloads + 1 WHERE id = ?', [id], (err) => {
        if (err) {
            console.error('Ошибка обновления счетчика скачиваний:', err);
        }
        
        // Получаем обновленное приложение
        db.get('SELECT * FROM apps WHERE id = ?', [id], (err, app) => {
            if (err || !app) {
                return res.status(404).json({ error: 'Приложение не найдено' });
            }
            
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            const apkUrl = `${baseUrl}/uploads/apks/${app.apk_filename}`;
            
            res.json({ 
                success: true, 
                download_url: apkUrl,
                original_filename: app.original_apk_name,
                downloads: app.downloads
            });
        });
    });
});

// Статические файлы
app.use('/uploads', express.static('uploads'));
app.use(express.static('../public'));

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер BayRex APK запущен на порту ${PORT}`);
    console.log(`Админ: @BayRex / admin123`);
    console.log(`URL: http://localhost:${PORT}`);
});
