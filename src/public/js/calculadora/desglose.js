/**
 * Módulo de desglose diario del devengamiento
 * Muestra, día por día desde la fecha de compra hasta la fecha de valuación:
 * - Devengamiento a TIR (Precio C+T)
 * - Ajuste por CER (Precio C+T Ajustado)
 * - Caída por pagos efectuados (Pagos Efect. Actualizados)
 * - Revalúo C+T y Revalúo de Ajuste (ADC)
 * - Valuación de la partida
 */

let ultimoDesglose = null;
let paginaDesglose = 1;
const FILAS_POR_PAGINA_DESGLOSE = 20;

function obtenerFechaISODesdeInput(id) {
    const valor = document.getElementById(id)?.value || '';
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(valor)) {
        return convertirFechaDDMMAAAAaYYYYMMDD(valor);
    }
    return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : null;
}

async function cargarMapaCER(fechaDesde, fechaHasta) {
    const response = await fetch(`/api/cer/bd?desde=${encodeURIComponent(fechaDesde)}&hasta=${encodeURIComponent(fechaHasta)}`);
    const result = await response.json();
    const mapa = new Map();
    if (result.success && Array.isArray(result.datos)) {
        result.datos.forEach(cer => {
            const fecha = cer.fecha.includes('T') ? cer.fecha.split('T')[0] : cer.fecha;
            mapa.set(fecha, parseFloat(cer.valor));
        });
    }
    return mapa;
}

// Valor CER exacto o, si no existe, el más cercano anterior (igual que buscarValorCERPorFecha)
function buscarCEREnMapa(fecha, mapaCER) {
    const cursor = new Date(fecha);
    for (let i = 0; i < 31; i++) {
        const valor = mapaCER.get(formatearFechaInput(cursor));
        if (valor !== undefined && isFinite(valor)) return valor;
        cursor.setDate(cursor.getDate() - 1);
    }
    return null;
}

/**
 * Calcular las filas del desglose diario
 * Replica la planilla de referencia (columnas F a Q)
 */
