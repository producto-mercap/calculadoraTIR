/**
 * Utilidades para procesamiento de inventario FIFO
 */

/**
 * Formatea un número con separador de miles
 */
function formatearNumero(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Calcula el saldo disponible de partidas (excluyendo PA)
 */
function calcularSaldoDisponible(partidas) {
    return partidas
        .filter(p => p.saldo > 0 && p.tipoMin !== 'PA')
        .reduce((sum, p) => sum + p.saldo, 0);
}

/**
 * Calcula el saldo inicial del día (partidas creadas antes del día actual)
 */
function calcularSaldoInicialDia(partidas, fecha) {
    const inicioDia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    
    return partidas
        .filter(p => {
            if (p.saldo <= 0 || p.tipoMin === 'PA') return false;
            if (!p.fecha) return false;
            return p.fecha.getTime() < inicioDia.getTime();
        })
        .reduce((sum, p) => {
            const imputacionesDelDia = p.imputaciones.filter(imp => {
                if (!imp.fecha) return false;
                return imp.fecha.getFullYear() === fecha.getFullYear() &&
                       imp.fecha.getMonth() === fecha.getMonth() &&
                       imp.fecha.getDate() === fecha.getDate();
            });
            
            if (imputacionesDelDia.length > 0) {
                const saldoInicial = p.saldo - imputacionesDelDia
                    .filter(imp => imp.cantidad > 0)
                    .reduce((s, imp) => s + imp.cantidad, 0) +
                    imputacionesDelDia
                    .filter(imp => imp.cantidad < 0)
                    .reduce((s, imp) => s - imp.cantidad, 0);
                return sum + saldoInicial;
            }
            return sum + p.saldo;
        }, 0);
}

/**
 * Obtiene la categoría de ordenamiento de una partida para imputaciones
 * A - Ingresos (Contados): INGR, C
 * B - Ingresos (patas en distintas fechas): PP, OCT, PRET/PRESTAMO (pata futura) | PA (contado), PFT (contado)
 * C - Ingresos por Transferencia: TRF
 */
function obtenerCategoriaPartidaParaImputacion(partida) {
    const tipoMin = partida.tipoMin ? partida.tipoMin.toUpperCase() : '';
    
    // A - Ingresos (Contados): INGR, C
    if (tipoMin === 'INGR' || tipoMin === 'ING') {
        return { categoria: 'A', orden: 1 };
    }
    if (tipoMin === 'C') {
        return { categoria: 'A', orden: 2 };
    }
    
    // B - Ingresos (patas en distintas fechas): PP, OCT, PRET/PRESTAMO (pata futura) | PA (contado), PFT (contado)
    if (tipoMin === 'PP') {
        return { categoria: 'B', orden: 3 };
    }
    if (tipoMin === 'OCT') {
        return { categoria: 'B', orden: 4 };
    }
    if (tipoMin === 'PRESTAMO' || tipoMin === 'PRÉSTAMO' || tipoMin === 'PREST' || tipoMin === 'PRET') {
        return { categoria: 'B', orden: 5 };
    }
    if (tipoMin === 'PA') {
        return { categoria: 'B', orden: 6 };
    }
    if (tipoMin === 'PF' || tipoMin === 'PFT') {
        return { categoria: 'B', orden: 7 };
    }
    
    // C - Ingresos por Transferencia: TRF
    if (tipoMin === 'TRFS' || tipoMin === 'TRFU' || tipoMin === 'TRFC' || tipoMin === 'TRF') {
        return { categoria: 'C', orden: 8 };
    }
    
    // Por defecto, mantener orden por fecha
    return { categoria: 'Z', orden: 999 };
}

/**
 * Obtiene partidas disponibles para aplicar egresos (respetando reglas de ordenamiento)
 */
function obtenerPartidasDisponibles(partidas, incluirCerradas = false) {
    return partidas
        .filter(p => {
            if (p.tipoMin === 'PA') return false;
            return p.saldo > 0;
        })
        .sort((a, b) => {
            // PRIMERO ordenar por fecha (FIFO estricto - partidas más antiguas primero)
            const fechaA = a.fecha ? (a.fecha.getTime ? a.fecha.getTime() : new Date(a.fecha).getTime()) : 0;
            const fechaB = b.fecha ? (b.fecha.getTime ? b.fecha.getTime() : new Date(b.fecha).getTime()) : 0;
            
            if (fechaA !== fechaB) {
                return fechaA - fechaB;
            }
            
            // Si misma fecha, ordenar por categoría según reglas de ordenamiento
            const catA = obtenerCategoriaPartidaParaImputacion(a);
            const catB = obtenerCategoriaPartidaParaImputacion(b);
            
            if (catA.orden !== catB.orden) {
                return catA.orden - catB.orden;
            }
            
            // Si misma fecha y categoría, ordenar por ID (mantener orden de creación)
            return a.id - b.id;
        });
}

/**
 * Verifica si dos fechas son del mismo día
 */
function esMismoDia(fecha1, fecha2) {
    if (!fecha1 || !fecha2) return false;
    return fecha1.getFullYear() === fecha2.getFullYear() &&
           fecha1.getMonth() === fecha2.getMonth() &&
           fecha1.getDate() === fecha2.getDate();
}

/**
 * Crea una imputación para una partida
 */
function crearImputacion(movimiento, cantidad, saldoDespues) {
    return {
        tipoMin: movimiento.tipoMin,
        tipoMov: movimiento.tipoMov,
        minutaOrigen: movimiento.minutaOrigen,
        fecha: movimiento.fecha,
        fechaStr: movimiento.fechaStr,
        cantidad: cantidad,
        cantidadOriginal: movimiento.cantidad,
        saldoDespues: saldoDespues
    };
}

module.exports = {
    formatearNumero,
    calcularSaldoDisponible,
    calcularSaldoInicialDia,
    obtenerPartidasDisponibles,
    obtenerCategoriaPartidaParaImputacion,
    esMismoDia,
    crearImputacion
};

