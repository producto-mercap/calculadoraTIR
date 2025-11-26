/**
 * Módulo para obtener valores CER de forma optimizada
 * Similar a diasHabiles.js, carga todos los valores CER de una vez
 */

// Cache de valores CER para evitar múltiples consultas
let cerCache = null;
let cerCacheFecha = null;

/**
 * Obtener valores CER desde la BD
 * @param {string} fechaDesde - Fecha inicio en formato YYYY-MM-DD
 * @param {string} fechaHasta - Fecha fin en formato YYYY-MM-DD
 * @returns {Promise<Array>} Array de objetos { fecha: 'YYYY-MM-DD', valor: number }
 */
async function obtenerValoresCER(fechaDesde, fechaHasta) {
    try {
        // Normalizar fechas a formato YYYY-MM-DD (strings)
        const desdeFormateado = typeof fechaDesde === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaDesde) 
            ? fechaDesde 
            : (fechaDesde instanceof Date ? formatearFechaInput(fechaDesde) : String(fechaDesde));
        const hastaFormateado = typeof fechaHasta === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaHasta) 
            ? fechaHasta 
            : (fechaHasta instanceof Date ? formatearFechaInput(fechaHasta) : String(fechaHasta));
        
        // Validar formato
        if (!/^\d{4}-\d{2}-\d{2}$/.test(desdeFormateado) || !/^\d{4}-\d{2}-\d{2}$/.test(hastaFormateado)) {
            console.error('[cuponesCER] Error: Fechas no están en formato YYYY-MM-DD:', { desdeFormateado, hastaFormateado });
            return [];
        }
        
        // Usar cache si está disponible y cubre el rango solicitado
        if (cerCache && cerCacheFecha) {
            const cacheDesde = crearFechaDesdeString(cerCacheFecha.desde);
            const cacheHasta = crearFechaDesdeString(cerCacheFecha.hasta);
            const desde = crearFechaDesdeString(desdeFormateado);
            const hasta = crearFechaDesdeString(hastaFormateado);
            
            // Si el cache cubre el rango solicitado, usar cache
            if (desde >= cacheDesde && hasta <= cacheHasta) {
                return cerCache;
            }
            
            // Si el rango solicitado es más amplio, expandir el cache
            if (desde < cacheDesde || hasta > cacheHasta) {
                // Expandir el rango del cache para incluir ambos rangos
                const nuevoDesde = desde < cacheDesde ? desdeFormateado : cerCacheFecha.desde;
                const nuevoHasta = hasta > cacheHasta ? hastaFormateado : cerCacheFecha.hasta;
                
                // Recargar con el rango expandido
                const response = await fetch(`/api/cer/bd?desde=${encodeURIComponent(nuevoDesde)}&hasta=${encodeURIComponent(nuevoHasta)}`);
                const result = await response.json();
                
                if (result.success && result.datos) {
                    const valores = result.datos.map(cer => ({
                        fecha: cer.fecha.includes('T') ? cer.fecha.split('T')[0] : cer.fecha,
                        valor: parseFloat(cer.valor) || 0
                    }));
                    
                    cerCache = valores;
                    cerCacheFecha = { desde: nuevoDesde, hasta: nuevoHasta };
                    return valores;
                }
            }
        }
        
        // Si no hay cache o no cubre el rango, cargar desde BD
        const response = await fetch(`/api/cer/bd?desde=${encodeURIComponent(desdeFormateado)}&hasta=${encodeURIComponent(hastaFormateado)}`);
        const result = await response.json();
        
        if (result.success && result.datos) {
            // Normalizar fechas y valores
            const valores = result.datos.map(cer => ({
                fecha: cer.fecha.includes('T') ? cer.fecha.split('T')[0] : cer.fecha,
                valor: parseFloat(cer.valor) || 0
            }));
            
            // Actualizar cache
            cerCache = valores;
            cerCacheFecha = { desde: desdeFormateado, hasta: hastaFormateado };
            
            return valores;
        }
        
        return [];
    } catch (error) {
        console.error('Error al obtener valores CER:', error);
        return [];
    }
}

