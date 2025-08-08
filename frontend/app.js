// VOD Platform Frontend JavaScript - Browser Compatible
(function() {
    'use strict';

    // Configuración
    const CONFIG = {
        API_BASE: window.location.hostname === 'localhost' 
            ? 'http://localhost:3000/api' 
            : '/api',
        HEALTH_BASE: window.location.hostname === 'localhost'
            ? 'http://localhost:3000'
            : ''
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
        async fetchAPI(endpoint, options) {
            options = options || {};
            const url = CONFIG.API_BASE + endpoint;
            const defaultOptions = {
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            if (AppState.currentUser && AppState.currentUser.token) {
                defaultOptions.headers['Authorization'] = 'Bearer ' + AppState.currentUser.token;
            }

            try {
                const response = await fetch(url, Object.assign(defaultOptions, options));
                
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                }
                
                return await response.json();
            } catch (error) {
                console.error('API Error for ' + endpoint + ':', error);
                this.showToast('Error: ' + error.message, 'error');
                throw error;
            }
        },

        async healthCheck(endpoint, timeout) {
            timeout = timeout || 5000;
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(function() {
                    controller.abort();
                }, timeout);
                
                const response = await fetch(endpoint, {
                    signal: controller.signal,
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                clearTimeout(timeoutId);
                
                if (response.ok) {
                    const data = await response.json();
                    return data.status === 'healthy';
                }
                return false;
            } catch (error) {
                console.log('Health check failed for ' + endpoint + ':', error.message);
                return false;
            }
        },

        formatDuration: function(seconds) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            
            if (hours > 0) {
                return hours + 'h ' + minutes + 'm';
            }
            return minutes + 'm';
        },

        formatNumber: function(num) {
            if (num >= 1000000) {
                return (num / 1000000).toFixed(1) + 'M';
            }
            if (num >= 1000) {
                return (num / 1000).toFixed(1) + 'K';
            }
            return num.toString();
        },

        showToast: function(message, type, duration) {
            type = type || 'info';
            duration = duration || 3000;
            
            const toastContainer = document.getElementById('toast-container');
            if (!toastContainer) return;
            
            const toast = document.createElement('div');
            toast.className = 'toast ' + type;
            toast.textContent = message;
            
            toastContainer.appendChild(toast);
            
            setTimeout(function() {
                toast.style.animation = 'slideOut 0.3s ease forwards';
                setTimeout(function() {
                    if (toastContainer.contains(toast)) {
                        toastContainer.removeChild(toast);
                    }
                }, 300);
            }, duration);
        },

        debounce: function(func, wait) {
            let timeout;
            return function() {
                const context = this;
                const args = arguments;
                const later = function() {
                    timeout = null;
                    func.apply(context, args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
    };

    // Gestión de autenticación
    const Auth = {
        async login() {
            const emailEl = document.getElementById('email');
            const passwordEl = document.getElementById('password');
            
            if (!emailEl || !passwordEl) {
                Utils.showToast('Elementos de login no encontrados', 'error');
                return;
            }

            const email = emailEl.value.trim();
            const password = passwordEl.value.trim();

            if (!email || !password) {
                Utils.showToast('Por favor completa todos los campos', 'error');
                return;
            }

            try {
                AppState.isLoading = true;
                this.updateLoginButton(true);

                const response = await Utils.fetchAPI('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email: email, password: password })
                });

                AppState.currentUser = {
                    id: response.user.id,
                    name: response.user.name,
                    email: response.user.email,
                    token: response.token
                };

                this.updateAuthUI();
                Utils.showToast('¡Bienvenido, ' + response.user.name + '!', 'success');
                
                emailEl.value = '';
                passwordEl.value = '';

            } catch (error) {
                Utils.showToast('Error de autenticación. Verifica tus credenciales.', 'error');
            } finally {
                AppState.isLoading = false;
                this.updateLoginButton(false);
            }
        },

        logout: function() {
            AppState.currentUser = null;
            this.updateAuthUI();
            Utils.showToast('Sesión cerrada correctamente', 'info');
        },

        updateAuthUI: function() {
            const loginForm = document.getElementById('login-form');
            const userInfo = document.getElementById('user-info');
            const userName = document.getElementById('user-name');

            if (!loginForm || !userInfo || !userName) return;

            if (AppState.currentUser) {
                loginForm.style.display = 'none';
                userInfo.style.display = 'flex';
                userName.textContent = AppState.currentUser.name;
            } else {
                loginForm.style.display = 'flex';
                userInfo.style.display = 'none';
            }
        },

        updateLoginButton: function(loading) {
            const button = document.querySelector('#login-form button');
            if (!button) return;
            
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

                const response = await Utils.fetchAPI('/content/content');
                AppState.allContent = response.content || [];
                AppState.filteredContent = AppState.allContent.slice();

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
                const response = await Utils.fetchAPI('/content/content?limit=6');
                const featuredContent = response.content || [];
                this.renderFeatured(featuredContent);
            } catch (error) {
                const featuredEl = document.getElementById('featured-content');
                if (featuredEl) {
                    featuredEl.innerHTML = '<div class="loading-placeholder">Error al cargar contenido destacado</div>';
                }
            }
        },

        renderContent: function() {
            const grid = document.getElementById('content-grid');
            if (!grid) return;
            
            if (AppState.filteredContent.length === 0) {
                grid.innerHTML = '<div class="loading-placeholder">No se encontró contenido que coincida con los filtros</div>';
                return;
            }

            const contentHTML = AppState.filteredContent.map(function(item) {
                const genreTags = item.genre.map(function(g) {
                    return '<span class="genre-tag">' + g + '</span>';
                }).join('');

                return '<div class="content-card" onclick="window.Content.openPlayer(' + item.id + ')">' +
                    '<img src="' + item.thumbnail + '" alt="' + item.title + '" ' +
                    'onerror="this.src=\'https://via.placeholder.com/400x200/333/white?text=Video\'" loading="lazy">' +
                    '<div class="content-info">' +
                    '<div class="content-title">' + item.title + '</div>' +
                    '<div class="content-description">' + item.description + '</div>' +
                    '<div class="content-genre">' + genreTags + '</div>' +
                    '<div class="content-meta">' +
                    '<span>⏱️ ' + Utils.formatDuration(item.duration) + '</span>' +
                    '<span>⭐ ' + item.rating + '</span>' +
                    '<span>👁️ ' + Utils.formatNumber(item.views || 0) + '</span>' +
                    '</div>' +
                    '</div>' +
                    '</div>';
            }).join('');

            grid.innerHTML = contentHTML;
        },

        renderFeatured: function(content) {
            const container = document.getElementById('featured-content');
            if (!container) return;
            
            if (content.length === 0) {
                container.innerHTML = '<div class="loading-placeholder">No hay contenido destacado disponible</div>';
                return;
            }

            const featuredHTML = content.map(function(item) {
                return '<div class="content-card" onclick="window.Content.openPlayer(' + item.id + ')">' +
                    '<img src="' + item.thumbnail + '" alt="' + item.title + '" ' +
                    'onerror="this.src=\'https://via.placeholder.com/400x200/333/white?text=Video\'" loading="lazy">' +
                    '<div class="content-info">' +
                    '<div class="content-title">' + item.title + '</div>' +
                    '<div class="content-description">' + item.description + '</div>' +
                    '<div class="content-stats">' +
                    '<span>👁️ ' + Utils.formatNumber(item.views || 0) + '</span>' +
                    '<span>❤️ ' + Utils.formatNumber(item.likes || 0) + '</span>' +
                    '</div>' +
                    '</div>' +
                    '</div>';
            }).join('');

            container.innerHTML = featuredHTML;
        },

        async openPlayer(contentId) {
            try {
                const response = await Utils.fetchAPI('/content/content/' + contentId);
                const content = response;

                const titleEl = document.getElementById('player-title');
                const sourceEl = document.getElementById('video-source');
                const descEl = document.getElementById('video-description');
                const durationEl = document.getElementById('video-duration');
                const genreEl = document.getElementById('video-genre');
                const ratingEl = document.getElementById('video-rating');

                if (titleEl) titleEl.textContent = content.title;
                if (sourceEl) sourceEl.src = content.video_url;
                if (descEl) descEl.textContent = content.description;
                if (durationEl) durationEl.textContent = 'Duración: ' + Utils.formatDuration(content.duration);
                if (genreEl) genreEl.textContent = 'Género: ' + content.genre.join(', ');
                if (ratingEl) ratingEl.textContent = 'Rating: ' + content.rating;

                const modal = document.getElementById('video-player-modal');
                if (modal) {
                    modal.classList.add('active');
                    
                    const video = document.getElementById('main-video');
                    if (video) video.load();
                }
                
                Utils.showToast('Reproduciendo: ' + content.title, 'success');

            } catch (error) {
                Utils.showToast('Error al cargar el video', 'error');
            }
        },

        closePlayer: function() {
            const modal = document.getElementById('video-player-modal');
            const video = document.getElementById('main-video');
            
            if (video) video.pause();
            if (modal) modal.classList.remove('active');
        },

        showLoadingState: function() {
            const grid = document.getElementById('content-grid');
            if (grid) {
                grid.innerHTML = '<div class="loading-placeholder"><span class="loading"></span> Cargando contenido...</div>';
            }
        },

        showErrorState: function(message) {
            const grid = document.getElementById('content-grid');
            if (grid) {
                grid.innerHTML = '<div class="loading-placeholder">❌ ' + message + '</div>';
            }
        },

        applyFilters: function() {
            const genre = AppState.currentFilters.genre;
            const search = AppState.currentFilters.search;
            const sort = AppState.currentFilters.sort;
            
            let filtered = AppState.allContent.slice();

            if (genre) {
                filtered = filtered.filter(function(item) {
                    return item.genre.some(function(g) {
                        return g.toLowerCase().indexOf(genre.toLowerCase()) !== -1;
                    });
                });
            }

            if (search) {
                const searchLower = search.toLowerCase();
                filtered = filtered.filter(function(item) {
                    return item.title.toLowerCase().indexOf(searchLower) !== -1 ||
                           item.description.toLowerCase().indexOf(searchLower) !== -1 ||
                           item.genre.some(function(g) {
                               return g.toLowerCase().indexOf(searchLower) !== -1;
                           });
                });
            }

            filtered.sort(function(a, b) {
                switch (sort) {
                    case 'views':
                        return (b.views || 0) - (a.views || 0);
                    case 'likes':
                        return (b.likes || 0) - (a.likes || 0);
                    case 'release_date':
                        return new Date(b.release_date || 0) - new Date(a.release_date || 0);
                    default:
                        return a.title.localeCompare(b.title);
                }
            });

            AppState.filteredContent = filtered;
            this.renderContent();
            this.updateContentCount();
        },

        updateContentCount: function() {
            const countElement = document.getElementById('content-count');
            if (!countElement) return;
            
            const total = AppState.filteredContent.length;
            const totalAll = AppState.allContent.length;
            
            if (total === totalAll) {
                countElement.textContent = total + ' elementos';
            } else {
                countElement.textContent = total + ' de ' + totalAll + ' elementos';
            }
        }
    };

    // Navigation
    const Navigation = {
        showSection: function(sectionName) {
            const navLinks = document.querySelectorAll('.nav-link');
            for (let i = 0; i < navLinks.length; i++) {
                navLinks[i].classList.remove('active');
            }
            
            const activeLink = document.querySelector('[onclick*="' + sectionName + '"]');
            if (activeLink) {
                activeLink.classList.add('active');
            }

            const sections = document.querySelectorAll('.content-section');
            for (let i = 0; i < sections.length; i++) {
                sections[i].classList.remove('active');
            }
            
            const targetSection = document.getElementById(sectionName + '-section');
            if (targetSection) {
                targetSection.classList.add('active');
                AppState.currentSection = sectionName;
            }

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
                    break;
            }
        }
    };

    // System Monitor
    const SystemMonitor = {
        async init() {
            this.updateServiceStatus('api-status', 'healthy');
            this.updateServiceStatus('content-status', 'healthy');
            this.updateServiceStatus('prometheus-status', 'healthy');
            
            const self = this;
            setInterval(function() {
                self.quickHealthCheck();
            }, 30000);
        },

        async quickHealthCheck() {
            try {
                const response = await Utils.fetchAPI('/content/content?limit=1');
                if (response && response.content) {
                    this.updateServiceStatus('api-status', 'healthy');
                    this.updateServiceStatus('content-status', 'healthy');
                }
            } catch (error) {
                this.updateServiceStatus('api-status', 'error');
                this.updateServiceStatus('content-status', 'error');
            }
        },

        updateServiceStatus: function(elementId, status) {
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

    // Funciones globales
    window.showSection = function(section) {
        Navigation.showSection(section);
    };

    window.login = function() {
        Auth.login();
    };

    window.logout = function() {
        Auth.logout();
    };

    window.closeVideoPlayer = function() {
        Content.closePlayer();
    };

    window.loadFeaturedContent = function() {
        Content.loadFeatured();
    };

    window.applyFilters = function() {
        const genreEl = document.getElementById('genre-filter');
        const sortEl = document.getElementById('sort-filter');
        
        if (genreEl) AppState.currentFilters.genre = genreEl.value;
        if (sortEl) AppState.currentFilters.sort = sortEl.value;
        
        Content.applyFilters();
    };

    window.clearFilters = function() {
        const searchEl = document.getElementById('search-input');
        const genreEl = document.getElementById('genre-filter');
        const sortEl = document.getElementById('sort-filter');
        
        if (searchEl) searchEl.value = '';
        if (genreEl) genreEl.value = '';
        if (sortEl) sortEl.value = 'title';
        
        AppState.currentFilters = { genre: '', search: '', sort: 'title' };
        Content.applyFilters();
        
        Utils.showToast('Filtros limpiados', 'info');
    };

    window.performSearch = function() {
        const searchEl = document.getElementById('search-input');
        if (searchEl) {
            AppState.currentFilters.search = searchEl.value.trim();
            Content.applyFilters();
            
            if (AppState.currentFilters.search) {
                Utils.showToast('Buscando: "' + AppState.currentFilters.search + '"', 'info');
            }
        }
    };

    // Exponer objetos para debugging
    window.Content = Content;
    window.Auth = Auth;
    window.VODPlatform = {
        AppState: AppState,
        Utils: Utils,
        Auth: Auth,
        Content: Content,
        Navigation: Navigation,
        SystemMonitor: SystemMonitor
    };

    // Inicialización
    document.addEventListener('DOMContentLoaded', async function() {
        console.log('🚀 VOD Platform iniciando...');
        
        Auth.updateAuthUI();
        await SystemMonitor.init();
        Navigation.showSection('home');
        
        // Event listeners
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce(function() {
                AppState.currentFilters.search = searchInput.value.trim();
                Content.applyFilters();
            }, 300));
            
            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    window.performSearch();
                }
            });
        }

        const emailInput = document.getElementById('email');
        if (emailInput) {
            emailInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    const passwordInput = document.getElementById('password');
                    if (passwordInput) passwordInput.focus();
                }
            });
        }
        
        const passwordInput = document.getElementById('password');
        if (passwordInput) {
            passwordInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    Auth.login();
                }
            });
        }

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                Content.closePlayer();
            }
        });

        const modal = document.getElementById('video-player-modal');
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target.id === 'video-player-modal') {
                    Content.closePlayer();
                }
            });
        }

        console.log('✅ VOD Platform iniciado correctamente');
        Utils.showToast('¡Plataforma VOD cargada correctamente!', 'success');
    });

})();