async function calcularDesglose() {
    const tir = window.tirModule?.getUltimaTIR?.();
    if (tir === null || tir === undefined) {
        throw new Error('Primero calcule la TIR.');
    }

    const fechaCompraISO = obtenerFechaISODesdeInput('fechaCompra');
    const fechaValuacionISO = obtenerFechaISODesdeInput('fechaValuacion');
    if (!fechaCompraISO || !fechaValuacionISO) {
        throw new Error('Complete la fecha de compra y la fecha de valuación.');
    }

    const fechaCompra = crearFechaDesdeString(fechaCompraISO);
    const fechaValuacion = crearFechaDesdeString(fechaValuacionISO);
    if (fechaValuacion < fechaCompra) {
        throw new Error('La fecha de valuación debe ser posterior o igual a la fecha de compra.');
    }

    const precioCompra = normalizarNumeroDesdeInput(document.getElementById('precioCompra')?.value);
    const cantidad = normalizarNumeroDesdeInput(document.getElementById('cantidadPartida')?.value) || 0;
    if (precioCompra === null) {
        throw new Error('Complete el precio de compra.');
    }

    const tipoInteresDias = parseInt(document.getElementById('tipoInteresDias')?.value || '0', 10);
    const ajusteCER = document.getElementById('ajusteCER')?.checked || false;
    const intervaloFin = parseInt(document.getElementById('intervaloFin')?.value || '0', 10);

    // Pagos de cupones (Pagos Actualiz. de la tabla de cupones), aperturados en:
    // - sinAjuste: flujo nominal (amortización + renta nominal × residual) × factor actualización → se descuenta del C+T
    // - ajuste: Pagos Actualiz. - sinAjuste → se descuenta del ajuste CER (C+T Ajustado)
    const pagos = (window.cuponesModule?.getCuponesData?.() || [])
        .filter(c => c.id !== 'inversion' && c.fechaLiquid)
        .map(c => {
            const fechaISO = /^\d{2}\/\d{2}\/\d{4}$/.test(c.fechaLiquid)
                ? convertirFechaDDMMAAAAaYYYYMMDD(c.fechaLiquid)
                : c.fechaLiquid;
            const monto = normalizarNumeroDesdeInput(c.pagosActualiz) || 0;
            const amortiz = normalizarNumeroDesdeInput(c.amortiz) || 0;
            const rentaNominal = normalizarNumeroDesdeInput(c.rentaNominal) || 0;
            const residual = normalizarNumeroDesdeInput(c.valorResidual) ?? 100;
            const factor = normalizarNumeroDesdeInput(c.factorActualiz) || 0;
            const sinAjuste = ajusteCER
                ? (amortiz + rentaNominal * residual / 100) * factor / 100
                : monto;
            return {
                fecha: crearFechaDesdeString(fechaISO),
                monto,
                sinAjuste,
                ajuste: monto - sinAjuste
            };
        })
        .filter(p => p.fecha);

    // CER: base = CER de compra; CER diario = CER (fecha + intervaloFin días hábiles)
    let cerCompra = null;
    let mapaCER = null;
    let feriados = [];
    if (ajusteCER) {
        cerCompra = window.cerValoresReferencia?.cerCompra;
        if (!cerCompra) {
            throw new Error('No se encontró el CER de compra. Verifique la fecha de compra y los intervalos.');
        }
        const desde = new Date(fechaCompra);
        desde.setDate(desde.getDate() - Math.abs(intervaloFin) * 2 - 45);
        const hasta = new Date(fechaValuacion);
        hasta.setDate(hasta.getDate() + 5);
        const desdeISO = formatearFechaInput(desde);
        const hastaISO = formatearFechaInput(hasta);
        feriados = await window.cuponesDiasHabiles.cargarFeriadosDesdeBD(desdeISO, hastaISO);
        mapaCER = await cargarMapaCER(desdeISO, hastaISO);
    }

    const filas = [];
    let anterior = null;
    const cursor = new Date(fechaCompra);

    while (cursor <= fechaValuacion) {
        const fecha = new Date(cursor);
        const fechaISO = formatearFechaInput(fecha);

        // G: Precio C+T = ROUND(precioCompra × (1 + TIR) ^ fracción, 8)
        const fraccion = calcularFraccionAnio(fechaCompraISO, fechaISO, tipoInteresDias);
        const precioCT = Math.round(precioCompra * Math.pow(1 + tir, fraccion) * 1e8) / 1e8;

        // O, P: fecha CER y CER del día
        let fechaCER = null;
        let cerDia = null;
        let precioCTAjustado = precioCT;
        if (ajusteCER) {
            fechaCER = intervaloFin !== 0
                ? window.cuponesDiasHabiles.sumarDiasHabiles(fecha, intervaloFin, feriados)
                : fecha;
            cerDia = buscarCEREnMapa(fechaCER, mapaCER);
            if (cerDia === null) {
                throw new Error(`No hay valor CER cargado para ${formatearFechaDDMMAAAA(fechaCER)}.`);
            }
            // H: Precio C+T Ajustado = Precio C+T × CER del día / CER compra
            precioCTAjustado = precioCT * cerDia / cerCompra;
        }

        // Pagos efectuados (cupones con fecha liquidación < fecha), aperturados
        const pagosEfectuados = pagos.filter(p => p.fecha < fecha);
        const pagosActualizados = pagosEfectuados.reduce((suma, p) => suma + p.monto, 0);
        // I: Pagos efectuados actualizados sin ajuste
        const pagosSinAjuste = pagosEfectuados.reduce((suma, p) => suma + p.sinAjuste, 0);
        // J: Pagos efectuados actualizados (parte de ajuste)
        const pagosAjuste = pagosActualizados - pagosSinAjuste;

        // K: Precio C+T - Pagos sin ajuste
        const precioCTPagos = precioCT - pagosSinAjuste;
        // L: Precio C+T Ajustado - Pagos ajustados
        const precioCTAjustPagosAjuste = precioCTAjustado - pagosAjuste;
        // Precio final de la partida = C+T Ajustado - todos los pagos
        const precioAjustPagos = precioCTAjustado - pagosActualizados;
        // N: Revalúo de ajuste acumulado (ADC) = L - G
        const revaluoAjuste = precioCTAjustPagosAjuste - precioCT;
        // M: Revalúo C+T del día (sobre C+T - Pagos sin ajuste) / O: Diferencia del revalúo de ajuste del día
        const revaluoCT = anterior ? precioCTPagos - anterior.precioCTPagos : 0;
        const difAjuste = anterior ? revaluoAjuste - anterior.revaluoAjuste : 0;

        const fila = {
            fecha,
            fechaCER,
            cerDia,
            precioCT,
            precioCTAjustado,
            pagosActualizados,
            pagosSinAjuste,
            pagosAjuste,
            precioCTPagos,
            precioCTAjustPagosAjuste,
            precioAjustPagos,
            revaluoCT,
            revaluoAjuste,
            difAjuste,
            revaluoTotal: revaluoCT + difAjuste,
            // Q: Valuación = cantidad × (Precio Ajustado - Pagos)
            valuacion: cantidad * precioAjustPagos,
            // El pago impacta el día siguiente a la fecha de liquidación del cupón
            impactoPago: anterior !== null && pagosActualizados !== anterior.pagosActualizados
        };
        filas.push(fila);
        anterior = fila;
        cursor.setDate(cursor.getDate() + 1);
    }

    const primera = filas[0];
    const ultima = filas[filas.length - 1];
    // Σ (Revalúo C+T + Dif. Ajuste): lo que se contabiliza sobre el precio de compra
    const sumaRevaluos = filas.reduce((suma, f) => suma + f.revaluoTotal, 0);
    return {
        ajusteCER,
        cantidad,
        precioCompra,
        cerCompra,
        filas,
        resumen: {
            devengamientoTIR: ultima.precioCT - primera.precioCT,
            ajusteCER: ultima.precioCTAjustado - ultima.precioCT,
            pagos: ultima.pagosActualizados,
            pagosSinAjuste: ultima.pagosSinAjuste,
            pagosAjuste: ultima.pagosAjuste,
            adc: ultima.revaluoAjuste,
            precioFinal: ultima.precioAjustPagos,
            valuacionInicial: primera.valuacion,
            valuacionFinal: ultima.valuacion,
            sumaRevaluos,
            precioContabilizado: precioCompra + sumaRevaluos
        }
    };
}

