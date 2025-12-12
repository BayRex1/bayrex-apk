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
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Путь для загрузок (на Render используем Persistent Disk)
const UPLOADS_PATH = process.env.RENDER ? '/var/data/uploads' : 'uploads';

// Создаем папки для загрузок если их нет
const createUploadDirs = () => {
    const dirs = [
        UPLOADS_PATH,
        path.join(UPLOADS_PATH, 'apks'),
        path.join(UPLOADS_PATH, 'icons')
    ];
    
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`✅ Создана папка: ${dir}`);
        }
    });
};

createUploadDirs();

// Настройка загрузки файлов
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (file.fieldname === 'apk') {
            cb(null, path.join(UPLOADS_PATH, 'apks'));
        } else if (file.fieldname === 'icon') {
            cb(null, path.join(UPLOADS_PATH, 'icons'));
        } else {
            cb(new Error('Неверное поле файла'), false);
        }
    },
    filename: function (req, file, cb) {
        const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const uniqueName = Date.now() + '-' + Math.random().toString(36).substring(2, 15) + path.extname(cleanName);
        cb(null, uniqueName);
    }
});

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
        fileSize: 200 * 1024 * 1024,
        files: 2
    }
});

// Хранилище данных (в памяти для простоты)
let appsDatabase = [];
let nextAppId = 1;

// Создаем несколько тестовых приложений
const createDemoApps = () => {
    if (appsDatabase.length === 0) {
        const demoApps = [
            {
                id: nextAppId++,
                name: "WhatsApp Messenger",
                description: "Бесплатный мессенджер для обмена сообщениями и звонками. Отправляйте сообщения, фото, видео, документы и совершайте бесплатные звонки.",
                version: "2.23.10",
                category: "Social",
                icon_filename: "whatsapp_demo.png",
                apk_filename: "whatsapp_demo.apk",
                original_apk_name: "WhatsApp_v2.23.10.apk",
                file_size: 45892000,
                downloads: 1250,
                is_featured: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            {
                id: nextAppId++,
                name: "Telegram",
                description: "Быстрый и безопасный мессенджер с облачным хранением и секретными чатами. Синхронизация между устройствами.",
                version: "9.5.0",
                category: "Social",
                icon_filename: "telegram_demo.png",
                apk_filename: "telegram_demo.apk",
                original_apk_name: "Telegram_v9.5.0.apk",
                file_size: 67345000,
                downloads: 980,
                is_featured: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            {
                id: nextAppId++,
                name: "Spotify Music",
                description: "Стриминговый сервис музыки и подкастов с миллионами треков. Создавайте плейлисты, открывайте новые треки.",
                version: "8.8.60",
                category: "Entertainment",
                icon_filename: "spotify_demo.png",
                apk_filename: "spotify_demo.apk",
                original_apk_name: "Spotify_v8.8.60.apk",
                file_size: 89231000,
                downloads: 750,
                is_featured: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            {
                id: nextAppId++,
                name: "YouTube",
                description: "Крупнейший видеохостинг в мире. Смотрите видео, слушайте музыку, создавайте плейлисты и подписывайтесь на каналы.",
                version: "18.45.43",
                category: "Entertainment",
                icon_filename: "youtube_demo.png",
                apk_filename: "youtube_demo.apk",
                original_apk_name: "YouTube_v18.45.43.apk",
                file_size: 120543000,
                downloads: 2100,
                is_featured: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }
        ];
        
        appsDatabase = demoApps;
        console.log(`✅ Создано ${demoApps.length} демо-приложений`);
    }
};

createDemoApps();

// Создаем администратора
const createAdmin = async () => {
    const adminUsername = '@BayRex';
    const adminPassword = 'admin123';
    
    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    return {
        username: adminUsername,
        password_hash: hashedPassword
    };
};

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

// Middleware для обработки ошибок загрузки файлов
const handleUploadErrors = (err, req, res, next) => {
    if (err) {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Файл слишком большой. Максимальный размер: 200MB' 
                });
            }
        }
        return res.status(400).json({ 
            success: false, 
            error: err.message 
        });
    }
    next();
};

// ==================== API РОУТЫ ====================

// 1. Проверка сервера
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'BayRex APK Server is running',
        version: '1.0.0'
    });
});

// 2. Получить информацию о сервере
app.get('/api/info', (req, res) => {
    res.json({
        success: true,
        data: {
            name: 'BayRex APK Store',
            version: '1.0.0',
            description: 'Магазин Android приложений',
            admin: '@BayRex',
            total_apps: appsDatabase.length,
            total_downloads: appsDatabase.reduce((sum, app) => sum + app.downloads, 0)
        }
    });
});

