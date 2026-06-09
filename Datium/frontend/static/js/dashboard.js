const ensureAuth = window.checkAuth || window.validarSesion;
if (ensureAuth) ensureAuth();

let editingSystemId = null;
let currentSystems = [];
let userProfile = null;
let activityChart = null;
let planChart = null;
let securityChart = null;
let promptCallback = null;

async function init() {
    await loadUserProfile();
    await Promise.all([loadSystems(), loadStatistics()]);

    window.addEventListener('message', (event) => {
        if (event.data.type === 'startLoading') {
            document.getElementById('loadingOverlay').classList.remove('hidden');
        } else if (event.data.type === 'stopLoading') {
            document.getElementById('loadingOverlay').classList.add('hidden');
        } else if (event.data.type === 'systemSaved') {
            document.getElementById('loadingOverlay').classList.add('hidden');
            toggleCreateForm();
            loadSystems();
            loadStatistics();
        } else if (event.data.type === 'closeModal') {
            toggleCreateForm();
        }
    });
}

async function loadUserProfile() {
    try {
        const res = await apiFetch('/user/profile');
        if (res && res.ok) {
            userProfile = await res.json();
            if (userProfile.role === 'admin') {
                window.location.href = 'admin.html';
                return;
            }
            updateUserUI();
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

function updateUserUI() {
    if (!userProfile) return;

    if (typeof window.datiumApplySidebar === 'function') {
        window.datiumApplySidebar(userProfile);
    } else {
        const nameEl = document.getElementById('userName');
        const emailEl = document.getElementById('userEmail');
        const initialEl = document.getElementById('userInitial');
        if (nameEl) nameEl.innerText = userProfile.name || 'Usuario';
        if (emailEl) emailEl.innerText = userProfile.email || '...';
        if (initialEl) initialEl.innerText = (userProfile.name || 'U').charAt(0).toUpperCase();
        if (userProfile.avatarUrl) {
            const avatarImg = document.getElementById('userAvatar');
            if (avatarImg) {
                avatarImg.src = userProfile.avatarUrl;
                avatarImg.classList.remove('hidden');
                if (initialEl) initialEl.classList.add('hidden');
            }
        }
    }

    const expertiseLevel = userProfile.expertise_level || 'beginner';
    document.body.setAttribute('data-expertise', expertiseLevel);
}

async function loadSystems() {
    try {
        const res = await apiFetch('/systems');
        if (res && res.ok) {
            currentSystems = await res.json();
            renderSystemsTable();
        } else {
            showError('Error al cargar sistemas');
        }
    } catch (error) {
        showError('Error de red al cargar sistemas');
    }
}

function renderSystemsTable() {
    const container = document.getElementById('systemsList');
    const emptyState = document.getElementById('emptyState');

    if (!container) return;

    if (currentSystems.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    container.innerHTML = currentSystems.map(system => {
        const createdDate = system.createdAt ? new Date(system.createdAt).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }) : 'N/A';

        let imageUrl = system.imageUrl || '/static/img/Isotipo modo claro.jpeg';
        if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
            imageUrl = '/' + imageUrl;
        }
        const securityIcon = system.securityMode === 'none' ? 'lock_open' :
            system.securityMode === 'general' ? 'lock' : 'admin_panel_settings';
        const securityColor = system.securityMode === 'none' ? 'text-gray-400' :
            system.securityMode === 'general' ? 'text-yellow-400' : 'text-green-400';

        const isOwner = system.isOwner === true;

        return `
            <tr class="hover:bg-gray-50 dark:hover:bg-[#1a2634] transition-colors cursor-pointer" onclick="enterSystem(${system.id})">
                <td class="py-4 px-5">
                    <div class="flex items-center justify-center">
                        <img src="${imageUrl}" alt="${system.name}"
                             class="w-10 h-10 rounded-lg object-cover border border-gray-700"
                             onerror="this.src='/static/img/Isotipo modo claro.jpeg'">
                    </div>
                </td>
                <td class="py-4 px-5">
                    <div class="flex flex-col">
                        <span class="text-[#111418] dark:text-white font-bold text-sm">${system.name || 'Sin nombre'}</span>
                        <span class="text-gray-400 text-xs truncate max-w-xs">${system.description || 'Sin descripcion'}</span>
                    </div>
                </td>
                <td class="py-4 px-5 text-center">
                    <div class="flex items-center justify-center gap-1">
                        <span class="material-symbols-outlined text-gray-400 text-sm">group</span>
                        <span class="text-[#111418] dark:text-white font-medium text-sm">${system.userCount || 1}</span>
                    </div>
                </td>
                <td class="py-4 px-5">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined ${securityColor} text-sm">${securityIcon}</span>
                        <span class="text-gray-400 text-xs">${createdDate}</span>
                    </div>
                </td>
                <td class="py-4 px-5 text-right">
                    <div class="flex items-center justify-end gap-2">
                        ${isOwner ? `
                        <button onclick="openInvitationModal(event, ${system.id})"
                                class="action-btn"
                                title="Invitar Usuarios">
                            <span class="material-symbols-outlined text-sm">person_add</span>
                        </button>` : ''}
                        ${isOwner ? `
                        <button onclick="editSystem(event, ${system.id})"
                                class="action-btn"
                                title="Editar">
                            <span class="material-symbols-outlined text-sm">edit</span>
                        </button>` : ''}
                        ${isOwner ? `
                        <button onclick="deleteSystem(event, ${system.id})"
                                class="action-btn action-btn-danger"
                                title="Eliminar">
                            <span class="material-symbols-outlined text-sm">delete</span>
                        </button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderSystemsSlider() {}

async function enterSystem(id) {
    checkSystemAccess(id, () => {
        window.location.href = `system.html?id=${id}`;
    });
}

async function checkSystemAccess(systemId, actionCallback) {
    const system = currentSystems.find(s => s.id === systemId);
    if (!system) return;

    if (system.securityMode === 'general') {
        openPasswordPrompt(systemId, actionCallback);
        return;
    }

    if (userProfile && system.ownerId === userProfile.id) {
        actionCallback();
        return;
    }

    actionCallback();
}

function openPasswordPrompt(systemId, callback) {
    promptCallback = (password) => verifyAnd(systemId, password, callback);
    document.getElementById('promptPasswordInput').value = '';
    document.getElementById('passwordErrorMsg').classList.add('hidden');
    document.getElementById('passwordPromptModal').classList.remove('hidden');
}

function closePasswordPrompt() {
    document.getElementById('passwordPromptModal').classList.add('hidden');
    promptCallback = null;
}

async function verifyAnd(systemId, password, callback) {
    if (!password) {
        showPasswordError('La contrasena es requerida');
        return;
    }

    try {
        const res = await apiFetch(`/systems/${systemId}/verify-password`, {
            method: 'POST',
            body: JSON.stringify({ password: password })
        });

        if (res.ok) {
            closePasswordPrompt();
            callback();
        } else {
            showPasswordError('Contrasena incorrecta');
        }
    } catch (e) {
        showPasswordError('Error de verificacion');
    }
}

function confirmPassword() {
    if (promptCallback) {
        const pwd = document.getElementById('promptPasswordInput').value;
        promptCallback(pwd);
    }
}

function showPasswordError(msg) {
    const el = document.getElementById('passwordErrorMsg');
    el.innerText = msg;
    el.classList.remove('hidden');
}

async function editSystem(event, id) {
    if (event) event.stopPropagation();
    checkSystemAccess(id, () => {
        window.location.href = `system_form.html?id=${id}`;
    });
}

async function deleteSystem(event, id) {
    if (event) event.stopPropagation();

    showConfirm('Esta accion eliminara el sistema y todos sus datos. No se puede deshacer.', () => {
        promptPassword(async () => {
            showLoading('Eliminando sistema...');
            try {
                const res = await apiFetch(`/systems/${id}`, { method: 'DELETE' });
                if (res && res.ok) {
                    showSuccess('Sistema eliminado', () => {
                        loadSystems();
                        loadStatistics();
                    });
                } else {
                    const errorData = await res.json();
                    showError(errorData.message || 'Error al eliminar sistema');
                }
            } catch (e) {
                showError('Error de conexion');
            }
        });
    });
}

async function loadStatistics() {
    const res = await apiFetch('/systems/estadisticas');
    if (res && res.ok) {
        const stats = await res.json();

        animateValue('statTotalSystems', 0, stats.totalSystems || 0, 1000);
        animateValue('statTotalUsers', 0, stats.totalUsers || 0, 1000);
        animateValue('statTotalRecords', 0, stats.totalRecords || 0, 1000);

        const totalSecure = (stats.securityGeneral || 0) + (stats.securityIndividual || 0);
        animateValue('statSecureSystems', 0, totalSecure, 1000);

        if (stats.planUsage) {
            const usage = stats.planUsage;
            const planNameEl = document.getElementById('statPlanName');
            const planUsageEl = document.getElementById('statPlanUsage');

            if (planNameEl) planNameEl.innerText = usage.planName || 'Basico';
            if (planUsageEl) {
                if (usage.planName === 'Empresarial') {
                    planUsageEl.innerText = `${usage.current} / Ilimitado`;
                } else {
                    planUsageEl.innerText = usage.max === -1
                        ? `${usage.current} / ∞ Usados`
                        : `${usage.current} / ${usage.max} Usados`;
                }
            }

            renderPlanChart(usage);
        }

        renderActivityChart(stats.activityLabels, stats.activityData);
        renderSecurityChart(stats);
    }
}

function renderSecurityChart(stats) {
    const ctx = document.getElementById('securityChart');
    if (!ctx) return;

    if (securityChart) securityChart.destroy();

    const secure = (stats.securityGeneral || 0) + (stats.securityIndividual || 0);
    const notSecure = stats.securityNone || 0;

    securityChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Segura', 'Ninguna'],
            datasets: [{
                data: [secure, notSecure],
                backgroundColor: ['#10b981', '#ef4444'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { display: false },
                tooltip: { enabled: true }
            },
            animation: { animateRotate: true, duration: 800 }
        }
    });
}

function renderPlanChart(usage) {
    const ctx = document.getElementById('planChart');
    if (!ctx) return;

    if (planChart) planChart.destroy();

    const max = usage.max === -1 ? 100 : usage.max;
    const current = usage.current;

    const data = usage.max === -1
        ? [0, 100]
        : [current, Math.max(0, max - current)];

    planChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Usado', 'Disponible'],
            datasets: [{
                data: data,
                backgroundColor: ['#ef4444', '#10b981'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            animation: { animateRotate: true, duration: 800 }
        }
    });
}

function renderActivityChart(labels, data) {
    const ctx = document.getElementById('activityChart');
    if (!ctx) return;

    if (activityChart) activityChart.destroy();

    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

    activityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels || ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'],
            datasets: [{
                label: 'Interacciones',
                data: data || [0, 0, 0, 0, 0, 0, 0],
                borderColor: '#3b82f6',
                backgroundColor: (context) => {
                    const bg = context.chart.ctx.createLinearGradient(0, 0, 0, 300);
                    bg.addColorStop(0, 'rgba(59, 130, 246, 0.15)');
                    bg.addColorStop(1, 'rgba(59, 130, 246, 0)');
                    return bg;
                },
                borderWidth: 2,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: isDark ? '#1e293b' : '#ffffff',
                pointBorderColor: '#3b82f6',
                pointBorderWidth: 2,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                    titleColor: isDark ? '#fff' : '#0f172a',
                    bodyColor: isDark ? '#94a3b8' : '#64748b',
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 10,
                    displayColors: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: gridColor, drawBorder: false },
                    ticks: { color: '#64748b', font: { size: 10 } }
                },
                x: {
                    grid: { color: gridColor, drawBorder: false },
                    ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 0 }
                }
            },
            interaction: { intersect: false, mode: 'nearest' },
            animation: { duration: 1000, easing: 'easeOutQuart' }
        }
    });
}

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;

    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

