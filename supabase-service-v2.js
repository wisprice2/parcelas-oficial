// Configuración de Supabase - Mapeo de configuración centralizado
// En un entorno de producción real con Next.js, esto se leería de process.env
const SUPABASE_URL = 'https://wrwixrkvxuxlzlbmqcnm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indyd2l4cmt2eHV4bHpsYm1xY25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NjYyMTAsImV4cCI6MjA4ODI0MjIxMH0.Obq02KaBRQuyJ5voJLnG5Ce8JK6jJizvfnmLHq1_KHU';

// Capa de abstracción para la inicialización
const getSupabaseClient = () => {
    if (typeof window !== 'undefined' && window.supabase) {
        return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return null;
};

const supabaseClient = getSupabaseClient();

let currentUserType = 'Partner'; // Por defecto
let currentFullAsesorName = '';
let currentAuthUser = null;

// --- SISTEMA DE PERSISTENCIA Y ADMINISTRACIÓN CON SUPABASE ---

// 1. Aplicar overrides guardados en Supabase a la base de datos "db"
async function applySupabaseOverrides() {
    try {
        const { data, error } = await supabaseClient
            .from('parcelas_overrides')
            .select('*');

        if (error) {
            console.error("Error consultando Supabase:", error);
            return;
        }

        if (data && data.length > 0) {
            data.forEach(override => {
                const proj = override.proyecto;
                const parc = override.parcela;

                if (db[proj] && db[proj][parc]) {
                    // Sobrescribir conservando los metros cuadrados originales
                    const originalM2 = db[proj][parc].m2;
                    db[proj][parc] = {
                        ...db[proj][parc],
                        precio: override.precio,
                        pie: override.pie,
                        cuotas: override.cuotas,
                        m2: originalM2
                    };
                }
            });
        }
    } catch (e) {
        console.error("Excepción cargandoOverrides de Supabase", e);
    }
}

// 2. Guardar overrides actuales en Supabase
async function saveOverridesSupabase(proyecto, parcela, newData) {
    try {
        const { data, error } = await supabaseClient
            .from('parcelas_overrides')
            .upsert({
                proyecto: proyecto,
                parcela: parcela,
                precio: newData.precio,
                pie: newData.pie,
                cuotas: newData.cuotas,
                updated_at: new Date().toISOString()
            }, { onConflict: 'proyecto, parcela' });

        if (error) throw error;
        return true;
    } catch (e) {
        console.error("Error guardando en Supabase:", e);
        alert("Ocurrió un error al guardar en la nube. Verifica la consola.");
        return false;
    }
}

// 3. Registrar cotización en el historial
async function registrarCotizacion(datos) {
    try {
        await supabaseClient.from('quotes_history').insert([datos]);
    } catch (e) {
        console.error("Error guardando historial:", e);
    }
}

// 5. Helpers de Cálculo Compartidos
function getTasaInteres(proyecto) {
    const p = proyecto.toUpperCase();
    if (p.includes("ESTANCIA VICTORIA") || p.includes("EL DORADO")) return 0.0195;
    if (p.includes("ALTOS DE NAHUELCURA")) return 0.0178;
    if (p.includes("AIRES DE ALERCE")) return 0.0210;
    return 0.0220;
}

function calcularCuotaNormal(saldo, meses, tasa) {
    if (tasa <= 0) return saldo / meses;
    return saldo * (tasa * Math.pow(1 + tasa, meses)) / (Math.pow(1 + tasa, meses) - 1);
}

function getMaxCuotasSinInteres(proyecto) {
    const p = proyecto.toUpperCase();
    if (p.includes("ALTOS DE NAHUELCURA")) return 18;
    if (p.includes("ESTANCIA VICTORIA")) return 24;
    if (p.includes("EL DORADO") || p.includes("VALLE SAN ANDRÉS") || p.includes("VERDE PRADERA")) return 6;
    return 0;
}

// 6. Cargar reportes de cotizaciones
async function cargarReportes() {
    const tbody = document.getElementById('reports-tbody');
    const fUser = document.getElementById('filter-user').value.trim().toLowerCase();
    const fType = document.getElementById('filter-type').value;
    const fProj = document.getElementById('filter-project').value;
    const btnDelMulti = document.getElementById('btn-delete-multi');
    const checkAll = document.getElementById('check-all-reports');

    if (btnDelMulti) btnDelMulti.style.display = 'none';
    if (checkAll) checkAll.checked = false;

    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px;">Cargando historial...</td></tr>';

    try {
        let query = supabaseClient.from('quotes_history').select('*').order('created_at', { ascending: false });

        if (fType) query = query.eq('user_type', fType);
        if (fProj) query = query.eq('proyecto', fProj);

        const { data, error } = await query;

        if (error) throw error;

        const filteredData = data.filter(r => {
            const matchUser = fUser === '' || (r.asesor_name || '').toLowerCase().includes(fUser);
            return matchUser;
        });

        if (filteredData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px;">No se encontraron registros.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        window.lastReportData = filteredData;

        filteredData.forEach(r => {
            const fecha = new Date(r.created_at).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            const tr = document.createElement('tr');

            let deleteIcon = '';
            // Permitir borrar si es admin o si el registro es suyo (simple check)
            if (currentAuthUser && (currentAuthUser.toLowerCase() === 'admin' || r.asesor_name.toLowerCase() === currentFullAsesorName.toLowerCase())) {
                deleteIcon = `
                    <button class="btn-mini-pdf" style="color:#ef4444; border-color:#fee2e2;" onclick="eliminarCotizacion('${r.id}')" title="Eliminar">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                `;
            }

            tr.innerHTML = `
                <td><input type="checkbox" class="report-check" value="${r.id}" onclick="updateMultiDeleteBtn()"></td>
                <td>${fecha}</td>
                <td><span class="badge-type badge-${r.user_type.toLowerCase()}">${r.user_type}</span><br>${r.asesor_name}</td>
                <td>${r.client_name}</td>
                <td><strong>${r.proyecto}</strong><br>Parcela ${r.parcela} (${r.m2} m²)</td>
                <td>$${r.precio_lista}</td>
                <td>
                    <button class="btn-mini-pdf" onclick="regenerarPDF_History('${r.id}')">
                        <i class="fa-solid fa-file-pdf"></i> Generar
                    </button>
                </td>
                <td style="text-align:center;">${deleteIcon}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error("Error cargando reportes:", e);
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:red; padding:20px;">Error al cargar datos.</td></tr>';
    }
}

// 7. Funciones de eliminación
async function eliminarCotizacion(id) {
    if (!confirm("¿Estás seguro de que deseas eliminar este reporte?")) return;

    try {
        const { error } = await supabaseClient
            .from('quotes_history')
            .delete()
            .eq('id', id);

        if (error) throw error;
        cargarReportes();
    } catch (e) {
        console.error("Error eliminando:", e);
        alert("No se pudo eliminar el reporte.");
    }
}

function toggleAllReports(master) {
    const checks = document.querySelectorAll('.report-check');
    checks.forEach(c => c.checked = master.checked);
    updateMultiDeleteBtn();
}

function updateMultiDeleteBtn() {
    const btn = document.getElementById('btn-delete-multi');
    const checkedCount = document.querySelectorAll('.report-check:checked').length;
    if (btn) btn.style.display = checkedCount > 0 ? 'block' : 'none';
}

async function eliminarSeleccionados() {
    const checks = document.querySelectorAll('.report-check:checked');
    const ids = Array.from(checks).map(c => c.value);

    if (ids.length === 0) return;
    if (!confirm(`¿Estás seguro de que deseas eliminar ${ids.length} reportes seleccionados?`)) return;

    try {
        const { error } = await supabaseClient
            .from('quotes_history')
            .delete()
            .in('id', ids);

        if (error) throw error;
        cargarReportes();
    } catch (e) {
        console.error("Error en borrado masivo:", e);
        alert("Error al intentar borrar múltiples reportes.");
    }
}

// --- SISTEMA DE LOGIN Y FLUJO DE AUTH (Basado en Tabla app_users) ---

function loginGuest() {
    currentUserType = 'Partner';
    currentFullAsesorName = 'Partner';
    localStorage.setItem('sa_user', 'Guest');
    localStorage.setItem('sa_type', 'Partner');
    closeAuthOverlay();
}

function showLoginForm() {
    document.getElementById('auth-welcome').classList.remove('active');
    document.getElementById('auth-login').classList.add('active');
    document.getElementById('login-error').style.display = 'none';
}

function showWelcomeForm() {
    document.getElementById('auth-login').classList.remove('active');
    document.getElementById('auth-welcome').classList.add('active');
    document.getElementById('login-user').value = '';
    document.getElementById('login-pass').value = '';
}

async function attemptLogin() {
    let u = document.getElementById('login-user').value.trim();
    let p = document.getElementById('login-pass').value.trim();
    const btnSubmit = document.getElementById('btn-login-submit');
    let err = document.getElementById('login-error');

    // Manejo de caracteres especiales para compatibilidad
    let searchUser = u;
    if (u.toLowerCase() === 'genesis.casañas' || u.toLowerCase() === 'genesis.casanas') {
        searchUser = 'genesis.casanas';
    }
    if (u.toLowerCase() === 'angela.yañes' || u.toLowerCase() === 'angela.yanes') {
        searchUser = 'angela.yanes';
    }

    if (!u || !p) {
        err.textContent = "Llena ambos campos";
        err.style.display = 'block';
        return;
    }

    btnSubmit.classList.add('loading');
    err.style.display = 'none';

    try {
        const { data, error } = await supabaseClient
            .from('app_users')
            .select('*')
            .ilike('username', searchUser)
            .eq('password', p)
            .single();

        if (error || !data) {
            err.textContent = "Usuario o contraseña incorrectos";
            err.style.display = 'block';
            btnSubmit.classList.remove('loading');
            return;
        }

        currentAuthUser = data.username;
        currentUserType = data.role || 'Interno';

        // Recordar sesión
        if (document.getElementById('login-remember').checked) {
            localStorage.setItem('sa_rem_user', u);
            localStorage.setItem('sa_rem_pass', p);
        } else {
            localStorage.removeItem('sa_rem_user');
            localStorage.removeItem('sa_rem_pass');
        }

        localStorage.setItem('sa_user', currentAuthUser);
        localStorage.setItem('sa_type', currentUserType);

        // Formatear nombre legible
        currentFullAsesorName = currentAuthUser.split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        if (data.needs_change) {
            btnSubmit.classList.remove('loading');
            document.getElementById('auth-login').classList.remove('active');
            document.getElementById('auth-change-pass').classList.add('active');
        } else {
            const toggleBtn = document.getElementById('btn-admin-nav-toggle');
            if (toggleBtn) toggleBtn.style.display = 'flex';
            closeAuthOverlay();

            // Pre-fill asesor name
            const asesorInput = document.getElementById('nombre-asesor');
            if (asesorInput) asesorInput.value = currentFullAsesorName;
        }

    } catch (e) {
        console.error("Login Exception", e);
        err.textContent = "Error de conexión: " + e.message;
        err.style.display = 'block';
        btnSubmit.classList.remove('loading');
    }
}

async function updatePassword() {
    let p1 = document.getElementById('new-pass1').value;
    let p2 = document.getElementById('new-pass2').value;
    const btnSubmit = document.getElementById('btn-change-submit');
    let err = document.getElementById('change-error');

    if (p1.length < 6) {
        err.textContent = "Mínimo 6 caracteres";
        err.style.display = 'block';
        return;
    }
    if (p1 !== p2) {
        err.textContent = "No coinciden";
        err.style.display = 'block';
        return;
    }

    btnSubmit.classList.add('loading');
    err.style.display = 'none';

    try {
        const { error } = await supabaseClient
            .from('app_users')
            .update({ password: p1, needs_change: false })
            .eq('username', currentAuthUser);

        if (error) throw error;

        const toggleBtn = document.getElementById('btn-admin-nav-toggle');
        if (toggleBtn) toggleBtn.style.display = 'flex';

        document.getElementById('auth-change-pass').classList.remove('active');
        document.getElementById('authOverlay').classList.remove('active');
        document.body.style.overflow = '';

        // Pre-fill asesor name
        const asesorInput = document.getElementById('nombre-asesor');
        if (asesorInput) asesorInput.value = currentFullAsesorName;

    } catch (e) {
        console.error("Update Pass Error", e);
        err.textContent = "Error actualizando.";
        err.style.display = 'block';
        btnSubmit.classList.remove('loading');
    }
}

function logout() {
    localStorage.removeItem('sa_user');
    localStorage.removeItem('sa_type');
    location.reload();
}

// Inicialización de sesión persistente (basada en localStorage para este modo)
document.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('sa_user');
    const savedType = localStorage.getItem('sa_type');

    if (savedUser && savedUser !== 'Guest') {
        currentAuthUser = savedUser;
        currentUserType = savedType;
        currentFullAsesorName = currentAuthUser.split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        const toggleBtn = document.getElementById('btn-admin-nav-toggle');
        if (toggleBtn) toggleBtn.style.display = 'flex';

        const asesorInput = document.getElementById('nombre-asesor');
        if (asesorInput) asesorInput.value = currentFullAsesorName;

        closeAuthOverlay();
    }
});
