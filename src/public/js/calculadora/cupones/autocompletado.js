/**
 * Lógica de autocompletado de cupones - Primera Etapa
 * 
 * Esta primera etapa implementa:
 * - Fila de Inversión
 * - Cálculo de fechas de cupones
 * - Fechas de liquidación, fin devengamiento e inicio
 * - Consideración de días hábiles y feriados
 */

/**
 * Obtener datos del formulario
 */
function obtenerDatosFormulario() {
    return {
        fechaCompra: document.getElementById('fechaCompra')?.value || '',
        precioCompra: document.getElementById('precioCompra')?.value || '',
        cantidadPartida: document.getElementById('cantidadPartida')?.value || '',
        fechaEmision: document.getElementById('fechaEmision')?.value || '',
        fechaPrimeraRenta: document.getElementById('fechaPrimeraRenta')?.value || '',
        periodicidad: document.getElementById('periodicidad')?.value || '',
        diasRestarFechaFinDev: parseInt(document.getElementById('diasRestarFechaFinDev')?.value || '-1', 10),
        intervaloInicio: parseInt(document.getElementById('intervaloInicio')?.value || '0', 10),
        intervaloFin: parseInt(document.getElementById('intervaloFin')?.value || '0', 10),
        fechaAmortizacion: document.getElementById('fechaAmortizacion')?.value || '',
        fechaValuacion: document.getElementById('fechaValuacion')?.value || ''
    };
}

/**
 * Crear fila de inversión
 */
async function crearFilaInversion() {
    const datos = obtenerDatosFormulario();
    
    if (!datos.fechaCompra || !datos.precioCompra || !datos.cantidadPartida) {
        return null;
    }
    
    // Convertir fecha de compra a Date
    const fechaCompraDate = crearFechaDesdeString(convertirFechaDDMMAAAAaYYYYMMDD(datos.fechaCompra));
    if (!fechaCompraDate) return null;
    
    // Calcular final intervalo usando días hábiles
    // Cargar feriados con margen suficiente
    const fechaDesde = formatearFechaInput(fechaCompraDate);
    const fechaHastaDate = new Date(fechaCompraDate);
    fechaHastaDate.setDate(fechaHastaDate.getDate() + Math.abs(datos.intervaloFin) + 30); // Margen para cargar feriados
    const fechaHasta = formatearFechaInput(fechaHastaDate);
    
    const feriados = await window.cuponesDiasHabiles.obtenerFeriados(fechaDesde, fechaHasta);
    let finalIntervalo = window.cuponesDiasHabiles.sumarDiasHabiles(fechaCompraDate, datos.intervaloFin, feriados);
    
    // Validación: si hay fecha valuación y finalIntervalo es mayor, ajustar
    if (datos.fechaValuacion) {
        const fechaValuacionDate = crearFechaDesdeString(convertirFechaDDMMAAAAaYYYYMMDD(datos.fechaValuacion));
        if (fechaValuacionDate && finalIntervalo > fechaValuacionDate) {
            // Usar fecha valuación + intervaloFin
            finalIntervalo = window.cuponesDiasHabiles.sumarDiasHabiles(fechaValuacionDate, datos.intervaloFin, feriados);
        }
    }
    
    // Cargar valores CER para obtener el valor CER Final
    const fechaDesdeCER = formatearFechaInput(finalIntervalo);
    const fechaHastaCERDate = new Date(finalIntervalo);
    fechaHastaCERDate.setDate(fechaHastaCERDate.getDate() + 30); // Margen
    const fechaHastaCER = formatearFechaInput(fechaHastaCERDate);
    const valoresCER = await window.cuponesCER.obtenerValoresCER(fechaDesdeCER, fechaHastaCER);
    const valorCERFinal = window.cuponesCER.buscarValorCERPorFecha(finalIntervalo, valoresCER);
    
    // Calcular flujo (negativo)
    const precioCompraNum = parseFloat(datos.precioCompra.replace(',', '.')) || 0;
    const cantidadPartidaNum = parseInt(datos.cantidadPartida, 10) || 0;
    const flujo = -(precioCompraNum * cantidadPartidaNum);
    
    // Convertir fechas a formato DD/MM/AAAA para mostrar
    const fechaLiquidacionStr = convertirFechaYYYYMMDDaDDMMAAAA(formatearFechaInput(fechaCompraDate), '/');
    const finalIntervaloStr = convertirFechaYYYYMMDDaDDMMAAAA(formatearFechaInput(finalIntervalo), '/');
    
    // Formatear valor CER Final (4 decimales, usar punto como separador decimal)
    const valorCERFinalStr = valorCERFinal !== null ? valorCERFinal.toFixed(4) : '';
    
    return {
        id: 'inversion',
        cupon: 'Inversión',
        fechaInicio: '',
        fechaFinDev: '',
        fechaLiquid: fechaLiquidacionStr,
        inicioIntervalo: '',
        finalIntervalo: finalIntervaloStr,
        valorCERInicio: '',
        valorCERFinal: valorCERFinalStr,
        dayCountFactor: '',
        amortiz: '',
        valorResidual: '',
        amortizAjustada: '',
        rentaNominal: '',
        rentaTNA: '',
        rentaAjustada: '',
        factorActualiz: '',
        pagosActualiz: '',
        flujos: flujo.toFixed(2),
        flujosDesc: ''
    };
}

