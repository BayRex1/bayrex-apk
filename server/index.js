const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Сессии
app.use(session({
    secret: process.env.SESSION_SECRET || 'bayrex-secret-key-2023',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Определяем путь для загрузок
const IS_RENDER = process.env.RENDER || false;
const UPLOADS_PATH = IS_RENDER ? '/var/data/uploads' : 'uploads';

console.log('🚀 Загрузки будут сохраняться в:', UPLOADS_PATH);
console.log('🔧 IS_RENDER:', IS_RENDER);

// Создаем папки для загрузок если их нет
const createUploadDirs = () => {
    try {
        const dirs = [
            UPLOADS_PATH,
            path.join(UPLOADS_PATH, 'apks'),
            path.join(UPLOADS_PATH, 'icons')
        ];
        
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                // Создаем папку рекурсивно
                fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
                console.log(`✅ Создана папка: ${dir}`);
            } else {
                console.log(`📁 Папка уже существует: ${dir}`);
            }
        });
    } catch (error) {
        console.error('❌ Ошибка создания папок:', error.message);
        console.log('⚠️  Продолжаем без создания папок...');
    }
};

// Проверяем права доступа к папке загрузок
const checkUploadsAccess = () => {
    try {
        // Пытаемся записать тестовый файл
        const testFile = path.join(UPLOADS_PATH, 'test.txt');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        console.log('✅ Права доступа к папке загрузок: OK');
        return true;
    } catch (error) {
        console.error('❌ Нет прав доступа к папке загрузок:', error.message);
        
        // Если это Render и нет прав, пытаемся использовать временную папку
        if (IS_RENDER) {
            console.log('🔄 Пытаюсь использовать /tmp/uploads...');
            const TMP_UPLOADS_PATH = '/tmp/uploads';
            
            try {
                if (!fs.existsSync(TMP_UPLOADS_PATH)) {
                    fs.mkdirSync(TMP_UPLOADS_PATH, { recursive: true });
                }
                // Проверяем права в /tmp
                const testFile = path.join(TMP_UPLOADS_PATH, 'test.txt');
                fs.writeFileSync(testFile, 'test');
                fs.unlinkSync(testFile);
                
                // Обновляем путь
                global.UPLOADS_PATH = TMP_UPLOADS_PATH;
                console.log('✅ Использую /tmp/uploads для загрузок');
                return true;
            } catch (tmpError) {
                console.error('❌ Нет прав даже в /tmp:', tmpError.message);
                return false;
            }
        }
        return false;
    }
};

// Пытаемся создать папки и проверить доступ
try {
    createUploadDirs();
    
    if (!checkUploadsAccess()) {
        console.log('⚠️  Использую временное хранилище в памяти');
        // Используем временное хранилище в памяти
        global.USE_MEMORY_STORAGE = true;
    }
} catch (error) {
    console.error('❌ Критическая ошибка инициализации:', error);
    global.USE_MEMORY_STORAGE = true;
}

// Настройка загрузки файлов
let storage;

if (global.USE_MEMORY_STORAGE) {
    // Используем memory storage если нет доступа к файловой системе
    console.log('🔄 Использую MemoryStorage для файлов');
    storage = multer.memoryStorage();
} else {
    // Используем disk storage
    storage = multer.diskStorage({
        destination: function (req, file, cb) {
            try {
                if (file.fieldname === 'apk') {
                    const dir = path.join(UPLOADS_PATH, 'apks');
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    cb(null, dir);
                } else if (file.fieldname === 'icon') {
                    const dir = path.join(UPLOADS_PATH, 'icons');
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    cb(null, dir);
                } else {
                    cb(new Error('Неверное поле файла'), false);
                }
            } catch (error) {
                console.error('Ошибка создания папки для файла:', error);
                cb(error, false);
            }
        },
        filename: function (req, file, cb) {
            const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
            const uniqueName = Date.now() + '-' + Math.random().toString(36).substring(2, 15) + path.extname(cleanName);
            cb(null, uniqueName);
        }
    });
}

