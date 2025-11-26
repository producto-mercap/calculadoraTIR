// Servicio para consumir API de feriados
// Usando ArgentinaDatos API (gratuita): https://argentinadatos.com/docs/operations/get-feriados.html
// Rango de años: 2016-2025
// Formato respuesta: [{ fecha: "YYYY-MM-DD", tipo: "string", nombre: "string" }]
const axios = require('axios');

// Forzar uso de ArgentinaDatos (la API anterior nolaborables.com.ar está caída)
const FERIADOS_API_URL = process.env.FERIADOS_API_URL || 'https://api.argentinadatos.com/v1/feriados';

// Validar que no se esté usando la API antigua
if (FERIADOS_API_URL.includes('nolaborables.com.ar')) {
    console.warn('[feriadosService] ⚠️ ADVERTENCIA: Se detectó URL de API antigua (nolaborables.com.ar).');
    console.warn('[feriadosService] ⚠️ Por favor actualice FERIADOS_API_URL en .env a: https://api.argentinadatos.com/v1/feriados');
    console.warn('[feriadosService] ⚠️ Usando ArgentinaDatos como fallback...');
}

/**
 * Obtener feriados de un año específico
 */
const obtenerFeriados = async (anio) => {
    // Validar rango de años según documentación de ArgentinaDatos (2016-2025)
    if (anio < 2016 || anio > 2025) {
        console.warn(`[feriadosService] ⚠️ Año ${anio} fuera del rango válido (2016-2025) para ArgentinaDatos API`);
    }
    
    const url = `${FERIADOS_API_URL}/${anio}`;
    console.log(`[feriadosService] 🔍 Obteniendo feriados para año ${anio} desde: ${url}`);
    
    try {
        const response = await axios.get(url, {
            timeout: 10000, // 10 segundos de timeout
            validateStatus: (status) => status < 500 // No lanzar error para 404
        });
        
        console.log(`[feriadosService] ✅ Respuesta recibida para año ${anio}:`, {
            status: response.status,
            statusText: response.statusText,
            dataType: Array.isArray(response.data) ? 'array' : typeof response.data,
            dataLength: Array.isArray(response.data) ? response.data.length : 'N/A'
        });
        
        if (response.status === 404) {
            console.warn(`[feriadosService] ⚠️ No hay datos de feriados para el año ${anio} (404) - retornando array vacío`);
            return [];
        }
        
        if (response.status !== 200) {
            console.error(`[feriadosService] ❌ Error HTTP ${response.status} para año ${anio}:`, response.statusText);
            return [];
        }
        
        const datos = response.data || [];
        
        if (!Array.isArray(datos)) {
            console.error(`[feriadosService] ❌ La respuesta no es un array para año ${anio}. Tipo recibido:`, typeof datos);
            return [];
        }
        
        // La API de ArgentinaDatos devuelve un array de objetos con: { fecha, tipo, nombre }
        // Formato de fecha: YYYY-MM-DD
        const feriadosProcesados = datos.map((feriado, index) => {
            try {
                // La API de ArgentinaDatos siempre devuelve objetos con fecha, tipo, nombre
                if (feriado && typeof feriado === 'object' && feriado.fecha) {
                    // Normalizar fecha (puede venir con hora, solo necesitamos la fecha)
                    let fechaNormalizada = feriado.fecha;
                    if (typeof fechaNormalizada === 'string' && fechaNormalizada.includes('T')) {
                        fechaNormalizada = fechaNormalizada.split('T')[0];
                    }
                    
                    return {
                        fecha: fechaNormalizada,
                        tipo: feriado.tipo || '',
                        nombre: feriado.nombre || ''
                    };
                }
                
                // Fallback por si acaso
                if (typeof feriado === 'string') {
                    return { fecha: feriado.split('T')[0], tipo: '', nombre: '' };
                }
                
                // Último fallback
                const fecha = feriado.fecha || feriado.date || feriado;
                return {
                    fecha: typeof fecha === 'string' ? fecha.split('T')[0] : fecha,
                    tipo: feriado.tipo || '',
                    nombre: feriado.nombre || ''
                };
            } catch (err) {
                console.error(`[feriadosService] ❌ Error procesando feriado ${index} del año ${anio}:`, err.message);
                return null;
            }
        }).filter(f => f !== null && f.fecha);
        
        console.log(`[feriadosService] ✅ Procesados ${feriadosProcesados.length} feriados para el año ${anio}`);
        return feriadosProcesados;
        
    } catch (error) {
        console.error(`[feriadosService] ❌ Error al obtener feriados para año ${anio}:`, {
            message: error.message,
            code: error.code,
            response: error.response ? {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            } : 'No response',
            url: url
        });
        
        if (error.response && error.response.status === 404) {
            console.warn(`[feriadosService] ⚠️ No hay datos de feriados para el año ${anio} (404) - retornando array vacío`);
            return [];
        }
        
        return [];
    }
};

/**
 * Obtener feriados en un rango de años
 */