/**
 * Crear filas de cupones
 */
async function crearFilasCupones() {
    const datos = obtenerDatosFormulario();
    
    if (!datos.fechaEmision || !datos.fechaPrimeraRenta || !datos.periodicidad || !datos.fechaCompra) {
        return [];
    }
    
    // Convertir fechas a Date
    const fechaEmisionDate = crearFechaDesdeString(convertirFechaDDMMAAAAaYYYYMMDD(datos.fechaEmision));
    const fechaCompraDate = crearFechaDesdeString(convertirFechaDDMMAAAAaYYYYMMDD(datos.fechaCompra));
    const fechaAmortizacionDate = datos.fechaAmortizacion ? 
        crearFechaDesdeString(convertirFechaDDMMAAAAaYYYYMMDD(datos.fechaAmortizacion)) : null;
    
    if (!fechaEmisionDate || !fechaCompraDate) {
        return [];
    }
    
    // Calcular el número del primer cupón (el siguiente a la fecha de compra)
    const numeroPrimerCupon = window.cuponesCalculoCupones.calcularNumeroPrimerCupon(
        fechaEmisionDate,
        datos.fechaPrimeraRenta,
        datos.periodicidad,
        fechaCompraDate
    );
    
    // Calcular fechas de cupones (hasta fechaAmortizacion si existe)
    const fechasCupones = window.cuponesCalculoCupones.calcularFechasCupones(
        fechaEmisionDate,
        datos.fechaPrimeraRenta,
        datos.periodicidad,
        fechaCompraDate,
        fechaAmortizacionDate
    );
    
    if (fechasCupones.length === 0) {
        return [];
    }
    
    // Calcular rango amplio de fechas para cargar feriados UNA SOLA VEZ
    // Incluir margen para intervalos (pueden ir hacia atrás o adelante)
    const fechaMinima = new Date(fechasCupones[0]);
    const fechaMaxima = new Date(fechasCupones[fechasCupones.length - 1]);
    
    // Calcular márgenes considerando los intervalos
    const margenIntervalo = Math.max(
        Math.abs(datos.intervaloInicio || 0),
        Math.abs(datos.intervaloFin || 0)
    ) + 30; // Margen adicional de seguridad
    
    fechaMinima.setDate(fechaMinima.getDate() - margenIntervalo);
    fechaMaxima.setDate(fechaMaxima.getDate() + margenIntervalo);
    
    // Si hay fechaAmortizacion, incluirla en el rango
    if (fechaAmortizacionDate) {
        if (fechaAmortizacionDate < fechaMinima) {
            fechaMinima.setTime(fechaAmortizacionDate.getTime());
            fechaMinima.setDate(fechaMinima.getDate() - margenIntervalo);
        }
        if (fechaAmortizacionDate > fechaMaxima) {
            fechaMaxima.setTime(fechaAmortizacionDate.getTime());
            fechaMaxima.setDate(fechaMaxima.getDate() + margenIntervalo);
        }
    }
    
    const fechaDesde = formatearFechaInput(fechaMinima);
    const fechaHasta = formatearFechaInput(fechaMaxima);
    
    // Validar que las fechas estén en formato correcto (YYYY-MM-DD)
    if (!fechaDesde || !fechaHasta) {
        console.error('[autocompletado] Error al formatear fechas para cargar feriados');
        return [];
    }
    
    // Cargar feriados UNA SOLA VEZ para todo el proceso
    console.log(`[autocompletado] Cargando feriados desde ${fechaDesde} hasta ${fechaHasta}`);
    const feriados = await window.cuponesDiasHabiles.obtenerFeriados(fechaDesde, fechaHasta);
    console.log(`[autocompletado] Feriados cargados: ${feriados.length} fechas`);
    
    // Cargar valores CER UNA SOLA VEZ para todo el proceso
    console.log(`[autocompletado] Cargando valores CER desde ${fechaDesde} hasta ${fechaHasta}`);
    const valoresCER = await window.cuponesCER.obtenerValoresCER(fechaDesde, fechaHasta);
    console.log(`[autocompletado] Valores CER cargados: ${valoresCER.length} registros`);
    
    // Crear filas de cupones
    const cupones = [];
    let contadorCupon = numeroPrimerCupon; // Empezar con el número correcto
    const esUltimoCupon = (index) => index === fechasCupones.length - 1;
    
    for (let i = 0; i < fechasCupones.length; i++) {
        const fechaPago = fechasCupones[i];
        const esUltimo = esUltimoCupon(i);
        
        // Calcular fecha liquidación
        // Si es el último cupón y hay fechaAmortizacion, usar esa fecha (ajustada a día hábil)
        let fechaLiquidacion;
        if (esUltimo && fechaAmortizacionDate) {
            fechaLiquidacion = window.cuponesDiasHabiles.obtenerProximoDiaHabil(fechaAmortizacionDate, feriados);
        } else {
            // Fecha pago, si no es hábil, próximo hábil
            fechaLiquidacion = window.cuponesDiasHabiles.obtenerProximoDiaHabil(fechaPago, feriados);
        }
        
        // Calcular fecha fin devengamiento (basado en fechaPrimeraRenta + diasRestarFechaFinDev)
        const fechaFinDev = window.cuponesCalculoCupones.calcularFechaFinDev(
            fechaPago, // Usar fechaPago, no fechaLiquidacion
            datos.fechaPrimeraRenta,
            datos.periodicidad,
            datos.diasRestarFechaFinDev
        );
        
        // Calcular fecha inicio (fecha fin dev + 1)
        const fechaInicio = window.cuponesCalculoCupones.calcularFechaInicio(fechaFinDev);
        
        // Calcular inicio intervalo (fecha inicio + intervaloInicio en días hábiles)
        // Usar feriados ya cargados en memoria
        let inicioIntervalo = window.cuponesDiasHabiles.sumarDiasHabiles(
            fechaInicio,
            datos.intervaloInicio,
            feriados
        );
        
        // Calcular final intervalo (fecha liquidación + intervaloFin en días hábiles)
        // Usar feriados ya cargados en memoria
        let finalIntervalo = window.cuponesDiasHabiles.sumarDiasHabiles(
            fechaLiquidacion,
            datos.intervaloFin,
            feriados
        );
        
        // Validación: si hay fecha valuación y las fechas de intervalo son mayores, ajustar
        if (datos.fechaValuacion) {
            const fechaValuacionDate = crearFechaDesdeString(convertirFechaDDMMAAAAaYYYYMMDD(datos.fechaValuacion));
            if (fechaValuacionDate) {
                // Si inicioIntervalo es mayor a fecha valuación, usar fecha valuación + intervaloInicio
                if (inicioIntervalo > fechaValuacionDate) {
                    inicioIntervalo = window.cuponesDiasHabiles.sumarDiasHabiles(
                        fechaValuacionDate,
                        datos.intervaloInicio,
                        feriados
                    );
                }
                
                // Si finalIntervalo es mayor a fecha valuación, usar fecha valuación + intervaloFin
                if (finalIntervalo > fechaValuacionDate) {
                    finalIntervalo = window.cuponesDiasHabiles.sumarDiasHabiles(
                        fechaValuacionDate,
                        datos.intervaloFin,
                        feriados
                    );
                }
            }
        }
        
        // Buscar valores CER para inicio y final intervalo
        // Usar valores CER ya cargados en memoria
        const valorCERInicio = window.cuponesCER.buscarValorCERPorFecha(inicioIntervalo, valoresCER);
        const valorCERFinal = window.cuponesCER.buscarValorCERPorFecha(finalIntervalo, valoresCER);
        
        // Convertir fechas a formato DD/MM/AAAA para mostrar
        const fechaInicioStr = convertirFechaYYYYMMDDaDDMMAAAA(formatearFechaInput(fechaInicio), '/');
        const fechaFinDevStr = convertirFechaYYYYMMDDaDDMMAAAA(formatearFechaInput(fechaFinDev), '/');
        const fechaLiquidacionStr = convertirFechaYYYYMMDDaDDMMAAAA(formatearFechaInput(fechaLiquidacion), '/');
        const inicioIntervaloStr = convertirFechaYYYYMMDDaDDMMAAAA(formatearFechaInput(inicioIntervalo), '/');
        const finalIntervaloStr = convertirFechaYYYYMMDDaDDMMAAAA(formatearFechaInput(finalIntervalo), '/');
        
        // Formatear valores CER (4 decimales, usar punto como separador decimal para inputs HTML)
        // Los inputs HTML type="number" requieren punto, no coma
        const valorCERInicioStr = valorCERInicio !== null ? valorCERInicio.toFixed(4) : '';
        const valorCERFinalStr = valorCERFinal !== null ? valorCERFinal.toFixed(4) : '';
        
        cupones.push({
            id: `cupon-${contadorCupon}`,
            cupon: contadorCupon,
            fechaInicio: fechaInicioStr,
            fechaFinDev: fechaFinDevStr,
            fechaLiquid: fechaLiquidacionStr,
            inicioIntervalo: inicioIntervaloStr,
            finalIntervalo: finalIntervaloStr,
            valorCERInicio: valorCERInicioStr,
            valorCERFinal: valorCERFinalStr,
            dayCountFactor: '',
            amortiz: '',
            valorResidual: '',
            amortizAjustada: '',
            rentaNominal: '',
            rentaTNA: '',
            rentaAjustada: '',
            factorActualiz: '',
            pagosActualiz: '',
            flujos: '',
            flujosDesc: ''
        });
        
        contadorCupon++;
    }
    
    return cupones;
}

/**
 * Autocompletar tabla de cupones (primera etapa)
 */
async function autocompletarCupones() {
    try {
        // Limpiar cupones existentes
        window.cuponesModule.setCuponesData([]);
        
        // Crear fila de inversión
        const filaInversion = await crearFilaInversion();
        
        // Crear filas de cupones
        const filasCupones = await crearFilasCupones();
        
        // Combinar todas las filas
        const todasLasFilas = [];
        if (filaInversion) {
            todasLasFilas.push(filaInversion);
        }
        todasLasFilas.push(...filasCupones);
        
        // Actualizar datos y renderizar
        window.cuponesModule.setCuponesData(todasLasFilas);
        
        // Mostrar la tabla si hay datos
        const tablaContainer = document.getElementById('tablaCuponesContainer');
        if (tablaContainer && todasLasFilas.length > 0) {
            tablaContainer.style.display = 'block';
        }
        
    } catch (error) {
        console.error('Error al autocompletar cupones:', error);
        if (typeof showError === 'function') {
            showError('Error al autocompletar cupones: ' + error.message);
        }
    }
}

// Exportar funciones
window.autocompletarCupones = autocompletarCupones;

