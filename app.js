// ============= APP LOGIC: UI, Simulador y Admin =============

let lastSimulationData = null;

// --- Inicialización ---

window.onload = async () => {
    // Cargar datos sobrescritos de Supabase antes de inicializar la UI
    await applySupabaseOverrides();

    const selectProyecto = document.getElementById('proyecto');
    const adminSelectProyecto = document.getElementById('admin-proyecto');

    if (selectProyecto) {
        // Vaciar y preparar la opción default del Front
        selectProyecto.innerHTML = '<option value="">Selecciona un proyecto...</option>';

        // Obtener llaves y ordenarlas para mejor UX
        const proyectos = Object.keys(db).sort();
        proyectos.forEach(proyecto => {
            let option = document.createElement('option');
            option.value = option.textContent = proyecto;
            selectProyecto.appendChild(option);

            if (adminSelectProyecto) {
                let adminOption = document.createElement('option');
                adminOption.value = adminOption.textContent = proyecto;
                adminSelectProyecto.appendChild(adminOption);
            }
        });

        // Forzar carga de parcelas si hay un proyecto pre-seleccionado
        cargarParcelasSimulador();

        // Poblar filtro de proyectos en reportes
        const filterProj = document.getElementById('filter-project');
        if (filterProj) {
            proyectos.forEach(p => {
                let opt = document.createElement('option');
                opt.value = opt.textContent = p;
                filterProj.appendChild(opt);
            });
        }
    }
};

document.addEventListener("DOMContentLoaded", () => {
    document.body.style.overflow = 'hidden'; // Detener scroll de fondo al detectar auth overlay activado

    // Soporte para tecla Enter en login
    ['login-user', 'login-pass'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('keydown', e => {
                if (e.key === 'Enter') { e.preventDefault(); attemptLogin(); }
            });
        }
    });

    // Soporte para tecla Enter en cambio de contraseña
    ['new-pass1', 'new-pass2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('keydown', e => {
                if (e.key === 'Enter') { e.preventDefault(); updatePassword(); }
            });
        }
    });

    // Formato de moneda para inputs personalizados
    ['custom-pie', 'custom-contado', 'admin-precio', 'admin-pie', 'admin-bulk-variation'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', (e) => formatCLPInput(e.target));
        }
    });

    // Listener para Enter en parcela
    const parcelaInput = document.getElementById('parcela');
    if (parcelaInput) {
        parcelaInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                generarSimulacion();
            }
        });
    }

    // Pre-fill remembered credentials
    const remUser = localStorage.getItem('sa_rem_user');
    const remPass = localStorage.getItem('sa_rem_pass');
    if (remUser && remPass) {
        const userIn = document.getElementById('login-user');
        const passIn = document.getElementById('login-pass');
        const remIn = document.getElementById('login-remember');
        if (userIn) userIn.value = remUser;
        if (passIn) passIn.value = remPass;
        if (remIn) remIn.checked = true;
    }
});

// --- Lógica del Simulador ---

function cargarParcelasSimulador() {
    const selectProyecto = document.getElementById('proyecto').value;
    const selectParcela = document.getElementById('parcela');

    if (!selectParcela) return;

    selectParcela.innerHTML = '<option value="">Selecciona una parcela...</option>';
    const container = document.getElementById('cuotas-container');
    if (container) container.innerHTML = '<span style="color:#64748b; font-size:13px;">Escribe o selecciona una parcela para ver las opciones...</span>';

    if (!selectProyecto || !db[selectProyecto]) return;

    const parcelas = Object.keys(db[selectProyecto]).sort((a, b) => {
        const numA = parseInt(a.replace(/[^0-9]/g, ''));
        const numB = parseInt(b.replace(/[^0-9]/g, ''));
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
    });

    parcelas.forEach(p => {
        let opt = document.createElement('option');
        opt.value = p;
        opt.textContent = `Parcela ${p}`;
        selectParcela.appendChild(opt);
    });
}

