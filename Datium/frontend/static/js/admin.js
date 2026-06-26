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

// ═══════════════════════════════════════════════════════
// TÉRMINOS Y CONDICIONES
// ═══════════════════════════════════════════════════════

window.loadTyc = async function () {
    const res = await apiFetch('/admin/tyc');
    if (!res || !res.ok) return;
    const data = await res.json();
    const el = document.getElementById('tyc-content');
    const ver = document.getElementById('tyc-version');
    if (el) el.value = data.content || '';
    if (ver) ver.textContent = data.version || '1';
};

window.saveTyc = async function () {
    const content = (document.getElementById('tyc-content') || {}).value;
    if (!content || !content.trim()) return showError('El contenido no puede estar vacío');
    showLoading('Guardando Términos...');
    const res = await apiFetch('/admin/tyc', {
        method: 'POST',
        body: JSON.stringify({ content }),
    });
    hideLoading();
    if (res && res.ok) {
        const data = await res.json();
        const ver = document.getElementById('tyc-version');
        if (ver) ver.textContent = data.version || '';
        showSuccess('Términos actualizados a la versión ' + (data.version || ''));
    } else {
        showError('No se pudieron guardar los Términos');
    }
};

// ═══════════════════════════════════════════════════════
// GESTIÓN DE PLANES
// ═══════════════════════════════════════════════════════

let allPlans = [];

window.loadPlans = async function () {
    const res = await apiFetch('/admin/plans');
    if (!res || !res.ok) return;
    allPlans = await res.json();
    renderPlans(allPlans);
};

function renderPlans(plans) {
    const grid = document.getElementById('plansGrid');
    if (!grid) return;
    if (!plans.length) {
        grid.innerHTML = '<p class="text-gray-500 col-span-full text-center py-12 font-bold">No hay planes registrados.</p>';
        return;
    }
    grid.innerHTML = plans.map(p => `
        <div class="surface-card p-6 flex flex-col gap-4 relative group">
            <div class="flex items-center justify-between">
                <h3 class="text-lg font-black text-[#111418] dark:text-white">${sanitize(p.name)}</h3>
                ${p.is_active
                    ? '<span class="badge badge-success">Activo</span>'
                    : '<span class="badge badge-danger">Inactivo</span>'}
            </div>
            <div class="text-3xl font-black text-primary">$${Number(p.price).toFixed(2)}<span class="text-xs font-bold text-gray-400 ml-1">/mes</span></div>
            <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="flex items-center gap-1.5 text-gray-500"><span class="material-symbols-outlined text-sm">database</span>${p.max_systems} Sistemas</div>
                <div class="flex items-center gap-1.5 text-gray-500"><span class="material-symbols-outlined text-sm">table_chart</span>${p.max_tables_per_system} Tablas</div>
                <div class="flex items-center gap-1.5 text-gray-500"><span class="material-symbols-outlined text-sm">storage</span>${p.max_storage_mb} MB</div>
                <div class="flex items-center gap-1.5 text-gray-500"><span class="material-symbols-outlined text-sm">data_array</span>${p.max_records_per_table.toLocaleString()} Registros</div>
                <div class="flex items-center gap-1.5 text-gray-500"><span class="material-symbols-outlined text-sm">view_column</span>${p.max_fields_per_table} Campos</div>
                <div class="flex items-center gap-1.5 ${p.has_ai_assistant ? 'text-green-500' : 'text-gray-400'}"><span class="material-symbols-outlined text-sm">smart_toy</span>${p.has_ai_assistant ? 'IA Activa' : 'Sin IA'}</div>
            </div>
            <div class="flex gap-2 mt-auto pt-2 border-t border-gray-100 dark:border-gray-700">
                <button onclick="editPlan(${p.id})" class="datium-btn bg-slate-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex-1 text-xs">
                    <span class="material-symbols-outlined text-sm">edit</span> Editar
                </button>
                <button onclick="deletePlan(${p.id}, '${sanitize(p.name)}')" class="datium-btn bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 flex-1 text-xs">
                    <span class="material-symbols-outlined text-sm">delete</span> Eliminar
                </button>
            </div>
        </div>
    `).join('');
}

window.openPlanModal = function (plan) {
    document.getElementById('planModalTitle').textContent = plan ? 'Editar Plan' : 'Nuevo Plan';
    document.getElementById('plan-id').value = plan ? plan.id : '';
    document.getElementById('plan-name').value = plan ? plan.name : '';
    document.getElementById('plan-price').value = plan ? plan.price : 0;
    document.getElementById('plan-max-systems').value = plan ? plan.max_systems : 1;
    document.getElementById('plan-max-tables').value = plan ? plan.max_tables_per_system : 3;
    document.getElementById('plan-max-records').value = plan ? plan.max_records_per_table : 50000;
    document.getElementById('plan-max-fields').value = plan ? plan.max_fields_per_table : 200;
    document.getElementById('plan-max-storage').value = plan ? plan.max_storage_mb : 1024;
    document.getElementById('plan-is-active').checked = plan ? plan.is_active : true;
    document.getElementById('plan-has-ai').checked = plan ? plan.has_ai_assistant : false;
    document.getElementById('planModal').classList.remove('hidden');
};

window.closePlanModal = function () {
    document.getElementById('planModal').classList.add('hidden');
};

window.savePlan = async function (e) {
    e.preventDefault();
    const id = document.getElementById('plan-id').value || null;
    const payload = {
        id: id ? Number(id) : undefined,
        name: document.getElementById('plan-name').value.trim(),
        price: parseFloat(document.getElementById('plan-price').value) || 0,
        max_systems: parseInt(document.getElementById('plan-max-systems').value) || 1,
        max_tables_per_system: parseInt(document.getElementById('plan-max-tables').value) || 3,
        max_records_per_table: parseInt(document.getElementById('plan-max-records').value) || 50000,
        max_fields_per_table: parseInt(document.getElementById('plan-max-fields').value) || 200,
        max_storage_mb: parseInt(document.getElementById('plan-max-storage').value) || 1024,
        is_active: document.getElementById('plan-is-active').checked,
        has_ai_assistant: document.getElementById('plan-has-ai').checked,
    };
    if (!payload.name) return showError('El nombre es obligatorio');
    showLoading('Guardando plan...');
    const res = await apiFetch('/admin/plans', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    hideLoading();
    if (res && res.ok) {
        showSuccess(id ? 'Plan actualizado' : 'Plan creado');
        closePlanModal();
        loadPlans();
    } else {
        const err = await res.json().catch(() => ({}));
        showError(err.error || 'Error al guardar el plan');
    }
    return false;
};

window.editPlan = function (planId) {
    const plan = allPlans.find(p => p.id === planId);
    if (plan) openPlanModal(plan);
};

window.deletePlan = function (planId, planName) {
    showConfirm(`¿Eliminar el plan "${planName}"? Los usuarios con este plan no serán eliminados pero quedarán sin plan asignado.`, () => {
        promptPassword(async () => {
            showLoading('Eliminando...');
            const res = await apiFetch(`/admin/plans/${planId}`, { method: 'DELETE' });
            hideLoading();
            if (res && res.ok) {
                showSuccess('Plan eliminado');
                loadPlans();
            } else {
                showError('No se pudo eliminar');
            }
        });
    });
};

document.addEventListener('DOMContentLoaded', initAdmin);