const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'apk') {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.apk') {
            cb(null, true);
        } else {
            cb(new Error('Только APK файлы разрешены'), false);
        }
    } else if (file.fieldname === 'icon') {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Только изображения разрешены'), false);
        }
    } else {
        cb(new Error('Неверное поле файла'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { 
        fileSize: 50 * 1024 * 1024, // 50MB для начала
        files: 2
    }
});

// Хранилище данных (в памяти)
let appsDatabase = [];
let nextAppId = 1;

// Создаем демо-приложения
const createDemoApps = () => {
    if (appsDatabase.length === 0) {
        const demoApps = [
            {
                id: nextAppId++,
                name: "WhatsApp Messenger",
                description: "Бесплатный мессенджер для обмена сообщениями и звонками.",
                version: "2.23.10",
                category: "Social",
                icon_filename: "whatsapp.png",
                apk_filename: "whatsapp.apk",
                downloads: 1250,
                is_featured: true,
                file_size: 45892000,
                created_at: new Date().toISOString()
            },
            {
                id: nextAppId++,
                name: "Telegram",
                description: "Быстрый и безопасный мессенджер с облачным хранением.",
                version: "9.5.0",
                category: "Social",
                icon_filename: "telegram.png",
                apk_filename: "telegram.apk",
                downloads: 980,
                is_featured: true,
                file_size: 67345000,
                created_at: new Date().toISOString()
            },
            {
                id: nextAppId++,
                name: "Spotify Music",
                description: "Стриминговый сервис музыки и подкастов с миллионами треков.",
                version: "8.8.60",
                category: "Entertainment",
                icon_filename: "spotify.png",
                apk_filename: "spotify.apk",
                downloads: 750,
                is_featured: false,
                file_size: 89231000,
                created_at: new Date().toISOString()
            }
        ];
        
        appsDatabase = demoApps;
        console.log(`✅ Создано ${demoApps.length} демо-приложений`);
    }
};

createDemoApps();

// Middleware для проверки авторизации
const requireAdmin = (req, res, next) => {
    if (req.session && req.session.adminId) {
        next();
    } else {
        res.status(401).json({ 
            success: false, 
            error: 'Требуется авторизация администратора' 
        });
    }
};

// API Роуты

// 1. Проверка сервера
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'BayRex APK Server is running',
        version: '1.0.0',
        uploads_path: UPLOADS_PATH,
        using_memory_storage: !!global.USE_MEMORY_STORAGE
    });
});

// 2. Получить приложения
app.get('/api/apps', (req, res) => {
    try {
        const search = req.query.search || '';
        let filteredApps = [...appsDatabase];
        
        if (search) {
            const searchLower = search.toLowerCase();
            filteredApps = filteredApps.filter(app => 
                app.name.toLowerCase().includes(searchLower) || 
                app.description.toLowerCase().includes(searchLower)
            );
        }
        
        // Добавляем фиктивные URL для демо
        const appsWithUrls = filteredApps.map(app => ({
            ...app,
            icon_url: `https://cdn-icons-png.flaticon.com/512/${app.id === 1 ? '124/124034' : app.id === 2 ? '2111/2111644' : '2111/2111624'}.png`,
            apk_url: '#',
            file_size_mb: (app.file_size / (1024 * 1024)).toFixed(2)
        }));
        
        res.json({ 
            success: true, 
            data: {
                apps: appsWithUrls,
                total: appsWithUrls.length
            }
        });
        
    } catch (error) {
        console.error('Ошибка получения приложений:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка получения приложений' 
        });
    }
});

// 3. Авторизация
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Имя пользователя и пароль обязательны' 
            });
        }
        
        // Проверяем администратора
        if (username === '@BayRex' && password === 'admin123') {
            req.session.adminId = 1;
            req.session.username = username;
            
            res.json({ 
                success: true, 
                message: 'Вход выполнен успешно',
                data: { username }
            });
        } else {
            res.status(401).json({ 
                success: false, 
                error: 'Неверное имя пользователя или пароль' 
            });
        }
        
    } catch (error) {
        console.error('Ошибка входа:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Внутренняя ошибка сервера' 
        });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ 
                success: false, 
                error: 'Ошибка при выходе' 
            });
        }
        res.json({ 
            success: true, 
            message: 'Выход выполнен успешно' 
        });
    });
});

