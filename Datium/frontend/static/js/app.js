function getToken() {
    return localStorage.getItem('token');
}

function setToken(token) {
    localStorage.setItem('token', token);
}

const DATIUM_USER_CACHE_KEY = 'datium_session_user_v1';

function defaultSidebarAvatarSrc() {
    return document.documentElement.classList.contains('dark')
        ? '/static/img/Isotipo modo oscuro.jpeg'
        : '/static/img/Isotipo modo claro.jpeg';
}

window.datiumDefaultAvatarUrl = defaultSidebarAvatarSrc;

function readCachedUser() {
    try {
        const raw = sessionStorage.getItem(DATIUM_USER_CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function writeCachedUser(user) {
    try {
        if (!user) {
            sessionStorage.removeItem(DATIUM_USER_CACHE_KEY);
            return;
        }
        sessionStorage.setItem(
            DATIUM_USER_CACHE_KEY,
            JSON.stringify({
                name: user.name || '',
                email: user.email || '',
                avatarUrl: (user.avatarUrl || '').trim(),
            })
        );
    } catch (e) {
        /* ignore */
    }
}

function applySidebarUserSnapshot(user) {
    const nameEl = document.getElementById('userName');
    const emailEl = document.getElementById('userEmail');
    const initialEl = document.getElementById('userInitial');
    const avatarEl = document.getElementById('userAvatar');
    if (!nameEl && !emailEl) return;

    const displayName = user && user.name ? user.name : 'Usuario';
    const displayEmail = user && user.email ? user.email : '';
    if (nameEl) nameEl.textContent = displayName;
    if (emailEl) emailEl.textContent = displayEmail || '—';

    if (avatarEl && initialEl) {
        const url = user && user.avatarUrl ? String(user.avatarUrl).trim() : '';
        avatarEl.classList.remove('object-contain', 'p-1.5', 'bg-white', 'dark:bg-gray-900');
        if (url) {
            avatarEl.src = url;
            avatarEl.classList.remove('hidden');
            avatarEl.classList.add('object-cover');
            initialEl.classList.add('hidden');
        } else {
            avatarEl.src = defaultSidebarAvatarSrc();
            avatarEl.classList.remove('hidden');
            avatarEl.classList.add('object-contain', 'p-1.5', 'bg-white', 'dark:bg-gray-900');
            avatarEl.classList.remove('object-cover');
            initialEl.classList.add('hidden');
        }
    }
}

window.datiumApplySidebar = function (user) {
    writeCachedUser(user);
    applySidebarUserSnapshot(user);
};

function hydrateSidebarFromCache() {
    const u = readCachedUser();
    applySidebarUserSnapshot(u || { name: 'Usuario', email: '', avatarUrl: '' });
}

window.datiumCacheUserFromAuth = function (u) {
    if (!u) return;
    writeCachedUser({
        name: u.name,
        email: u.email,
        avatarUrl: u.avatarUrl || '',
    });
    applySidebarUserSnapshot({ name: u.name, email: u.email, avatarUrl: u.avatarUrl || '' });
};

window.datiumRefreshDefaultSidebarAvatar = function () {
    const u = readCachedUser();
    if (u && u.avatarUrl) return;
    applySidebarUserSnapshot(u || { name: 'Usuario', email: '', avatarUrl: '' });
};

function logout() {
    localStorage.removeItem('token');
    try {
        sessionStorage.removeItem(DATIUM_USER_CACHE_KEY);
    } catch (e) {
        /* ignore */
    }
    window.location.href = 'login.html';
}

function checkAuth() {
    if (!getToken()) {
        window.location.href = 'login.html';
    }
}

async function apiFetch(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }

    const response = await fetch(API_URL + endpoint, {
        cache: 'no-store',
        ...options,
        headers,
        credentials: 'include'
    });

    if (response.status === 401) {
        logout();
        return;
    }

    return response;
}

let _loadingDepth = 0;

function showLoading(message) {
    // Pantalla de carga deshabilitada globalmente
    return;
}

function hideLoading() {
    // Pantalla de carga deshabilitada globalmente
    return;
}

function sanitize(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str.toString();
    return div.innerHTML;
}

function showSuccess(message = 'Listo', callback = null) {
    showToast(message, 'success');
    if (callback) setTimeout(callback, 300);
}

function showError(message = 'Ha ocurrido un error') {
    showToast(message, 'error');
}

function showToast(message, type = 'info') {
    const containerId = 'toast-container';
    let container = document.getElementById(containerId);

    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.className = 'fixed top-4 right-4 z-[120] flex flex-col gap-3 pointer-events-none';
        document.body.appendChild(container);
    }

    const toastId = 'toast-' + Date.now();
    const icons = { error: 'error', success: 'check_circle', info: 'info', warning: 'warning' };
    const colors = { error: 'border-red-500', success: 'border-emerald-500', info: 'border-blue-500', warning: 'border-amber-500' };
    const iconColors = { error: 'text-red-500', success: 'text-emerald-500', info: 'text-blue-500', warning: 'text-amber-500' };
    const titles = { error: 'Error', success: 'Exito', info: 'Info', warning: 'Aviso' };

    const icon = icons[type] || icons.info;
    const borderColor = colors[type] || colors.info;
    const iconColor = iconColors[type] || iconColors.info;
    const title = titles[type] || titles.info;

    const html = `
        <div id="${toastId}" class="pointer-events-auto min-w-[300px] max-w-md bg-white dark:bg-[#1e293b] border-l-4 ${borderColor} shadow-xl rounded-lg p-4 flex items-start gap-3 transform translate-x-full transition-all duration-300">
            <span class="material-symbols-outlined ${iconColor} mt-0.5">${icon}</span>
            <div class="flex-1">
                <h4 class="font-bold text-[#111418] dark:text-white text-sm mb-0.5">${title}</h4>
                <p class="text-gray-500 dark:text-gray-400 text-sm leading-tight">${message}</p>
            </div>
            <button onclick="document.getElementById('${toastId}').classList.add('translate-x-full', 'opacity-0'); setTimeout(() => document.getElementById('${toastId}').remove(), 300);"
                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                <span class="material-symbols-outlined text-lg">close</span>
            </button>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', html);

    requestAnimationFrame(() => {
        const toast = document.getElementById(toastId);
        if (toast) toast.classList.remove('translate-x-full');
    });

    setTimeout(() => {
        const toast = document.getElementById(toastId);
        if (toast) {
            toast.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}



function showConfirm(message, onConfirm) {
    const existing = document.getElementById('confirm-modal');
    if (existing) existing.remove();

    const html = `
        <div id="confirm-modal" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm opacity-0 transition-opacity duration-300">
            <div class="bg-white dark:bg-[#1e293b] rounded-2xl p-6 shadow-2xl max-w-sm w-full transform scale-95 transition-transform duration-300">
                <div class="flex flex-col gap-4 text-center">
                    <div class="mx-auto p-3 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500">
                        <span class="material-symbols-outlined text-3xl">help</span>
                    </div>
                    <h3 class="text-lg font-bold text-[#111418] dark:text-white">Confirmar accion</h3>
                    <p class="text-gray-500 dark:text-gray-400 text-sm">${message}</p>
                    <div class="flex gap-3 justify-center mt-2">
                        <button id="confirm-cancel" class="datium-btn datium-btn-ghost">Cancelar</button>
                        <button id="confirm-ok" class="datium-btn datium-btn-primary">Confirmar</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    const modal = document.getElementById('confirm-modal');

    requestAnimationFrame(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.remove('scale-95');
        modal.querySelector('div').classList.add('scale-100');
    });

    document.getElementById('confirm-cancel').onclick = () => {
        modal.classList.add('opacity-0');
        setTimeout(() => modal.remove(), 300);
    };

    document.getElementById('confirm-ok').onclick = () => {
        modal.classList.add('opacity-0');
        setTimeout(() => {
            modal.remove();
            if (onConfirm) onConfirm();
        }, 300);
    };
}

