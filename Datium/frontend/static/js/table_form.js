checkAuth();

const urlParams = new URLSearchParams(window.location.search);
const systemId = urlParams.get('systemId');
const tableId = urlParams.get('tableId');

let systemTables = [];

async function init() {
    if (!systemId) {
        showError('ID de sistema no proporcionado');
        setTimeout(() => window.location.href = 'dashboard.html', 1500);
        return;
    }

    await loadSystemTablesForRelations();

    if (tableId) {
        document.title = "Editar Tabla - Datium";
        document.querySelector('h1').innerText = "Editar Tabla";
        const submitBtn = document.getElementById('btnSubmit');
        if (submitBtn) {
            submitBtn.innerHTML = '<span class="material-symbols-outlined">save</span> Actualizar Tabla';
        }
        await loadTableData();
    } else {
        addNewFieldRow();
    }

    loadSidebarInfo();
    setupLivePreview();
    initSortable();
}

function initSortable() {
    const container = document.getElementById('newFieldsContainer');
    if (!container) return;
    Sortable.create(container, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        onEnd: () => {
            updatePreview();
        }
    });
}

function setupLivePreview() {
    const container = document.getElementById('newFieldsContainer');
    container.addEventListener('input', updatePreview);
    container.addEventListener('change', updatePreview);

    const observer = new MutationObserver((mutations) => {
        updatePreview();
    });
    observer.observe(container, { childList: true });
}

function updatePreview() {
    const fieldRows = document.getElementById('newFieldsContainer').children;
    const fields = Array.from(fieldRows).map(row => {
        const nameInput = row.querySelector('.new-field-name');
        if (!nameInput) return null;
        const name = nameInput.value.trim();
        const type = row.querySelector('.new-field-type').value;
        const isPrimaryKey = row.querySelector('.new-field-pk').checked || false;
        return { name: name || 'Nueva Columna', type: type, isPrimaryKey: isPrimaryKey };
    }).filter(f => f);

    const thead = document.getElementById('previewTableHead');
    const tbody = document.getElementById('previewTableBody');
    if (!thead || !tbody) return;

    let thHtml = `<th class="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-800/80 z-10 min-w-[60px]">ID</th>`;
    fields.forEach(f => {
        let icon = 'text_fields';
        if (f.type === 'number') icon = 'tag';
        if (f.type === 'date') icon = 'calendar_today';
        if (f.type === 'boolean') icon = 'check_box';
        if (f.type === 'select') icon = 'list';
        if (f.type === 'relation') icon = 'link';
        if (f.type === 'email') icon = 'alternate_email';
        if (f.type === 'url') icon = 'language';
        if (f.type === 'phone') icon = 'phone';
        if (f.type === 'time') icon = 'schedule';
        if (f.type === 'file') icon = 'upload_file';

        thHtml += `
            <th class="px-6 py-3 font-medium text-gray-600 dark:text-gray-300 group min-w-[150px]">
                <div class="flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[14px] text-gray-400 group-hover:text-primary transition-colors">${icon}</span>
                    <span class="text-sm">${f.name}</span>
                    ${f.isPrimaryKey ? '<span class="text-amber-500 text-[10px]" title="Llave Primaria">🔑</span>' : ''}
                </div>
            </th>
        `;
    });
    thHtml += `<th class="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[100px]">Acciones</th>`;
    thead.innerHTML = thHtml;

    let trHtml = '';
    for (let i = 1; i <= 2; i++) {
        trHtml += `<tr class="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">`;
        trHtml += `<td class="px-6 py-3.5 text-sm font-medium text-gray-500 sticky left-0 bg-white dark:bg-gray-900/50 z-10 w-auto border-r border-gray-100 dark:border-gray-800/50">#${i}</td>`;

        fields.forEach(f => {
            let mockVal = 'Datos...';
            if (f.type === 'number') mockVal = i * 142;
            if (f.type === 'date') mockVal = `2026-03-1${i}`;
            if (f.type === 'boolean') mockVal = i === 1 ? 'Sí' : 'No';
            if (f.type === 'select') mockVal = 'Opción A';
            if (f.type === 'relation') mockVal = 'Rel_#0' + i;
            if (f.type === 'email') mockVal = 'correo@ejemplo.com';
            if (f.type === 'url') mockVal = 'https://datium.com';
            if (f.type === 'phone') mockVal = '+57 300 000 0000';
            if (f.type === 'time') mockVal = '10:00 AM';
            if (f.type === 'file') mockVal = 'archivo.pdf';

            trHtml += `<td class="px-6 py-3.5 text-sm text-gray-600 dark:text-gray-400 opacity-60">${mockVal}</td>`;
        });

        trHtml += `
            <td class="px-6 py-3.5">
                <div class="flex gap-2 opacity-50">
                    <div class="w-6 h-6 rounded bg-gray-200 dark:bg-gray-800"></div>
                    <div class="w-6 h-6 rounded bg-gray-200 dark:bg-gray-800"></div>
                </div>
            </td>
        </tr>`;
    }
    tbody.innerHTML = trHtml;
}