/**
 * Buscar valor CER para una fecha específica
 * Si no existe la fecha exacta, busca el valor más cercano anterior
 * @param {Date|string} fecha - Fecha a buscar (Date o string YYYY-MM-DD o DD/MM/AAAA)
 * @param {Array} valoresCER - Array de valores CER ya cargados
 * @returns {number|null} Valor CER encontrado o null si no existe
 */
function buscarValorCERPorFecha(fecha, valoresCER = []) {
    if (!valoresCER || valoresCER.length === 0) {
        return null;
    }
    
    // Normalizar fecha a YYYY-MM-DD
    let fechaNormalizada;
    if (fecha instanceof Date) {
        fechaNormalizada = formatearFechaInput(fecha);
    } else if (typeof fecha === 'string') {
        // Si está en formato DD/MM/AAAA, convertir
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(fecha)) {
            fechaNormalizada = convertirFechaDDMMAAAAaYYYYMMDD(fecha);
        } else {
            fechaNormalizada = fecha.includes('T') ? fecha.split('T')[0] : fecha;
        }
    } else {
        return null;
    }
    
    // Buscar fecha exacta
    const cerExacto = valoresCER.find(cer => cer.fecha === fechaNormalizada);
    if (cerExacto) {
        return cerExacto.valor;
    }
    
    // Si no existe exacto, buscar el más cercano anterior
    const fechaDate = crearFechaDesdeString(fechaNormalizada);
    if (!fechaDate) {
        return null;
    }
    
    // Ordenar valores CER por fecha descendente y buscar el primero anterior o igual
    const valoresOrdenados = [...valoresCER].sort((a, b) => {
        const fechaA = crearFechaDesdeString(a.fecha);
        const fechaB = crearFechaDesdeString(b.fecha);
        if (!fechaA || !fechaB) return 0;
        return fechaB.getTime() - fechaA.getTime(); // Descendente
    });
    
    for (const cer of valoresOrdenados) {
        const cerFecha = crearFechaDesdeString(cer.fecha);
        if (cerFecha && cerFecha <= fechaDate) {
            return cer.valor;
        }
    }
    
    return null;
}

/**
 * Buscar valor CER para una fecha específica (versión async que carga CER si es necesario)
 * @param {Date|string} fecha - Fecha a buscar
 * @param {number} margenDias - Margen de días para cargar CER (default: 30)
 * @returns {Promise<number|null>} Valor CER encontrado o null
 */
async function buscarValorCERPorFechaAsync(fecha, margenDias = 30) {
    // Normalizar fecha
    let fechaDate;
    if (fecha instanceof Date) {
        fechaDate = fecha;
    } else if (typeof fecha === 'string') {
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(fecha)) {
            fechaDate = crearFechaDesdeString(convertirFechaDDMMAAAAaYYYYMMDD(fecha));
        } else {
            fechaDate = crearFechaDesdeString(fecha);
        }
    }
    
    if (!fechaDate) {
        return null;
    }
    
    // Calcular rango para cargar CER
    const fechaDesdeDate = new Date(fechaDate);
    fechaDesdeDate.setDate(fechaDesdeDate.getDate() - margenDias);
    const fechaHastaDate = new Date(fechaDate);
    fechaHastaDate.setDate(fechaHastaDate.getDate() + margenDias);
    
    const fechaDesde = formatearFechaInput(fechaDesdeDate);
    const fechaHasta = formatearFechaInput(fechaHastaDate);
    
    const valoresCER = await obtenerValoresCER(fechaDesde, fechaHasta);
    return buscarValorCERPorFecha(fecha, valoresCER);
}

// Exportar funciones
window.cuponesCER = {
    obtenerValoresCER,
    buscarValorCERPorFecha,
    buscarValorCERPorFechaAsync
};