function toggleCreateForm() {
    const container = document.getElementById('createSystemContainer');
    const isHidden = container.classList.contains('hidden');
    const iframe = document.getElementById('systemFormFrame');

    if (isHidden) {
        container.classList.remove('hidden');
        if (!editingSystemId) {
            iframe.contentWindow.postMessage({ type: 'resetForm' }, '*');
        }
    } else {
        container.classList.add('hidden');
        editingSystemId = null;
        iframe.contentWindow.postMessage({ type: 'resetForm' }, '*');
    }
}

window.toggleCreateForm = toggleCreateForm;

let currentInvitationSystemId = null;

function openInvitationModal(event, systemId) {
    if (event) event.stopPropagation();
    currentInvitationSystemId = systemId;
    document.getElementById('invitationModal').classList.remove('hidden');
    document.getElementById('inviteEmail').value = '';
    loadInvitations(systemId);
}

function closeInvitationModal() {
    document.getElementById('invitationModal').classList.add('hidden');
    currentInvitationSystemId = null;
}

async function loadInvitations(systemId) {
    const listEl = document.getElementById('invitationsList');
    listEl.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">Cargando...</div>';

    try {
        const res = await apiFetch(`/systems/${systemId}/invitations`);
        if (res.ok) {
            const invitations = await res.json();
            if (invitations.length === 0) {
                listEl.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">No hay usuarios invitados aun.</div>';
                return;
            }

            listEl.innerHTML = invitations.map(inv => `
                <div class="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800 space-y-3">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                                ${(inv.name || inv.email).charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div class="text-sm font-bold text-[#111418] dark:text-white">${inv.name || 'Usuario'}</div>
                                <div class="text-[10px] text-gray-400 uppercase font-black">${inv.email}</div>
                            </div>
                        </div>
                        <button onclick="revokeInvitation(${systemId}, ${inv.id})"
                            class="action-btn action-btn-danger" title="Revocar acceso">
                            <span class="material-symbols-outlined text-lg">block</span>
                        </button>
                    </div>
                    <div class="flex flex-wrap gap-2 text-[10px] text-gray-500">
                        Permisos de tablas desde la vista del sistema.
                    </div>
                </div>
            `).join('');
        } else {
            listEl.innerHTML = '<div class="text-center py-8 text-red-400 text-sm">Error al cargar invitaciones.</div>';
        }
    } catch (e) {
        listEl.innerHTML = '<div class="text-center py-8 text-red-400 text-sm">Error de conexion.</div>';
    }
}

