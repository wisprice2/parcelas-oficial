// Configuración de Appwrite - Reemplazo de supabase-service-v2.js
// Actualizado con nueva API Key con todos los permisos

const APPWRITE_ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
const APPWRITE_PROJECT_ID = '69cd7ceb0021e3fb3d67';
// Nueva API Key con permisos de plataforma y base de datos
const APPWRITE_API_KEY = 'standard_e82a14b23fe16530448f9a9eeaba139f336d5cca8cfa183a46451a7e78ab82f434145e551b7e2471d3079054f57b0c61f5c95706e0a6950b1e40a02e52ac420cd9ee8885328c12549cd186e33cde2da832d4dd93238a183eb3ae499d73058f5a7783086faa077e79a8243bf58054f3bf30234300b44d134453a311e0e0d7dc2f';
const DATABASE_ID = 'cotizador_db';

let appwriteClient = null;
let appwriteDatabases = null;

// Inicializar cliente de Appwrite
function initAppwrite() {
    if (typeof window !== 'undefined' && window.Appwrite) {
        const { Client, Databases } = window.Appwrite;
        appwriteClient = new Client()
            .setEndpoint(APPWRITE_ENDPOINT)
            .setProject(APPWRITE_PROJECT_ID)
            .setKey(APPWRITE_API_KEY);
        appwriteDatabases = new Databases(appwriteClient);
        console.log("Appwrite SDK inicializado correctamente con nueva API Key.");
    }
}

// Cargar Appwrite en el contexto global
if (typeof window !== 'undefined') {
    if (!window.Appwrite) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/appwrite@14.0.0/dist/appwrite.umd.js';
        script.onload = () => {
            initAppwrite();
            applySupabaseOverrides(); // Cargar datos iniciales al estar listo
        };
        document.head.appendChild(script);
    } else {
        initAppwrite();
        applySupabaseOverrides();
    }
}

let currentUserType = 'Partner';
let currentFullAsesorName = '';
let currentAuthUser = null;

// --- SISTEMA DE PERSISTENCIA Y ADMINISTRACIÓN CON APPWRITE ---

async function applySupabaseOverrides() {
    try {
        if (!appwriteDatabases) {
            console.warn("Appwrite no inicializado aún, reintentando...");
            setTimeout(applySupabaseOverrides, 1000);
            return;
        }

        const response = await appwriteDatabases.listDocuments(DATABASE_ID, 'parcelas_overrides');
        const data = response.documents || [];

        if (data && data.length > 0) {
            data.forEach(override => {
                const proj = override.proyecto;
                const parc = override.parcela;

                if (db[proj] && db[proj][parc]) {
                    const originalM2 = db[proj][parc].m2;
                    let cuotas = override.cuotas;
                    if (typeof cuotas === 'string' && cuotas.startsWith('{')) {
                        try { cuotas = JSON.parse(cuotas); } catch (e) {}
                    }
                    db[proj][parc] = {
                        ...db[proj][parc],
                        precio: override.precio,
                        pie: override.pie,
                        cuotas: cuotas,
                        m2: originalM2
                    };
                }
            });
            console.log(`✅ ${data.length} overrides aplicados desde Appwrite.`);
        }
    } catch (e) {
        console.error("Excepción cargando Overrides de Appwrite", e);
    }
}

async function saveOverridesSupabase(proyecto, parcela, newData) {
    const payload = {
        proyecto: proyecto,
        parcela: parcela,
        precio: String(newData.precio),
        pie: String(newData.pie),
        cuotas: typeof newData.cuotas === 'string' ? newData.cuotas : JSON.stringify(newData.cuotas),
        updated_at: new Date().toISOString()
    };

    try {
        // Buscar si ya existe el documento para ese proyecto/parcela
        const existing = await appwriteDatabases.listDocuments(DATABASE_ID, 'parcelas_overrides', [
            `proyecto="${proyecto}"`,
            `parcela="${parcela}"`
        ]);

        if (existing.documents && existing.documents.length > 0) {
            const docId = existing.documents[0].$id;
            await appwriteDatabases.updateDocument(DATABASE_ID, 'parcelas_overrides', docId, payload);
        } else {
            await appwriteDatabases.createDocument(DATABASE_ID, 'parcelas_overrides', 'unique()', payload);
        }
        return true;
    } catch (e) {
        console.error("Error guardando en Appwrite:", e);
        return false;
    }
}

async function saveBulkOverridesSupabase(payloadArray) {
    try {
        for (const p of payloadArray) {
            await saveOverridesSupabase(p.proyecto, p.parcela, p);
        }
        return true;
    } catch (e) {
        console.error("Error bulk Appwrite:", e);
        return false;
    }
}

async function registrarCotizacion(datos) {
    try {
        const payload = {
            ...datos,
            created_at: new Date().toISOString(),
            precio_lista: String(datos.precio_lista),
            precio_contado: String(datos.precio_contado),
            pie: String(datos.pie),
            cuotas_detalle: typeof datos.cuotas_detalle === 'string' ? datos.cuotas_detalle : JSON.stringify(datos.cuotas_detalle),
            total_quote: "0",
            pdf_url: ""
        };
        
        await appwriteDatabases.createDocument(DATABASE_ID, 'quotes_history', 'unique()', payload);
        console.log("✅ Cotización registrada en Appwrite.");
    } catch (e) {
        console.error("Error registro Appwrite:", e);
    }
}

// Helpers
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

