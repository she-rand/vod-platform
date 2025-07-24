// VOD Platform Frontend JavaScript
// Configuración y variables globales
const CONFIG = {
    API_BASE: window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api' 
        : '/api',
    ENDPOINTS: {
        AUTH_LOGIN: '/auth/login',
        CONTENT_LIST: '/content/content',
        CONTENT_DETAIL: '/content/content',
        CONTENT_STATS: '/content/stats',
        CONTENT_GENRES: '/content/genres',
        HEALTH_API: '/health',
        HEALTH_CONTENT: '/content/health'
    }
};

// Estado de la aplicación
const AppState = {
    currentUser: null,
    currentSection: 'home',
    allContent: [],
    filteredContent: [],
    currentFilters: {
        genre: '',
        search: '',
        sort: 'title'
    },
    isLoading: false
};

// Utilidades
const Utils = {
    // Hacer peticiones HTTP
    async fetchAPI(endpoint, options = {}) {
        const url = `${CONFIG.API_BASE}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(AppState.currentUser?.token && {
                    'Authorization': `Bearer ${AppState.currentUser.token}`
                })
            }
        };

        try {
            const response = await fetch(url, { ...defaultOptions, ...options });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`API Error for ${endpoint}:`, error);
            this.showToast(`Error: ${error.message}`, 'error');
            throw error;
        }
    },

    // Formatear duración en segundos a formato legible
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    },

    // Formatear números grandes
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    },

    // Mostrar notificaciones toast
    showToast(message, type = 'info', duration = 3000) {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                if (toastContainer.contains(toast)) {
                    toastContainer.removeChild(toast);
                }
            }, 300);
        }, duration);
    },

    // Debounce para búsquedas
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// Gestión de autenticación
const Auth = {
    async login() {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();

        if (!email || !password) {
            Utils.showToast('Por favor completa todos los campos', 'error');
            return;
        }

        try {
            AppState.isLoading = true;
            this.updateLoginButton(true);

            const response = await Utils.fetchAPI(CONFIG.ENDPOINTS.AUTH_LOGIN, {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            AppState.currentUser = {
                ...response.user,
                token: response.token
            };

            this.updateAuthUI();
            Utils.showToast(`¡Bienvenido, ${response.user.name}!`, 'success');
            
            // Limpiar campos
            document.getElementById('email').value = '';
            document.getElementById('password').value = '';

        } catch (error) {
            Utils.showToast('Error de autenticación. Verifica tus credenciales.', 'error');
        } finally {
            AppState.isLoading = false;
            this.updateLoginButton(false);
        }
    },

    logout() {
        AppState.currentUser = null;
        this.updateAuthUI();
        Utils.showToast('Sesión cerrada correctamente', 'info');
    },

    updateAuthUI() {
        const loginForm = document.getElementById('login-form');
        const userInfo = document.getElementById('user-info');
        const userName = document.getElementById('user-name');

        if (AppState.currentUser) {
            loginForm.style.display = 'none';
            userInfo.style.display = 'flex';
            userName.textContent = AppState.currentUser.name;
        } else {
            loginForm.style.display = 'flex';
            userInfo.style.display = 'none';
        }
    },

    updateLoginButton(loading) {
        const button = document.querySelector('#login-form button');
        if (loading) {
            button.innerHTML = '<span class="loading"></span> Iniciando...';
            button.disabled = true;
        } else {
            button.innerHTML = 'Iniciar Sesión';
            button.disabled = false;
        }
    }
};

// Gestión de contenido
const Content = {
    async loadAll() {
        try {
            AppState.isLoading = true;
            this.showLoadingState();

            const response = await Utils.fetchAPI(CONFIG.ENDPOINTS.CONTENT_LIST);
            AppState.allContent = response.content || [];
            AppState.filteredContent = [...AppState.allContent];

            this.renderContent();
            this.updateContentCount();
            
        } catch (error) {
            this.showErrorState('Error al cargar el contenido');
        } finally {
            AppState.isLoading = false;
        }
    },

    async loadFeatured() {
        try {
            const response = await Utils.fetchAPI(CONFIG.ENDPOINTS.CONTENT_LIST + '?limit=6');
            const featuredContent = response.content || [];
            this.renderFeatured(featuredContent);
        } catch (error) {
            document.getElementById('featured-content').innerHTML = 
                '<div class="loading-placeholder">Error al cargar contenido destacado</div>';
        }
    },

    renderContent() {
        const grid = document.getElementById('content-grid');
        
        if (AppState.filteredContent.length === 0) {
            grid.innerHTML = '<div class="loading-placeholder">No se encontró contenido que coincida con los filtros</div>';
            return;
        }

        grid.innerHTML = AppState.filteredContent.map(item => `
            <div class="content-card" onclick="Content.openPlayer(${item.id})">
                <img src="${item.thumbnail}" 
                     alt="${item.title}" 
                     onerror="this.src='https://via.placeholder.com/400x200/333/white?text=Video'"
                     loading="lazy">
                <div class="content-info">
                    <div class="content-title">${item.title}</div>
                    <div class="content-description">${item.description}</div>
                    <div class="content-genre">
                        ${item.genre.map(g => `<span class="genre-tag">${g}</span>`).join('')}
                    </div>
                    <div class="content-meta">
                        <span>⏱️ ${Utils.formatDuration(item.duration)}</span>
                        <span>⭐ ${item.rating}</span>
                        <span>👁️ ${Utils.formatNumber(item.views || 0)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    },

    renderFeatured(content) {
        const container = document.getElementById('featured-content');
        
        if (content.length === 0) {
            container.innerHTML = '<div class="loading-placeholder">No hay contenido destacado disponible</div>';
            return;
        }

        container.innerHTML = content.map(item => `
            <div class="content-card" onclick="Content.openPlayer(${item.id})">
                <img src="${item.thumbnail}" 
                     alt="${item.title}" 
                     onerror="this.src='https://via.placeholder.com/400x200/333/white?text=Video'"
                     loading="lazy">
                <div class="content-info">
                    <div class="content-title">${item.title}</div>
                    <div class="content-description">${item.description}</div>
                    <div class="content-stats">
                        <span>👁️ ${Utils.formatNumber(item.views || 0)}</span>
                        <span>❤️ ${Utils.formatNumber(item.likes || 0)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    },

    applyFilters() {
        const { genre, search, sort } = AppState.currentFilters;
        let filtered = [...AppState.allContent];

        // Filtrar por género
        if (genre) {
            filtered = filtered.filter(item => 
                item.genre.some(g => g.toLowerCase().includes(genre.toLowerCase()))
            );
        }

        // Filtrar por búsqueda
        if (search) {
            const searchLower = search.toLowerCase();
            filtered = filtered.filter(item =>
                item.title.toLowerCase().includes(searchLower) ||
                item.description.toLowerCase().includes(searchLower) ||
                item.genre.some(g => g.toLowerCase().includes(searchLower))
            );
        }

        // Ordenar
        filtered.sort((a, b) => {
            switch (sort) {
                case 'views':
                    return (b.views || 0) - (a.views || 0);
                case 'likes':
                    return (b.likes || 0) - (a.likes || 0);
                case 'release_date':
                    return new Date(b.release_date || 0) - new Date(a.release_date || 0);
                default: // title
                    return a.title.localeCompare(b.title);
            }
        });

        AppState.filteredContent = filtered;
        this.renderContent();
        this.updateContentCount();
    },

    updateContentCount() {
        const countElement = document.getElementById('content-count');
        const total = AppState.filteredContent.length;
        const totalAll = AppState.allContent.length;
        
        if (total === totalAll) {
            countElement.textContent = `${total} elementos`;
        } else {
            countElement.textContent = `${total} de ${totalAll} elementos`;
        }
    },

    async openPlayer(contentId) {
        try {
            const response = await Utils.fetchAPI(`${CONFIG.ENDPOINTS.CONTENT_DETAIL}/${contentId}`);
            const content = response;

            // Actualizar modal
            document.getElementById('player-title').textContent = content.title;
            document.getElementById('video-source').src = content.video_url;
            document.getElementById('video-description').textContent = content.description;
            document.getElementById('video-duration').textContent = `Duración: ${Utils.formatDuration(content.duration)}`;
            document.getElementById('video-genre').textContent = `Género: ${content.genre.join(', ')}`;
            document.getElementById('video-rating').textContent = `Rating: ${content.rating}`;

            // Mostrar modal
            const modal = document.getElementById('video-player-modal');
            modal.classList.add('active');
            
            // Cargar y reproducir video
            const video = document.getElementById('main-video');
            video.load();
            
            Utils.showToast(`Reproduciendo: ${content.title}`, 'success');

        } catch (error) {
            Utils.showToast('Error al cargar el video', 'error');
        }
    },

    closePlayer() {
        const modal = document.getElementById('video-player-modal');
        const video = document.getElementById('main-video');
        
        video.pause();
        modal.classList.remove('active');
    },

    showLoadingState() {
        document.getElementById('content-grid').innerHTML = 
            '<div class="loading-placeholder"><span class="loading"></span> Cargando contenido...</div>';
    },

    showErrorState(message) {
        document.getElementById('content-grid').innerHTML = 
            `<div class="loading-placeholder">❌ ${message}</div>`;
    }
};

// Gestión de estadísticas
const Stats = {
    async load() {
        try {
            const response = await Utils.fetchAPI(CONFIG.ENDPOINTS.CONTENT_STATS);
            this.render(response);
        } catch (error) {
            this.showError('Error al cargar estadísticas');
        }
    },

    render(stats) {
        // Actualizar tarjetas de estadísticas
        document.getElementById('total-content').textContent = stats.total_content || 0;
        document.getElementById('total-views').textContent = Utils.formatNumber(stats.total_views || 0);
        document.getElementById('total-likes').textContent = Utils.formatNumber(stats.total_likes || 0);
        document.getElementById('avg-duration').textContent = `${stats.average_duration_minutes || 0}min`;

        // Renderizar gráfico de géneros
        this.renderGenreChart(stats.content_by_genre || {});
    },

    renderGenreChart(genreData) {
        const chartContainer = document.getElementById('genre-chart');
        
        if (Object.keys(genreData).length === 0) {
            chartContainer.innerHTML = '<p>No hay datos de géneros disponibles</p>';
            return;
        }

        const maxCount = Math.max(...Object.values(genreData));
        
        chartContainer.innerHTML = Object.entries(genreData)
            .sort(([,a], [,b]) => b - a)
            .map(([genre, count]) => {
                const percentage = (count / maxCount) * 100;
                return `
                    <div class="chart-bar" style="margin-bottom: 1rem;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                            <span>${genre}</span>
                            <span>${count}</span>
                        </div>
                        <div style="background: rgba(255,255,255,0.1); height: 20px; border-radius: 10px; overflow: hidden;">
                            <div style="background: var(--gradient-primary); height: 100%; width: ${percentage}%; transition: width 0.5s ease;"></div>
                        </div>
                    </div>
                `;
            }).join('');
    },

    showError(message) {
        document.getElementById('genre-chart').innerHTML = `<p>${message}</p>`;
    }
};

// Gestión de navegación
const Navigation = {
    showSection(sectionName) {
        // Actualizar navegación
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        const activeLink = document.querySelector(`[onclick="showSection('${sectionName}')"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        // Mostrar sección
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        const targetSection = document.getElementById(`${sectionName}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
            AppState.currentSection = sectionName;
        }

        // Cargar datos específicos de la sección
        this.loadSectionData(sectionName);
    },

    async loadSectionData(sectionName) {
        switch (sectionName) {
            case 'home':
                if (AppState.allContent.length === 0) {
                    await Content.loadAll();
                }
                await Content.loadFeatured();
                break;
            case 'browse':
                if (AppState.allContent.length === 0) {
                    await Content.loadAll();
                } else {
                    Content.renderContent();
                }
                break;
            case 'stats':
                await Stats.load();
                break;
        }
    }
};

// Gestión de búsqueda y filtros
const Search = {
    init() {
        // Configurar debounce para búsqueda
        this.debouncedSearch = Utils.debounce(() => {
            AppState.currentFilters.search = document.getElementById('search-input').value.trim();
            Content.applyFilters();
        }, 300);
    },

    handleInput() {
        this.debouncedSearch();
    },

    performSearch() {
        AppState.currentFilters.search = document.getElementById('search-input').value.trim();
        Content.applyFilters();
        
        if (AppState.currentFilters.search) {
            Utils.showToast(`Buscando: "${AppState.currentFilters.search}"`, 'info');
        }
    },

    applyFilters() {
        AppState.currentFilters.genre = document.getElementById('genre-filter').value;
        AppState.currentFilters.sort = document.getElementById('sort-filter').value;
        Content.applyFilters();
    },

    clearFilters() {
        document.getElementById('search-input').value = '';
        document.getElementById('genre-filter').value = '';
        document.getElementById('sort-filter').value = 'title';
        
        AppState.currentFilters = { genre: '', search: '', sort: 'title' };
        Content.applyFilters();
        
        Utils.showToast('Filtros limpiados', 'info');
    }
};

// Monitoreo del sistema
const SystemMonitor = {
    async init() {
        await this.checkSystemHealth();
        // Verificar salud cada 30 segundos
        setInterval(() => this.checkSystemHealth(), 30000);
    },

    async checkSystemHealth() {
        const services = [
            { name: 'api', endpoint: '', elementId: 'api-status' },
            { name: 'content', endpoint: '/content', elementId: 'content-status' },
            { name: 'prometheus', url: 'http://localhost:9090', elementId: 'prometheus-status' }
        ];

        for (const service of services) {
            try {
                if (service.url) {
                    // Para servicios externos como Prometheus
                    const response = await fetch(service.url, { mode: 'no-cors' });
                    this.updateServiceStatus(service.elementId, 'healthy');
                } else {
                    // Para nuestros servicios internos
                    await Utils.fetchAPI(service.endpoint + '/health');
                    this.updateServiceStatus(service.elementId, 'healthy');
                }
            } catch (error) {
                this.updateServiceStatus(service.elementId, 'error');
            }
        }
    },

    updateServiceStatus(elementId, status) {
        const element = document.getElementById(elementId);
        if (element) {
            switch (status) {
                case 'healthy':
                    element.textContent = '🟢';
                    element.title = 'Servicio funcionando correctamente';
                    break;
                case 'error':
                    element.textContent = '🔴';
                    element.title = 'Servicio no disponible';
                    break;
                default:
                    element.textContent = '🟡';
                    element.title = 'Estado desconocido';
            }
        }
    }
};

// Event Listeners globales
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 VOD Platform iniciando...');
    
    // Inicializar componentes
    Search.init();
    Auth.updateAuthUI();
    await SystemMonitor.init();
    
    // Cargar sección inicial
    Navigation.showSection('home');
    
    // Event listeners para búsqueda
    document.getElementById('search-input').addEventListener('input', () => Search.handleInput());
    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            Search.performSearch();
        }
    });

    // Event listeners para auth
    document.getElementById('email').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('password').focus();
        }
    });
    
    document.getElementById('password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            Auth.login();
        }
    });

    // Cerrar modal con Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            Content.closePlayer();
        }
    });

    // Cerrar modal clickeando fuera
    document.getElementById('video-player-modal').addEventListener('click', (e) => {
        if (e.target.id === 'video-player-modal') {
            Content.closePlayer();
        }
    });

    console.log('✅ VOD Platform iniciado correctamente');
    Utils.showToast('¡Plataforma VOD cargada correctamente!', 'success');
});

// Funciones globales para HTML onclick
function showSection(section) {
    Navigation.showSection(section);
}

function login() {
    Auth.login();
}

function logout() {
    Auth.logout();
}

function handleSearch() {
    Search.handleInput();
}

function performSearch() {
    Search.performSearch();
}

function applyFilters() {
    Search.applyFilters();
}

function clearFilters() {
    Search.clearFilters();
}

function loadFeaturedContent() {
    Content.loadFeatured();
}

function loadStats() {
    Stats.load();
}

function showStats() {
    Navigation.showSection('stats');
}

function closeVideoPlayer() {
    Content.closePlayer();
}

// Exportar para debugging en consola
window.VODPlatform = {
    AppState,
    Utils,
    Auth,
    Content,
    Stats,
    Navigation,
    Search,
    SystemMonitor
};