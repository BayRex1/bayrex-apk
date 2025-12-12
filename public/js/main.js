// BayRex APK - Главный JavaScript файл
// Версия 1.0.0

// ===== КОНСТАНТЫ И ПЕРЕМЕННЫЕ =====
const API_BASE_URL = window.location.origin;
let currentPage = 1;
let itemsPerPage = 12;
let totalPages = 1;
let currentFilter = 'all';
let currentCategory = '';
let currentSort = 'newest';
let currentSearch = '';

let apps = [];
let categories = [];
let adminApps = [];
let isAdminLoggedIn = false;
let currentEditingAppId = null;
let appIconFile = null;
let appApkFile = null;
let isAdminPanelVisible = false;
let appToDelete = null;

// ===== DOM ЭЛЕМЕНТЫ =====
const elements = {
    // Основные секции
    appsSection: document.getElementById('appsSection'),
    adminPanel: document.getElementById('adminPanel'),
    appsGrid: document.getElementById('appsGrid'),
    adminAppsList: document.getElementById('adminAppsList'),
    categoriesList: document.getElementById('categoriesList'),
    footerCategories: document.getElementById('footerCategories'),
    
    // Загрузка и уведомления
    loading: document.getElementById('loading'),
    notification: document.getElementById('notification'),
    notificationText: document.getElementById('notificationText'),
    
    // Поиск и фильтры
    searchInput: document.getElementById('searchInput'),
    categoryFilter: document.getElementById('categoryFilter'),
    sortSelect: document.getElementById('sortSelect'),
    
    // Пагинация
    pagination: document.getElementById('pagination'),
    prevPage: document.getElementById('prevPage'),
    nextPage: document.getElementById('nextPage'),
    pageInfo: document.getElementById('pageInfo'),
    appCount: document.getElementById('appCount'),
    sectionTitle: document.getElementById('sectionTitle'),
    
    // Кнопки управления
    loginBtn: document.getElementById('loginBtn'),
    addAppBtn: document.getElementById('addAppBtn'),
    adminPanelBtn: document.getElementById('adminPanelBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    closeAdminPanelBtn: document.getElementById('closeAdminPanelBtn'),
    refreshAdminBtn: document.getElementById('refreshAdminBtn'),
    
    // Модалки
    loginModal: document.getElementById('loginModal'),
    appModal: document.getElementById('appModal'),
    confirmModal: document.getElementById('confirmModal'),
    
    // Форма входа
    usernameInput: document.getElementById('username'),
    passwordInput: document.getElementById('password'),
    submitLogin: document.getElementById('submitLogin'),
    cancelLogin: document.getElementById('cancelLogin'),
    closeLoginModal: document.getElementById('closeLoginModal'),
    
    // Форма приложения
    appForm: document.getElementById('appForm'),
    appName: document.getElementById('appName'),
    appDescription: document.getElementById('appDescription'),
    appVersion: document.getElementById('appVersion'),
    appCategory: document.getElementById('appCategory'),
    appFeatured: document.getElementById('appFeatured'),
    appIcon: document.getElementById('appIcon'),
    appFile: document.getElementById('appFile'),
    appId: document.getElementById('appId'),
    iconPreview: document.getElementById('iconPreview'),
    fileName: document.getElementById('fileName'),
    fileSize: document.getElementById('fileSize'),
    submitAppBtn: document.getElementById('submitAppBtn'),
    cancelAppBtn: document.getElementById('cancelAppBtn'),
    closeAppModal: document.getElementById('closeAppModal'),
    modalAppTitle: document.getElementById('modalAppTitle'),
    
    // Подтверждение удаления
    confirmTitle: document.getElementById('confirmTitle'),
    confirmMessage: document.getElementById('confirmMessage'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
    cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
    closeConfirmModal: document.getElementById('closeConfirmModal'),
    
    // Статистика
    totalApps: document.getElementById('totalApps'),
    totalDownloads: document.getElementById('totalDownloads'),
    totalAppsStat: document.getElementById('totalAppsStat'),
    totalDownloadsStat: document.getElementById('totalDownloadsStat'),
    featuredAppsStat: document.getElementById('featuredAppsStat'),
    totalSizeStat: document.getElementById('totalSizeStat'),
    adminAppCount: document.getElementById('adminAppCount'),
    
    // Кнопки в футере
    footerLoginBtn: document.getElementById('footerLoginBtn'),
    footerAddAppBtn: document.getElementById('footerAddAppBtn'),
    footerStatsBtn: document.getElementById('footerStatsBtn'),
    aboutBtn: document.getElementById('aboutBtn'),
    contactBtn: document.getElementById('contactBtn'),
    helpBtn: document.getElementById('helpBtn')
};

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', async function() {
    showLoading();
    
    try {
        // Проверяем подключение к серверу
        const serverInfo = await fetch(`${API_BASE_URL}/api/info`);
        if (!serverInfo.ok) {
            throw new Error('Сервер не отвечает');
        }
        
        // Проверяем авторизацию
        await checkAuth();
        
        // Загружаем категории
        await loadCategories();
        
        // Загружаем приложения
        await loadApps();
        
        // Загружаем статистику
        await loadStats();
        
        // Настраиваем обработчики событий
        setupEventListeners();
        
        // Показываем уведомление о успешной загрузке
        showNotification('Добро пожаловать в BayRex APK!', 'success');
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showNotification('Ошибка загрузки данных. Пожалуйста, обновите страницу.', 'error');
    } finally {
        hideLoading();
    }
});

