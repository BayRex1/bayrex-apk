// BayRex APK - Главный JavaScript файл

// Базовый URL API (пустой, потому что мы на том же домене)
const API_BASE_URL = '';

// Состояние приложения
let apps = [];
let isAdminLoggedIn = false;
let currentSearch = '';

// DOM элементы
const elements = {
    // Основные
    appsGrid: document.getElementById('appsGrid'),
    searchInput: document.getElementById('searchInput'),
    appCount: document.getElementById('appCount'),
    sectionTitle: document.getElementById('sectionTitle'),
    emptyState: document.getElementById('emptyState'),
    
    // Кнопки управления
    loginBtn: document.getElementById('loginBtn'),
    addAppBtn: document.getElementById('addAppBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    
    // Модалка входа
    loginModal: document.getElementById('loginModal'),
    closeLoginModal: document.getElementById('closeLoginModal'),
    cancelLogin: document.getElementById('cancelLogin'),
    submitLogin: document.getElementById('submitLogin'),
    usernameInput: document.getElementById('username'),
    passwordInput: document.getElementById('password'),
    
    // Уведомления
    notification: document.getElementById('notification'),
    notificationText: document.getElementById('notificationText'),
    
    // Футер
    aboutBtn: document.getElementById('aboutBtn'),
    helpBtn: document.getElementById('helpBtn')
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 BayRex APK инициализируется...');
    
    // Загружаем приложения
    loadApps();
    
    // Проверяем авторизацию
    checkAuth();
    
    // Настраиваем обработчики событий
    setupEventListeners();
});

// ==================== ФУНКЦИИ ====================

