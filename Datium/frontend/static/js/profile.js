checkAuth();

let profileData = null;
let availablePlans = [];
let formSnapshot = null;
let profileIti = null;

function formatStorageMb(mb) {
    const n = Number(mb) || 0;
    if (n >= 1024) return `${(n / 1024).toFixed(n % 1024 === 0 ? 0 : 1)} GB`;
    return `${n} MB`;
}

function getPhoneValue() {
    if (profileIti) {
        try {
            const n = profileIti.getNumber();
            if (n && profileIti.isValidNumber()) return n.replace(/\s/g, '');
            const digits = (n || '').replace(/\D/g, '');
            if (digits.length >= 10) return n.replace(/\s/g, '');
        } catch (e) {}
    }
    const el = document.getElementById('profilePhone');
    return (el && el.value ? el.value : '').trim().replace(/\s/g, '');
}

function captureFormSnapshot() {
    return {
        name: (document.getElementById('profileName') || {}).value?.trim() || '',
        phone: getPhoneValue(),
    };
}

function syncSaveButton() {
    const btn = document.getElementById('btnSaveProfile');
    if (!btn || !formSnapshot) return;
    const cur = captureFormSnapshot();
    const dirty = cur.name !== formSnapshot.name || cur.phone !== formSnapshot.phone;
    btn.disabled = !dirty;
}

function initPhoneWidget() {
    const el = document.getElementById('profilePhone');
    if (!el || !window.intlTelInput || profileIti) return;
    profileIti = window.intlTelInput(el, {
        utilsScript: 'https://cdn.jsdelivr.net/npm/intl-tel-input@23.0.4/build/js/utils.js',
        initialCountry: 'auto',
        geoIpLookup: (callback) => {
            fetch('https://ipapi.co/json')
                .then((res) => res.json())
                .then((data) => callback(data.country_code))
                .catch(() => callback('es'));
        },
        separateDialCode: true,
        showSelectedDialCode: true,
        countrySearch: true,
        strictMode: true,
        autoPlaceholder: 'aggressive',
        placeholderNumberType: 'MOBILE',
    });
    if (profileData && profileData.phone) {
        try { profileIti.setNumber(profileData.phone); } catch (e) { el.value = profileData.phone; }
    }
    el.addEventListener('input', syncSaveButton);
    el.addEventListener('countrychange', syncSaveButton);
}

function applyUserToForm(user) {
    profileData = user;
    const nameEl = document.getElementById('profileName');
    const emailEl = document.getElementById('profileEmail');
    const phoneEl = document.getElementById('profilePhone');
    const dn = document.getElementById('displayNameMain');
    const des = document.getElementById('displayEmailSub');
    const planEl = document.getElementById('currentPlanName');
    const av = document.getElementById('profileAvatar');
    const memberEl = document.getElementById('memberSince');

    if (nameEl) nameEl.value = user.name || '';
    if (emailEl) emailEl.value = user.email || '';
    if (dn) dn.innerText = user.name || 'Sin nombre';
    if (des) des.innerText = user.email || '';
    if (planEl) planEl.innerText = user.planName || 'Free';

    if (memberEl && user.createdAt) {
        try {
            const d = new Date(user.createdAt);
            const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
            memberEl.innerText = `Miembro desde ${months[d.getMonth()]} ${d.getFullYear()}`;
        } catch(e) { memberEl.innerText = 'Miembro'; }
    } else if (memberEl) {
        memberEl.innerText = 'Miembro';
    }

    if (av) {
        const def =
            typeof window.datiumDefaultAvatarUrl === 'function'
                ? window.datiumDefaultAvatarUrl()
                : document.documentElement.classList.contains('dark')
                  ? '/static/img/Isotipo modo oscuro.jpeg'
                  : '/static/img/Isotipo modo claro.jpeg';
        if (user.avatarUrl) {
            av.src = user.avatarUrl;
            av.className = 'w-full h-full object-cover bg-gray-100 dark:bg-gray-800';
        } else {
            av.src = def;
            av.className = 'w-full h-full object-contain p-4 bg-white dark:bg-gray-900';
        }
    }

    if (profileIti && user.phone) {
        try { profileIti.setNumber(user.phone); } catch (e) { if (phoneEl) phoneEl.value = user.phone; }
    } else if (phoneEl && !profileIti) {
        phoneEl.value = user.phone || '';
    }

    updateStorageBar(user);

    formSnapshot = captureFormSnapshot();
    syncSaveButton();
}