function goBack() {
    window.location.href = `system.html?id=${systemId}`;
}

async function loadSystemTablesForRelations() {
    const res = await apiFetch(`/systems/${systemId}/tables`);
    if (res.ok) {
        systemTables = await res.json();
    }
}

async function loadTableData() {
    const res = await apiFetch(`/tables/${tableId}`);
    if (res.ok) {
        const table = await res.json();
        document.getElementById('newTableName').value = table.name;
        document.getElementById('newTableDesc').value = table.description || '';
    }

    const fieldsRes = await apiFetch(`/tables/${tableId}/fields`);
    if (fieldsRes.ok) {
        const fields = await fieldsRes.json();
        if (fields.length === 0) {
            addNewFieldRow();
        } else {
            for (const f of fields) {
                addNewFieldRow(f);
            }
        }
    }
}

function addNewFieldRow(fieldData = null) {
    const container = document.getElementById('newFieldsContainer');
    const div = document.createElement('div');
    div.className = 'bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 flex flex-wrap gap-3 items-end animate-fade-in group relative';

    div.innerHTML = `
        <div class="drag-handle absolute -left-2 top-1/2 -translate-y-1/2 p-1 text-gray-300 hover:text-primary cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-all">
            <span class="material-symbols-outlined text-lg">drag_indicator</span>
        </div>
        <div class="flex-1 min-w-[150px]">
            <input type="text" class="new-field-name w-full px-3 py-2 rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-black/20 text-sm focus:ring-2 focus:ring-primary/50 dark:text-white" placeholder="Nombre Campo" required>
        </div>
        <div class="w-[140px]">
            <select class="new-field-type w-full px-3 py-2 rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-black/20 text-sm focus:ring-2 focus:ring-primary/50 dark:text-white">
                <option value="text">Texto</option>
                <option value="number">Número</option>
                <option value="date">Fecha</option>
                <option value="boolean">Si/No</option>
                <option value="select">Lista (Select)</option>
                <option value="relation">Relación</option>
                <option value="email">Email</option>
                <option value="url">URL</option>
                <option value="phone">Teléfono</option>
                <option value="time">Hora</option>
                <option value="file">Archivo</option>
            </select>
        </div>
        
        <div class="flex-1 min-w-[200px] flex gap-2" >
             <div class="field-options-container flex-1 hidden">
                <input type="text" class="new-field-options w-full px-3 py-2 rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-black/20 text-sm dark:text-white" placeholder="Opciones: A, B, C">
            </div>
            <div class="field-relation-container flex-1 hidden flex-col gap-1">
                <div class="flex gap-2 w-full">
                    <select class="new-field-rel-table w-1/2 px-2 py-2 rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-black/20 text-xs dark:text-white">
                        <option value="">Tabla Destino...</option>
                        ${systemTables.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                    </select>
                    <select class="new-field-rel-display w-1/2 px-2 py-2 rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-black/20 text-xs dark:text-white" disabled>
                        <option value="">Campo Display...</option>
                    </select>
                </div>
                <div class="field-rel-pk-info text-[10px] text-primary italic font-bold px-1 hidden"></div>
            </div>
        </div>

        <div class="flex items-center gap-2 h-10">
            <label class="flex items-center cursor-pointer" title="Campo Obligatorio">
                <input type="checkbox" class="new-field-required form-checkbox rounded text-primary border-gray-300 dark:border-gray-600 bg-transparent focus:ring-0 w-4 h-4">
                <span class="ml-2 text-xs text-gray-500 font-medium">Req.</span>
            </label>
            <label class="flex items-center cursor-pointer" title="Valor Único">
                <input type="checkbox" class="new-field-unique form-checkbox rounded text-blue-500 border-gray-300 dark:border-gray-600 bg-transparent focus:ring-0 w-4 h-4">
                <span class="ml-2 text-xs text-gray-500 font-medium">Uniq</span>
            </label>
            <label class="flex items-center cursor-pointer" title="Llave Primaria">
                <input type="checkbox" class="new-field-pk form-checkbox rounded text-amber-500 border-gray-300 dark:border-gray-600 bg-transparent focus:ring-0 w-4 h-4" onchange="togglePK(this)">
                <span class="ml-2 text-xs text-gray-500 font-medium">PK</span>
            </label>
            <button type="button" onclick="const row = this.closest('.bg-gray-50'); row.style.opacity = '0'; setTimeout(() => row.remove(), 300);" class="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Eliminar campo">
                <span class="material-symbols-outlined text-lg">delete</span>
            </button>
        </div>
    `;

    const select = div.querySelector('.new-field-type');
    const optionsDiv = div.querySelector('.field-options-container');
    const relationDiv = div.querySelector('.field-relation-container');
    const relTableSelect = div.querySelector('.new-field-rel-table');
    const relDisplaySelect = div.querySelector('.new-field-rel-display');
    const optionsInput = div.querySelector('.new-field-options');
    const nameInput = div.querySelector('.new-field-name');
    const requiredCheck = div.querySelector('.new-field-required');

    const toggleType = (type) => {
        optionsDiv.classList.add('hidden');
        relationDiv.classList.add('hidden');
        relationDiv.classList.remove('flex');

        if (type === 'select') {
            optionsDiv.classList.remove('hidden');
        }
        if (type === 'relation') {
            relationDiv.classList.remove('hidden');
            relationDiv.classList.add('flex');
        }
    };

    select.addEventListener('change', (e) => toggleType(e.target.value));

    const loadRelFields = async (tId, selectedFieldId = null) => {
        if (!tId) return;
        relDisplaySelect.innerHTML = '<option value="">Cargando...</option>';
        relDisplaySelect.disabled = true;
        
        const pkInfo = div.querySelector('.field-rel-pk-info');
        pkInfo.classList.add('hidden');

        const res = await apiFetch(`/tables/${tId}/fields`);
        if (res.ok) {
            const fields = await res.json();
            relDisplaySelect.innerHTML = '<option value="">Campo Display (Opcional)...</option>' + fields.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
            relDisplaySelect.disabled = false;

            const targetPk = fields.find(f => f.isPrimaryKey);
            if (targetPk) {
                pkInfo.innerText = `Ligar a PK: ${targetPk.name}`;
                pkInfo.classList.remove('hidden');
                pkInfo.classList.replace('text-red-500', 'text-primary');
            } else {
                pkInfo.innerText = `⚠️ La tabla destino no tiene PK.`;
                pkInfo.classList.remove('hidden');
                pkInfo.classList.replace('text-primary', 'text-red-500');
            }

            if (selectedFieldId) {
                relDisplaySelect.value = selectedFieldId;
            }
        }
    };

    relTableSelect.addEventListener('change', async (e) => {
        loadRelFields(e.target.value);
    });

    container.appendChild(div);

    if (fieldData) {
        nameInput.value = fieldData.name;
        select.value = fieldData.type;
        requiredCheck.checked = fieldData.required;

        toggleType(fieldData.type);

        if (fieldData.type === 'select' && fieldData.options) {
            optionsInput.value = fieldData.options.join(', ');
        }

        if (fieldData.type === 'relation' && fieldData.relatedTableId) {
            relTableSelect.value = fieldData.relatedTableId;

            loadRelFields(fieldData.relatedTableId, fieldData.relatedDisplayFieldId)
                .then(() => {
                    if (!fieldData.relatedDisplayFieldId && fieldData.relatedFieldName) {
                        const options = Array.from(relDisplaySelect.options);
                        const match = options.find(opt => opt.text === fieldData.relatedFieldName);
                        if (match) relDisplaySelect.value = match.value;
                    }
                });
        }

        const idInput = document.createElement('input');
        idInput.type = 'hidden';
        idInput.className = 'new-field-id';
        idInput.value = fieldData.id;
        div.appendChild(idInput);

        if (fieldData.isPrimaryKey) {
            div.querySelector('.new-field-pk').checked = true;
            div.querySelector('.new-field-unique').checked = true;
            div.querySelector('.new-field-required').checked = true;
        }
        if (fieldData.is_unique) {
            div.querySelector('.new-field-unique').checked = true;
        }
    }
}

