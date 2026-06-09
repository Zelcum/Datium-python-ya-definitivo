let allUsers = [];

async function initAdmin() {
    showLoading('Cargando panel...');
    const profileRes = await apiFetch('/user/profile');
    if (!profileRes || !profileRes.ok) return (window.location.href = 'dashboard.html');
    const user = await profileRes.json();
    if (user.role !== 'admin') {
        window.location.href = 'dashboard.html';
        return;
    }
    const nameEl = document.getElementById('userName');
    const emailEl = document.getElementById('userEmail');
    const initialEl = document.getElementById('userInitial');
    if (nameEl) nameEl.innerText = user.name || 'Admin';
    if (emailEl) emailEl.innerText = user.email || '';
    if (initialEl) initialEl.innerText = (user.name || 'A').charAt(0).toUpperCase();
    await Promise.all([loadDashboardStats(), loadUsers(), loadReports()]);
    hideLoading();
    setupSearch();
}

function setupSearch() {
    const searchInput = document.getElementById('userListSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allUsers.filter(
                (u) =>
                    (u.name || '').toLowerCase().includes(term) ||
                    (u.email || '').toLowerCase().includes(term)
            );
            renderUsers(filtered);
        });
    }
}

async function loadDashboardStats() {
    const res = await apiFetch('/admin/stats');
    if (!res || !res.ok) return;
    const data = await res.json();
    animateValue('stat-total-users', 0, data.users || 0, 600);
    animateValue('stat-total-systems', 0, data.systems || 0, 600);
}

async function loadUsers() {
    const res = await apiFetch('/admin/users');
    if (!res || !res.ok) return;
    allUsers = await res.json();
    renderUsers(allUsers);
}

function renderUsers(users) {
    const tbody = document.getElementById('fullUsersTableBody');
    if (!tbody) return;
    if (users.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="5" class="p-12 text-center text-gray-500 font-bold uppercase tracking-widest">No se encontraron usuarios</td></tr>';
        return;
    }
    tbody.innerHTML = users
        .map(
            (u) => `
        <tr class="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-0">
            <td class="px-6 py-5">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-900 flex items-center justify-center font-bold text-xs shadow-inner">${(u.name || 'U').charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="text-xs font-bold dark:text-white">${sanitize(u.name || 'Sin nombre')}</div>
                        <div class="text-[10px] text-gray-500">${sanitize(u.email)}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-5">
                <span class="badge badge-primary">${u.role || 'user'}</span>
            </td>
            <td class="px-6 py-5 text-[10px] font-bold text-gray-500">${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}</td>
            <td class="px-6 py-5">
                ${u.is_suspended ? '<span class="badge badge-danger">Bloqueado</span>' : '<span class="badge badge-success">Activo</span>'}
            </td>
            <td class="px-6 py-5 text-right">
                <button onclick="toggleUserStatus(${u.id}, ${u.is_suspended})" class="action-btn ${u.is_suspended ? '' : 'action-btn-danger'}" title="${u.is_suspended ? 'Habilitar' : 'Suspender'}">
                    <span class="material-symbols-outlined text-lg">${u.is_suspended ? 'check_circle' : 'block'}</span>
                </button>
            </td>
        </tr>`
        )
        .join('');
}

window.toggleUserStatus = async function (id, curSuspended) {
    const action = curSuspended ? 'activate' : 'suspend';
    showConfirm(`Confirmas la ${curSuspended ? 'activacion' : 'suspension'} de este usuario?`, () => {
        promptPassword(async () => {
            showLoading('Aplicando cambios...');
            const res = await apiFetch(`/admin/users/${id}/action`, {
                method: 'POST',
                body: JSON.stringify({ action }),
            });
            hideLoading();
            if (res.ok) {
                showSuccess('Estado actualizado');
                loadUsers();
                loadDashboardStats();
            }
        });
    });
};

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

window.exportUsers = function (format = 'csv') {
    promptPassword(async () => {
        showLoading(`Exportando usuarios ${format.toUpperCase()}...`);
        try {
            const res = await apiFetch(`/admin/users/export?format=${format}`);
            if (!res) throw new Error('Error de conexion');
            if (res.ok) {
                const blob = await res.blob();
                downloadBlob(blob, `Datium_Users_${new Date().toISOString().slice(0, 10)}.${format === 'xlsx' ? 'xlsx' : format}`);
                showSuccess(`Exportado como ${format.toUpperCase()}`);
            } else {
                showError('Error al exportar');
            }
        } catch (e) {
            showError('Error de red');
        } finally {
            hideLoading();
        }
    });
};

async function loadReports() {
    const tbody = document.getElementById('adminReportsBody');
    if (!tbody) return;
    const res = await apiFetch('/admin/reports');
    if (!res || !res.ok) return;
    const reports = await res.json();
    if (!reports.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-gray-500">Sin reportes</td></tr>';
        return;
    }
    tbody.innerHTML = reports.map((r) => `
        <tr class="border-b border-gray-100 dark:border-gray-800">
            <td class="px-4 py-3 text-xs">${sanitize(r.userEmail || r.user || '')}</td>
            <td class="px-4 py-3 text-xs font-bold">${sanitize(r.title)}</td>
            <td class="px-4 py-3 text-xs">${r.status === 'resolved' ? 'Resuelto' : 'Pendiente'}</td>
            <td class="px-4 py-3 text-right">
                <button type="button" class="action-btn" onclick="toggleReportStatus(${r.id}, '${r.status}')">
                    <span class="material-symbols-outlined text-sm">swap_horiz</span>
                </button>
            </td>
        </tr>`).join('');
}

window.toggleReportStatus = async function (id, status) {
    const next = status === 'resolved' ? 'pending' : 'resolved';
    showLoading('Actualizando...');
    const res = await apiFetch(`/admin/reports/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: next }),
    });
    hideLoading();
    if (res && res.ok) {
        showSuccess('Estado actualizado');
        loadReports();
    } else {
        showError('No se pudo actualizar');
    }
};

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'export.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 2000);
}

document.addEventListener('DOMContentLoaded', initAdmin);
