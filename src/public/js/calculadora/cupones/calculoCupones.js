/**
 * Módulo para calcular fechas de cupones basado en periodicidad
 */

/**
 * Calcular el número del cupón vigente en la fecha de compra
 * El cupón vigente es el que tiene fecha de pago >= fecha de compra
 * @param {Date} fechaEmision - Fecha de emisión
 * @param {string} fechaPrimeraRenta - Fecha de primera renta en formato DD/MM
 * @param {string} periodicidad - Periodicidad: 'mensual', 'bimestral', 'trimestral', 'semestral', 'anual'
 * @param {Date} fechaCompra - Fecha de compra
 * @returns {number} Número del cupón vigente en la fecha de compra (1-based)
 */
function calcularNumeroPrimerCupon(fechaEmision, fechaPrimeraRenta, periodicidad, fechaCompra) {
    if (!fechaEmision || !fechaPrimeraRenta || !periodicidad || !fechaCompra) {
        return 1;
    }
    
    // Parsear fecha de primera renta (DD/MM)
    const partes = fechaPrimeraRenta.split('/');
    if (partes.length !== 2) {
        return 1;
    }
    
    const diaPago = parseInt(partes[0], 10);
    const mesPago = parseInt(partes[1], 10) - 1; // Los meses en JS son 0-11
    
    // Calcular meses según periodicidad
    let mesesPorPeriodo;
    switch (periodicidad.toLowerCase()) {
        case 'mensual':
            mesesPorPeriodo = 1;
            break;
        case 'bimestral':
            mesesPorPeriodo = 2;
            break;
        case 'trimestral':
            mesesPorPeriodo = 3;
            break;
        case 'semestral':
            mesesPorPeriodo = 6;
            break;
        case 'anual':
            mesesPorPeriodo = 12;
            break;
        default:
            return 1;
    }
    
    // Calcular primera fecha de pago
    const añoEmision = fechaEmision.getFullYear();
    let primeraFechaPago = new Date(añoEmision, mesPago, diaPago);
    
    // Si la fecha de pago es anterior a la fecha de emisión, usar el año siguiente
    if (primeraFechaPago < fechaEmision) {
        primeraFechaPago = new Date(añoEmision + 1, mesPago, diaPago);
    }
    
    // Encontrar el cupón vigente (fecha de pago >= fecha de compra)
    let numeroCupon = 1;
    let fechaActual = new Date(primeraFechaPago);
    const fechaLimite = new Date(fechaEmision);
    fechaLimite.setFullYear(fechaLimite.getFullYear() + 10);
    
    // Avanzar hasta encontrar el cupón vigente
    while (fechaActual < fechaCompra && fechaActual <= fechaLimite) {
        const fechaAnterior = new Date(fechaActual);
        fechaActual.setMonth(fechaActual.getMonth() + mesesPorPeriodo);
        numeroCupon++;
        
        // Si la fecha actual es >= fecha de compra, este es el cupón vigente
        if (fechaActual >= fechaCompra) {
            break;
        }
    }
    
    return numeroCupon;
}

/**
 * Calcular fechas de cupones basado en fecha emisión, fecha pago y periodicidad
 * Incluye el cupón vigente en la fecha de compra
 * @param {Date} fechaEmision - Fecha de emisión
 * @param {string} fechaPrimeraRenta - Fecha de primera renta en formato DD/MM
 * @param {string} periodicidad - Periodicidad: 'mensual', 'bimestral', 'trimestral', 'semestral', 'anual'
 * @param {Date} fechaCompra - Fecha de compra (incluir cupón vigente en esta fecha)
 * @param {Date} fechaAmortizacion - Fecha de amortización (último cupón)
 * @returns {Array<Date>} Array de fechas de cupones (incluye el vigente en fecha de compra)
 */