function mostrarOpcionesCuotas() {
    const proyectoSeleccionado = document.getElementById('proyecto').value;
    const numParcela = document.getElementById('parcela').value.trim().toUpperCase();
    const container = document.getElementById('cuotas-container');

    if (!container) return;

    if (!proyectoSeleccionado || !numParcela) {
        container.innerHTML = '<span style="color:#64748b; font-size:13px;">Selecciona una parcela para ver sus opciones...</span>';
        return;
    }

    const dataProyecto = db[proyectoSeleccionado];
    if (!dataProyecto) return;

    const parcelaKey = Object.keys(dataProyecto).find(k => k.toUpperCase() === numParcela);

    if (!parcelaKey) {
        container.innerHTML = '<span style="color:#64748b; font-size:13px;">Parcela no encontrada...</span>';
        return;
    }

    const p = dataProyecto[parcelaKey];
    const maxSinInteres = getMaxCuotasSinInteres(proyectoSeleccionado);
    let cuotasOfrecidas = Object.keys(p.cuotas || {});

    const extrasSinInteres = [6, 12, 18, 24].filter(m => m <= maxSinInteres && !cuotasOfrecidas.includes(m.toString()));
    cuotasOfrecidas = [...new Set([...cuotasOfrecidas, ...extrasSinInteres.map(String)])].sort((a, b) => parseInt(a) - parseInt(b));

    if (cuotasOfrecidas.length === 0 && maxSinInteres === 0) {
        container.innerHTML = '<span style="color:#64748b; font-size:13px;">No hay financiamiento configurado para esta parcela.</span>';
        return;
    }

    let htmlCheckboxes = '';
    cuotasOfrecidas.forEach((cant, idx) => {
        const isSelected = idx < 3;
        const checkedStr = isSelected ? 'checked' : '';
        const activeClass = isSelected ? 'selected' : '';
        htmlCheckboxes += `
        <label class="cuota-btn-mini ${activeClass}">
            <input type="checkbox" name="cuota-opcion" value="${cant}" ${checkedStr} onchange="toggleMiniButtonStyle(this)">
            <span>${cant} Meses</span>
        </label>`;
    });

    htmlCheckboxes += `
        <div style="display:flex; align-items:center; gap:8px; margin-left:8px; border-left:1.5px solid var(--border); padding-left:16px;">
            <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted);">Meses</label>
                <input type="number" id="custom-meses" min="1" max="120" placeholder="Ej: 3" style="width: 75px; padding: 8px; border: 1.5px solid var(--border); border-radius: 8px; font-size: 13px; background: rgba(255,255,255,0.05); color:var(--text-main);">
            </div>
            <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:var(--text-muted);">Meses UF</label>
                <input type="number" id="custom-meses-uf" min="1" max="120" placeholder="Ej: 6" style="width: 75px; padding: 8px; border: 1.5px solid var(--border); border-radius: 8px; font-size: 13px; background: rgba(255,255,255,0.05); color:var(--text-main);">
            </div>
        </div>
    `;

    container.innerHTML = htmlCheckboxes;
}