async function sendInvitation() {
    if (!currentInvitationSystemId) return;
    const email = document.getElementById('inviteEmail').value;
    if (!email) {
        showError('Ingresa un correo electronico');
        return;
    }

    const payload = {
        email: email,
        ownerPassword: '',
        can_read: true,
        can_create: document.getElementById('permCreate').checked,
        can_update: false,
        can_delete: false
    };

    promptPassword(async (password) => {
        payload.ownerPassword = password;
        showLoading('Enviando invitacion...');
        try {
            const res = await apiFetch(`/systems/${currentInvitationSystemId}/invite`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            hideLoading();
            if (res.ok) {
                showSuccess('Invitacion enviada');
                document.getElementById('inviteEmail').value = '';
                document.getElementById('permCreate').checked = false;
                loadInvitations(currentInvitationSystemId);
            } else {
                const data = await res.json().catch(() => ({}));
                showError(data.error || data.message || 'Error al invitar');
            }
        } catch (e) {
            hideLoading();
            showError('Error de conexion');
        }
    });
}

async function revokeInvitation(systemId, shareId) {
    showConfirm('Revocar acceso a este usuario?', () => {
        promptPassword(async () => {
            try {
                const res = await apiFetch(`/systems/${systemId}/invitations/${shareId}`, {
                    method: 'DELETE'
                });
                if (res.ok) {
                    showSuccess('Acceso revocado', () => {
                        loadInvitations(systemId);
                    });
                } else {
                    showError('Error al revocar acceso');
                }
            } catch (e) {
                showError('Error de conexion');
            }
        });
    });
}

function startDashboardVoice() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        showError('Tu navegador no soporta reconocimiento de voz.');
        return;
    }

    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    const btn = document.getElementById('dashboardVoiceBtn');
    const originalContent = btn.innerHTML;

    btn.innerHTML = `
        <span class="material-symbols-outlined animate-pulse text-red-500">mic</span>
        <span class="text-xs font-bold text-red-500">Escuchando...</span>
    `;

    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        const searchInput = document.getElementById('tableSearchInput');
        if (searchInput) {
            searchInput.value = text;
            searchInput.dispatchEvent(new Event('input'));
            showSuccess(`Buscando: "${text}"`);
        }
    };

    recognition.onerror = (event) => {
        showError('Error al reconocer voz: ' + event.error);
    };

    recognition.onend = () => {
        btn.innerHTML = originalContent;
    };

    recognition.start();
}

async function acceptTerms() {
    try {
        const res = await apiFetch('/autenticacion/aceptar-terminos', {
            method: 'POST',
            body: JSON.stringify({ version: userProfile.termsVersion })
        });
        if (res.ok) {
            document.getElementById('termsModal').classList.add('hidden');
            showSuccess('Terminos aceptados');
        } else {
            showError('Error al aceptar los terminos');
        }
    } catch (e) {
        showError('Error de conexion');
    }
}

init();
