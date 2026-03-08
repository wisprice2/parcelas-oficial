// ============= PDF SERVICE: Generación y Reportes =============

async function regenerarPDF_History(quoteId) {
    try {
        const { data: q, error } = await supabaseClient.from('quotes_history').select('*').eq('id', quoteId).single();
        if (error || !q) return alert("No se pudo recuperar la cotización.");

        // Inyectamos valores temporales para asegurar que la db local tenga el objeto parcela (por si acaso)
        if (!db[q.proyecto]) db[q.proyecto] = {};
        db[q.proyecto][q.parcela] = {
            m2: q.m2,
            precio: q.precio_lista,
            pie: q.pie,
            cuotas: {}
        };

        // Llamar a la descarga pasando los datos directamente (sin depender del DOM)
        await descargarPDF({
            proy: q.proyecto,
            parc: q.parcela,
            cliente: q.client_name,
            asesor: q.asesor_name,
            pie: q.pie,
            contado: q.precio_contado,
            cuotas_detalle: q.cuotas_detalle
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
        const advisorNameInput = document.getElementById('nombre-asesor');

        if (!clientNameInput.value.trim()) {
            alert("Para generar el PDF es obligatorio ingresar el Nombre del Cliente.");
            clientNameInput.focus();
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
        // Logo embebido como base64 directamente
        const logoBase64 = "data:image/png;base64,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";

        const fechaStr = new Date().toLocaleDateString('es-CL');
        const nombreCliente = dataOverride ? dataOverride.cliente : (document.getElementById('nombre-cliente').value.trim() || '___________________');

        let asesorInput = dataOverride ? dataOverride.asesor : document.getElementById('nombre-asesor').value.trim();
        if (!asesorInput && currentAuthUser) {
            if (currentAuthUser.includes('.')) {
                asesorInput = currentAuthUser.split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            } else {
                asesorInput = currentAuthUser.charAt(0).toUpperCase() + currentAuthUser.slice(1);
            }
        }
        const nombreAsesor = asesorInput || '___________________';

        // Registrar en historial si es nueva generación
        if (lastSimulationData && !dataOverride) {
            registrarCotizacion({
                ...lastSimulationData,
                asesor_name: nombreAsesor,
                client_name: nombreCliente
            });
        }

        // Determinar monto de reserva
        const proyUpper = proy.toUpperCase();
        const montoReserva = (proyUpper.includes('ESTANCIA VICTORIA') || proyUpper.includes('EL DORADO')) ? '500.000' : '200.000';

        // Cuotas y recálculo de Pie
        const parseMoney = (str) => parseInt(String(str).replace(/[^0-9]/g, ''), 10);
        const formatMoney = (num) => Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

        const precioNum = parseMoney(p.precio);
        const pieOriginalNum = parseMoney(p.pie);
        const customPieInput = dataOverride ? dataOverride.pie : document.getElementById('custom-pie').value.trim();
        const pieCustomNum = customPieInput ? parseMoney(customPieInput) : NaN;

        const customContadoInput = dataOverride ? dataOverride.contado : document.getElementById('custom-contado').value.trim();
        const contadoCustomNum = customContadoInput ? parseMoney(customContadoInput) : NaN;
        const precioFinalContado = (!isNaN(contadoCustomNum) && contadoCustomNum > 0) ? formatMoney(contadoCustomNum) : p.precio;

        const usarPieCustom = !isNaN(pieCustomNum) && pieCustomNum > 0 && pieCustomNum < precioNum;
        const pieFinalNum = usarPieCustom ? pieCustomNum : pieOriginalNum;
        const pieFinal = formatMoney(pieFinalNum);

        const maxSinInteres = getMaxCuotasSinInteres(proy);

        // Determinar el máximo de cuotas normales configuradas
        let maxCuotasConfiguradas = 0;
        if (p.cuotas) {
            const mesesDisponibles = Object.keys(p.cuotas).map(Number).filter(n => !isNaN(n));
            if (mesesDisponibles.length > 0) {
                maxCuotasConfiguradas = Math.max(...mesesDisponibles);
            }
        }

        const boxes = document.querySelectorAll('input[name="cuota-opcion"]:checked');
        let opcionesCuotas = (dataOverride && dataOverride.cuotas_detalle) ? dataOverride.cuotas_detalle : Array.from(boxes).map(b => ({ m: parseInt(b.value), uf: false }));

        if (!dataOverride) {
            const customMesesInput = document.getElementById('custom-meses').value.trim();
            const customMesesNum = parseInt(customMesesInput);
            if (!isNaN(customMesesNum) && customMesesNum > 0) {
                const existing = opcionesCuotas.find(o => o.m === customMesesNum);
                if (!existing) opcionesCuotas.push({ m: customMesesNum, uf: false });
            }

            const customMesesUFInput = document.getElementById('custom-meses-uf').value.trim();
            const customMesesUFNum = parseInt(customMesesUFInput);
            if (!isNaN(customMesesUFNum) && customMesesUFNum > 0) {
                const existing = opcionesCuotas.find(o => o.m === customMesesUFNum);
                if (existing) existing.uf = true;
                else opcionesCuotas.push({ m: customMesesUFNum, uf: true });
            }
            opcionesCuotas.sort((a, b) => a.m - b.m);
        }

        let cuotaLines = [];
        const saldoParaFinanciar = precioNum - pieFinalNum;
        let mostrarAdvertenciaPDF = false;

        for (const opt of opcionesCuotas) {
            let cNum = opt.m;
            if (isNaN(cNum)) continue;

            let cuotaFinal = "";
            let esSinInteres = opt.uf || cNum <= maxSinInteres;

            if (esSinInteres) {
                const valorCuotaMath = saldoParaFinanciar / cNum;
                cuotaFinal = formatMoney(valorCuotaMath);
                cuotaLines.push(`${cNum} cuotas de $${cuotaFinal} (UF)`);
            } else {
                const tasa = getTasaInteres(proy);
                const valorCuotaMath = calcularCuotaNormal(saldoParaFinanciar, cNum, tasa);
                cuotaFinal = formatMoney(valorCuotaMath);
                cuotaLines.push(`${cNum} cuotas de $${cuotaFinal}`);

                // Validar si excede el sistema
                if (maxCuotasConfiguradas > 0 && cNum > maxCuotasConfiguradas) {
                    mostrarAdvertenciaPDF = true;
                }
            }
        }
        const cuotasTexto = cuotaLines.length > 0 ? cuotaLines.join('<br>') : 'N/A';

        const htmlContent = `
            <div style="width: 794px; height: 1122px; position: absolute; top: 0; left: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2d3748; background: #fafaf9; overflow: hidden; z-index: -9999;">
                <style>
                    /* CSS Optimizado para renderizado PDF (A4 estricto) */
                    body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; color: #2d3748; background: #fafaf9; }
                    
                    /* Banner Superior */
                    .hero-banner { background-color: #2E4A3D; color: #ffffff; padding: 30px 40px; display: flex; justify-content: space-between; align-items: center; }
                    .brand-logo { width: 110px; height: auto; padding: 0; display: flex; align-items: center; justify-content: flex-start; flex-shrink: 0; }
                    .brand-logo img { width: 100%; height: auto; object-fit: contain; display: block; }
                    .hero-details { text-align: right; }
                    .hero-details h1 { margin: 0 0 5px 0; font-size: 32px; font-weight: 300; }
                    .hero-details p { margin: 0; color: #a7f3d0; font-size: 15px; }

                    .content-wrapper { padding: 25px 40px; }

                    /* Tarjeta Cliente superpuesta */
                    .client-card { background: #ffffff; border-radius: 6px; padding: 20px 25px; margin-top: -20px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); border-left: 5px solid #2E4A3D; margin-bottom: 25px; display: flex; flex-direction: column; }
                    .client-label { font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 1px; margin-bottom: 5px; font-weight: 600; }
                    .client-name { font-size: 20px; font-weight: 300; color: #1f2937; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; margin-bottom: 10px; font-family: 'Times New Roman', serif; }
                    .validity-text { font-size: 12px; color: #64748b; font-style: italic; }

                    .greeting { font-size: 14px; color: #4b5563; line-height: 1.5; margin-bottom: 20px; text-align: justify; }

                    /* Tablas Premium */
                    .pricing-section { margin-bottom: 20px; }
                    .pricing-title { background: #e6f4ea; color: #166534; padding: 8px 15px; font-size: 13px; font-weight: bold; border-radius: 4px 4px 0 0; margin: 0; }
                    table { width: 100%; border-collapse: collapse; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 0 0 4px 4px; overflow: hidden; }
                    th { background: #f8fafc; color: #64748b; font-weight: 600; text-align: left; padding: 10px 15px; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
                    td { padding: 10px 15px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
                    .price-highlight { font-size: 15px; font-weight: 700; color: #2E4A3D; }

                    /* Grid Inferior */
                    .info-grid { display: flex; gap: 20px; margin-top: 25px; }
                    .info-box { background: #ffffff; padding: 15px; border-radius: 6px; flex: 1; border: 1px solid #e5e7eb; }
                    .info-box h3 { margin-top: 0; font-size: 13px; color: #2E4A3D; display: flex; align-items: center; border-bottom: 1px solid #f3f4f6; padding-bottom: 8px; margin-bottom: 8px; }
                    
                    ul.check-list { list-style: none; padding: 0; margin: 0; }
                    ul.check-list li { position: relative; padding-left: 18px; margin-bottom: 6px; font-size: 12px; color: #4b5563; }
                    ul.check-list li::before { content: "✓"; position: absolute; left: 0; color: #10b981; font-weight: bold; }

                    .urgent-text { font-size: 11px; color: #b45309; background: #fef3c7; padding: 6px 10px; border-radius: 4px; margin-top: 10px; display: inline-block; }

                    /* Footer */
                    .footer { margin-top: 20px; text-align: center; color: #6b7280; font-size: 11px; border-top: 1px solid #e5e7eb; padding-top: 15px; }
                    .executive { font-size: 14px; color: #2E4A3D; font-weight: 600; margin-bottom: 5px; }
                    .trust-badge { display: inline-block; margin-top: 8px; padding: 4px 12px; border: 1px solid #d1d5db; border-radius: 20px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
                </style>

                <div class="hero-banner">
                    <div class="brand-logo">
                        <img src="${logoBase64}" alt="Logo Soy Nativo">
                    </div>
                    <div class="hero-details">
                        <h1>Cotización Oficial</h1>
                        <p>Proyecto: <strong>${proy}</strong> | Fecha: ${fechaStr}</p>
                    </div>
                </div>

                <div class="content-wrapper">
                    
                    <div class="client-card">
                        <div class="client-label">Cliente</div>
                        <div class="client-name">${nombreCliente}</div>
                        <div class="validity-text">Vigencia de la cotización: hasta 31 de marzo de 2026</div>
                    </div>

                    <p class="greeting">
                        Nos complace presentar la siguiente cotización para la(s) parcela(s) que visitó con nuestro equipo. 
                        Agradecemos profundamente su interés en proteger el patrimonio natural y formar parte de la comunidad <strong>Soy Nativo</strong>.
                    </p>

                    <div class="pricing-section">
                        <div class="pricing-title">Opción 1: Financiamiento Directo</div>
                        <table>
                            <thead>
                                <tr>
                                    <th>N° Parcela</th>
                                    <th>Superficie</th>
                                    <th>Precio Parcela</th>
                                    <th>Pie</th>
                                    <th>Cuotas</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><strong>${parcelaKey}</strong></td>
                                    <td>${p.m2} m²</td>
                                    <td class="price-highlight">$${p.precio}</td>
                                    <td>$${pieFinal}</td>
                                    <td>${cuotasTexto}</td>
                                </tr>
                            </tbody>
                        </table>
                        ${mostrarAdvertenciaPDF ? '<div class="urgent-text" style="background:#fef2f2; color:#ef4444; border: 1px solid #fecaca; margin-top:10px;">Condición: Sujeto a evaluación</div>' : ''}
                    </div>

                    <div class="pricing-section">
                        <div class="pricing-title">Opción 2: Pago al Contado</div>
                        <table>
                            <thead>
                                <tr>
                                    <th>N° Parcela</th>
                                    <th>Superficie</th>
                                    <th>Precio Contado</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><strong>${parcelaKey}</strong></td>
                                    <td>${p.m2} m²</td>
                                    <td class="price-highlight">$${precioFinalContado}</td>
                                </tr>
                            </tbody>
                        </table>
                        <div class="urgent-text">
                            Condición: Firma y pago requeridos hasta el 31 de marzo de 2026.
                        </div>
                    </div>

                    <div class="info-grid">
                        <div class="info-box">
                            <h3>Beneficios Exclusivos</h3>
                            <ul class="check-list">
                                <li>Rol propio aprobado por SAG</li>
                                <li>Portón de acceso exclusivo</li>
                                <li>Caminos interiores estabilizados</li>
                                <li>Asesoría legal y seguimiento post venta</li>
                            </ul>
                        </div>
                        <div class="info-box">
                            <h3>Instrucciones de Reserva</h3>
                            <p style="font-size: 12px; color: #4b5563; margin-top:0;">Asegure su parcela con una reserva de <strong>$${montoReserva}</strong> (válida 7 días). Transferir a:</p>
                            <p style="font-size: 12px; margin-bottom: 0;">
                                ${proyUpper.includes('LARQUI') ? `
                                <strong>Banco Santander</strong><br>
                                Cuenta Corriente: 27422055<br>
                                Inmobiliaria Soy Nativo Limitada<br>
                                RUT: 78289708-K<br>
                                administrativo@soynativo.cl
                                ` : `
                                <strong>Banco Scotiabank</strong><br>
                                Cuenta Corriente: 979734867<br>
                                Soc. de Inv. Las Araucarias SPA<br>
                                RUT: 77.278.269-1<br>
                                administrativo@soynativo.cl
                                `}
                            </p>
                        </div>
                    </div>

                    <div class="footer">
                        <div class="executive">Atendido por: ${nombreAsesor}</div>
                        <div>Quedamos a su entera disposición para cualquier consulta.</div>
                        <div style="font-size: 9px; color: #9ca3af; margin-bottom: 10px;">*Valores referenciales sujetos a disponibilidad y evaluación comercial.</div>
                        <div class="trust-badge">11 años desarrollando proyectos inmobiliarios</div>
                        <p style="margin-top: 10px; color: #9ca3af;">www.soynativo.cl</p>
                    </div>

                </div>
            </div>
        `;

        // Crear un div virtual contenedor
        const el = document.createElement('div');
        el.innerHTML = htmlContent;
        // Adjuntamos temporalmente al DOM detrás del contenido visual principal 
        document.body.appendChild(el);

        // Configuración de html2pdf
        const opt = {
            margin: 0,
            filename: `Cotizacion_${proy.replace(/\s+/g, '_')}_Parcela_${parc}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0, width: 794, height: 1122 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        await html2pdf().set(opt).from(el.firstElementChild).save();

        // Remover el contenedor del DOM tras la creación
        document.body.removeChild(el);

        if (hasBtn) {
            btn.querySelector('.btn-content').innerHTML = '<i class="fa-solid fa-check" style="color: #16a34a;"></i> Generado';
            setTimeout(() => { btn.querySelector('.btn-content').innerHTML = originalContent; }, 3000);
        }
    } catch (e) {
        console.error('PDF generation error:', e);
        if (hasBtn) {
            btn.querySelector('.btn-content').innerHTML = 'Error generando';
            setTimeout(() => { btn.querySelector('.btn-content').innerHTML = originalContent; }, 3000);
        }
    }
}

async function exportarReportesCSV() {
    if (!window.lastReportData || window.lastReportData.length === 0) {
        return alert("No hay datos para exportar.");
    }

    const headers = ["Fecha", "Tipo Usuario", "Asesor", "Cliente", "Proyecto", "Parcela", "M2", "Precio Lista", "Precio Pie"];
    let csvContent = "\ufeff" + headers.join(";") + "\n";

    window.lastReportData.forEach(r => {
        const fecha = new Date(r.created_at).toLocaleString('es-CL');
        const row = [
            fecha,
            r.user_type,
            r.asesor_name,
            r.client_name,
            r.proyecto,
            r.parcela,
            r.m2,
            r.precio_lista,
            r.pie
        ];
        csvContent += row.map(v => `"${v}"`).join(";") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Reporte_Cotizaciones_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
