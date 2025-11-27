/**
 * Módulo para calcular Day Count Factor según diferentes convenciones
 * Similar a la función FRAC.AÑO de Excel
 */

/**
 * Calcula el Day Count Factor según la convención seleccionada
 * @param {Date} fechaInicio - Fecha de inicio
 * @param {Date} fechaFinDev - Fecha fin devengamiento
 * @param {number} tipoInteresDias - Tipo de convención (0, 1, 2, 3)
 * @returns {number} Day Count Factor
 */
function calcularDayCountFactor(fechaInicio, fechaFinDev, tipoInteresDias) {
    if (!fechaInicio || !fechaFinDev) {
        return null;
    }
    
    // La fecha fin es fechaFinDev + 1 día corrido
    const fechaFin = new Date(fechaFinDev);
    fechaFin.setDate(fechaFin.getDate() + 1);
    
    switch (parseInt(tipoInteresDias, 10)) {
        case 0: // US (NASD) 30/360
            return calcular30_360(fechaInicio, fechaFin);
            
        case 1: // Real/real (Actual/actual)
            return calcularActualActual(fechaInicio, fechaFin);
            
        case 2: // Real/360 (Actual/360)
            return calcularActual360(fechaInicio, fechaFin);
            
        case 3: // Real/365 (Actual/365)
            return calcularActual365(fechaInicio, fechaFin);
            
        default:
            return null;
    }
}

/**
 * Calcula Day Count Factor usando convención 30/360 (US NASD)
 * Fórmula: (360*(Y2-Y1) + 30*(M2-M1) + (D2-D1)) / 360
 * Reglas especiales:
 * - Si D1 = 31, se cambia a 30
 * - Si D2 = 31 y D1 = 30 o 31, se cambia D2 a 30
 */
function calcular30_360(fechaInicio, fechaFin) {
    let d1 = fechaInicio.getDate();
    let m1 = fechaInicio.getMonth() + 1; // Meses 1-12
    let y1 = fechaInicio.getFullYear();
    
    let d2 = fechaFin.getDate();
    let m2 = fechaFin.getMonth() + 1;
    let y2 = fechaFin.getFullYear();
    
    // Regla: Si D1 = 31, cambiar a 30
    if (d1 === 31) {
        d1 = 30;
    }
    
    // Regla: Si D2 = 31 y D1 = 30 o 31, cambiar D2 a 30
    if (d2 === 31 && (d1 === 30 || d1 === 31)) {
        d2 = 30;
    }
    
    // Calcular diferencia
    const diff = (360 * (y2 - y1)) + (30 * (m2 - m1)) + (d2 - d1);
    
    return diff / 360;
}

/**
 * Calcula Day Count Factor usando convención Actual/Actual
 * Días reales entre fechas / días reales en el año
 * Si el período cruza años, se calcula proporcionalmente
 */
function calcularActualActual(fechaInicio, fechaFin) {
    // Calcular días reales entre las fechas
    const diffTime = fechaFin.getTime() - fechaInicio.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    
    // Si las fechas están en el mismo año
    if (fechaInicio.getFullYear() === fechaFin.getFullYear()) {
        const year = fechaInicio.getFullYear();
        const diasEnAnio = esAnioBisiesto(year) ? 366 : 365;
        return diffDays / diasEnAnio;
    }
    
    // Si cruzan años, calcular proporcionalmente
    let totalFactor = 0;
    let fechaActual = new Date(fechaInicio);
    
    while (fechaActual < fechaFin) {
        const year = fechaActual.getFullYear();
        const diasEnAnio = esAnioBisiesto(year) ? 366 : 365;
        
        // Calcular fecha fin del año actual
        const finAnio = new Date(year, 11, 31); // 31 de diciembre
        
        if (fechaFin <= finAnio) {
            // El período termina en este año
            const diffTime = fechaFin.getTime() - fechaActual.getTime();
            const diffDays = diffTime / (1000 * 60 * 60 * 24);
            totalFactor += diffDays / diasEnAnio;
            break;
        } else {
            // El período continúa al siguiente año
            const diffTime = finAnio.getTime() - fechaActual.getTime();
            const diffDays = diffTime / (1000 * 60 * 60 * 24);
            totalFactor += diffDays / diasEnAnio;
            fechaActual = new Date(year + 1, 0, 1); // 1 de enero del siguiente año
        }
    }
    
    return totalFactor;
}

/**
 * Calcula Day Count Factor usando convención Actual/360
 * Días reales entre fechas / 360
 */
function calcularActual360(fechaInicio, fechaFin) {
    const diffTime = fechaFin.getTime() - fechaInicio.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays / 360;
}

/**
 * Calcula Day Count Factor usando convención Actual/365
 * Días reales entre fechas / 365
 */
function calcularActual365(fechaInicio, fechaFin) {
    const diffTime = fechaFin.getTime() - fechaInicio.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays / 365;
}

/**
 * Verifica si un año es bisiesto
 */
function esAnioBisiesto(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

// Exportar funciones globalmente
window.cuponesDayCountFactor = {
    calcularDayCountFactor,
    calcular30_360,
    calcularActualActual,
    calcularActual360,
    calcularActual365
};