/**
 * Проверка авторизации
 */
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/check-auth`, {
            credentials: 'include'
        });
        
        if (!response.ok) return;
        
        const data = await response.json();
        
        if (data.success && data.authenticated) {
            isAdminLoggedIn = true;
            updateAdminUI();
            console.log('✅ Авторизован как администратор');
        }
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
    }
}

/**
 * Загрузка приложений
 */
async function loadApps() {
    try {
        console.log('📥 Загружаю приложения...');
        
        const response = await fetch(`${API_BASE_URL}/api/apps`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            apps = data.data.apps || [];
            renderApps();
            updateAppCount(apps.length);
            console.log(`✅ Загружено ${apps.length} приложений`);
        } else {
            throw new Error(data.error || 'Неизвестная ошибка');
        }
        
    } catch (error) {
        console.error('❌ Ошибка загрузки приложений:', error);
        showNotification('Ошибка загрузки приложений', 'error');
        
        // Показываем демо-данные если сервер недоступен
        if (apps.length === 0) {
            showDemoData();
        }
    }
}

/**
 * Рендеринг приложений
 */
function renderApps() {
    if (!elements.appsGrid) return;
    
    // Очищаем контейнер
    elements.appsGrid.innerHTML = '';
    
    // Показываем пустое состояние если нет приложений
    if (apps.length === 0) {
        if (elements.emptyState) {
            elements.emptyState.style.display = 'block';
        }
        return;
    }
    
    // Скрываем пустое состояние
    if (elements.emptyState) {
        elements.emptyState.style.display = 'none';
    }
    
    // Рендерим каждое приложение
    apps.forEach(app => {
        const appCard = createAppCard(app);
        elements.appsGrid.appendChild(appCard);
    });
}

/**
 * Создание карточки приложения
 */
function createAppCard(app) {
    const card = document.createElement('div');
    card.className = 'app-card';
    
    // Форматируем размер файла
    const fileSizeMB = app.file_size_mb || '0.00';
    
    // Создаем HTML карточки
    card.innerHTML = `
        <div class="app-icon-container">
            <img src="${app.icon_url || 'https://cdn-icons-png.flaticon.com/512/3067/3067256.png'}" 
                 alt="${app.name}" 
                 class="app-icon"
                 onerror="this.src='https://cdn-icons-png.flaticon.com/512/3067/3067256.png'">
        </div>
        <div class="app-content">
            <div class="app-header">
                <h3 class="app-title">${app.name}</h3>
                <span class="app-version">${app.version || '1.0'}</span>
            </div>
            <p class="app-description">${app.description || 'Описание отсутствует'}</p>
            <div class="app-meta">
                <span class="app-category">${app.category || 'Other'}</span>
                <div class="app-downloads">
                    <i class="fas fa-download"></i>
                    ${app.downloads || 0}
                </div>
            </div>
            <div class="app-actions">
                <button class="btn-download" data-id="${app.id}">
                    <i class="fas fa-download"></i> Скачать APK
                </button>
            </div>
        </div>
    `;
    
    // Добавляем обработчик скачивания
    const downloadBtn = card.querySelector('.btn-download');
    downloadBtn.addEventListener('click', () => downloadApp(app.id));
    
    return card;
}

/**
 * Скачивание приложения
 */
async function downloadApp(appId) {
    try {
        console.log(`📥 Скачиваю приложение ID: ${appId}`);
        
        const response = await fetch(`${API_BASE_URL}/api/apps/${appId}/download`, {
            method: 'POST',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Создаем временную ссылку для скачивания
            const link = document.createElement('a');
            link.href = data.data.download_url;
            link.download = data.data.original_filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showNotification(`Скачивание "${data.data.app_name}" начато`, 'success');
            
            // Обновляем счетчик скачиваний в UI
            const appIndex = apps.findIndex(a => a.id === appId);
            if (appIndex !== -1) {
                apps[appIndex].downloads = data.data.downloads;
                renderApps();
            }
        } else {
            throw new Error(data.error || 'Ошибка скачивания');
        }
        
    } catch (error) {
        console.error('❌ Ошибка скачивания:', error);
        showNotification('Ошибка при скачивании приложения', 'error');
    }
}

/**
 * Вход в систему
 */
async function login(username, password) {
    try {
        console.log(`🔐 Пытаюсь войти как: ${username}`);
        
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password }),
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Ошибка входа');
        }
        
        if (data.success) {
            isAdminLoggedIn = true;
            updateAdminUI();
            closeLoginModal();
            showNotification('Вход выполнен успешно!', 'success');
            console.log('✅ Вход выполнен успешно');
            
            // Перезагружаем приложения
            await loadApps();
            
            return true;
        } else {
            throw new Error(data.error || 'Ошибка входа');
        }
        
    } catch (error) {
        console.error('❌ Ошибка входа:', error);
        showNotification(error.message, 'error');
        return false;
    }
}

/**
 * Выход из системы
 */
async function logout() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success) {
            isAdminLoggedIn = false;
            updateAdminUI();
            showNotification('Выход выполнен успешно', 'info');
            console.log('✅ Выход выполнен');
        }
        
    } catch (error) {
        console.error('❌ Ошибка выхода:', error);
        showNotification('Ошибка при выходе из системы', 'error');
    }
}

/**
 * Обновление UI админа
 */
function updateAdminUI() {
    if (!elements.loginBtn || !elements.logoutBtn || !elements.addAppBtn) return;
    
    if (isAdminLoggedIn) {
        elements.loginBtn.style.display = 'none';
        elements.logoutBtn.style.display = 'flex';
        elements.addAppBtn.style.display = 'flex';
    } else {
        elements.loginBtn.style.display = 'flex';
        elements.logoutBtn.style.display = 'none';
        elements.addAppBtn.style.display = 'none';
    }
}

/**
 * Обновление счетчика приложений
 */
function updateAppCount(count) {
    if (elements.appCount) {
        elements.appCount.textContent = count;
    }
    
    if (elements.sectionTitle) {
        let title = 'Все приложения';
        if (currentSearch) {
            title = `Поиск: "${currentSearch}"`;
        }
        elements.sectionTitle.textContent = title;
    }
}

/**
 * Показать уведомление
 */
function showNotification(message, type = 'info') {
    if (!elements.notification || !elements.notificationText) return;
    
    elements.notificationText.textContent = message;
    
    // Устанавливаем класс и иконку
    elements.notification.className = `notification ${type}`;
    const icon = elements.notification.querySelector('i');
    
    switch (type) {
        case 'success':
            icon.className = 'fas fa-check-circle';
            break;
        case 'error':
            icon.className = 'fas fa-exclamation-circle';
            break;
        case 'warning':
            icon.className = 'fas fa-exclamation-triangle';
            break;
        default:
            icon.className = 'fas fa-info-circle';
    }
    
    // Показываем уведомление
    elements.notification.classList.add('show');
    
    // Скрываем через 5 секунд
    setTimeout(() => {
        elements.notification.classList.remove('show');
    }, 5000);
}

/**
 * Показать демо-данные
 */
function showDemoData() {
    console.log('🔄 Показываю демо-данные...');
    
    apps = [
        {
            id: 1,
            name: "WhatsApp Messenger",
            description: "Бесплатный мессенджер для общения с друзьями и семьей. Отправляйте сообщения, фото, видео и совершайте звонки.",
            version: "2.23.10",
            category: "Social",
            icon_url: "https://cdn-icons-png.flaticon.com/512/124/124034.png",
            downloads: 1250,
            file_size_mb: "45.89"
        },
        {
            id: 2,
            name: "Telegram",
            description: "Быстрый и безопасный мессенджер с облачным хранением. Синхронизация между устройствами, секретные чаты.",
            version: "9.5.0",
            category: "Social",
            icon_url: "https://cdn-icons-png.flaticon.com/512/2111/2111644.png",
            downloads: 980,
            file_size_mb: "67.34"
        },
        {
            id: 3,
            name: "Spotify Music",
            description: "Стриминговый сервис музыки и подкастов с миллионами треков. Создавайте плейлисты, открывайте новые треки.",
            version: "8.8.60",
            category: "Entertainment",
            icon_url: "https://cdn-icons-png.flaticon.com/512/2111/2111624.png",
            downloads: 750,
            file_size_mb: "89.23"
        },
        {
            id: 4,
            name: "YouTube",
            description: "Крупнейший видеохостинг в мире. Смотрите видео, слушайте музыку, создавайте плейлисты и подписывайтесь на каналы.",
            version: "18.45.43",
            category: "Entertainment",
            icon_url: "https://cdn-icons-png.flaticon.com/512/1384/1384060.png",
            downloads: 2100,
            file_size_mb: "120.54"
        }
    ];
    
    renderApps();
    updateAppCount(apps.length);
    showNotification('Загружены демо-данные', 'info');
}

/**
 * Открыть модалку входа
 */
function openLoginModal() {
    if (elements.loginModal) {
        elements.loginModal.style.display = 'flex';
        
        // Автозаполнение для тестирования
        if (elements.usernameInput) {
            elements.usernameInput.value = '@BayRex';
        }
        if (elements.passwordInput) {
            elements.passwordInput.value = 'admin123';
        }
    }
}

/**
 * Закрыть модалку входа
 */
function closeLoginModal() {
    if (elements.loginModal) {
        elements.loginModal.style.display = 'none';
        
        // Очищаем поля
        if (elements.usernameInput) {
            elements.usernameInput.value = '';
        }
        if (elements.passwordInput) {
            elements.passwordInput.value = '';
        }
    }
}

/**
 * Настройка обработчиков событий
 */
function setupEventListeners() {
    // Поиск приложений
    if (elements.searchInput) {
        let searchTimeout;
        elements.searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            
            searchTimeout = setTimeout(async () => {
                currentSearch = this.value.trim();
                
                if (currentSearch.length > 0) {
                    try {
                        const response = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(currentSearch)}`);
                        const data = await response.json();
                        
                        if (data.success) {
                            apps = data.data.results || [];
                            renderApps();
                            updateAppCount(apps.length);
                        }
                    } catch (error) {
                        console.error('Ошибка поиска:', error);
                    }
                } else {
                    // Если поиск очищен, загружаем все приложения
                    loadApps();
                }
            }, 500);
        });
    }
    
    // Кнопка входа
    if (elements.loginBtn) {
        elements.loginBtn.addEventListener('click', openLoginModal);
    }
    
    // Кнопка выхода
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', logout);
    }
    
    // Модалка входа: закрытие
    if (elements.closeLoginModal) {
        elements.closeLoginModal.addEventListener('click', closeLoginModal);
    }
    
    if (elements.cancelLogin) {
        elements.cancelLogin.addEventListener('click', closeLoginModal);
    }
    
    // Модалка входа: отправка формы
    if (elements.submitLogin) {
        elements.submitLogin.addEventListener('click', async function(e) {
            e.preventDefault();
            
            const username = elements.usernameInput ? elements.usernameInput.value.trim() : '';
            const password = elements.passwordInput ? elements.passwordInput.value : '';
            
            if (!username || !password) {
                showNotification('Заполните все поля', 'error');
                return;
            }
            
            await login(username, password);
        });
    }
    
    // Кнопка добавления приложения
    if (elements.addAppBtn) {
        elements.addAppBtn.addEventListener('click', function() {
            showNotification('Функция добавления приложения скоро будет доступна', 'info');
        });
    }
    
    // Кнопки в футере
    if (elements.aboutBtn) {
        elements.aboutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            alert(`
BayRex APK - Магазин Android приложений

Версия: 1.0.0
Описание: Бесплатная платформа для распространения Android приложений.

Функции:
✓ Скачивание APK без регистрации
✓ Поиск приложений
✓ Административная панель
✓ Загрузка новых приложений

Администратор:
Логин: @BayRex
Пароль: admin123

Разработано с ❤️ для сообщества Android
            `);
        });
    }
    
    if (elements.helpBtn) {
        elements.helpBtn.addEventListener('click', function(e) {
            e.preventDefault();
            alert(`
Помощь по использованию BayRex APK

Для пользователей:
1. Используйте поиск для быстрого поиска приложений
2. Нажмите "Скачать APK" для загрузки приложения
3. Все приложения проверены и безопасны

Для администраторов:
1. Войдите в систему с логином @BayRex и паролем admin123
2. Используйте кнопку "Добавить" для загрузки новых приложений
3. Управляйте существующими приложениями

Техническая поддержка:
Если возникли проблемы, проверьте консоль браузера (F12 → Console)
            `);
        });
    }
    
    // Закрытие модалок при клике вне
    window.addEventListener('click', function(e) {
        if (e.target === elements.loginModal) {
            closeLoginModal();
        }
    });
    
    // Обработка клавиши Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeLoginModal();
        }
    });
    
    // Обработка Enter в форме входа
    if (elements.loginModal) {
        elements.loginModal.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && elements.loginModal.style.display === 'flex') {
                e.preventDefault();
                if (elements.submitLogin) {
                    elements.submitLogin.click();
                }
            }
        });
    }
}

// Экспорт функций для глобального использования
window.downloadApp = downloadApp;
window.login = login;
window.logout = logout;

console.log('✅ BayRex APK инициализирован успешно!');