app.get('/api/check-auth', (req, res) => {
    res.json({ 
        success: true, 
        authenticated: !!req.session.adminId,
        data: req.session.adminId ? { username: req.session.username } : null
    });
});

// 4. Скачивание приложения
app.post('/api/apps/:id/download', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const appIndex = appsDatabase.findIndex(a => a.id === id);
        
        if (appIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                error: 'Приложение не найдено' 
            });
        }
        
        // Увеличиваем счетчик скачиваний
        appsDatabase[appIndex].downloads += 1;
        
        // Для демо просто возвращаем успех
        res.json({ 
            success: true, 
            message: 'Скачивание зарегистрировано',
            data: {
                download_url: '#',
                original_filename: appsDatabase[appIndex].apk_filename,
                downloads: appsDatabase[appIndex].downloads,
                app_name: appsDatabase[appIndex].name
            }
        });
        
    } catch (error) {
        console.error('Ошибка скачивания:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка скачивания' 
        });
    }
});

// 5. Статистика
app.get('/api/stats', (req, res) => {
    try {
        const totalApps = appsDatabase.length;
        const totalDownloads = appsDatabase.reduce((sum, app) => sum + app.downloads, 0);
        const totalSizeMB = appsDatabase.reduce((sum, app) => sum + app.file_size, 0) / (1024 * 1024);
        const featuredApps = appsDatabase.filter(app => app.is_featured).length;
        
        res.json({ 
            success: true, 
            data: {
                total_apps: totalApps,
                total_downloads: totalDownloads,
                total_size_mb: totalSizeMB.toFixed(2),
                featured_apps: featuredApps
            }
        });
        
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка получения статистики' 
        });
    }
});

// 6. Категории
app.get('/api/categories', (req, res) => {
    const categories = [
        { id: 1, name: 'Social', description: 'Социальные сети', icon: 'fas fa-comments' },
        { id: 2, name: 'Tools', description: 'Инструменты', icon: 'fas fa-tools' },
        { id: 3, name: 'Entertainment', description: 'Развлечения', icon: 'fas fa-film' },
        { id: 4, name: 'Other', description: 'Другое', icon: 'fas fa-ellipsis-h' }
    ];
    
    res.json({ 
        success: true, 
        data: categories 
    });
});

// 7. Поиск
app.get('/api/search', (req, res) => {
    try {
        const query = req.query.q || '';
        
        if (!query.trim()) {
            return res.json({ 
                success: true, 
                data: { 
                    results: [], 
                    query: query,
                    count: 0 
                } 
            });
        }
        
        const searchLower = query.toLowerCase();
        const results = appsDatabase
            .filter(app => 
                app.name.toLowerCase().includes(searchLower) || 
                app.description.toLowerCase().includes(searchLower)
            )
            .map(app => ({
                id: app.id,
                name: app.name,
                description: app.description,
                icon_filename: app.icon_filename,
                downloads: app.downloads,
                category: app.category
            }));
        
        res.json({ 
            success: true, 
            data: { 
                results: results, 
                query: query,
                count: results.length 
            } 
        });
        
    } catch (error) {
        console.error('Ошибка поиска:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка поиска' 
        });
    }
});

// Статические файлы (фронтенд)
app.use(express.static(path.join(__dirname, '../public')));

// Всё остальное → фронтенд
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Запуск сервера
app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log(`🚀 BayRex APK Server запущен!`);
    console.log('='.repeat(60));
    console.log(`📍 Порт: ${PORT}`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log('='.repeat(60));
    console.log('👑 Администратор: @BayRex / admin123');
    console.log('='.repeat(60));
    console.log(`📁 Папка загрузок: $here UPLOADS_PATH}`);
    console.log(`💾 Memory Storage: ${global.USE_MEMORY_STORAGE ? 'Да' : 'Нет'}`);
    console.log('='.repeat(60));
    console.log(`📊 Приложений: ${appsDatabase.length}`);
    console.log('='.repeat(60));
    console.log('✅ Сервер готов к работе!');
    console.log('='.repeat(60));
});