async function cargarReportes() {
    const tbody = document.getElementById('reports-tbody');
    if (!tbody) return;
    
    const fUser = document.getElementById('filter-user').value.trim().toLowerCase();
    const fType = document.getElementById('filter-type').value;
    const fProj = document.getElementById('filter-project').value;

    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px;">Cargando...</td></tr>';

    try {
        let queries = [];
        if (fType) queries.push(`user_type="${fType}"`);
        if (fProj) queries.push(`proyecto="${fProj}"`);

        const response = await appwriteDatabases.listDocuments(DATABASE_ID, 'quotes_history', queries);
        let data = response.documents || [];

        data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const filteredData = data.filter(r => {
            return fUser === '' || (r.asesor_name || '').toLowerCase().includes(fUser);
        });

        if (filteredData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px;">Sin registros.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        window.lastReportData = filteredData;

        filteredData.forEach(r => {
            const fecha = new Date(r.created_at).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            const tr = document.createElement('tr');
            let deleteIcon = '';
            if (currentAuthUser && (currentAuthUser.toLowerCase() === 'admin' || r.asesor_name.toLowerCase() === currentFullAsesorName.toLowerCase())) {
                deleteIcon = `<button class="btn-mini-pdf" style="color:#ef4444;" onclick="eliminarCotizacion('${r.$id}')"><i class="fa-solid fa-trash"></i></button>`;
            }

            tr.innerHTML = `
                <td><input type="checkbox" class="report-check" value="${r.$id}" onclick="updateMultiDeleteBtn()"></td>
                <td><span style="font-size:12px;">${fecha}</span></td>
                <td><span class="badge-type badge-${r.user_type.toLowerCase()}">${r.user_type}</span><div style="font-weight:600;">${r.asesor_name}</div></td>
                <td><span style="font-weight:600; color:var(--accent);">${r.client_name}</span></td>
                <td>${r.client_phone || 'N/A'}</td>
                <td><div>${r.proyecto}</div><div style="font-size:12px;">Parcela ${r.parcela} (${r.m2} m²)</div></td>
                <td style="font-weight:600; color:#16a34a;">$${r.precio_lista}</td>
                <td style="text-align:center;"><button class="btn-mini-pdf" onclick="regenerarPDF_History('${r.$id}')"><i class="fa-solid fa-file-pdf"></i></button></td>
                <td style="text-align:center;">${deleteIcon}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Error reportes:", e);
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:red;">Error al cargar.</td></tr>';
    }
}

async function eliminarCotizacion(id) {
    if (!confirm("¿Eliminar reporte?")) return;
    try {
        await appwriteDatabases.deleteDocument(DATABASE_ID, 'quotes_history', id);
        cargarReportes();
    } catch (e) { console.error(e); }
}

function updateMultiDeleteBtn() {
    const btn = document.getElementById('btn-delete-multi');
    const checkedCount = document.querySelectorAll('.report-check:checked').length;
    if (btn) btn.style.display = checkedCount > 0 ? 'block' : 'none';
}

async function eliminarSeleccionados() {
    const ids = Array.from(document.querySelectorAll('.report-check:checked')).map(c => c.value);
    if (ids.length === 0 || !confirm(`¿Eliminar ${ids.length} reportes?`)) return;
    try {
        for (const id of ids) await appwriteDatabases.deleteDocument(DATABASE_ID, 'quotes_history', id);
        cargarReportes();
    } catch (e) { console.error(e); }
}

// Auth
function loginGuest() {
    currentUserType = 'Partner';
    currentFullAsesorName = 'Partner';
    localStorage.setItem('sa_user', 'Guest');
    localStorage.setItem('sa_type', 'Partner');
    closeAuthOverlay();
}

async function attemptLogin() {
    let u = document.getElementById('login-user').value.trim();
    let p = document.getElementById('login-pass').value.trim();
    const btnSubmit = document.getElementById('btn-login-submit');
    const err = document.getElementById('login-error');

    if (!u || !p) return;
    btnSubmit.classList.add('loading');

    try {
        const response = await appwriteDatabases.listDocuments(DATABASE_ID, 'app_users', [
            `username="${u}"`,
            `password="${p}"`
        ]);

        const data = response.documents[0];
        if (!data) {
            err.textContent = "Error de credenciales";
            err.style.display = 'block';
            btnSubmit.classList.remove('loading');
            return;
        }

        currentAuthUser = data.username;
        currentUserType = data.role || 'Interno';
        localStorage.setItem('sa_user', currentAuthUser);
        localStorage.setItem('sa_type', currentUserType);
        currentFullAsesorName = currentAuthUser.split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        if (data.needs_change) {
            document.getElementById('auth-login').classList.remove('active');
            document.getElementById('auth-change-pass').classList.add('active');
        } else {
            const toggleBtn = document.getElementById('btn-admin-nav-toggle');
            if (toggleBtn) toggleBtn.style.display = 'flex';
            closeAuthOverlay();
        }
    } catch (e) {
        console.error(e);
        btnSubmit.classList.remove('loading');
    }
}

function logout() {
    localStorage.removeItem('sa_user');
    localStorage.removeItem('sa_type');
    location.reload();
}

document.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('sa_user');
    if (savedUser && savedUser !== 'Guest') {
        currentAuthUser = savedUser;
        currentUserType = localStorage.getItem('sa_type');
        currentFullAsesorName = currentAuthUser.split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const toggleBtn = document.getElementById('btn-admin-nav-toggle');
        if (toggleBtn) toggleBtn.style.display = 'flex';
        closeAuthOverlay();
    }
});

function closeAuthOverlay() {
    const overlay = document.getElementById('authOverlay');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// Version: 1.0.2 - Force Vercel Re-deployment
