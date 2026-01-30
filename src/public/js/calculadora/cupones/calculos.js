/**
 * Utilidades para cálculos y asignaciones financieras de los cupones
 */

function normalizarNumeroDesdeInput(valor) {
    if (valor === null || valor === undefined) return null;
    if (typeof valor === 'number') {
        return isNaN(valor) ? null : valor;
    }
    if (typeof valor === 'string') {
        const sanitized = valor.replace(',', '.').trim();
        if (!sanitized) return null;
        const parsed = parseFloat(sanitized);
        return isNaN(parsed) ? null : parsed;
    }
    return null;
}

function formatearNumero(valor, decimales = 4) {
    if (!isFinite(valor)) return '';
    const redondeado = parseFloat(valor.toFixed(decimales + 2)); // redondeo intermedio
    if (Number.isInteger(redondeado)) {
        return redondeado.toString();
    }
    return redondeado.toFixed(decimales);
}

function actualizarCampoCupon(cupon, campo, valor) {
    cupon[campo] = valor;
    const input = document.getElementById(`${campo}_${cupon.id}`);
    if (input && input.value !== valor) {
        input.value = valor;
    }
}

function obtenerCantidadPartida() {
    return normalizarNumeroDesdeInput(document.getElementById('cantidadPartida')?.value);
}

function obtenerPrecioCompra() {
    return normalizarNumeroDesdeInput(document.getElementById('precioCompra')?.value);
}

function obtenerCoeficienteCEREmision() {
    const texto = document.getElementById('coefCEREmision')?.textContent || '';
    return normalizarNumeroDesdeTexto(texto);
}

function obtenerCoeficienteCERCompra() {
    const elemento = document.getElementById('coefCERCompra');
    const texto = elemento?.textContent || '';
    const coeficiente = normalizarNumeroDesdeTexto(texto);
    
    return coeficiente;
}

function obtenerDecimalesAjustes() {
    const input = document.getElementById('decimalesAjustes');
    if (input) {
        const valor = parseInt(input.value, 10);
        return isNaN(valor) || valor < 0 ? 8 : Math.min(valor, 12);
    }
    return 8; // Por defecto 8
}

function calcularFlujoInversion(cantidad, precio, coeficiente) {
    if (cantidad === null || precio === null) {
        return null;
    }
    if (coeficiente === null || coeficiente <= 0) {
        return null;
    }
    return -(cantidad * precio * coeficiente);
}

function calcularFlujoCupon(cantidad, amortizacionAjustada, rentaAjustada) {
    if (cantidad === null || cantidad === 0) {
        return null;
    }
    if (amortizacionAjustada === null || rentaAjustada === null) {
        return null;
    }
    return cantidad * ((amortizacionAjustada / 100) + (rentaAjustada / 100));
}

function recalcularFlujosCupones(cupones = window.cuponesModule?.getCuponesData?.() || []) {
    if (!Array.isArray(cupones) || cupones.length === 0) {
        limpiarFlujosCalculados();
        return;
    }

    const cantidadPartida = obtenerCantidadPartida();
    const precioCompra = obtenerPrecioCompra();
    const ajusteCER = document.getElementById('ajusteCER')?.checked || false;
    const coeficienteCERCompra = ajusteCER ? obtenerCoeficienteCERCompra() : 1;
    const decimalesAjustes = obtenerDecimalesAjustes();
    const decimalesFlujos = decimalesAjustes === 12 ? 12 : 8;

    cupones.forEach((cupon, index) => {
        let flujoCalculado = null;

        if (cupon.id === 'inversion') {
            // Con ajuste CER: cantidad * precio * coeficienteCERCompra
            // Sin ajuste CER: cantidad * precio
            if (ajusteCER) {
                // SIEMPRE recalcular el flujo con el coeficiente CER actualizado
                flujoCalculado = calcularFlujoInversion(cantidadPartida, precioCompra, coeficienteCERCompra);
            } else {
                // Sin ajuste CER: simplemente cantidad * precio (negativo porque es inversión)
                if (cantidadPartida !== null && precioCompra !== null) {
                    flujoCalculado = -(cantidadPartida * precioCompra);
                }
            }
        } else {
            const amortizacionAjustadaRaw = cupon.amortizAjustada;
            const rentaAjustadaRaw = cupon.rentaAjustada;
            const amortizacionAjustada = normalizarNumeroDesdeInput(amortizacionAjustadaRaw);
            const rentaAjustada = normalizarNumeroDesdeInput(rentaAjustadaRaw);
            
            flujoCalculado = calcularFlujoCupon(cantidadPartida, amortizacionAjustada, rentaAjustada);
        }

        if (flujoCalculado === null || !isFinite(flujoCalculado)) {
            actualizarCampoCupon(cupon, 'flujos', '');
            // Limpiar también el valor numérico completo
            cupon.flujosNumero = null;
        } else {
            // Guardar el valor numérico completo para cálculos de TIR (sin pérdida de precisión)
            cupon.flujosNumero = flujoCalculado;
            
            // Si los decimales de ajustes están en 12, usar 12 decimales para los flujos (mayor precisión para TIR)
            const flujoFormateado = formatearNumero(flujoCalculado, decimalesFlujos);
            actualizarCampoCupon(cupon, 'flujos', flujoFormateado);
        }
    });

    if (window.tirModule && typeof window.tirModule.actualizarFlujosDescontadosYSumatoria === 'function') {
        window.tirModule.actualizarFlujosDescontadosYSumatoria();
    }
}

function limpiarFlujosCalculados() {
    const cupones = window.cuponesModule?.getCuponesData?.() || [];
    cupones.forEach(cupon => {
        actualizarCampoCupon(cupon, 'flujos', '');
        actualizarCampoCupon(cupon, 'flujosDesc', '');
    });
}