function togglePK(checkbox) {
    if (checkbox.checked) {
        // Uncheck other PK checkboxes
        document.querySelectorAll('.new-field-pk').forEach(cb => {
            if (cb !== checkbox) cb.checked = false;
        });
        // PK must be unique and required
        const row = checkbox.closest('.bg-gray-50');
        row.querySelector('.new-field-unique').checked = true;
        row.querySelector('.new-field-required').checked = true;
    }
}

async function saveTable() {
    const name = document.getElementById('newTableName').value;
    const description = document.getElementById('newTableDesc').value;
    if (!name) return showError('El nombre es requerido');

    const fieldRows = document.getElementById('newFieldsContainer').children;
    let validationError = null;

    const fields = Array.from(fieldRows).map(row => {
        const nameInput = row.querySelector('.new-field-name');
        if (!nameInput) return null;

        const idInput = row.querySelector('.new-field-id');
        const fieldId = (idInput && idInput.value) ? parseInt(idInput.value) : null;

        const type = row.querySelector('.new-field-type').value;
        let options = [];
        let relatedTableId = null;
        let relatedDisplayFieldId = null;

        if (type === 'select') {
            const optsStr = row.querySelector('.new-field-options').value;
            if (optsStr) options = optsStr.split(',').map(s => s.trim()).filter(s => s);
        } else if (type === 'relation') {
            const tId = row.querySelector('.new-field-rel-table').value;
            const fId = row.querySelector('.new-field-rel-display').value;

            if (!tId) validationError = 'Debe seleccionar una Tabla Destino para los campos de tipo Relación.';
            if (tId) relatedTableId = parseInt(tId);
            if (fId) relatedDisplayFieldId = parseInt(fId);
        }

        return {
            id: fieldId,
            name: nameInput.value,
            type: type,
            required: row.querySelector('.new-field-required').checked,
            unique: row.querySelector('.new-field-unique').checked || false,
            isPrimaryKey: row.querySelector('.new-field-pk').checked || false,
            orderIndex: Array.from(fieldRows).indexOf(row),
            options: options,
            relatedTableId: relatedTableId,
            relatedDisplayFieldId: relatedDisplayFieldId
        };
    }).filter(f => f);

    const emptyNameFields = fields.filter(f => !f.name || !f.name.trim());
    if (emptyNameFields.length > 0) return showError('Todos los campos deben tener un nombre. Elimina los campos vacíos o dales un nombre.');

    const fieldNames = fields.map(f => f.name.trim().toLowerCase());
    const seen = {};
    for (const n of fieldNames) {
        if (seen[n]) return showError(`El campo "${n}" está duplicado. Cada campo debe tener un nombre único.`);
        seen[n] = true;
    }

    if (validationError) return showError(validationError);

    const btn = document.getElementById('btnSubmit');
    const originalBtnContent = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Guardando...';
    btn.disabled = true;

    if (tableId) {
        const res = await apiFetch(`/systems/${systemId}/tables/${tableId}`, {
            method: 'PUT',
            body: JSON.stringify({ name, description, fields })
        });

        if (res.ok) {
            showSuccess('¡La estructura de la tabla ha sido modificada correctamente!', () => {
                window.location.href = `system.html?id=${systemId}`;
            });
        } else {
            btn.innerHTML = originalBtnContent;
            btn.disabled = false;
            try {
                const errorData = await res.json();
                showError(errorData.message || errorData.error || 'Error actualizando tabla');
            } catch (e) {
                showError('Error actualizando tabla');
            }
        }
    } else {
        const res = await apiFetch(`/systems/${systemId}/tables`, {
            method: 'POST',
            body: JSON.stringify({ name, description, fields })
        });

        if (res.ok) {
            const savedTable = await res.json();
            showSuccess('¡La tabla se ha creado correctamente!', () => {
                window.location.href = `system.html?id=${systemId}`;
            });
        } else {
            btn.innerHTML = originalBtnContent;
            btn.disabled = false;
            try {
                const errorData = await res.json();
                showError(errorData.message || 'Error creando tabla');
            } catch (e) {
                showError('Error creando tabla');
            }
        }
    }
}

async function loadSidebarInfo() {
    const res = await apiFetch('/user/profile');
    if (res && res.ok) {
        const userProfile = await res.json();
        if (typeof window.datiumApplySidebar === 'function') {
            window.datiumApplySidebar(userProfile);
        }
    }
}

init();
