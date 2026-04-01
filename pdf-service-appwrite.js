// ============= PDF SERVICE: Generación y Reportes (Appwrite) =============

async function regenerarPDF_History(quoteId) {
    try {
        const response = await appwriteDatabases.getDocument(DATABASE_ID, 'quotes_history', quoteId);
        const q = response;
        
        if (!q) return alert("No se pudo recuperar la cotización.");

        // Inyectamos valores temporales para asegurar que la db local tenga el objeto parcela
        if (!db[q.proyecto]) db[q.proyecto] = {};
        db[q.proyecto][q.parcela] = {
            m2: q.m2,
            precio: q.precio_lista,
            pie: q.pie,
            cuotas: {}
        };

        // Parsear cuotas_detalle si es string JSON
        let cuotasDetalle = q.cuotas_detalle;
        if (typeof cuotasDetalle === 'string') {
            try {
                cuotasDetalle = JSON.parse(cuotasDetalle);
            } catch (e) {
                console.warn("No se pudo parsear cuotas_detalle:", e);
            }
        }

        // Llamar a la descarga pasando los datos directamente
        await descargarPDF({
            proy: q.proyecto,
            parc: q.parcela,
            cliente: q.client_name,
            asesor: q.asesor_name,
            telefono: q.client_phone,
            pie: q.pie,
            contado: q.precio_contado,
            cuotas_detalle: cuotasDetalle
        });

        window.temporaryOpcionesCuotas = null;

    } catch (e) {
        console.error("Regeneración fallida", e);
        alert("Ocurrió un error al intentar generar el PDF histórico.");
    }
}

async function descargarPDF(dataOverride = null) {
    // Validación obligatoria solo al generar PDF
    if (!dataOverride) {
        const clientNameInput = document.getElementById('nombre-cliente');
        const clientPhoneInput = document.getElementById('telefono-cliente');
        const advisorNameInput = document.getElementById('nombre-asesor');

        if (!clientNameInput.value.trim()) {
            alert("Para generar el PDF es obligatorio ingresar el Nombre del Cliente.");
            clientNameInput.focus();
            return;
        }
        if (!clientPhoneInput.value.trim()) {
            alert("Para generar el PDF es obligatorio ingresar el Teléfono del Cliente.");
            clientPhoneInput.focus();
            return;
        }
        if (!advisorNameInput.value.trim()) {
            alert("Para generar el PDF es obligatorio ingresar el Nombre del Asesor.");
            advisorNameInput.focus();
            return;
        }
    }

    // Si hay override, usamos esos datos, si no, leemos la UI
    const proy = dataOverride ? dataOverride.proy : document.getElementById('proyecto').value;
    const parc = dataOverride ? dataOverride.parc.trim().toUpperCase() : document.getElementById('parcela').value.trim().toUpperCase();

    const dataProyecto = db[proy];
    if (!dataProyecto) return console.error("Proyecto no encontrado");

    const parcelaKey = Object.keys(dataProyecto).find(k => k.toUpperCase() === parc);
    if (!parcelaKey) return console.error("Parcela no encontrada");

    const p = dataProyecto[parcelaKey];

    const btn = document.getElementById('btn-pdf');
    const hasBtn = btn && btn.querySelector('.btn-content');
    const originalContent = '<i class="fa-solid fa-file-pdf" style="color: #dc2626;"></i> Generar PDF';

    if (hasBtn) {
        btn.querySelector('.btn-content').innerHTML = '<div class="spinner" style="border-top-color:#1e293b;border-right-color:#1e293b;width:16px;height:16px;display:inline-block;margin-right:8px;vertical-align:middle;"></div> Generando...';
    }

    try {
        // Logo embebido como base64 (mismo que el original)
        const logoBase64 = "data:image/png;base64,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
84
(Content truncated due to size limit. Use use line ranges to read remaining content)