function normalizarNumeroDesdeTexto(texto) {
    if (typeof texto !== 'string') return normalizarNumeroDesdeInput(texto);
    return normalizarNumeroDesdeInput(texto.replace(',', '.').trim());
}

// Función obtenerDecimalesAjustes ya está definida arriba (línea 57), no duplicar

function obtenerDecimalesRentaTNA() {
    const input = document.getElementById('decimalesRentaTNA');
    if (!input) return 4; // Default: 4 decimales
    const valor = parseInt(input.value, 10);
    if (isNaN(valor) || valor < 0 || valor > 12) return 4;
    return valor;
}

function aplicarRentaTNAEnCupones(cupones, rentaTNA) {
    const valor = rentaTNA ?? '';
    if (!Array.isArray(cupones)) return;
    cupones.forEach(cupon => {
        if (!cupon || cupon.id === 'inversion') return;
        actualizarCampoCupon(cupon, 'rentaTNA', valor);
    });
}

/**
 * Aplica amortización en los cupones desde el último hacia atrás hasta completar el residual objetivo.
 * @param {Array} cupones - Lista de cupones (puede incluir fila inversión)
 * @param {string|number} porcentajeAmortizacion - Porcentaje por cupón (ej. 20)
 * @param {number|null} residualInicial - Residual al inicio del primer cupón de la lista (ej. 60 cuando la partida cae en los últimos cupones). Si no se pasa, se usa 100.
 */
function aplicarAmortizacionEnCupones(cupones, porcentajeAmortizacion, residualInicial) {
    if (!Array.isArray(cupones) || cupones.length === 0) return;
    
    const porcentaje = normalizarNumeroDesdeInput(porcentajeAmortizacion);
    const cuponesRegulares = cupones.filter(c => c && c.id !== 'inversion');
    
    cuponesRegulares.forEach(cupon => {
        actualizarCampoCupon(cupon, 'amortiz', '0');
    });
    
    if (porcentaje === null || porcentaje <= 0 || cuponesRegulares.length === 0) {
        return;
    }
    
    // Si la partida cae en los últimos cupones, el primer cupón visible no parte de 100% sino del residual ya amortizado por cupones anteriores
    const objetivo = (residualInicial != null && isFinite(residualInicial) && residualInicial >= 0)
        ? Math.min(100, residualInicial)
        : 100;
    let restante = objetivo;
    for (let i = cuponesRegulares.length - 1; i >= 0 && restante > 0; i--) {
        const valor = Math.min(porcentaje, restante);
        actualizarCampoCupon(cuponesRegulares[i], 'amortiz', formatearNumero(valor, 4));
        restante = parseFloat((restante - valor).toFixed(6));
    }
    
    if (restante > 0 && cuponesRegulares.length > 0) {
        const valorActual = normalizarNumeroDesdeInput(cuponesRegulares[0].amortiz) || 0;
        actualizarCampoCupon(cuponesRegulares[0], 'amortiz', formatearNumero(valorActual + restante, 4));
    }
}

/**
 * Calcular factor de actualización para un cupón
 * Factor = (1 + TIR) ^ (FRAC Año entre fecha liq cupon y fecha valuacion)
 */
function calcularFactorActualizacion(cupon) {
    // Obtener TIR
    const tir = window.tirModule?.getUltimaTIR?.() || null;
    if (tir === null) {
        return null;
    }
    
    // Obtener fecha de valuación
    const fechaValuacionStr = document.getElementById('fechaValuacion')?.value;
    if (!fechaValuacionStr) {
        return null;
    }
    
    // Obtener fecha liquidación del cupón
    if (!cupon.fechaLiquid) {
        return null;
    }
    
    // Convertir fechas a formato ISO (YYYY-MM-DD)
    let fechaValuacionISO = fechaValuacionStr;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaValuacionISO)) {
        fechaValuacionISO = convertirFechaDDMMAAAAaYYYYMMDD(fechaValuacionISO);
    }
    
    let fechaLiquidISO = cupon.fechaLiquid;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaLiquidISO)) {
        fechaLiquidISO = convertirFechaDDMMAAAAaYYYYMMDD(fechaLiquidISO);
    }
    
    // Obtener tipoInteresDias
    const tipoInteresDias = parseInt(document.getElementById('tipoInteresDias')?.value || '0', 10);
    
    // Calcular fracción de año entre fecha liquidación y fecha valuación
    const fraccionAnio = calcularFraccionAnio(fechaLiquidISO, fechaValuacionISO, tipoInteresDias);
    
    if (fraccionAnio <= 0) {
        return 1; // Si la fracción es 0 o negativa, el factor es 1
    }
    
    // Calcular factor = (1 + TIR) ^ fraccionAnio
    const factor = Math.pow(1 + tir, fraccionAnio);
    return factor;
}

/**
 * Calcular pagos actualizados para un cupón
 * Pagos Actualizados = (amortizacion ajustada * Factor actualizacion / 100) + (Renta ajustada * factor actualizacion /100)
 */
function calcularPagosActualizados(cupon, factorActualizacion) {
    if (factorActualizacion === null) {
        return null;
    }
    
    const amortizacionAjustada = normalizarNumeroDesdeInput(cupon.amortizAjustada) || 0;
    const rentaAjustada = normalizarNumeroDesdeInput(cupon.rentaAjustada) || 0;
    
    const pagosActualizados = (amortizacionAjustada * factorActualizacion / 100) + (rentaAjustada * factorActualizacion / 100);
    return pagosActualizados;
}