function formatearFechaDDMMAAAA(fecha) {
    if (!fecha) return '';
    const d = String(fecha.getDate()).padStart(2, '0');
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}/${fecha.getFullYear()}`;
}

function formatearMonto(valor) {
    return valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderizarDesglose(desglose) {
    const decimales = obtenerDecimalesAjustes();
    const fmt = v => (v === null || v === undefined) ? '-' : v.toFixed(decimales);
    const { resumen, ajusteCER } = desglose;

    const resumenItems = [
        ['Precio Compra', fmt(desglose.precioCompra)],
        ['Devengamiento TIR', fmt(resumen.devengamientoTIR)],
        ajusteCER ? ['Ajuste CER', fmt(resumen.ajusteCER)] : null,
        ['Pagos sin Ajuste', fmt(-resumen.pagosSinAjuste)],
        ajusteCER ? ['Pagos Ajustados', fmt(-resumen.pagosAjuste)] : null,
        ['Revalúo Ajuste (ADC)', fmt(resumen.adc)],
        ['Precio Ajustado - Pagos', fmt(resumen.precioFinal)],
        ['Valuación', formatearMonto(resumen.valuacionFinal)]
    ].filter(Boolean);

    document.getElementById('desgloseResumen').innerHTML = resumenItems.map(([label, valor]) => `
        <div class="resultado-item-horizontal">
            <span class="resultado-label">${label}</span>
            <span class="resultado-valor">${valor}</span>
        </div>`).join('');

    const columnasCER = ajusteCER ? '' : 'style="display: none;"';
    document.getElementById('desgloseHead').innerHTML = `
        <tr>
            <th>Fecha</th>
            <th ${columnasCER}>Fecha<br>CER</th>
            <th ${columnasCER}>CER<br>del día</th>
            <th>Precio<br>C+T</th>
            <th ${columnasCER}>Precio C+T<br>Ajustado</th>
            <th>Pagos Efect. Act.<br>sin Ajuste</th>
            <th ${columnasCER}>Pagos Efect. Act.<br>Ajustados</th>
            <th>Precio C+T<br>- Pagos</th>
            <th ${columnasCER}>Precio C+T Ajust.<br>- Pagos Ajust.</th>
            <th>Revalúo<br>C+T</th>
            <th>Revalúo de<br>Ajuste (ADC)</th>
            <th>Diferencia<br>Rev. Ajuste</th>
            <th>Revalúo C+T<br>+ Dif. Ajuste</th>
            <th>Valuación</th>
        </tr>`;

    // Pie de tabla: sumatoria de "Revalúo C+T + Dif. Ajuste" sobre todo el período (no solo la página)
    const columnasAntesSuma = ajusteCER ? 12 : 7;
    document.getElementById('desgloseFoot').innerHTML = `
        <tr class="fila-total-desglose">
            <td colspan="${columnasAntesSuma}"></td>
            <td style="white-space: nowrap;">Σ ${fmt(resumen.sumaRevaluos)}</td>
            <td></td>
        </tr>`;

    // Lo que efectivamente se contabiliza: precio de compra + sumatoria de revalúos
    document.getElementById('desgloseContabilizado').innerHTML = `
        <div class="contabilizado-item">
            <span class="resultado-label">Precio Compra</span>
            <span class="resultado-valor">${fmt(desglose.precioCompra)}</span>
        </div>
        <span class="contabilizado-operador">+</span>
        <div class="contabilizado-item">
            <span class="resultado-label">Σ Revalúo C+T + Dif. Ajuste</span>
            <span class="resultado-valor">${fmt(resumen.sumaRevaluos)}</span>
        </div>
        <span class="contabilizado-operador">=</span>
        <div class="contabilizado-item contabilizado-resultado">
            <span class="resultado-label">Precio contabilizado</span>
            <span class="resultado-valor">${fmt(resumen.precioContabilizado)}</span>
        </div>`;

    renderizarPaginaDesglose(1);
}

/**
 * Renderizar una página del desglose (FILAS_POR_PAGINA_DESGLOSE filas)
 */
function renderizarPaginaDesglose(pagina) {
    if (!ultimoDesglose) return;
    const { filas, ajusteCER } = ultimoDesglose;
    const totalPaginas = Math.max(1, Math.ceil(filas.length / FILAS_POR_PAGINA_DESGLOSE));
    paginaDesglose = Math.min(Math.max(1, pagina), totalPaginas);

    const decimales = obtenerDecimalesAjustes();
    const fmt = v => (v === null || v === undefined) ? '-' : v.toFixed(decimales);
    const columnasCER = ajusteCER ? '' : 'style="display: none;"';
    const desde = (paginaDesglose - 1) * FILAS_POR_PAGINA_DESGLOSE;
    const filasPagina = filas.slice(desde, desde + FILAS_POR_PAGINA_DESGLOSE);

    document.getElementById('desgloseBody').innerHTML = filasPagina.map(f => `
        <tr${f.impactoPago ? ' class="cupon-vigente" title="Impacto de pago de cupón"' : ''}>
            <td>${formatearFechaDDMMAAAA(f.fecha)}</td>
            <td ${columnasCER}>${formatearFechaDDMMAAAA(f.fechaCER)}</td>
            <td ${columnasCER}>${fmt(f.cerDia)}</td>
            <td>${fmt(f.precioCT)}</td>
            <td ${columnasCER}>${fmt(f.precioCTAjustado)}</td>
            <td>${fmt(f.pagosSinAjuste)}</td>
            <td ${columnasCER}>${fmt(f.pagosAjuste)}</td>
            <td>${fmt(f.precioCTPagos)}</td>
            <td ${columnasCER}>${fmt(f.precioCTAjustPagosAjuste)}</td>
            <td>${fmt(f.revaluoCT)}</td>
            <td>${fmt(f.revaluoAjuste)}</td>
            <td>${fmt(f.difAjuste)}</td>
            <td>${fmt(f.revaluoTotal)}</td>
            <td>${formatearMonto(f.valuacion)}</td>
        </tr>`).join('');

    document.getElementById('desgloseInfoPagina').textContent =
        `Mostrando ${desde + 1} - ${desde + filasPagina.length} de ${filas.length} días`;
    document.getElementById('desglosePagina').textContent = `Página ${paginaDesglose} de ${totalPaginas}`;
    [['btnDesgloseAnterior', paginaDesglose <= 1], ['btnDesgloseSiguiente', paginaDesglose >= totalPaginas]]
        .forEach(([id, deshabilitado]) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            btn.disabled = deshabilitado;
            btn.style.opacity = deshabilitado ? '0.5' : '1';
            btn.style.cursor = deshabilitado ? 'not-allowed' : 'pointer';
        });
}

function cambiarPaginaDesglose(delta) {
    renderizarPaginaDesglose(paginaDesglose + delta);
}

async function mostrarDesglose() {
    const panel = document.getElementById('panelDesglose');
    const btn = document.getElementById('btnVerDesglose');
    if (!panel) return;

    if (panel.style.display !== 'none') {
        panel.style.display = 'none';
        if (btn) btn.querySelector('span').textContent = 'Ver desglose';
        return;
    }

    if (btn) btn.disabled = true;
    try {
        ultimoDesglose = await calcularDesglose();
        renderizarDesglose(ultimoDesglose);
        panel.style.display = 'block';
        if (btn) btn.querySelector('span').textContent = 'Ocultar desglose';
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        console.error('[desglose] Error al calcular desglose:', error);
        if (typeof showError === 'function') showError(error.message);
    } finally {
        if (btn) btn.disabled = false;
    }
}

function ocultarDesglose() {
    ultimoDesglose = null;
    const panel = document.getElementById('panelDesglose');
    if (panel) panel.style.display = 'none';
    const btn = document.getElementById('btnVerDesglose');
    if (btn) btn.querySelector('span').textContent = 'Ver desglose';
}

function exportarDesgloseCSV() {
    if (!ultimoDesglose) return;
    const { filas, ajusteCER } = ultimoDesglose;
    const num = v => (v === null || v === undefined) ? '' : String(v).replace('.', ',');
    const encabezado = ['Fecha'];
    if (ajusteCER) encabezado.push('Fecha CER', 'CER del dia');
    encabezado.push('Precio C+T');
    if (ajusteCER) encabezado.push('Precio C+T Ajustado');
    encabezado.push('Pagos Efect. Act. sin Ajuste');
    if (ajusteCER) encabezado.push('Pagos Efect. Act. Ajustados');
    encabezado.push('Precio C+T - Pagos');
    if (ajusteCER) encabezado.push('Precio C+T Ajustado - Pagos Ajustados');
    encabezado.push('Precio Ajustado - Pagos', 'Revaluo C+T',
        'Revaluo de Ajuste (ADC)', 'Diferencia Rev. Ajuste', 'Revaluo C+T + Dif. Ajuste', 'Valuacion');

    const lineas = filas.map(f => {
        const celdas = [formatearFechaDDMMAAAA(f.fecha)];
        if (ajusteCER) celdas.push(formatearFechaDDMMAAAA(f.fechaCER), num(f.cerDia));
        celdas.push(num(f.precioCT));
        if (ajusteCER) celdas.push(num(f.precioCTAjustado));
        celdas.push(num(f.pagosSinAjuste));
        if (ajusteCER) celdas.push(num(f.pagosAjuste));
        celdas.push(num(f.precioCTPagos));
        if (ajusteCER) celdas.push(num(f.precioCTAjustPagosAjuste));
        celdas.push(num(f.precioAjustPagos), num(f.revaluoCT),
            num(f.revaluoAjuste), num(f.difAjuste), num(f.revaluoTotal), num(Math.round(f.valuacion * 100) / 100));
        return celdas.join(';');
    });

    const csv = '﻿' + [encabezado.join(';'), ...lineas].join('\n');
    const ticker = document.getElementById('ticker')?.value?.trim() || 'especie';
    const enlace = document.createElement('a');
    enlace.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    enlace.download = `desglose_${ticker}_${formatearFechaInput(filas[filas.length - 1].fecha)}.csv`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
}

window.desgloseModule = {
    calcularDesglose,
    mostrarDesglose,
    ocultarDesglose,
    exportarDesgloseCSV
};

window.mostrarDesglose = mostrarDesglose;
window.exportarDesgloseCSV = exportarDesgloseCSV;
window.cambiarPaginaDesglose = cambiarPaginaDesglose;