function promptPassword(onSuccess) {
    const existing = document.getElementById('password-prompt-modal');
    if (existing) existing.remove();

    const html = `
        <div id="password-prompt-modal" class="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm opacity-0 transition-opacity duration-300">
            <div class="bg-white dark:bg-[#151f2b] rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col items-center text-center transform scale-95 transition-transform duration-300">
                <div class="flex flex-col gap-4 text-center">
                    <div class="mx-auto p-3 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500">
                        <span class="material-symbols-outlined text-3xl">lock</span>
                    </div>
                    <h3 class="text-lg font-bold text-[#111418] dark:text-white">Verificacion Requerida</h3>
                    <p class="text-gray-500 dark:text-gray-400 text-sm">Por seguridad, ingresa tu contrasena para continuar.</p>
                    <div class="mt-2 text-left">
                        <input type="password" id="prompt-password-input" placeholder="Tu contrasena"
                            class="datium-input">
                        <p id="prompt-error" class="text-xs text-red-500 mt-2 hidden"></p>
                    </div>
                    <div class="flex gap-3 justify-center mt-2">
                        <button id="prompt-cancel" class="datium-btn datium-btn-ghost">Cancelar</button>
                        <button id="prompt-confirm" class="datium-btn datium-btn-danger">Confirmar</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    const modal = document.getElementById('password-prompt-modal');
    const input = document.getElementById('prompt-password-input');
    const errorMsg = document.getElementById('prompt-error');
    const confirmBtn = document.getElementById('prompt-confirm');

    requestAnimationFrame(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.remove('scale-95');
        modal.querySelector('div').classList.add('scale-100');
        input.focus();
    });

    const close = () => {
        modal.classList.add('opacity-0');
        setTimeout(() => modal.remove(), 300);
    };

    document.getElementById('prompt-cancel').onclick = close;

    const verify = async () => {
        const password = input.value;
        if (!password) {
            errorMsg.innerText = "Ingresa tu contrasena";
            errorMsg.classList.remove('hidden');
            return;
        }

        confirmBtn.disabled = true;
        confirmBtn.innerText = "Verificando...";
        errorMsg.classList.add('hidden');

        try {
            const res = await apiFetch('/user/verify-password', {
                method: 'POST',
                body: JSON.stringify({ password })
            });

            if (res.ok) {
                close();
                if (onSuccess) onSuccess(password);
            } else {
                const data = await res.json();
                errorMsg.innerText = data.error || "Contrasena incorrecta";
                errorMsg.classList.remove('hidden');
                confirmBtn.disabled = false;
                confirmBtn.innerText = "Confirmar";
            }
        } catch (e) {
            errorMsg.innerText = "Error de conexion";
            errorMsg.classList.remove('hidden');
            confirmBtn.disabled = false;
            confirmBtn.innerText = "Confirmar";
        }
    };

    confirmBtn.onclick = verify;
    input.onkeyup = (e) => {
        if (e.key === 'Enter') verify();
    };
}

function toggleSidebar() {
    const sidebar = document.querySelector('aside');
    const overlay = document.getElementById('sidebarOverlay');

    if (sidebar) {
        if (sidebar.classList.contains('-translate-x-full')) {
            sidebar.classList.remove('-translate-x-full');
            if (overlay) overlay.classList.remove('hidden');
        } else {
            sidebar.classList.add('-translate-x-full');
            if (overlay) overlay.classList.add('hidden');
        }
    }
}

function ensureChatNavLink() {
    const nav = document.querySelector('aside nav');
    if (!nav) return;
    let link = nav.querySelector('a[href="chat.html"]');
    const current = (window.location.pathname || '').toLowerCase();
    const isChat = current.endsWith('/chat.html') || current.endsWith('/chatbot/chat.html');
    const cls = isChat ? 'sidebar-link active' : 'sidebar-link';
    if (!link) {
        nav.insertAdjacentHTML(
            'beforeend',
            `<a href="chat.html" class="${cls}" style="color: var(--primary)">
            <span class="material-symbols-outlined">smart_toy</span>
            Datium IA
        </a>`
        );
        return;
    }
    link.className = cls;
    link.setAttribute('href', 'chat.html');
}

async function datiumRefreshSessionUser() {
    if (!getToken()) return null;
    const res = await apiFetch('/user/profile');
    if (!res || !res.ok) return null;
    const user = await res.json();
    window.usuarioActual = user;

    writeCachedUser(user);
    applySidebarUserSnapshot(user);

    ensureChatNavLink();

    if (user.role === 'admin') {
        const nav = document.querySelector('aside nav');
        if (nav && !nav.querySelector('a[href="admin.html"]')) {
            nav.insertAdjacentHTML(
                'beforeend',
                `<a href="admin.html" class="sidebar-link" style="color: var(--danger); margin-top: 0.5rem; border-top: 1px solid var(--border); padding-top: 1rem;">
                            <span class="material-symbols-outlined">shield_person</span>
                            Panel Admin
                        </a>`
            );
        }
    }

    try {
        window.dispatchEvent(new CustomEvent('datium:session-user', { detail: user }));
    } catch (e) {
        /* ignore */
    }

    return user;
}

window.datiumRefreshSessionUser = datiumRefreshSessionUser;

function injectReportSystem() {
    if (!getToken()) return;
    if (document.getElementById('reportFab')) return;

    const fabHtml = `
        <button id="reportFab" onclick="openReportModal()" class="fixed bottom-6 right-6 bg-red-600 hover:bg-red-700 text-white px-4 py-4 rounded-full shadow-2xl flex items-center justify-center z-50 group transition-all hover:scale-110" aria-label="Reportar problema">
            <span class="material-symbols-outlined">bug_report</span>
            <span class="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 ease-in-out font-bold group-hover:ml-2">Reportar</span>
        </button>
    `;
    document.body.insertAdjacentHTML('beforeend', fabHtml);

    const modalHtml = `
        <div id="reportModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] hidden flex-col items-center justify-center p-4">
            <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl transform transition-transform scale-95 opacity-0 duration-200" id="reportModalContent">
                <div class="flex items-center gap-3 mb-6">
                    <div class="icon-circle icon-circle-danger">
                        <span class="material-symbols-outlined font-bold">bug_report</span>
                    </div>
                    <h3 class="text-xl font-black text-gray-900 dark:text-white truncate">Reportar un Problema</h3>
                </div>
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Titulo</label>
                        <input type="text" id="reportTitle" placeholder="Ej. El boton no funciona" class="datium-input">
                    </div>
                    <div>
                        <label class="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Descripcion</label>
                        <textarea id="reportSummary" rows="4" placeholder="Que estabas intentando hacer?" class="datium-input resize-none"></textarea>
                    </div>
                    <div class="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl">
                        <span class="material-symbols-outlined text-amber-500 mt-0.5">info</span>
                        <p class="text-xs text-amber-700 dark:text-amber-400 font-medium">Se adjuntara una captura de pantalla automaticamente.</p>
                    </div>
                </div>
                <div class="flex justify-end gap-3 mt-8">
                    <button onclick="closeReportModal()" class="datium-btn datium-btn-ghost">Cancelar</button>
                    <button onclick="submitReport()" class="datium-btn datium-btn-danger">
                        <span>Enviar</span>
                        <span class="material-symbols-outlined text-sm">send</span>
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function loadHtml2Canvas() {
    if (typeof html2canvas !== 'undefined') return Promise.resolve();
    return new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-report-capture="1"]');
        if (existing) {
            const t0 = Date.now();
            const poll = () => {
                if (typeof html2canvas !== 'undefined') return resolve();
                if (Date.now() - t0 > 20000) return reject(new Error('timeout html2canvas'));
                requestAnimationFrame(poll);
            };
            poll();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.dataset.reportCapture = '1';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('No se pudo cargar html2canvas'));
        document.head.appendChild(script);
    });
}