function recalcularValoresDerivados(cupones, opciones = {}) {
    if (!Array.isArray(cupones) || cupones.length === 0) return;
    
    const ajusteCER = document.getElementById('ajusteCER')?.checked || false;
    const coeficienteCEREmision = ajusteCER ? (obtenerCoeficienteCEREmision() || 1) : 1;
    const decimalesAjustes = obtenerDecimalesAjustes();
    
    const cuponesRegulares = cupones.filter(c => c && c.id !== 'inversion');
    const porcentaje = normalizarNumeroDesdeInput(opciones.porcentajeAmortizacion ?? document.getElementById('porcentajeAmortizacion')?.value);
    // Cuando la partida cae en los últimos cupones, el primer cupón visible no parte de 100% sino del residual ya amortizado.
    // Si no nos pasan residualInicial, lo calculamos para que cualquier llamada (CER, storage, core) respete el valor correcto.
    let residualInicial = (opciones.residualInicial != null && isFinite(opciones.residualInicial) && opciones.residualInicial >= 0)
        ? Math.min(100, opciones.residualInicial)
        : null;
    if (residualInicial === null && porcentaje > 0 && cuponesRegulares.length > 0) {
        residualInicial = calcularResidualInicialSiPartidaEnUltimosCupones(cuponesRegulares, porcentaje);
    }
    if (residualInicial === null) residualInicial = 100;
    let residual = residualInicial;
    cupones.forEach((cupon, index) => {
        if (!cupon || cupon.id === 'inversion') {
            return;
        }
        
        const amortizacionActual = normalizarNumeroDesdeInput(cupon.amortiz) || 0;
        const residualActual = Math.max(0, residual);
        actualizarCampoCupon(cupon, 'valorResidual', formatearNumero(residualActual, 4));
        
        // Amortización ajustada: con ajuste CER se multiplica por coeficiente, sin ajuste CER es igual a amortización
        const amortizAjustada = ajusteCER ? (amortizacionActual * coeficienteCEREmision) : amortizacionActual;
        actualizarCampoCupon(cupon, 'amortizAjustada', formatearNumero(amortizAjustada, decimalesAjustes));
        
        // Renta TNA: usar la del cupón si existe, sino la del formulario
        const rentaTNACupon = normalizarNumeroDesdeInput(cupon.rentaTNA);
        const rentaTNAValor = rentaTNACupon !== null ? rentaTNACupon : normalizarNumeroDesdeInput(opciones.rentaTNA ?? document.getElementById('rentaTNA')?.value);
        
        const dayCount = normalizarNumeroDesdeInput(cupon.dayCountFactor) || 0;
        const rentaNominal = (rentaTNAValor || 0) * dayCount;
        // Usar decimalesAjustes para formatear rentaNominal (respeta el campo "Decimales")
        actualizarCampoCupon(cupon, 'rentaNominal', formatearNumero(rentaNominal, decimalesAjustes));
        
        const residualFactor = residualActual / 100;
        // Renta ajustada: con ajuste CER se multiplica por coeficiente, sin ajuste CER es igual a renta nominal * residualFactor
        const rentaAjustada = ajusteCER ? (rentaNominal * coeficienteCEREmision * residualFactor) : (rentaNominal * residualFactor);
        actualizarCampoCupon(cupon, 'rentaAjustada', formatearNumero(rentaAjustada, decimalesAjustes));
        
        // Calcular factor de actualización
        const factorActualizacion = calcularFactorActualizacion(cupon);
        if (factorActualizacion !== null) {
            const factorFormateado = formatearNumero(factorActualizacion, decimalesAjustes);
            actualizarCampoCupon(cupon, 'factorActualiz', factorFormateado);
            
            // Calcular pagos actualizados
            const pagosActualizados = calcularPagosActualizados(cupon, factorActualizacion);
            if (pagosActualizados !== null) {
                const pagosFormateados = formatearNumero(pagosActualizados, decimalesAjustes);
                actualizarCampoCupon(cupon, 'pagosActualiz', pagosFormateados);
            } else {
                actualizarCampoCupon(cupon, 'pagosActualiz', '');
            }
        } else {
            actualizarCampoCupon(cupon, 'factorActualiz', '');
            actualizarCampoCupon(cupon, 'pagosActualiz', '');
        }
        
        residual = Math.max(0, residualActual - amortizacionActual);
    });
    
    recalcularFlujosCupones(cupones);
}

/**
 * Calcula el residual inicial del primer cupón cuando la partida cae en los últimos cupones (lista parcial).
 * @param {Array} cuponesRegulares - Cupones sin la fila inversión
 * @param {number} porcentaje - Porcentaje de amortización por cupón
 * @returns {number|null} Residual inicial (ej. 60) o null si se usa 100
 */
function calcularResidualInicialSiPartidaEnUltimosCupones(cuponesRegulares, porcentaje) {
    if (!Array.isArray(cuponesRegulares) || cuponesRegulares.length === 0 || !porcentaje || porcentaje <= 0) {
        return null;
    }
    const primerCuponNumero = parseInt(cuponesRegulares[0].numeroCupon, 10) || 1;
    const ultimoCuponNumero = parseInt(cuponesRegulares[cuponesRegulares.length - 1].numeroCupon, 10) || 1;
    if (primerCuponNumero <= 1) return null;
    const totalCuponesBono = ultimoCuponNumero;
    const cuponesEnCola = Math.ceil(100 / porcentaje);
    const inicioCola = Math.max(1, totalCuponesBono - cuponesEnCola + 1);
    const cuponesAntesEnCola = Math.max(0, primerCuponNumero - inicioCola);
    return 100 - cuponesAntesEnCola * porcentaje;
}