function generarSimulacion() {
    const proyectoSeleccionado = document.getElementById('proyecto').value;
    const numParcela = document.getElementById('parcela').value.trim().toUpperCase();
    const errorMsg = document.getElementById('error-msg');
    const resultado = document.getElementById('resultado');

    const telefonoCliente = document.getElementById('telefono-cliente').value.trim();

    errorMsg.innerText = '';
    resultado.value = '';

    if (!proyectoSeleccionado || !numParcela) {
        errorMsg.innerText = 'Por favor, selecciona un proyecto y una parcela.';
        return;
    }

    if (!telefonoCliente) {
        errorMsg.innerText = 'El teléfono del cliente es obligatorio para generar la cotización.';
        return;
    }

    const dataProyecto = db[proyectoSeleccionado];
    if (!dataProyecto) {
        errorMsg.innerText = 'Proyecto no encontrado.';
        return;
    }

    const parcelaKey = Object.keys(dataProyecto).find(k => k.toUpperCase() === numParcela);
    if (!parcelaKey) {
        errorMsg.innerText = `La parcela "${numParcela}" no existe.`;
        return;
    }

    const p = dataProyecto[parcelaKey];
    const parseMoney = (str) => parseInt(String(str).replace(/[^0-9]/g, ''), 10);
    const formatMoney = (num) => Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    const precioNum = parseMoney(p.precio);
    const pieOriginalNum = parseMoney(p.pie);
    const customPieInput = document.getElementById('custom-pie').value.trim();
    const pieCustomNum = customPieInput ? parseMoney(customPieInput) : NaN;

    const customContadoInput = document.getElementById('custom-contado').value.trim();
    const contadoCustomNum = customContadoInput ? parseMoney(customContadoInput) : NaN;
    const precioFinalContado = (!isNaN(contadoCustomNum) && contadoCustomNum > 0) ? formatMoney(contadoCustomNum) : p.precio;

    const usarPieCustom = !isNaN(pieCustomNum) && pieCustomNum > 0 && pieCustomNum < precioNum;
    const pieFinalNum = usarPieCustom ? pieCustomNum : pieOriginalNum;
    const pieFinal = formatMoney(pieFinalNum);

    const maxSinInteres = getMaxCuotasSinInteres(proyectoSeleccionado);
    const boxes = document.querySelectorAll('input[name="cuota-opcion"]:checked');
    let opcionesCuotas = Array.from(boxes).map(b => ({ m: parseInt(b.value), uf: false }));

    const customMesesNum = parseInt(document.getElementById('custom-meses').value);
    if (!isNaN(customMesesNum) && customMesesNum > 0) {
        if (!opcionesCuotas.find(o => o.m === customMesesNum)) opcionesCuotas.push({ m: customMesesNum, uf: false });
    }

    const customMesesUFNum = parseInt(document.getElementById('custom-meses-uf').value);
    if (!isNaN(customMesesUFNum) && customMesesUFNum > 0) {
        const existing = opcionesCuotas.find(o => o.m === customMesesUFNum);
        if (existing) existing.uf = true;
        else opcionesCuotas.push({ m: customMesesUFNum, uf: true });
    }

    if (opcionesCuotas.length === 0) {
        errorMsg.innerText = 'Selecciona al menos 1 opción de cuota.';
        return;
    }

    opcionesCuotas.sort((a, b) => a.m - b.m);

    let cuotasTexto = "";
    const saldoParaFinanciar = precioNum - pieFinalNum;
    const opcionesCuotasCalculadas = [];

    for (const opt of opcionesCuotas) {
        let cNum = opt.m;
        let esSinInteres = opt.uf || cNum <= maxSinInteres;
        let valorCuotaMath = esSinInteres ? (saldoParaFinanciar / cNum) : calcularCuotaNormal(saldoParaFinanciar, cNum, getTasaInteres(proyectoSeleccionado));
        let label = esSinInteres ? "(UF)" : "";

        const valorFormateado = formatMoney(valorCuotaMath);
        cuotasTexto += `• ${cNum} cuotas de $${valorFormateado} ${label}\n`;

        opcionesCuotasCalculadas.push({
            meses: cNum,
            valor: valorFormateado,
            uf: opt.uf,
            sinInteres: esSinInteres
        });
    }

    const textoResultado = `*${proyectoSeleccionado}* – Parcela ${parcelaKey}\n📐 ${p.m2} m²\n💰 Valor Lista: $${p.precio}\n💵 Pago Contado: $${precioFinalContado}\n\nPie: $${pieFinal}\n\nSaldo financiado:\n${cuotasTexto.trim()}`;
    resultado.value = textoResultado;

    // Renderizar Dashboard Visual
    renderVisualResults({
        proyecto: proyectoSeleccionado,
        parcela: parcelaKey,
        m2: p.m2,
        precio: p.precio,
        contado: precioFinalContado,
        pie: pieFinal,
        cuotas: opcionesCuotasCalculadas
    });

    const nombreAsesor = document.getElementById('nombre-asesor').value.trim();
    const nombreCliente = document.getElementById('nombre-cliente').value.trim();

    lastSimulationData = {
        created_at: new Date().toISOString(),
        user_type: currentUserType,
        asesor_name: nombreAsesor || currentFullAsesorName || 'Sin Nombre',
        client_name: nombreCliente || 'Cliente Genérico',
        client_phone: telefonoCliente,
        proyecto: proyectoSeleccionado,
        parcela: parcelaKey,
        m2: p.m2,
        precio_lista: p.precio,
        precio_contado: precioFinalContado,
        pie: pieFinal,
        cuotas_detalle: JSON.stringify(opcionesCuotasCalculadas)
    };

    document.getElementById('btn-pdf').style.display = 'block';

    // Guardar automáticamente en el historial de reportes
    registrarCotizacion(lastSimulationData);
}

