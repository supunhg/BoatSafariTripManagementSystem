
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/me');
        const result = await response.json();
        
        if (response.ok && result.user) {
            updateAuthUI(result.user);
            localStorage.setItem('user', JSON.stringify(result.user));
        } else {
            updateAuthUI(null);
            localStorage.removeItem('user');
        }
    } catch (error) {
        console.error('Auth check error:', error);
        updateAuthUI(null);
        localStorage.removeItem('user');
    }
}

function updateAuthUI(user) {
    const authNav = document.getElementById('auth-nav');
    const userInfo = document.getElementById('user-info');
    const userName = document.getElementById('user-name');
    const getStartedBtn = document.getElementById('get-started-btn');
    
    if (user) {
        if (authNav) {
            authNav.innerHTML = '<a href="/dashboard">Dashboard</a>';
        }
        
        if (userInfo) {
            userInfo.style.display = 'flex';
        }
        
        if (userName) {
            userName.textContent = `${user.firstName} ${user.lastName}`;
        }
        
        if (getStartedBtn) {
            getStartedBtn.textContent = 'Dashboard';
            getStartedBtn.href = '/dashboard';
        }
    } else {
        if (authNav) {
            authNav.innerHTML = '<a href="/login">Login</a>';
        }
        
        if (userInfo) {
            userInfo.style.display = 'none';
        }
        
        if (getStartedBtn) {
            getStartedBtn.textContent = 'Get Started';
            getStartedBtn.href = '/register';
        }
    }
}

async function logout() {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST'
        });
        
        if (response.ok) {
            localStorage.removeItem('user');
            window.location.href = '/';
        } else {
            console.error('Logout failed');
        }
    } catch (error) {
        console.error('Logout error:', error);
        localStorage.removeItem('user');
        window.location.href = '/';
    }
}

function requireAuth() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user) {
        window.location.href = '/login';
        return false;
    }
    return true;
}

function requireRole(allowedRoles) {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user || !allowedRoles.includes(user.role)) {
        window.location.href = '/dashboard';
        return false;
    }
    return true;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function formatTime(timeString) {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes), 0);
    return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
}

function formatDateTime(dateString, timeString) {
    return `${formatDate(dateString)} at ${formatTime(timeString)}`;
}

function setButtonLoading(button, loading = true) {
    const text = button.querySelector('.btn-text') || button;
    const spinner = button.querySelector('.loading');
    
    if (loading) {
        button.disabled = true;
        if (text !== button) text.style.display = 'none';
        if (spinner) spinner.style.display = 'inline-block';
    } else {
        button.disabled = false;
        if (text !== button) text.style.display = 'inline';
        if (spinner) spinner.style.display = 'none';
    }
}

function showAlert(message, type = 'info', containerId = 'alert-container') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const alertClass = {
        'success': 'alert-success',
        'error': 'alert-error',
        'warning': 'alert-warning',
        'info': 'alert-info'
    }[type] || 'alert-info';
    
    container.innerHTML = `
        <div class="alert ${alertClass}">
            ${message}
        </div>
    `;
    
    setTimeout(() => {
        if (container.innerHTML.includes(message)) {
            container.innerHTML = '';
        }
    }, 5000);
}

async function apiRequest(url, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        }
    };
    
    const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };
    
    try {
        const response = await fetch(url, finalOptions);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API request error:', error);
        throw error;
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
}

function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

function createLoadingElement() {
    const loading = document.createElement('div');
    loading.className = 'loading';
    return loading;
}

function debounce(func, wait) {
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

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function calculateAge(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    return age;
}

function initializeUI() {
    
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => {
            const navMenu = document.querySelector('.nav-menu');
            navMenu.classList.toggle('show');
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeUI();
});