function aplicarValoresFinancierosEnCupones(cupones, opciones = {}) {
    if (!Array.isArray(cupones) || cupones.length === 0) {
        return;
    }
    
    const debeActualizarAmortizacion = opciones.actualizarAmortizacion !== false;
    const debeActualizarRenta = opciones.actualizarRenta !== false;
    const cuponesRegulares = cupones.filter(c => c && c.id !== 'inversion');
    const porcentajeAmortizacion = opciones.porcentajeAmortizacion ?? document.getElementById('porcentajeAmortizacion')?.value ?? '';
    const porcentaje = normalizarNumeroDesdeInput(porcentajeAmortizacion);
    const residualInicial = opciones.residualInicial ?? (porcentaje > 0 ? calcularResidualInicialSiPartidaEnUltimosCupones(cuponesRegulares, porcentaje) : null);
    
    if (debeActualizarRenta) {
        const rentaTNA = opciones.rentaTNA ?? document.getElementById('rentaTNA')?.value ?? '';
        aplicarRentaTNAEnCupones(cupones, rentaTNA);
    }
    
    if (debeActualizarAmortizacion) {
        aplicarAmortizacionEnCupones(cupones, porcentajeAmortizacion, residualInicial);
    }
    
    recalcularValoresDerivados(cupones, { ...opciones, residualInicial: residualInicial ?? opciones.residualInicial });
    
    if (opciones.forceRender && window.cuponesModule && typeof window.cuponesModule.renderizarCupones === 'function') {
        window.cuponesModule.renderizarCupones();
        // Reaplicar para reflejar los valores en el nuevo DOM
        recalcularValoresDerivados(cupones, { ...opciones, forceRender: false });
    }
}

/**
 * Placeholders para cálculos futuros - se mantienen para compatibilidad
 */
function calcularDayCountFactor(fechaInicio, fechaFin, tipoInteresDias) {
    return 0;
}

function calcularRentaNominal(rentaTNA, dayCountFactor) {
    return rentaTNA * dayCountFactor;
}

function calcularTIR(flujos, fechas, fechaCompra) {
    return 0;
}

window.cuponesCalculos = {
    aplicarRentaTNAEnCupones,
    aplicarAmortizacionEnCupones,
    recalcularValoresDerivados,
    aplicarValoresFinancieros: aplicarValoresFinancierosEnCupones,
    calcularDayCountFactor,
    calcularRentaNominal,
    calcularTIR,
    recalcularFlujos: recalcularFlujosCupones,
    calcularPromedioTAMAR: calcularPromedioTAMARParaCupon,
    calcularPromedioBADLAR: calcularPromedioBADLARParaCupon,
    obtenerDecimalesRentaTNA
};

// Caché para consultas TAMAR - evita llamadas repetidas a la API
const tamarCache = new Map();
const TAMAR_CACHE_MS = 5 * 60 * 1000; // 5 minutos de caché

/**
 * Obtener datos TAMAR con caché
 */
async function obtenerTAMARConCache(fechaDesde, fechaHasta) {
    const cacheKey = `${fechaDesde}_${fechaHasta}`;
    const ahora = Date.now();
    
    // Verificar caché
    const cached = tamarCache.get(cacheKey);
    if (cached && (ahora - cached.time) < TAMAR_CACHE_MS) {
        return cached.data;
    }
    
    // Obtener valores TAMAR desde la API
    const response = await fetch(`/api/tamar?desde=${fechaDesde}&hasta=${fechaHasta}`);
    const result = await response.json();
    
    // Guardar en caché
    tamarCache.set(cacheKey, { data: result, time: ahora });
    
    return result;
}

/**
 * Limpiar caché de TAMAR (llamar cuando se cambian parámetros significativos)
 */
function limpiarCacheTAMAR() {
    tamarCache.clear();
}

/**
 * Calcular promedio de TAMAR para un cupón entre inicio y final intervalo
 */