// 3. Аутентификация
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Имя пользователя и пароль обязательны' 
            });
        }
        
        // Создаем администратора если нужно
        const admin = await createAdmin();
        
        if (username !== admin.username) {
            return res.status(401).json({ 
                success: false, 
                error: 'Неверное имя пользователя или пароль' 
            });
        }
        
        const isPasswordValid = await bcrypt.compare(password, admin.password_hash);
        
        if (!isPasswordValid) {
            return res.status(401).json({ 
                success: false, 
                error: 'Неверное имя пользователя или пароль' 
            });
        }
        
        // Создаем сессию
        req.session.adminId = 1;
        req.session.username = admin.username;
        req.session.save();
        
        res.json({ 
            success: true, 
            message: 'Вход выполнен успешно',
            data: {
                username: admin.username
            }
        });
        
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
    if (req.session.adminId) {
        res.json({ 
            success: true, 
            authenticated: true,
            data: {
                username: req.session.username
            }
        });
    } else {
        res.json({ 
            success: true, 
            authenticated: false 
        });
    }
});

// 4. Приложения
app.get('/api/apps', (req, res) => {
    try {
        const search = req.query.search || '';
        const category = req.query.category || '';
        const featured = req.query.featured === 'true';
        
        let filteredApps = [...appsDatabase];
        
        // Поиск
        if (search) {
            const searchLower = search.toLowerCase();
            filteredApps = filteredApps.filter(app => 
                app.name.toLowerCase().includes(searchLower) || 
                app.description.toLowerCase().includes(searchLower)
            );
        }
        
        // Фильтр по категории
        if (category) {
            filteredApps = filteredApps.filter(app => app.category === category);
        }
        
        // Фильтр по рекомендуемым
        if (featured) {
            filteredApps = filteredApps.filter(app => app.is_featured);
        }
        
        // Добавляем URL к файлам
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const appsWithUrls = filteredApps.map(app => ({
            ...app,
            icon_url: `/uploads/icons/${app.icon_filename}`,
            apk_url: `/uploads/apks/${app.apk_filename}`,
            file_size_mb: (app.file_size / (1024 * 1024)).toFixed(2),
            created_at_formatted: new Date(app.created_at).toLocaleDateString('ru-RU')
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

app.get('/api/apps/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const app = appsDatabase.find(a => a.id === id);
        
        if (!app) {
            return res.status(404).json({ 
                success: false, 
                error: 'Приложение не найдено' 
            });
        }
        
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const appWithUrls = {
            ...app,
            icon_url: `/uploads/icons/${app.icon_filename}`,
            apk_url: `/uploads/apks/${app.apk_filename}`,
            file_size_mb: (app.file_size / (1024 * 1024)).toFixed(2),
            created_at_formatted: new Date(app.created_at).toLocaleDateString('ru-RU')
        };
        
        res.json({ 
            success: true, 
            data: appWithUrls 
        });
        
    } catch (error) {
        console.error('Ошибка получения приложения:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка получения приложения' 
        });
    }
});

app.post('/api/apps', requireAdmin, upload.fields([
    { name: 'icon', maxCount: 1 },
    { name: 'apk', maxCount: 1 }
]), handleUploadErrors, (req, res) => {
    try {
        const { name, description, version, category } = req.body;
        const iconFile = req.files['icon'] ? req.files['icon'][0] : null;
        const apkFile = req.files['apk'] ? req.files['apk'][0] : null;
        
        if (!name || !description || !apkFile) {
            return res.status(400).json({ 
                success: false, 
                error: 'Название, описание и APK файл обязательны' 
            });
        }
        
        const newApp = {
            id: nextAppId++,
            name: name.trim(),
            description: description.trim(),
            version: version || '1.0',
            category: category || 'Other',
            icon_filename: iconFile ? iconFile.filename : 'default.png',
            apk_filename: apkFile.filename,
            original_apk_name: apkFile.originalname,
            file_size: apkFile.size,
            downloads: 0,
            is_featured: req.body.featured === 'true',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        appsDatabase.push(newApp);
        
        res.status(201).json({ 
            success: true, 
            message: 'Приложение успешно добавлено',
            data: newApp
        });
        
    } catch (error) {
        console.error('Ошибка добавления приложения:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка добавления приложения' 
        });
    }
});

app.put('/api/apps/:id', requireAdmin, upload.fields([
    { name: 'icon', maxCount: 1 },
    { name: 'apk', maxCount: 1 }
]), handleUploadErrors, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const appIndex = appsDatabase.findIndex(a => a.id === id);
        
        if (appIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                error: 'Приложение не найдено' 
            });
        }
        
        const { name, description, version, category } = req.body;
        const iconFile = req.files['icon'] ? req.files['icon'][0] : null;
        const apkFile = req.files['apk'] ? req.files['apk'][0] : null;
        
        if (!name || !description) {
            return res.status(400).json({ 
                success: false, 
                error: 'Название и описание обязательны' 
            });
        }
        
        const updatedApp = {
            ...appsDatabase[appIndex],
            name: name.trim(),
            description: description.trim(),
            version: version || appsDatabase[appIndex].version,
            category: category || appsDatabase[appIndex].category,
            icon_filename: iconFile ? iconFile.filename : appsDatabase[appIndex].icon_filename,
            apk_filename: apkFile ? apkFile.filename : appsDatabase[appIndex].apk_filename,
            original_apk_name: apkFile ? apkFile.originalname : appsDatabase[appIndex].original_apk_name,
            file_size: apkFile ? apkFile.size : appsDatabase[appIndex].file_size,
            is_featured: req.body.featured === 'true',
            updated_at: new Date().toISOString()
        };
        
        appsDatabase[appIndex] = updatedApp;
        
        res.json({ 
            success: true, 
            message: 'Приложение успешно обновлено',
            data: updatedApp
        });
        
    } catch (error) {
        console.error('Ошибка обновления приложения:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка обновления приложения' 
        });
    }
});