// --- Lógica Administrativa ---

function openAdmin() {
    document.getElementById('simulator-view').style.display = 'none';
    document.getElementById('admin-view').style.display = 'block';
    document.getElementById('btn-goto-simulator').style.display = 'flex';
    document.getElementById('btn-admin-nav-toggle').style.display = 'none';
    document.getElementById('main-header-title').innerHTML = '<i class="fa-solid fa-gear"></i> Configuraciones del Sistema';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goToSimulator() {
    document.getElementById('admin-view').style.display = 'none';
    document.getElementById('simulator-view').style.display = 'block';
    document.getElementById('btn-goto-simulator').style.display = 'none';
    document.getElementById('btn-admin-nav-toggle').style.display = 'flex';
    document.getElementById('main-header-title').innerHTML = '<i class="fa-solid fa-chart-line"></i> Centro de Gestión';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function loadAdminParcelas() {
    const proj = document.getElementById('admin-proyecto').value;
    const parcSel = document.getElementById('admin-parcela');
    const bulk = document.getElementById('admin-bulk-container');

    parcSel.innerHTML = '<option value="">Selecciona una parcela...</option>';
    document.getElementById('admin-data-container').style.display = 'none';
    document.getElementById('admin-empty-state').style.display = 'block';

    if (!proj) {
        parcSel.disabled = true;
        bulk.style.display = 'none';
        return;
    }

    parcSel.disabled = false;
    bulk.style.display = 'block';

    const parcelas = Object.keys(db[proj]).sort((a, b) => {
        const numA = parseInt(a.replace(/[^0-9]/g, ''));
        const numB = parseInt(b.replace(/[^0-9]/g, ''));
        return (!isNaN(numA) && !isNaN(numB)) ? numA - numB : a.localeCompare(b);
    });

    parcelas.forEach(p => {
        let opt = document.createElement('option');
        opt.value = p; opt.textContent = `Parcela ${p}`;
        parcSel.appendChild(opt);
    });
}

function loadAdminData() {
    const proj = document.getElementById('admin-proyecto').value;
    const parc = document.getElementById('admin-parcela').value;
    const dataContainer = document.getElementById('admin-data-container');
    const emptyState = document.getElementById('admin-empty-state');
    const cuotasContainer = document.getElementById('admin-cuotas-list');

    if (!proj || !parc) {
        dataContainer.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    const data = db[proj][parc];
    document.getElementById('admin-precio').value = data.precio;
    document.getElementById('admin-pie').value = data.pie;

    cuotasContainer.innerHTML = '';
    const mesesStandard = ['12', '24', '36', '48', '60'];
    const todosMeses = new Set([...mesesStandard, ...Object.keys(data.cuotas)]);
    Array.from(todosMeses).sort((a, b) => parseInt(a) - parseInt(b)).forEach(meses => {
        cuotasContainer.innerHTML += `
            <div class="cuota-item">
                <div class="cuota-label">${meses}x</div>
                <input type="text" class="admin-cuota-input" data-meses="${meses}" value="${data.cuotas[meses] || ''}">
            </div>`;
    });

    dataContainer.style.display = 'block';
    emptyState.style.display = 'none';
}

function renderVisualResults(data) {
    const container = document.getElementById('visual-results');
    if (!container) return;

    let cuotasHtml = '';
    data.cuotas.forEach(c => {
        cuotasHtml += `
            <div class="cuota-card ${c.sinInteres ? 'highlight' : ''}">
                <div class="cuota-label" style="font-weight: 600; color: var(--text-main);">
                    <i class="fa-solid ${c.uf ? 'fa-chart-line' : 'fa-calendar'}" style="color: var(--primary); opacity: 0.8;"></i>
                    ${c.meses} Meses ${c.uf ? '(UF)' : ''}
                </div>
                <div class="cuota-monto" style="font-family: var(--font-heading); margin: 4px 0;">$${c.valor}</div>
                <div>
                   <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 8px; border-radius: 6px; background: ${c.sinInteres ? 'var(--primary)' : 'var(--secondary)'}; color: white; display: inline-block;">
                    ${c.sinInteres ? 'UF' : 'Crédito Directo'}
                   </span>
                </div>
            </div>
        `;
    });

    container.innerHTML = `
        <div class="result-card">
            <div class="result-header-box">
                <div class="stat-item">
                    <span class="stat-label">Proyecto</span>
                    <span class="stat-value">${data.proyecto}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Parcela</span>
                    <span class="stat-value">${data.parcela}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Valor Lista</span>
                    <span class="stat-value" style="color: var(--text-main);">$${data.precio}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Pie Inicial</span>
                    <span class="stat-value" style="color: var(--text-main);">$${data.pie}</span>
                </div>
            </div>
            
            <div style="margin-bottom: 20px; font-size: 14px; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-layer-group" style="color: var(--primary);"></i>
                Opciones de Financiamiento
            </div>
            <div class="cuotas-comparison-grid">
                ${cuotasHtml}
            </div>
        </div>
    `;
}

function saveAdminData() {
    const proj = document.getElementById('admin-proyecto').value;
    const parc = document.getElementById('admin-parcela').value;
    const btnSave = document.getElementById('btn-save-admin');

    if (!proj || !parc) return;

    btnSave.classList.add('loading');

    setTimeout(async () => {
        const nuevasCuotas = {};
        document.querySelectorAll('.admin-cuota-input').forEach(input => {
            if (input.value.trim()) nuevasCuotas[input.getAttribute('data-meses')] = input.value.trim();
        });

        const newData = {
            precio: document.getElementById('admin-precio').value.trim(),
            pie: document.getElementById('admin-pie').value.trim(),
            cuotas: nuevasCuotas
        };

        if (await saveOverridesSupabase(proj, parc, newData)) {
            db[proj][parc] = { ...db[proj][parc], ...newData };
            btnSave.classList.replace('loading', 'success');
            btnSave.querySelector('.btn-content').innerHTML = '¡Guardado!';
            setTimeout(() => {
                btnSave.classList.remove('success');
                btnSave.querySelector('.btn-content').innerHTML = 'Guardar Cambios';
            }, 2000);
        } else {
            btnSave.classList.remove('loading');
        }
    }, 300);
}

async function applyBulkProjectUpdate() {
    const proj = document.getElementById('admin-proyecto').value;
    const variationInput = document.getElementById('admin-bulk-variation').value.trim();

    if (!proj) {
        alert("Por favor, selecciona un proyecto primero.");
        return;
    }

    const isNeg = variationInput.startsWith('-');
    const variation = (isNeg ? -1 : 1) * (parseInt(variationInput.replace(/[^0-9]/g, '')) || 0);

    if (variation === 0) {
        alert("Por favor, ingresa una variación válida.");
        return;
    }

    if (!confirm(`¿Estás seguro de aplicar una variación de $${variation.toLocaleString('es-CL')} a TODAS las parcelas de "${proj}"?`)) {
        return;
    }

    const parcelas = db[proj];
    const payloadArray = [];
    const timestamp = new Date().toISOString();

    const parseMoney = (str) => parseInt(String(str).replace(/[^0-9]/g, ''), 10);
    const formatMoney = (num) => Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    for (const id in parcelas) {
        const data = parcelas[id];
        const currentPrecio = parseMoney(data.precio);
        const newPrecioNum = currentPrecio + variation;
        const newPrecioText = formatMoney(newPrecioNum);

        payloadArray.push({
            proyecto: proj,
            parcela: id,
            precio: newPrecioText,
            pie: data.pie,
            cuotas: data.cuotas,
            updated_at: timestamp
        });
    }

    const success = await saveBulkOverridesSupabase(payloadArray);
    if (success) {
        // Actualizar base de datos local
        payloadArray.forEach(p => {
            db[proj][p.parcela].precio = p.precio;
        });

        // Refrescar vista si hay algo seleccionado
        loadAdminData();

        alert(`¡Éxito! Se actualizaron ${payloadArray.length} parcelas.`);
        document.getElementById('admin-bulk-variation').value = '';
    }
}

// --- Helpers ---

function formatCLPInput(input) {
    const isNeg = input.value.startsWith('-');
    let val = input.value.replace(/[^0-9]/g, '');
    if (!val) { input.value = isNeg ? '-' : ''; return; }
    input.value = (isNeg ? '-' : '') + '$' + parseInt(val).toLocaleString('es-CL');
}

function switchAdminTab(tab) {
    const isReportes = tab === 'reportes';

    // Toggle side items
    document.getElementById('side-tab-ajustes').classList.toggle('active', tab === 'ajustes');
    document.getElementById('side-tab-reportes').classList.toggle('active', isReportes);

    // Toggle content sections
    document.getElementById('view-ajustes').style.display = isReportes ? 'none' : 'block';
    document.getElementById('view-reportes').style.display = isReportes ? 'block' : 'none';

    if (isReportes) cargarReportes();
}

function closeAuthOverlay() {
    document.getElementById('authOverlay').classList.remove('active');
    document.body.style.overflow = 'auto'; // Forzamos auto en lugar de vacío para asegurar en móviles
    document.documentElement.style.overflow = 'auto';
}

const protectAreas = ['resultado', 'visual-results'];
protectAreas.forEach(id => {
    const area = document.getElementById(id);
    if (area) {
        area.addEventListener('copy', e => e.preventDefault());
        area.addEventListener('cut', e => e.preventDefault());
        area.addEventListener('contextmenu', e => e.preventDefault());
    }
});

function limitarCuotas(checkbox) {
    if (document.querySelectorAll('input[name="cuota-opcion"]:checked').length > 3) {
        checkbox.checked = false;
        checkbox.closest('.cuota-btn-mini')?.classList.remove('selected');
        alert("Máximo 3 opciones.");
        return false;
    }
    return true;
}

function toggleMiniButtonStyle(checkbox) {
    if (checkbox.checked) {
        if (!limitarCuotas(checkbox)) return;
        checkbox.closest('.cuota-btn-mini').classList.add('selected');
    } else {
        checkbox.closest('.cuota-btn-mini').classList.remove('selected');
    }
}

// --- SISTEMA DE TEMAS (DARK MODE) ---
function toggleTheme() {
    const body = document.body;
    const btn = document.getElementById('btn-theme-toggle');
    const isDark = body.classList.toggle('dark-mode');

    // Guardar preferencia
    localStorage.setItem('theme', isDark ? 'dark' : 'light');

    // Actualizar icono y logos
    if (btn) {
        btn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    }

    const logos = document.querySelectorAll('.theme-logo');
    logos.forEach(img => {
        img.src = isDark ? 'logo-white.png' : 'logo.png';
    });
}

// Inicializar tema al cargar
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');

        // Cargar logos oscuros al inicio
        const logos = document.querySelectorAll('.theme-logo');
        logos.forEach(img => {
            img.src = 'logo-white.png';
        });
    }
});