async function calcularPromedioTAMARParaCupon(cupon) {
    if (!cupon.inicioIntervalo) {
        return null;
    }

    try {
        // Obtener fórmula seleccionada
        const formulaSelect = document.getElementById('formula');
        const formula = formulaSelect?.value || 'promedio-aritmetico';
        
        let valores = [];
        
        if (formula === 'promedio-n-tasas') {
            // Promedio N tasas: calcular promedio de N tasas partiendo desde fecha inicio -X (en días hábiles)
            const cantidadTasasInput = document.getElementById('cantidadTasas');
            const cantidadTasas = parseInt(cantidadTasasInput?.value || '0', 10);
            
            if (cantidadTasas <= 0) {
                return null;
            }
            
            // Obtener intervaloInicio del formulario
            const intervaloInicioInput = document.getElementById('intervaloInicio');
            const intervaloInicio = parseInt(intervaloInicioInput?.value || '0', 10);
            
            // Para "Promedio N tasas", usar inicioIntervalo si está disponible (especialmente para cupón vigente)
            // Si inicioIntervalo está disponible, usarlo directamente (ya está calculado desde fechaValuacion para el cupón vigente)
            // Si no, calcular desde fechaInicio + intervaloInicio
            let fechaBaseDate = null;
            
            if (cupon.inicioIntervalo) {
                // Usar inicioIntervalo directamente (ya está calculado correctamente)
                let inicioIntervaloStr = cupon.inicioIntervalo;
                if (/^\d{2}\/\d{2}\/\d{4}$/.test(inicioIntervaloStr)) {
                    inicioIntervaloStr = convertirFechaDDMMAAAAaYYYYMMDD(inicioIntervaloStr);
                }
                fechaBaseDate = crearFechaDesdeString(inicioIntervaloStr);
            }
            
            // Si no se pudo obtener desde inicioIntervalo, calcular desde fechaInicio + intervaloInicio
            if (!fechaBaseDate) {
                let fechaInicioStr = cupon.fechaInicio;
                if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaInicioStr)) {
                    fechaInicioStr = convertirFechaDDMMAAAAaYYYYMMDD(fechaInicioStr);
                }
                const fechaInicioDate = crearFechaDesdeString(fechaInicioStr);
                if (!fechaInicioDate) {
                    return null;
                }
                // Calcular fecha base = fechaInicio + intervaloInicio
                const fechaDesde = formatearFechaInput(fechaInicioDate);
                const fechaHastaDate = new Date(fechaInicioDate);
                fechaHastaDate.setDate(fechaHastaDate.getDate() + Math.abs(intervaloInicio) + 60);
                const fechaHasta = formatearFechaInput(fechaHastaDate);
                
                let feriadosParaCalc = window.cuponesDiasHabiles?.obtenerFeriados?.(fechaDesde, fechaHasta);
                if (!feriadosParaCalc || feriadosParaCalc.length === 0) {
                    feriadosParaCalc = await window.cuponesDiasHabiles?.cargarFeriadosDesdeBD?.(fechaDesde, fechaHasta) || [];
                }
                
                fechaBaseDate = window.cuponesDiasHabiles?.sumarDiasHabiles?.(fechaInicioDate, intervaloInicio, feriadosParaCalc);
            }
            
            if (!fechaBaseDate) {
                return null;
            }
            
            // Calcular rango de fechas para cargar feriados (con margen)
            const fechaDesdeDate = new Date(fechaBaseDate);
            fechaDesdeDate.setDate(fechaDesdeDate.getDate() - cantidadTasas - 60); // Margen hacia atrás
            const fechaHastaDate = new Date(fechaBaseDate);
            fechaHastaDate.setDate(fechaHastaDate.getDate() + 60); // Margen hacia adelante
            
            const fechaDesde = formatearFechaInput(fechaDesdeDate);
            const fechaHasta = formatearFechaInput(fechaHastaDate);
            
            // Obtener feriados para calcular días hábiles
            let feriados = window.cuponesDiasHabiles?.obtenerFeriados?.(fechaDesde, fechaHasta);
            if (!feriados || feriados.length === 0) {
                feriados = await window.cuponesDiasHabiles?.cargarFeriadosDesdeBD?.(fechaDesde, fechaHasta) || [];
            }
            
            // Verificar si es el cupón vigente para limitar fechas hasta fecha de valuación
            const fechaValuacionStr = document.getElementById('fechaValuacion')?.value || '';
            let fechaValuacionDate = null;
            let esCuponVigente = false;
            
            if (fechaValuacionStr && cupon.fechaInicio && cupon.fechaFinDev) {
                try {
                    fechaValuacionDate = crearFechaDesdeString(convertirFechaDDMMAAAAaYYYYMMDD(fechaValuacionStr));
                    if (fechaValuacionDate) {
                        const fechaInicioDate = crearFechaDesdeString(convertirFechaDDMMAAAAaYYYYMMDD(cupon.fechaInicio));
                        const fechaFinDevDate = crearFechaDesdeString(convertirFechaDDMMAAAAaYYYYMMDD(cupon.fechaFinDev));
                        if (fechaInicioDate && fechaFinDevDate &&
                            fechaValuacionDate >= fechaInicioDate && 
                            fechaValuacionDate <= fechaFinDevDate) {
                            esCuponVigente = true;
                        }
                    }
                } catch (e) {
                    // Ignorar errores de parsing
                }
            }

            // Obtener valores TAMAR con caché
            const result = await obtenerTAMARConCache(fechaDesde, fechaHasta);
            
            if (!result.success || !result.datos || result.datos.length === 0) {
                return null;
            }
            
            // Calcular fechas objetivo usando días hábiles
            // Primera fecha: fechaBase (que es fechaInicio + intervaloInicio o inicioIntervalo)
            // Segunda fecha: fechaBase - 1 día hábil
            // Tercera fecha: fechaBase - 2 días hábiles
            // etc.
            const fechasObjetivo = [];
            for (let i = 0; i < cantidadTasas; i++) {
                const diasOffset = -i; // Hacia atrás desde fechaBase
                const fechaObjetivo = window.cuponesDiasHabiles?.sumarDiasHabiles?.(fechaBaseDate, diasOffset, feriados);
                if (fechaObjetivo) {
                    fechasObjetivo.push(formatearFechaInput(fechaObjetivo));
                }
            }
            
            // Buscar valores para cada fecha objetivo
            // Si es el cupón vigente, solo incluir fechas hasta la fecha de valuación
            const fechaValuacionStrISO = esCuponVigente && fechaValuacionDate ? formatearFechaInput(fechaValuacionDate) : null;
            
            for (const fechaObjetivo of fechasObjetivo) {
                // Si es cupón vigente, filtrar fechas que no excedan la fecha de valuación
                if (esCuponVigente && fechaValuacionStrISO && fechaObjetivo > fechaValuacionStrISO) {
                    continue; // Saltar esta fecha si excede la fecha de valuación
                }
                
                const valor = result.datos.find(item => {
                    const itemFecha = typeof item.fecha === 'string' && item.fecha.includes('T') 
                        ? item.fecha.split('T')[0] 
                        : item.fecha;
                    return itemFecha === fechaObjetivo;
                });
                
                if (valor) {
                    const valorNum = parseFloat(valor.valor || 0);
                    if (!isNaN(valorNum) && valorNum > 0) {
                        valores.push(valorNum);
                    }
                }
            }
            
            // Para el cupón vigente, aceptar si tenemos al menos una tasa (hasta la fecha de valuación)
            // Para otros cupones, requerir todas las tasas
            if (esCuponVigente) {
                if (valores.length === 0) {
                    return null;
                }
            } else {
                if (valores.length !== cantidadTasas) {
                    // No se encontraron todas las tasas necesarias
                    return null;
                }
            }
        } else {
            // Promedio Aritmético: calcular promedio entre inicio y final intervalo
            if (!cupon.finalIntervalo) {
                return null;
            }
            
            // Convertir fechas de DD/MM/AAAA a YYYY-MM-DD
            let fechaDesde = cupon.inicioIntervalo;
            let fechaHasta = cupon.finalIntervalo;
            
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaDesde)) {
                fechaDesde = convertirFechaDDMMAAAAaYYYYMMDD(fechaDesde);
            }
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaHasta)) {
                fechaHasta = convertirFechaDDMMAAAAaYYYYMMDD(fechaHasta);
            }

            // Verificar si es el cupón vigente y limitar hasta fecha de valuación
            const fechaValuacionStr = document.getElementById('fechaValuacion')?.value || '';
            let fechaValuacionDate = null;
            let esCuponVigente = false;
            
            if (fechaValuacionStr) {
                try {
                    fechaValuacionDate = crearFechaDesdeString(convertirFechaDDMMAAAAaYYYYMMDD(fechaValuacionStr));
                    if (fechaValuacionDate && cupon.fechaInicio && cupon.fechaFinDev) {
                        const fechaInicioDate = crearFechaDesdeString(convertirFechaDDMMAAAAaYYYYMMDD(cupon.fechaInicio));
                        const fechaFinDevDate = crearFechaDesdeString(convertirFechaDDMMAAAAaYYYYMMDD(cupon.fechaFinDev));
                        if (fechaInicioDate && fechaFinDevDate &&
                            fechaValuacionDate >= fechaInicioDate && 
                            fechaValuacionDate <= fechaFinDevDate) {
                            esCuponVigente = true;
                        }
                    }
                } catch (e) {
                    // Ignorar errores de parsing
                }
            }

            // Si es el cupón vigente, limitar fechaHasta a la fecha de valuación
            if (esCuponVigente && fechaValuacionDate) {
                const fechaHastaDate = crearFechaDesdeString(fechaHasta);
                if (fechaHastaDate && fechaHastaDate > fechaValuacionDate) {
                    fechaHasta = formatearFechaInput(fechaValuacionDate);
                }
            }

            // Obtener valores TAMAR con caché
            const result = await obtenerTAMARConCache(fechaDesde, fechaHasta);

            if (!result.success || !result.datos || result.datos.length === 0) {
                return null;
            }

            // Calcular promedio aritmético
            // Si es el cupón vigente, filtrar valores hasta la fecha de valuación
            let datosFiltrados = result.datos;
            if (esCuponVigente && fechaValuacionDate) {
                const fechaValuacionStrISO = formatearFechaInput(fechaValuacionDate);
                datosFiltrados = result.datos.filter(item => {
                    const itemFecha = typeof item.fecha === 'string' && item.fecha.includes('T') 
                        ? item.fecha.split('T')[0] 
                        : item.fecha;
                    return itemFecha <= fechaValuacionStrISO;
                });
            }

            valores = datosFiltrados.map(item => parseFloat(item.valor || 0)).filter(v => !isNaN(v) && v > 0);
        }
        
        if (valores.length === 0) {
            return null;
        }

        const suma = valores.reduce((acc, val) => acc + val, 0);
        const promedio = suma / valores.length;

        // Actualizar el campo promedioTasa en el cupón
        actualizarCampoCupon(cupon, 'promedioTasa', formatearNumero(promedio, 4));

        // Obtener spread y calcular Renta TNA
        const spread = normalizarNumeroDesdeInput(document.getElementById('spread')?.value) || 0;
        const rentaTNA = promedio + spread;
        
        // Actualizar Renta TNA del cupón
        const decimalesRentaTNA = obtenerDecimalesRentaTNA();
        actualizarCampoCupon(cupon, 'rentaTNA', formatearNumero(rentaTNA, decimalesRentaTNA));

        return promedio;

    } catch (error) {
        console.error('Error al calcular promedio TAMAR:', error);
        return null;
    }
}