window.openReportModal = function () {
    const modal = document.getElementById('reportModal');
    const content = document.getElementById('reportModalContent');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
    }, 10);
};

window.closeReportModal = function () {
    const modal = document.getElementById('reportModal');
    const content = document.getElementById('reportModalContent');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.getElementById('reportTitle').value = '';
        document.getElementById('reportSummary').value = '';
    }, 200);
};

window.submitReport = async function () {
    const title = document.getElementById('reportTitle').value.trim();
    const summary = document.getElementById('reportSummary').value.trim();

    if (!title || !summary) return showError('Completa todos los campos');

    closeReportModal();
    showLoading('Tomando captura...');

    try {
        await loadHtml2Canvas();

        const fab = document.getElementById('reportFab');
        if (fab) fab.style.display = 'none';

        const canvas = await html2canvas(document.body, {
            useCORS: true,
            allowTaint: true,
            backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#f1f5f9'
        });

        if (fab) fab.style.display = '';

        const msgEl = document.getElementById('datium-global-loading-msg');
        if (msgEl) msgEl.textContent = 'Subiendo evidencia...';
        const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
        const formData = new FormData();
        formData.append('file', blob, 'report.png');

        const token = getToken();
        let screenshotUrl = '';

        try {
            const uploadRes = await fetch(API_URL + '/upload/image', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token },
                body: formData
            });

            if (uploadRes.ok) {
                const data = await uploadRes.json();
                screenshotUrl = data.url;
            }
        } catch (e) {
            console.warn('Screenshot upload issue', e);
        }

        if (msgEl) msgEl.textContent = 'Enviando reporte...';
        const repRes = await apiFetch('/user/reports', {
            method: 'POST',
            body: JSON.stringify({
                title, summary, screenshot_url: screenshotUrl
            })
        });

        if (repRes.ok) {
            showSuccess('Reporte enviado correctamente.');
        } else {
            showError('Error al enviar el reporte');
        }

    } catch (e) {
        console.error(e);
        showError('No se pudo procesar tu reporte. ' + (e.message || ''));
    } finally {
        hideLoading();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    injectReportSystem();

    if (!document.getElementById('sidebarOverlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'sidebarOverlay';
        overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-40 hidden md:hidden transition-opacity';
        overlay.onclick = toggleSidebar;
        document.body.appendChild(overlay);
    }

    if (getToken() && !window.location.pathname.includes('login.html') && !window.location.pathname.includes('register.html')) {
        hydrateSidebarFromCache();
        datiumRefreshSessionUser().catch((e) => console.warn(e));
    }
});