function updateStorageBar(user) {
    const bar = document.getElementById('storageBar');
    const label = document.getElementById('storageLabel');
    if (!bar || !label) return;
    const used = Number(user.storage_used_bytes || 0);
    const maxMb = Number(user.max_storage_mb || 1024);
    const maxBytes = maxMb * 1024 * 1024;
    const pct = maxBytes > 0 ? Math.min((used / maxBytes) * 100, 100) : 0;
    bar.style.width = pct.toFixed(1) + '%';
    const usedMb = (used / (1024 * 1024)).toFixed(1);
    label.textContent = `${usedMb} MB / ${formatStorageMb(maxMb)} usado`;
    if (pct > 90) bar.classList.add('bg-red-500');
    else if (pct > 70) bar.classList.add('bg-yellow-500');
}

async function loadProfile() {
    const res = await apiFetch('/user/profile');
    if (!res || !res.ok) return;
    const user = await res.json();
    applyUserToForm(user);
    if (typeof window.datiumApplySidebar === 'function') {
        window.datiumApplySidebar(user);
    }
}

async function loadPlans() {
    try {
        const res = await apiFetch('/plans');
        if (!res || !res.ok) return;
        availablePlans = await res.json();
        renderPlans();
    } catch (e) {
        console.error(e);
    }
}

function planCardTheme(name) {
    const n = String(name || '').toLowerCase();
    if (n.includes('pro')) {
        return { ring: 'ring-2 ring-primary/40', btn: 'bg-primary text-white hover:bg-blue-600' };
    }
    if (n.includes('corp')) {
        return { ring: 'ring-1 ring-gray-300 dark:ring-gray-600', btn: 'bg-slate-900 text-white dark:bg-white dark:text-gray-900' };
    }
    return { ring: 'ring-1 ring-gray-200 dark:ring-gray-700', btn: 'bg-gray-100 dark:bg-gray-800 text-[#111418] dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700' };
}

function renderPlans() {
    const container = document.getElementById('plansContainer');
    if (!container) return;

    const currentId = profileData && profileData.planId ? String(profileData.planId) : '';
    const currentName = String(profileData?.planName || 'Free').toLowerCase();

    const rows = availablePlans.length
        ? availablePlans
        : [
              { id: 1, name: 'Free', price: 0, max_systems: 1, max_tables_per_system: 3, max_storage_mb: 1024, has_ai_assistant: true },
              { id: 2, name: 'Pro', price: 20, max_systems: 5, max_tables_per_system: 10, max_storage_mb: 1024, has_ai_assistant: true },
              { id: 3, name: 'Corporate', price: 50, max_systems: 100, max_tables_per_system: 50, max_storage_mb: 1024, has_ai_assistant: true },
          ];

    container.innerHTML = rows
        .map((plan) => {
            const theme = planCardTheme(plan.name);
            const isCurrent =
                (currentId && String(plan.id) === currentId) ||
                (!currentId && currentName === String(plan.name).toLowerCase());
            const price = Number(plan.price) || 0;
            const st = formatStorageMb(plan.max_storage_mb);
            return `
            <div class="rounded-3xl bg-white dark:bg-[#151f2b] border border-gray-200 dark:border-gray-800 p-6 flex flex-col h-full min-h-[320px] shadow-sm ${theme.ring}">
                <div class="flex justify-between items-start gap-2 mb-4 min-h-[2.5rem]">
                    <h4 class="text-lg font-black text-[#111418] dark:text-white">${plan.name}</h4>
                    ${isCurrent ? '<span class="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">Actual</span>' : '<span class="w-16 shrink-0"></span>'}
                </div>
                <p class="text-4xl font-black text-[#111418] dark:text-white mb-6">$${price}<span class="text-sm font-bold text-gray-400">/mes</span></p>
                <ul class="space-y-2 text-sm text-gray-600 dark:text-gray-400 flex-1 mb-6">
                    <li class="flex gap-2 items-start"><span class="material-symbols-outlined text-emerald-500 text-lg shrink-0">check_circle</span><span>${plan.max_systems} sistemas</span></li>
                    <li class="flex gap-2 items-start"><span class="material-symbols-outlined text-emerald-500 text-lg shrink-0">check_circle</span><span>${plan.max_tables_per_system} tablas por sistema</span></li>
                    <li class="flex gap-2 items-start"><span class="material-symbols-outlined text-emerald-500 text-lg shrink-0">check_circle</span><span>${st} almacenamiento</span></li>
                    <li class="flex gap-2 items-start"><span class="material-symbols-outlined text-emerald-500 text-lg shrink-0">check_circle</span><span>IA incluida</span></li>
                </ul>
                <button type="button" onclick="changePlan(${plan.id})" ${isCurrent ? 'disabled' : ''}
                    class="mt-auto w-full py-3.5 rounded-xl text-sm font-black uppercase tracking-wide transition-all ${
                        isCurrent ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 cursor-default border border-emerald-500/20' : theme.btn
                    }">
                    ${isCurrent ? 'Plan activo' : 'Seleccionar plan'}
                </button>
            </div>`;
        })
        .join('');
}