const obtenerFeriadosRango = async (fechaDesde, fechaHasta) => {
    console.log(`[feriadosService] 🔍 obtenerFeriadosRango - INICIO`, {
        fechaDesde,
        fechaHasta,
        tipoDesde: typeof fechaDesde,
        tipoHasta: typeof fechaHasta
    });
    
    try {
        // Validar formato YYYY-MM-DD
        const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!fechaRegex.test(fechaDesde) || !fechaRegex.test(fechaHasta)) {
            console.error(`[feriadosService] ❌ Formato de fecha inválido:`, {
                fechaDesde,
                fechaHasta,
                desdeValido: fechaRegex.test(fechaDesde),
                hastaValido: fechaRegex.test(fechaHasta)
            });
            throw new Error('Formato de fecha inválido. Use YYYY-MM-DD');
        }
        
        // Crear fechas sin problemas de zona horaria
        const partesDesde = fechaDesde.split('-');
        const partesHasta = fechaHasta.split('-');
        const fechaDesdeDate = new Date(parseInt(partesDesde[0]), parseInt(partesDesde[1]) - 1, parseInt(partesDesde[2]));
        const fechaHastaDate = new Date(parseInt(partesHasta[0]), parseInt(partesHasta[1]) - 1, parseInt(partesHasta[2]));
        
        if (isNaN(fechaDesdeDate.getTime()) || isNaN(fechaHastaDate.getTime())) {
            console.error(`[feriadosService] ❌ Fechas inválidas después de parsear:`, {
                fechaDesde,
                fechaHasta,
                fechaDesdeDate: fechaDesdeDate.toString(),
                fechaHastaDate: fechaHastaDate.toString()
            });
            throw new Error('Fechas inválidas');
        }
        
        console.log(`[feriadosService] ✅ Fechas parseadas correctamente:`, {
            fechaDesdeDate: fechaDesdeDate.toISOString().split('T')[0],
            fechaHastaDate: fechaHastaDate.toISOString().split('T')[0]
        });
        
        const fechaMinima = new Date(2020, 0, 1);
        const fechaInicio = fechaDesdeDate < fechaMinima ? fechaMinima : fechaDesdeDate;
        
        const todosLosFeriados = [];
        let añoActual = fechaInicio.getFullYear();
        const añoFin = fechaHastaDate.getFullYear();
        
        console.log(`[feriadosService] 📅 Consultando feriados para años ${añoActual} a ${añoFin}`);
        
        while (añoActual <= añoFin) {
            console.log(`[feriadosService] 🔄 Consultando año ${añoActual}...`);
            const feriadosAño = await obtenerFeriados(añoActual);
            if (feriadosAño && feriadosAño.length > 0) {
                console.log(`[feriadosService] ✅ Año ${añoActual}: ${feriadosAño.length} feriados encontrados`);
                todosLosFeriados.push(...feriadosAño);
            } else {
                console.log(`[feriadosService] ⚠️ Año ${añoActual}: No se encontraron feriados`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            añoActual++;
        }
        
        console.log(`[feriadosService] 📊 Total de feriados obtenidos antes de filtrar: ${todosLosFeriados.length}`);
        
        const feriadosFiltrados = todosLosFeriados
            .filter((feriado, index, self) => {
                const fechaFeriado = feriado.fecha;
                if (!fechaFeriado) {
                    console.warn(`[feriadosService] ⚠️ Feriado sin fecha en índice ${index}`);
                    return false;
                }
                
                // Crear fecha sin problemas de zona horaria
                let fechaFeriadoDate;
                if (typeof fechaFeriado === 'string' && /^\d{4}-\d{2}-\d{2}/.test(fechaFeriado)) {
                    const partes = fechaFeriado.split('T')[0].split('-');
                    fechaFeriadoDate = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
                } else {
                    fechaFeriadoDate = new Date(fechaFeriado);
                }
                
                if (isNaN(fechaFeriadoDate.getTime())) {
                    console.warn(`[feriadosService] ⚠️ Fecha inválida para feriado:`, fechaFeriado);
                    return false;
                }
                
                if (fechaFeriadoDate < fechaInicio || fechaFeriadoDate > fechaHastaDate) {
                    return false;
                }
                
                return index === self.findIndex(f => f.fecha === fechaFeriado);
            })
            .map(feriado => ({
                fecha: feriado.fecha,
                tipo: feriado.tipo || '',
                nombre: feriado.nombre || ''
            }));
        
        console.log(`[feriadosService] ✅ obtenerFeriadosRango - FIN: ${feriadosFiltrados.length} feriados en el rango`);
        return feriadosFiltrados;
    } catch (error) {
        console.error(`[feriadosService] ❌ Error al obtener feriados en rango:`, {
            message: error.message,
            stack: error.stack,
            fechaDesde,
            fechaHasta
        });
        throw new Error(`No se pudo obtener datos de feriados: ${error.message}`);
    }
};

module.exports = {
    obtenerFeriados,
    obtenerFeriadosRango
};