app.delete('/api/apps/:id', requireAdmin, (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const appIndex = appsDatabase.findIndex(a => a.id === id);
        
        if (appIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                error: 'Приложение не найдено' 
            });
        }
        
        const deletedApp = appsDatabase.splice(appIndex, 1)[0];
        
        res.json({ 
            success: true, 
            message: 'Приложение успешно удалено',
            data: deletedApp
        });
        
    } catch (error) {
        console.error('Ошибка удаления приложения:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Ошибка удаления приложения' 
        });
    }
});

// 5. Скачивание приложения
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
        
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const downloadUrl = `${baseUrl}/uploads/apks/${appsDatabase[appIndex].apk_filename}`;
        
        res.json({ 
            success: true, 
            message: 'Скачивание зарегистрировано',
            data: {
                download_url: downloadUrl,
                original_filename: appsDatabase[appIndex].original_apk_name,
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

// 6. Статистика
app.get('/api/stats', (req, res) => {
    try {
        const totalApps = appsDatabase.length;
        const totalDownloads = appsDatabase.reduce((sum, app) => sum + app.downloads, 0);
        const totalSizeMB = appsDatabase.reduce((sum, app) => sum + app.file_size, 0) / (1024 * 1024);
        const featuredApps = appsDatabase.filter(app => app.is_featured).length;
        
        // Самое популярное приложение
        const topApp = appsDatabase.length > 0 
            ? appsDatabase.reduce((prev, current) => (prev.downloads > current.downloads) ? prev : current)
            : null;
        
        res.json({ 
            success: true, 
            data: {
                total_apps: totalApps,
                total_downloads: totalDownloads,
                total_size_mb: totalSizeMB.toFixed(2),
                featured_apps: featuredApps,
                top_app: topApp ? {
                    name: topApp.name,
                    downloads: topApp.downloads
                } : null
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

// 7. Категории
app.get('/api/categories', (req, res) => {
    const categories = [
        { id: 1, name: 'Social', description: 'Социальные сети и мессенджеры', icon: 'fas fa-comments' },
        { id: 2, name: 'Tools', description: 'Инструменты и утилиты', icon: 'fas fa-tools' },
        { id: 3, name: 'Games', description: 'Игры', icon: 'fas fa-gamepad' },
        { id: 4, name: 'Productivity', description: 'Продуктивность', icon: 'fas fa-briefcase' },
        { id: 5, name: 'Entertainment', description: 'Развлечения', icon: 'fas fa-film' },
        { id: 6, name: 'Education', description: 'Образование', icon: 'fas fa-graduation-cap' },
        { id: 7, name: 'Other', description: 'Другое', icon: 'fas fa-ellipsis-h' }
    ];
    
    res.json({ 
        success: true, 
        data: categories 
    });
});

// 8. Поиск
app.get('/api/search', (req, res) => {
    try {
        const query = req.query.q || '';
        const limit = parseInt(req.query.limit) || 10;
        
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
            .slice(0, limit)
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

// Статические файлы
app.use('/uploads', express.static(UPLOADS_PATH));
app.use(express.static(path.join(__dirname, '../public')));

// Всё остальное → фронтенд
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error('Необработанная ошибка:', err);
    res.status(500).json({ 
        success: false, 
        error: 'Внутренняя ошибка сервера',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log(`🚀 BayRex APK Server запущен!`);
    console.log('='.repeat(60));
    console.log(`📍 Порт: ${PORT}`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log('='.repeat(60));
    console.log('👑 Администратор:');
    console.log('   Имя пользователя: @BayRex');
    console.log('   Пароль: admin123');
    console.log('='.repeat(60));
    console.log('📁 Папка загрузок:', UPLOADS_PATH);
    console.log('📊 Приложений в базе:', appsDatabase.length);
    console.log('='.repeat(60));
});