// ===== API ФУНКЦИИ =====

/**
 * Проверка авторизации
 */
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/check-auth`, {
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.authenticated) {
            isAdminLoggedIn = true;
            updateAdminUI();
            showNotification(`Вы вошли как ${data.data.username}`, 'info');
        }
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
    }
}

/**
 * Загрузка категорий
 */
async function loadCategories() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/categories`);
        const data = await response.json();
        
        if (data.success) {
            categories = data.data;
            renderCategories();
            renderCategoryFilter();
            renderFooterCategories();
        }
    } catch (error) {
        console.error('Ошибка загрузки категорий:', error);
    }
}

/**
 * Загрузка приложений
 */
async function loadApps(page = 1) {
    try {
        showLoading();
        
        let url = `${API_BASE_URL}/api/apps?`;
        const params = new URLSearchParams();
        
        params.append('limit', itemsPerPage);
        params.append('offset', (page - 1) * itemsPerPage);
        
        if (currentSearch) {
            params.append('search', currentSearch);
        }
        
        if (currentCategory) {
            params.append('category', currentCategory);
        }
        
        if (currentFilter === 'featured') {
            params.append('featured', 'true');
        }
        
        url += params.toString();
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            apps = data.data.apps;
            totalPages = Math.ceil(data.data.total / itemsPerPage);
            currentPage = page;
            
            renderApps(apps);
            updatePagination();
            updateAppCount(data.data.total);
            
            // Обновляем админ список если открыта панель
            if (isAdminPanelVisible) {
                await loadAdminApps();
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки приложений:', error);
        showNotification('Ошибка загрузки приложений', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Загрузка приложений для админ панели
 */
async function loadAdminApps() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/apps?limit=1000`);
        const data = await response.json();
        
        if (data.success) {
            adminApps = data.data.apps;
            renderAdminApps();
            updateAdminAppCount(adminApps.length);
        }
    } catch (error) {
        console.error('Ошибка загрузки админ приложений:', error);
    }
}

/**
 * Загрузка статистики
 */
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/stats`);
        const data = await response.json();
        
        if (data.success) {
            // Главная статистика
            if (elements.totalApps) {
                elements.totalApps.textContent = data.data.total_apps || 0;
            }
            if (elements.totalDownloads) {
                elements.totalDownloads.textContent = data.data.total_downloads || 0;
            }
            
            // Админ статистика
            if (elements.totalAppsStat) {
                elements.totalAppsStat.textContent = data.data.total_apps || 0;
            }
            if (elements.totalDownloadsStat) {
                elements.totalDownloadsStat.textContent = data.data.total_downloads || 0;
            }
            if (elements.featuredAppsStat) {
                elements.featuredAppsStat.textContent = data.data.featured_apps || 0;
            }
            if (elements.totalSizeStat) {
                elements.totalSizeStat.textContent = `${Math.round(data.data.total_size_mb || 0)} MB`;
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

/**
 * Скачивание приложения
 */
async function downloadApp(appId) {
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/api/apps/${appId}/download`, {
            method: 'POST',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Создаем ссылку для скачивания
            const link = document.createElement('a');
            link.href = data.data.download_url;
            link.download = data.data.original_filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showNotification(`Скачивание "${data.data.app_name}" начато`, 'success');
            
            // Обновляем статистику
            await loadStats();
        }
    } catch (error) {
        console.error('Ошибка скачивания:', error);
        showNotification('Ошибка скачивания приложения', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Добавление/обновление приложения
 */
async function saveApp(appData, appId = null) {
    try {
        showLoading();
        
        const formData = new FormData();
        formData.append('name', appData.name);
        formData.append('description', appData.description);
        formData.append('version', appData.version);
        formData.append('category', appData.category);
        formData.append('featured', appData.featured);
        
        if (appData.iconFile) {
            formData.append('icon', appData.iconFile);
        }
        
        if (appData.apkFile) {
            formData.append('apk', appData.apkFile);
        }
        
        const url = appId 
            ? `${API_BASE_URL}/api/apps/${appId}`
            : `${API_BASE_URL}/api/apps`;
        
        const method = appId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            body: formData,
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Ошибка сохранения');
        }
        
        showNotification(
            data.message || (appId ? 'Приложение обновлено' : 'Приложение добавлено'), 
            'success'
        );
        
        // Перезагружаем данные
        await loadApps(currentPage);
        await loadStats();
        
        if (isAdminPanelVisible) {
            await loadAdminApps();
        }
        
        return data.data;
        
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        showNotification(error.message, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

/**
 * Удаление приложения
 */
async function deleteApp(appId) {
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/api/apps/${appId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Ошибка удаления');
        }
        
        showNotification('Приложение успешно удалено', 'success');
        
        // Перезагружаем данные
        await loadApps(currentPage);
        await loadStats();
        
        if (isAdminPanelVisible) {
            await loadAdminApps();
        }
        
    } catch (error) {
        console.error('Ошибка удаления:', error);
        showNotification(error.message, 'error');
        throw error;
    } finally {
        hideLoading();
    }
}

/**
 * Вход в систему
 */
async function login(username, password) {
    try {
        showLoading();
        
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
        
        isAdminLoggedIn = true;
        updateAdminUI();
        showNotification('Вход выполнен успешно', 'success');
        
        return true;
        
    } catch (error) {
        console.error('Ошибка входа:', error);
        showNotification(error.message, 'error');
        return false;
    } finally {
        hideLoading();
    }
}

/**
 * Выход из системы
 */
async function logout() {
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/api/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success) {
            isAdminLoggedIn = false;
            updateAdminUI();
            showNotification('Выход выполнен успешно', 'info');
            
            // Если открыта админ панель, закрываем её
            if (isAdminPanelVisible) {
                toggleAdminPanel();
            }
        }
        
    } catch (error) {
        console.error('Ошибка выхода:', error);
        showNotification('Ошибка выхода из системы', 'error');
    } finally {
        hideLoading();
    }
}

// ===== РЕНДЕРИНГ =====

/**
 * Рендеринг категорий
 */
function renderCategories() {
    if (!elements.categoriesList) return;
    
    elements.categoriesList.innerHTML = '';
    
    // Кнопка "Все"
    const allButton = document.createElement('button');
    allButton.className = 'category-btn active';
    allButton.innerHTML = '<i class="fas fa-th"></i> Все';
    allButton.addEventListener('click', () => {
        document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
        allButton.classList.add('active');
        currentCategory = '';
        loadApps(1);
    });
    elements.categoriesList.appendChild(allButton);
    
    // Категории из базы данных
    categories.forEach(category => {
        const button = document.createElement('button');
        button.className = 'category-btn';
        button.innerHTML = `<i class="${category.icon}"></i> ${category.name}`;
        button.addEventListener('click', () => {
            document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentCategory = category.name;
            loadApps(1);
        });
        elements.categoriesList.appendChild(button);
    });
}

/**
 * Рендеринг фильтра категорий
 */
function renderCategoryFilter() {
    if (!elements.categoryFilter) return;
    
    elements.categoryFilter.innerHTML = '<option value="">Все категории</option>';
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.name;
        option.textContent = category.name;
        elements.categoryFilter.appendChild(option);
    });
}

/**
 * Рендеринг категорий в футере
 */
function renderFooterCategories() {
    if (!elements.footerCategories) return;
    
    elements.footerCategories.innerHTML = '';
    
    categories.forEach(category => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#';
        a.innerHTML = `<i class="${category.icon}"></i> ${category.name}`;
        a.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
            currentCategory = category.name;
            loadApps(1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        li.appendChild(a);
        elements.footerCategories.appendChild(li);
    });
}

/**
 * Рендеринг приложений
 */
function renderApps(appsList) {
    if (!elements.appsGrid) return;
    
    elements.appsGrid.innerHTML = '';
    
    if (appsList.length === 0) {
        elements.appsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <h3>Приложений не найдено</h3>
                <p>Попробуйте изменить параметры поиска или фильтрации</p>
            </div>
        `;
        return;
    }
    
    // Сортировка
    const sortedApps = [...appsList].sort((a, b) => {
        switch (currentSort) {
            case 'popular':
                return b.downloads - a.downloads;
            case 'name':
                return a.name.localeCompare(b.name);
            case 'newest':
            default:
                return new Date(b.created_at) - new Date(a.created_at);
        }
    });
    
    sortedApps.forEach(app => {
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
    
    // Форматирование даты
    const date = new Date(app.created_at);
    const formattedDate = date.toLocaleDateString('ru-RU');
    
    // Форматирование размера файла
    const fileSizeMB = app.file_size_mb || '0.00';
    
    card.innerHTML = `
        ${app.is_featured ? '<span class="app-badge"><i class="fas fa-star"></i> Рекомендуемое</span>' : ''}
        <div class="app-icon-container">
            <img src="${app.icon_url}" alt="${app.name}" class="app-icon" 
                 onerror="this.src='https://cdn-icons-png.flaticon.com/512/3067/3067256.png'">
        </div>
        <div class="app-content">
            <div class="app-header">
                <h3 class="app-title">${app.name}</h3>
                <span class="app-version">${app.version || '1.0'}</span>
            </div>
            <p class="app-description">${app.description}</p>
            <div class="app-meta">
                <span class="app-category">${app.category}</span>
                <div class="app-downloads">
                    <i class="fas fa-download"></i>
                    ${app.downloads}
                </div>
            </div>
            <div class="app-meta">
                <span><i class="fas fa-calendar"></i> ${formattedDate}</span>
                <span><i class="fas fa-weight"></i> ${fileSizeMB} MB</span>
            </div>
            <div class="app-actions">
                <button class="btn-download" data-id="${app.id}">
                    <i class="fas fa-download"></i> Скачать APK
                </button>
                <button class="btn-info" data-id="${app.id}">
                    <i class="fas fa-info-circle"></i>
                </button>
            </div>
        </div>
    `;
    
    // Обработчики событий
    const downloadBtn = card.querySelector('.btn-download');
    const infoBtn = card.querySelector('.btn-info');
    
    downloadBtn.addEventListener('click', () => downloadApp(app.id));
    infoBtn.addEventListener('click', () => showAppInfo(app));
    
    return card;
}

/**
 * Рендеринг приложений в админ панели
 */
function renderAdminApps() {
    if (!elements.adminAppsList) return;
    
    elements.adminAppsList.innerHTML = '';
    
    if (adminApps.length === 0) {
        elements.adminAppsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <h3>Приложений пока нет</h3>
                <p>Добавьте первое приложение, нажав кнопку "Добавить"</p>
            </div>
        `;
        return;
    }
    
    adminApps.forEach(app => {
        const appItem = createAdminAppItem(app);
        elements.adminAppsList.appendChild(appItem);
    });
}

/**
 * Создание элемента приложения для админ панели
 */
function createAdminAppItem(app) {
    const item = document.createElement('div');
    item.className = 'admin-app-item';
    
    // Форматирование даты
    const date = new Date(app.created_at);
    const formattedDate = date.toLocaleDateString('ru-RU');
    
    item.innerHTML = `
        <div class="admin-app-info">
            <img src="${app.icon_url}" alt="${app.name}" class="admin-app-icon"
                 onerror="this.src='https://cdn-icons-png.flaticon.com/512/3067/3067256.png'">
            <div class="admin-app-details">
                <h4 class="admin-app-title">${app.name}</h4>
                <p class="admin-app-description">${app.description}</p>
                <div class="admin-app-meta">
                    <span><i class="fas fa-folder"></i> ${app.category}</span>
                    <span><i class="fas fa-download"></i> ${app.downloads} скачиваний</span>
                    <span><i class="fas fa-calendar"></i> ${formattedDate}</span>
                    ${app.is_featured ? '<span><i class="fas fa-star"></i> Рекомендуемое</span>' : ''}
                </div>
            </div>
        </div>
        <div class="admin-app-actions">
            <button class="btn-edit" data-id="${app.id}">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn-delete" data-id="${app.id}">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `;
    
    // Обработчики событий
    const editBtn = item.querySelector('.btn-edit');
    const deleteBtn = item.querySelector('.btn-delete');
    
    editBtn.addEventListener('click', () => editApp(app.id));
    deleteBtn.addEventListener('click', () => confirmDeleteApp(app));
    
    return item;
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

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
 * Показать/скрыть загрузку
 */
function showLoading() {
    if (elements.loading) {
        elements.loading.style.display = 'flex';
    }
}

function hideLoading() {
    if (elements.loading) {
        setTimeout(() => {
            elements.loading.style.display = 'none';
        }, 300);
    }
}

/**
 * Обновление UI админ панели
 */
function updateAdminUI() {
    if (!isAdminLoggedIn) {
        elements.loginBtn.style.display = 'flex';
        elements.addAppBtn.style.display = 'none';
        elements.adminPanelBtn.style.display = 'none';
        elements.logoutBtn.style.display = 'none';
        
        if (elements.footerAddAppBtn) {
            elements.footerAddAppBtn.style.display = 'none';
        }
    } else {
        elements.loginBtn.style.display = 'none';
        elements.addAppBtn.style.display = 'flex';
        elements.adminPanelBtn.style.display = 'flex';
        elements.logoutBtn.style.display = 'flex';
        
        if (elements.footerAddAppBtn) {
            elements.footerAddAppBtn.style.display = 'block';
        }
    }
}

/**
 * Обновление пагинации
 */
function updatePagination() {
    if (!elements.pagination) return;
    
    if (totalPages <= 1) {
        elements.pagination.style.display = 'none';
        return;
    }
    
    elements.pagination.style.display = 'flex';
    elements.prevPage.disabled = currentPage === 1;
    elements.nextPage.disabled = currentPage === totalPages;
    elements.pageInfo.textContent = `Страница ${currentPage} из ${totalPages}`;
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
        if (currentFilter === 'featured') title = 'Рекомендуемые приложения';
        if (currentCategory) title = `Приложения: ${currentCategory}`;
        if (currentSearch) title = `Поиск: "${currentSearch}"`;
        
        elements.sectionTitle.textContent = title;
    }
}

/**
 * Обновление счетчика приложений в админ панели
 */
function updateAdminAppCount(count) {
    if (elements.adminAppCount) {
        elements.adminAppCount.textContent = count;
    }
}

/**
 * Переключение админ панели
 */
function toggleAdminPanel() {
    isAdminPanelVisible = !isAdminPanelVisible;
    
    if (isAdminPanelVisible) {
        elements.appsSection.style.display = 'none';
        elements.adminPanel.style.display = 'block';
        loadAdminApps();
        loadStats();
    } else {
        elements.appsSection.style.display = 'block';
        elements.adminPanel.style.display = 'none';
    }
}

/**
 * Открытие формы редактирования приложения
 */
async function editApp(appId) {
    try {
        showLoading();
        
        const response = await fetch(`${API_BASE_URL}/api/apps/${appId}`);
        const data = await response.json();
        
        if (data.success) {
            const app = data.data;
            currentEditingAppId = appId;
            
            // Заполняем форму
            elements.appName.value = app.name;
            elements.appDescription.value = app.description;
            elements.appVersion.value = app.version || '1.0';
            elements.appCategory.value = app.category || 'Other';
            elements.appFeatured.checked = app.is_featured;
            elements.appId.value = appId;
            
            // Настраиваем предпросмотр иконки
            if (app.icon_url) {
                elements.iconPreview.src = app.icon_url;
                elements.iconPreview.style.display = 'block';
            }
            
            // Настраиваем информацию о файле
            if (elements.fileName && elements.fileSize) {
                elements.fileName.textContent = app.original_apk_name || 'Файл не выбран';
                elements.fileSize.textContent = app.file_size_mb ? `${app.file_size_mb} MB` : '-';
            }
            
            // Настраиваем заголовок и кнопку
            elements.modalAppTitle.innerHTML = '<i class="fas fa-edit"></i> Редактировать приложение';
            elements.submitAppBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить изменения';
            
            // Сбрасываем файлы
            appIconFile = null;
            appApkFile = null;
            
            // Показываем модалку
            elements.appModal.style.display = 'flex';
        }
    } catch (error) {
        console.error('Ошибка загрузки приложения:', error);
        showNotification('Ошибка загрузки приложения', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Подтверждение удаления приложения
 */
function confirmDeleteApp(app) {
    appToDelete = app;
    
    if (elements.confirmTitle && elements.confirmMessage) {
        elements.confirmTitle.textContent = `Удалить "${app.name}"?`;
        elements.confirmMessage.textContent = `Вы уверены, что хотите удалить приложение "${app.name}"? Это действие нельзя отменить. Все файлы приложения будут удалены.`;
    }
    
    elements.confirmModal.style.display = 'flex';
}

/**
 * Показать информацию о приложении
 */
function showAppInfo(app) {
    alert(`
${app.name} - v${app.version || '1.0'}

${app.description}

Категория: ${app.category}
Скачиваний: ${app.downloads}
Размер: ${app.file_size_mb || '0.00'} MB
Добавлено: ${new Date(app.created_at).toLocaleDateString('ru-RU')}

Для скачивания нажмите кнопку "Скачать APK"
    `);
}

/**
 * Сброс формы приложения
 */
function resetAppForm() {
    if (elements.appForm) {
        elements.appForm.reset();
    }
    
    currentEditingAppId = null;
    appIconFile = null;
    appApkFile = null;
    
    if (elements.iconPreview) {
        elements.iconPreview.style.display = 'none';
        elements.iconPreview.src = '';
    }
    
    if (elements.fileName && elements.fileSize) {
        elements.fileName.textContent = 'Файл не выбран';
        elements.fileSize.textContent = '-';
    }
    
    if (elements.modalAppTitle) {
        elements.modalAppTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Добавить новое приложение';
    }
    
    if (elements.submitAppBtn) {
        elements.submitAppBtn.innerHTML = '<i class="fas fa-save"></i> Добавить приложение';
    }
}

// ===== ОБРАБОТЧИКИ СОБЫТИЙ =====
function setupEventListeners() {
    // Поиск
    if (elements.searchInput) {
        let searchTimeout;
        elements.searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentSearch = this.value.trim();
                loadApps(1);
            }, 500);
        });
    }
    
    // Фильтр категорий
    if (elements.categoryFilter) {
        elements.categoryFilter.addEventListener('change', function() {
            currentCategory = this.value;
            loadApps(1);
        });
    }
    
    // Сортировка
    if (elements.sortSelect) {
        elements.sortSelect.addEventListener('change', function() {
            currentSort = this.value;
            loadApps(currentPage);
        });
    }
    
    // Кнопки фильтров
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            loadApps(1);
        });
    });
    
    // Пагинация
    if (elements.prevPage) {
        elements.prevPage.addEventListener('click', () => {
            if (currentPage > 1) {
                loadApps(currentPage - 1);
            }
        });
    }
    
    if (elements.nextPage) {
        elements.nextPage.addEventListener('click', () => {
            if (currentPage < totalPages) {
                loadApps(currentPage + 1);
            }
        });
    }
    
    // Кнопки управления
    if (elements.loginBtn) {
        elements.loginBtn.addEventListener('click', () => {
            elements.loginModal.style.display = 'flex';
        });
    }
    
    if (elements.addAppBtn) {
        elements.addAppBtn.addEventListener('click', () => {
            resetAppForm();
            elements.appModal.style.display = 'flex';
        });
    }
    
    if (elements.adminPanelBtn) {
        elements.adminPanelBtn.addEventListener('click', () => {
            toggleAdminPanel();
        });
    }
    
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', () => {
            logout();
        });
    }
    
    if (elements.closeAdminPanelBtn) {
        elements.closeAdminPanelBtn.addEventListener('click', () => {
            toggleAdminPanel();
        });
    }
    
    if (elements.refreshAdminBtn) {
        elements.refreshAdminBtn.addEventListener('click', async () => {
            await loadAdminApps();
            await loadStats();
            showNotification('Данные обновлены', 'success');
        });
    }
    
    // Модалка входа
    if (elements.closeLoginModal) {
        elements.closeLoginModal.addEventListener('click', () => {
            elements.loginModal.style.display = 'none';
        });
    }
    
    if (elements.cancelLogin) {
        elements.cancelLogin.addEventListener('click', () => {
            elements.loginModal.style.display = 'none';
        });
    }
    
    if (elements.submitLogin) {
        elements.submitLogin.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const username = elements.usernameInput.value.trim();
            const password = elements.passwordInput.value;
            
            if (!username || !password) {
                showNotification('Заполните все поля', 'error');
                return;
            }
            
            const success = await login(username, password);
            
            if (success) {
                elements.loginModal.style.display = 'none';
                elements.usernameInput.value = '';
                elements.passwordInput.value = '';
            }
        });
    }
    
    // Модалка приложения
    if (elements.closeAppModal) {
        elements.closeAppModal.addEventListener('click', () => {
            elements.appModal.style.display = 'none';
            resetAppForm();
        });
    }
    
    if (elements.cancelAppBtn) {
        elements.cancelAppBtn.addEventListener('click', () => {
            elements.appModal.style.display = 'none';
            resetAppForm();
        });
    }
    
    // Загрузка файлов
    if (elements.appIcon) {
        elements.appIcon.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                appIconFile = file;
                
                // Показываем предпросмотр
                const reader = new FileReader();
                reader.onload = function(event) {
                    elements.iconPreview.src = event.target.result;
                    elements.iconPreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
                
                // Обновляем текст кнопки
                if (elements.iconLabel) {
                    elements.iconLabel.innerHTML = `<i class="fas fa-check"></i> ${file.name}`;
                }
            }
        });
    }
    
    if (elements.appFile) {
        elements.appFile.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                appApkFile = file;
                
                // Обновляем информацию о файле
                if (elements.fileName && elements.fileSize) {
                    elements.fileName.textContent = file.name;
                    elements.fileSize.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
                }
                
                // Обновляем текст кнопки
                if (elements.fileLabel) {
                    elements.fileLabel.innerHTML = `<i class="fas fa-check"></i> ${file.name}`;
                }
            }
        });
    }
    
    // Форма приложения
    if (elements.appForm) {
        elements.appForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Валидация
            if (!elements.appName.value.trim() || !elements.appDescription.value.trim()) {
                showNotification('Заполните название и описание', 'error');
                return;
            }
            
            if (!currentEditingAppId && !appApkFile) {
                showNotification('Выберите APK файл', 'error');
                return;
            }
            
            // Подготавливаем данные
            const appData = {
                name: elements.appName.value.trim(),
                description: elements.appDescription.value.trim(),
                version: elements.appVersion.value.trim() || '1.0',
                category: elements.appCategory.value || 'Other',
                featured: elements.appFeatured.checked,
                iconFile: appIconFile,
                apkFile: appApkFile
            };
            
            try {
                await saveApp(appData, currentEditingAppId);
                elements.appModal.style.display = 'none';
                resetAppForm();
            } catch (error) {
                // Ошибка уже обработана в saveApp
            }
        });
    }
    
    // Модалка подтверждения удаления
    if (elements.closeConfirmModal) {
        elements.closeConfirmModal.addEventListener('click', () => {
            elements.confirmModal.style.display = 'none';
            appToDelete = null;
        });
    }
    
    if (elements.cancelDeleteBtn) {
        elements.cancelDeleteBtn.addEventListener('click', () => {
            elements.confirmModal.style.display = 'none';
            appToDelete = null;
        });
    }
    
    if (elements.confirmDeleteBtn) {
        elements.confirmDeleteBtn.addEventListener('click', async () => {
            if (appToDelete) {
                await deleteApp(appToDelete.id);
                elements.confirmModal.style.display = 'none';
                appToDelete = null;
            }
        });
    }
    
    // Футер кнопки
    if (elements.footerLoginBtn) {
        elements.footerLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            elements.loginModal.style.display = 'flex';
        });
    }
    
    if (elements.footerAddAppBtn) {
        elements.footerAddAppBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (isAdminLoggedIn) {
                resetAppForm();
                elements.appModal.style.display = 'flex';
            }
        });
    }
    
    if (elements.footerStatsBtn) {
        elements.footerStatsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (isAdminLoggedIn) {
                if (!isAdminPanelVisible) {
                    toggleAdminPanel();
                }
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                showNotification('Для просмотра статистики требуется войти в систему', 'warning');
            }
        });
    }
    
    if (elements.aboutBtn) {
        elements.aboutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            alert(`
BayRex APK - Магазин Android приложений

Версия: 1.0.0
Описание: Бесплатная платформа для распространения Android приложений (APK файлов). Пользователи могут скачивать приложения без регистрации, администраторы управляют контентом через панель управления.

Функции:
✓ Скачивание APK без регистрации
✓ Поиск и фильтрация приложений
✓ Панель управления для администратора
✓ Статистика скачиваний
✓ Категории приложений

Администратор по умолчанию:
Логин: @BayRex
Пароль: admin123

Важно: Смените пароль после первого входа!
            `);
        });
    }
    
    if (elements.contactBtn) {
        elements.contactBtn.addEventListener('click', (e) => {
            e.preventDefault();
            alert(`
Контакты BayRex APK

По вопросам сотрудничества и предложений:
Email: contact@bayrex-apk.com
Telegram: @bayrex_support

Техническая поддержка:
Если возникли проблемы с работой сайта, пожалуйста, свяжитесь с администратором через панель управления.
            `);
        });
    }
    
    if (elements.helpBtn) {
        elements.helpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            alert(`
Помощь по использованию BayRex APK

Для пользователей:
1. Используйте поиск для быстрого поиска приложений
2. Фильтруйте приложения по категориям
3. Скачивайте APK файлы нажатием на кнопку "Скачать APK"
4. Для получения информации о приложении нажмите кнопку с иконкой информации

Для администраторов:
1. Войдите в систему с логином @BayRex и паролем admin123
2. Смените пароль после первого входа
3. Используйте панель управления для добавления, редактирования и удаления приложений
4. Загружайте APK файлы и иконки через форму добавления

Ограничения:
- Максимальный размер APK файла: 200MB
- Поддерживаемые форматы иконок: JPEG, PNG, GIF, WebP
- Все приложения проверяются администратором перед публикацией
            `);
        });
    }
    
    // Закрытие модалок при клике вне
    window.addEventListener('click', (e) => {
        if (e.target === elements.loginModal) {
            elements.loginModal.style.display = 'none';
        }
        if (e.target === elements.appModal) {
            elements.appModal.style.display = 'none';
            resetAppForm();
        }
        if (e.target === elements.confirmModal) {
            elements.confirmModal.style.display = 'none';
            appToDelete = null;
        }
    });
    
    // Обработка клавиши Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (elements.loginModal.style.display === 'flex') {
                elements.loginModal.style.display = 'none';
            }
            if (elements.appModal.style.display === 'flex') {
                elements.appModal.style.display = 'none';
                resetAppForm();
            }
            if (elements.confirmModal.style.display === 'flex') {
                elements.confirmModal.style.display = 'none';
                appToDelete = null;
            }
        }
    });
}

// ===== ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ HTML =====
window.downloadApp = downloadApp;
window.editApp = editApp;
window.confirmDeleteApp = confirmDeleteApp;

console.log('BayRex APK инициализирован успешно!');