async function handleAvatarChange(input) {
    if (!input.files || !input.files[0]) return;
    const busy = document.getElementById('avatarBusy');
    if (busy) busy.classList.remove('hidden');
    const file = input.files[0];
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.type)) {
        showError('Solo se permiten imágenes (JPG, PNG, GIF, WEBP)');
        if (busy) busy.classList.add('hidden');
        return;
    }
    const formData = new FormData();
    formData.append('file', file);
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/upload/image`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
        });
        if (!res.ok) { showError('No se pudo subir la imagen'); return; }
        const data = await res.json();
        const url = data.url;
        await apiFetch('/user/avatar', { method: 'PUT', body: JSON.stringify({ avatarUrl: url }) });
        const av = document.getElementById('profileAvatar');
        if (av) { av.src = url; av.classList.remove('opacity-0'); }
        showSuccess('Foto actualizada');
        if (typeof window.datiumRefreshSessionUser === 'function') await window.datiumRefreshSessionUser();
        await loadProfile();
    } catch (e) {
        showError('Error de red al subir');
    } finally {
        if (busy) busy.classList.add('hidden');
        input.value = '';
    }
}

async function saveProfileFields() {
    const name = (document.getElementById('profileName') || {}).value?.trim() || '';
    const phone = getPhoneValue();
    const res = await apiFetch('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, phone: phone || '' }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showError(err.error || 'No se pudo guardar');
        return;
    }
    showSuccess('Perfil actualizado con éxito');
    await loadProfile();
    if (typeof window.datiumRefreshSessionUser === 'function') await window.datiumRefreshSessionUser();
}

async function submitPasswordChange() {
    const cur = (document.getElementById('currentPassword') || {}).value || '';
    const nw = (document.getElementById('newPassword') || {}).value || '';
    const cf = (document.getElementById('newPasswordConfirm') || {}).value || '';
    if (!cur || !nw || !cf) return showError('Completa los tres campos de contraseña');
    if (nw !== cf) return showError('La nueva contraseña y la confirmación no coinciden');
    if (nw.length < 8) return showError('La contraseña debe tener al menos 8 caracteres');
    const res = await apiFetch('/user/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword: cur, newPassword: nw }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showError(err.error || 'No se pudo cambiar la contraseña');
        return;
    }
    showSuccess('Contraseña actualizada');
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('newPasswordConfirm').value = '';
}

async function changePlan(planId) {
    if (planId == 1) {
        showConfirm('¿Cambiar de plan? Se aplican límites nuevos al instante.', async () => {
            try {
                const res = await apiFetch('/user/plan', {
                    method: 'PUT',
                    body: JSON.stringify({ newPlanId: planId }),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    showError(err.error || 'Plan no disponible');
                    return;
                }
                const body = await res.json().catch(() => ({}));
                showSuccess('Plan actualizado', async () => {
                    if (body.planName) {
                        profileData = profileData || {};
                        profileData.planName = body.planName;
                        profileData.planId = body.planId;
                    }
                    await loadProfile();
                    await loadPlans();
                    if (typeof window.datiumRefreshSessionUser === 'function') await window.datiumRefreshSessionUser();
                });
            } catch (e) {
                showError('Error de conexión');
            }
        });
    } else {
        // Redirige a la simulación de pagos para los planes de pago
        window.location.href = `payment_simulation.html?plan=${planId}`;
    }
}

window.changePlan = changePlan;

async function initPage() {
    await Promise.all([loadProfile(), loadPlans()]);
    initPhoneWidget();
    formSnapshot = captureFormSnapshot();
    syncSaveButton();
    const nameEl = document.getElementById('profileName');
    if (nameEl) nameEl.addEventListener('input', syncSaveButton);
    const btn = document.getElementById('btnSaveProfile');
    if (btn) btn.addEventListener('click', saveProfileFields);

    window.addEventListener('datium:session-user', (ev) => {
        const u = ev.detail;
        if (!u) return;
        applyUserToForm(u);
        renderPlans();
    });
}

document.addEventListener('DOMContentLoaded', initPage);

window.handleAvatarChange = handleAvatarChange;
window.submitPasswordChange = submitPasswordChange;