function calcularFechasCupones(fechaEmision, fechaPrimeraRenta, periodicidad, fechaCompra, fechaAmortizacion) {
    if (!fechaEmision || !fechaPrimeraRenta || !periodicidad) {
        return [];
    }
    
    // Parsear fecha de primera renta (DD/MM)
    const partes = fechaPrimeraRenta.split('/');
    if (partes.length !== 2) {
        return [];
    }
    
    const diaPago = parseInt(partes[0], 10);
    const mesPago = parseInt(partes[1], 10) - 1; // Los meses en JS son 0-11
    
    // Calcular meses según periodicidad
    let mesesPorPeriodo;
    switch (periodicidad.toLowerCase()) {
        case 'mensual':
            mesesPorPeriodo = 1;
            break;
        case 'bimestral':
            mesesPorPeriodo = 2;
            break;
        case 'trimestral':
            mesesPorPeriodo = 3;
            break;
        case 'semestral':
            mesesPorPeriodo = 6;
            break;
        case 'anual':
            mesesPorPeriodo = 12;
            break;
        default:
            return [];
    }
    
    // Calcular primera fecha de pago
    const añoEmision = fechaEmision.getFullYear();
    let primeraFechaPago = new Date(añoEmision, mesPago, diaPago);
    
    // Si la fecha de pago es anterior a la fecha de emisión, usar el año siguiente
    if (primeraFechaPago < fechaEmision) {
        primeraFechaPago = new Date(añoEmision + 1, mesPago, diaPago);
    }
    
    // Encontrar el cupón vigente en la fecha de compra
    // El cupón vigente es el que tiene fecha de pago >= fecha de compra
    let fechaCuponVigente = new Date(primeraFechaPago);
    let contador = 0;
    const maxCupones = 120; // Límite de seguridad
    
    // Avanzar hasta encontrar el cupón vigente (fecha de pago >= fecha de compra)
    while (fechaCuponVigente < fechaCompra && contador < maxCupones) {
        const fechaAnterior = new Date(fechaCuponVigente);
        fechaCuponVigente.setMonth(fechaCuponVigente.getMonth() + mesesPorPeriodo);
        
        // Si pasamos la fecha de compra, el cupón anterior podría ser el vigente
        // pero necesitamos el cupón cuyo período contiene la fecha de compra
        if (fechaCuponVigente > fechaCompra) {
            // El cupón vigente es el que tiene fecha de pago = fechaCuponVigente
            // porque fechaCompra está entre fechaAnterior y fechaCuponVigente
            break;
        }
        contador++;
    }
    
    // Generar todas las fechas de cupones desde el cupón vigente hasta fechaAmortizacion
    const fechasCupones = [];
    const fechaLimite = fechaAmortizacion || new Date(fechaEmision);
    if (!fechaAmortizacion) {
        fechaLimite.setFullYear(fechaLimite.getFullYear() + 10);
    }
    
    // Agregar el cupón vigente (fecha de pago >= fecha de compra)
    if (fechaCuponVigente <= fechaLimite) {
        fechasCupones.push(new Date(fechaCuponVigente));
    }
    
    // Agregar cupones siguientes hasta la fecha límite
    let fechaActual = new Date(fechaCuponVigente);
    fechaActual.setMonth(fechaActual.getMonth() + mesesPorPeriodo);
    contador = 0;
    
    while (fechaActual <= fechaLimite && contador < maxCupones) {
        fechasCupones.push(new Date(fechaActual));
        
        // Si llegamos a la fecha de amortización, detener
        if (fechaAmortizacion && fechaActual >= fechaAmortizacion) {
            break;
        }
        
        // Avanzar al siguiente cupón
        fechaActual.setMonth(fechaActual.getMonth() + mesesPorPeriodo);
        contador++;
    }
    
    return fechasCupones;
}

/**
 * Calcular fecha fin de devengamiento basado en fechaPrimeraRenta y periodicidad
 * @param {Date} fechaPago - Fecha de pago del cupón
 * @param {string} fechaPrimeraRenta - Fecha de primera renta en formato DD/MM
 * @param {string} periodicidad - Periodicidad: 'mensual', 'bimestral', 'trimestral', 'semestral', 'anual'
 * @param {number} diasRestar - Días a restar (normalmente negativo, ej: -1)
 * @returns {Date} Fecha fin de devengamiento
 */
function calcularFechaFinDev(fechaPago, fechaPrimeraRenta, periodicidad, diasRestar) {
    // Parsear fecha de primera renta (DD/MM)
    const partes = fechaPrimeraRenta.split('/');
    if (partes.length !== 2) {
        // Fallback: usar fechaPago + diasRestar
        const fecha = new Date(fechaPago);
        fecha.setDate(fecha.getDate() + diasRestar);
        return fecha;
    }
    
    const diaPago = parseInt(partes[0], 10);
    const mesPago = parseInt(partes[1], 10) - 1; // Los meses en JS son 0-11
    
    // Calcular meses según periodicidad
    let mesesPorPeriodo;
    switch (periodicidad.toLowerCase()) {
        case 'mensual':
            mesesPorPeriodo = 1;
            break;
        case 'bimestral':
            mesesPorPeriodo = 2;
            break;
        case 'trimestral':
            mesesPorPeriodo = 3;
            break;
        case 'semestral':
            mesesPorPeriodo = 6;
            break;
        case 'anual':
            mesesPorPeriodo = 12;
            break;
        default:
            mesesPorPeriodo = 1;
    }
    
    // Calcular la fecha base: mismo día y mes que fechaPrimeraRenta, pero ajustado al período del cupón
    // Para cada cupón, la fecha base es fechaPrimeraRenta ajustada al período correspondiente
    const añoPago = fechaPago.getFullYear();
    const mesPagoActual = fechaPago.getMonth();
    
    // Crear fecha base con el día y mes de fechaPrimeraRenta en el año del cupón
    let fechaBase = new Date(añoPago, mesPago, diaPago);
    
    // Si la fecha base es posterior a fechaPago, retroceder un período
    // Esto asegura que la fecha base sea anterior o igual a fechaPago
    if (fechaBase > fechaPago) {
        fechaBase.setMonth(fechaBase.getMonth() - mesesPorPeriodo);
    }
    
    // Aplicar días a restar (normalmente -1, que resta un día)
    fechaBase.setDate(fechaBase.getDate() + diasRestar);
    
    return fechaBase;
}

/**
 * Calcular fecha inicio (fecha fin dev + 1)
 * @param {Date} fechaFinDev - Fecha fin de devengamiento
 * @returns {Date} Fecha inicio
 */
function calcularFechaInicio(fechaFinDev) {
    const fecha = new Date(fechaFinDev);
    fecha.setDate(fecha.getDate() + 1);
    return fecha;
}

// Exportar funciones
window.cuponesCalculoCupones = {
    calcularNumeroPrimerCupon,
    calcularFechasCupones,
    calcularFechaFinDev,
    calcularFechaInicio
};