// Caché para consultas BADLAR - evita llamadas repetidas a la API
const badlarCache = new Map();
const BADLAR_CACHE_MS = 5 * 60 * 1000; // 5 minutos de caché

/**
 * Obtener datos BADLAR con caché
 */
async function obtenerBADLARConCache(fechaDesde, fechaHasta) {
    const cacheKey = `${fechaDesde}_${fechaHasta}`;
    const ahora = Date.now();
    
    // Verificar caché
    const cached = badlarCache.get(cacheKey);
    if (cached && (ahora - cached.time) < BADLAR_CACHE_MS) {
        return cached.data;
    }
    
    // Obtener valores BADLAR desde la API
    const response = await fetch(`/api/badlar/bd?desde=${fechaDesde}&hasta=${fechaHasta}`);
    const result = await response.json();
    
    // Guardar en caché
    badlarCache.set(cacheKey, { data: result, time: ahora });
    
    return result;
}

/**
 * Limpiar caché de BADLAR (llamar cuando se cambian parámetros significativos)
 */
function limpiarCacheBADLAR() {
    badlarCache.clear();
}

/**
 * Calcular promedio de BADLAR para un cupón entre inicio y final intervalo
 */
async function calcularPromedioBADLARParaCupon(cupon) {
    if (!cupon.inicioIntervalo) {
        return null;
    }

    try {
        // Obtener fórmula seleccionada
        const formulaSelect = document.getElementById('formula');
        const formula = formulaSelect?.value || 'promedio-aritmetico';
        
        let valores = [];
        
        if (formula === 'promedio-n-tasas') {
            // Promedio N tasas: calcular promedio de N tasas partiendo desde fecha inicio -X (en días hábiles)
            const cantidadTasasInput = document.getElementById('cantidadTasas');
            const cantidadTasas = parseInt(cantidadTasasInput?.value || '0', 10);
            
            if (cantidadTasas <= 0) {
                return null;
            }
            
            // Obtener intervaloInicio del formulario
            const intervaloInicioInput = document.getElementById('intervaloInicio');
            const intervaloInicio = parseInt(intervaloInicioInput?.value || '0', 10);
            
            // Para "Promedio N tasas", usar inicioIntervalo si está disponible (especialmente para cupón vigente)
            // Si inicioIntervalo está disponible, usarlo directamente (ya está calculado desde fechaValuacion para el cupón vigente)
            // Si no, calcular desde fechaInicio + intervaloInicio
            let fechaBaseDate = null;
            
            if (cupon.inicioIntervalo) {
                // Usar inicioIntervalo directamente (ya está calculado correctamente)
                let inicioIntervaloStr = cupon.inicioIntervalo;
                if (/^\d{2}\/\d{2}\/\d{4}$/.test(inicioIntervaloStr)) {
                    inicioIntervaloStr = convertirFechaDDMMAAAAaYYYYMMDD(inicioIntervaloStr);
                }
                fechaBaseDate = crearFechaDesdeString(inicioIntervaloStr);
            }
            
            // Si no se pudo obtener desde inicioIntervalo, calcular desde fechaInicio + intervaloInicio
            if (!fechaBaseDate) {
                let fechaInicioStr = cupon.fechaInicio;
                if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaInicioStr)) {
                    fechaInicioStr = convertirFechaDDMMAAAAaYYYYMMDD(fechaInicioStr);
                }
                const fechaInicioDate = crearFechaDesdeString(fechaInicioStr);
                if (!fechaInicioDate) {
                    return null;
                }
                // Calcular fecha base = fechaInicio + intervaloInicio
                const fechaDesde = formatearFechaInput(fechaInicioDate);
                const fechaHastaDate = new Date(fechaInicioDate);
                fechaHastaDate.setDate(fechaHastaDate.getDate() + Math.abs(intervaloInicio) + 60);
                const fechaHasta = formatearFechaInput(fechaHastaDate);
                
                let feriadosParaCalc = window.cuponesDiasHabiles?.obtenerFeriados?.(fechaDesde, fechaHasta);
                if (!feriadosParaCalc || feriadosParaCalc.length === 0) {
                    feriadosParaCalc = await window.cuponesDiasHabiles?.cargarFeriadosDesdeBD?.(fechaDesde, fechaHasta) || [];
                }
                
                fechaBaseDate = window.cuponesDiasHabiles?.sumarDiasHabiles?.(fechaInicioDate, intervaloInicio, feriadosParaCalc);
            }
            
            if (!fechaBaseDate) {
                return null;
            }
            
            // Calcular rango de fechas para cargar feriados (con margen)
            const fechaDesdeDate = new Date(fechaBaseDate);
            fechaDesdeDate.setDate(fechaDesdeDate.getDate() - cantidadTasas - 60); // Margen hacia atrás
            const fechaHastaDate = new Date(fechaBaseDate);
            fechaHastaDate.setDate(fechaHastaDate.getDate() + 60); // Margen hacia adelante
            
            const fechaDesde = formatearFechaInput(fechaDesdeDate);
            const fechaHasta = formatearFechaInput(fechaHastaDate);
            
            // Obtener feriados para calcular días hábiles
            let feriados = window.cuponesDiasHabiles?.obtenerFeriados?.(fechaDesde, fechaHasta);
            if (!feriados || feriados.length === 0) {
                feriados = await window.cuponesDiasHabiles?.cargarFeriadosDesdeBD?.(fechaDesde, fechaHasta) || [];
            }
            
            // Verificar si es el cupón vigente para limitar fechas hasta fecha de valuación
            const fechaValuacionStr = document.getElementById('fechaValuacion')?.value || '';
            let fechaValuacionDate = null;
            let esCuponVigente = false;
            
            if (fechaValuacionStr && cupon.fechaInicio && cupon.fechaFinDev) {
                try {
                    fechaValuacionDate = crearFechaDesdeString(convertirFechaDDMMAAAAaYYYYMMDD(fechaValuacionStr));
                    if (fechaValuacionDate) {
                        const fechaInicioDate = crearFechaDesdeString(convertirFechaDDMMAAAAaYYYYMMDD(cupon.fechaInicio));
                        const fechaFinDevDate = crearFechaDesdeString(convertirFechaDDMMAAAAaYYYYMMDD(cupon.fechaFinDev));
                        if (fechaInicioDate && fechaFinDevDate &&
                            fechaValuacionDate >= fechaInicioDate && 
                            fechaValuacionDate <= fechaFinDevDate) {
                            esCuponVigente = true;
                        }
                    }
                } catch (e) {
                    // Ignorar errores de parsing
                }
            }

            // Obtener valores BADLAR con caché
            const result = await obtenerBADLARConCache(fechaDesde, fechaHasta);
            
            if (!result.success || !result.datos || result.datos.length === 0) {
                return null;
            }
            
            // Calcular fechas objetivo usando días hábiles
            // Primera fecha: fechaBase (que es fechaInicio + intervaloInicio o inicioIntervalo)
            // Segunda fecha: fechaBase - 1 día hábil
            // Tercera fecha: fechaBase - 2 días hábiles
            // etc.
            const fechasObjetivo = [];
            for (let i = 0; i < cantidadTasas; i++) {
                const diasOffset = -i; // Hacia atrás desde fechaBase
                const fechaObjetivo = window.cuponesDiasHabiles?.sumarDiasHabiles?.(fechaBaseDate, diasOffset, feriados);
                if (fechaObjetivo) {
                    fechasObjetivo.push(formatearFechaInput(fechaObjetivo));
                }
            }
            
            // Buscar valores para cada fecha objetivo
            // Si es el cupón vigente, solo incluir fechas hasta la fecha de valuación
            const fechaValuacionStrISO = esCuponVigente && fechaValuacionDate ? formatearFechaInput(fechaValuacionDate) : null;
            
            for (const fechaObjetivo of fechasObjetivo) {
                // Si es cupón vigente, filtrar fechas que no excedan la fecha de valuación
                if (esCuponVigente && fechaValuacionStrISO && fechaObjetivo > fechaValuacionStrISO) {
                    continue; // Saltar esta fecha si excede la fecha de valuación
                }
                
                const valor = result.datos.find(item => {
                    const itemFecha = typeof item.fecha === 'string' && item.fecha.includes('T') 
                        ? item.fecha.split('T')[0] 
                        : item.fecha;
                    return itemFecha === fechaObjetivo;
                });
                
                if (valor) {
                    const valorNum = parseFloat(valor.valor || 0);
                    if (!isNaN(valorNum) && valorNum > 0) {
                        valores.push(valorNum);
                    }
                }
            }
            
            // Para el cupón vigente, aceptar si tenemos al menos una tasa (hasta la fecha de valuación)
            // Para otros cupones, requerir todas las tasas
            if (esCuponVigente) {
                if (valores.length === 0) {
                    return null;
                }
            } else {
                if (valores.length !== cantidadTasas) {
                    // No se encontraron todas las tasas necesarias
                    return null;
                }
            }
        } else {
            // Promedio Aritmético: calcular promedio entre inicio y final intervalo
            if (!cupon.finalIntervalo) {
                return null;
            }
            
            // Convertir fechas de DD/MM/AAAA a YYYY-MM-DD
            let fechaDesde = cupon.inicioIntervalo;
            let fechaHasta = cupon.finalIntervalo;
            
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaDesde)) {
                fechaDesde = convertirFechaDDMMAAAAaYYYYMMDD(fechaDesde);
            }
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaHasta)) {
                fechaHasta = convertirFechaDDMMAAAAaYYYYMMDD(fechaHasta);
            }

            // Verificar si es el cupón vigente y limitar hasta fecha de valuación
            const fechaValuacionStr = document.getElementById('fechaValuacion')?.value || '';
            let fechaValuacionDate = null;
            let esCuponVigente = false;
            
            if (fechaValuacionStr) {
                try {
                    fechaValuacionDate = crearFechaDesdeString(convertirFechaDDMMAAAAaYYYYMMDD(fechaValuacionStr));
                    if (fechaValuacionDate && cupon.fechaInicio && cupon.fechaFinDev) {
                        const fechaInicioDate = crearFechaDesdeString(convertirFechaDDMMAAAAaYYYYMMDD(cupon.fechaInicio));
                        const fechaFinDevDate = crearFechaDesdeString(convertirFechaDDMMAAAAaYYYYMMDD(cupon.fechaFinDev));
                        if (fechaInicioDate && fechaFinDevDate &&
                            fechaValuacionDate >= fechaInicioDate && 
                            fechaValuacionDate <= fechaFinDevDate) {
                            esCuponVigente = true;
                        }
                    }
                } catch (e) {
                    // Ignorar errores de parsing
                }
            }

            // Si es el cupón vigente, limitar fechaHasta a la fecha de valuación
            if (esCuponVigente && fechaValuacionDate) {
                const fechaHastaDate = crearFechaDesdeString(fechaHasta);
                if (fechaHastaDate && fechaHastaDate > fechaValuacionDate) {
                    fechaHasta = formatearFechaInput(fechaValuacionDate);
                }
            }

            // Obtener valores BADLAR con caché
            const result = await obtenerBADLARConCache(fechaDesde, fechaHasta);

            if (!result.success || !result.datos || result.datos.length === 0) {
                return null;
            }

            // Calcular promedio aritmético
            // Si es el cupón vigente, filtrar valores hasta la fecha de valuación
            let datosFiltrados = result.datos;
            if (esCuponVigente && fechaValuacionDate) {
                const fechaValuacionStrISO = formatearFechaInput(fechaValuacionDate);
                datosFiltrados = result.datos.filter(item => {
                    const itemFecha = typeof item.fecha === 'string' && item.fecha.includes('T') 
                        ? item.fecha.split('T')[0] 
                        : item.fecha;
                    return itemFecha <= fechaValuacionStrISO;
                });
            }

            valores = datosFiltrados.map(item => parseFloat(item.valor || 0)).filter(v => !isNaN(v) && v > 0);
        }
        
        if (valores.length === 0) {
            return null;
        }

        const suma = valores.reduce((acc, val) => acc + val, 0);
        const promedio = suma / valores.length;

        // Actualizar el campo promedioTasa en el cupón
        actualizarCampoCupon(cupon, 'promedioTasa', formatearNumero(promedio, 4));

        // Obtener spread y calcular Renta TNA
        const spread = normalizarNumeroDesdeInput(document.getElementById('spread')?.value) || 0;
        const rentaTNA = promedio + spread;
        
        // Actualizar Renta TNA del cupón
        const decimalesRentaTNA = obtenerDecimalesRentaTNA();
        actualizarCampoCupon(cupon, 'rentaTNA', formatearNumero(rentaTNA, decimalesRentaTNA));

        return promedio;

    } catch (error) {
        console.error('Error al calcular promedio BADLAR:', error);
        return null;
    }
}

