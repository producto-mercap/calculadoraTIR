/**
 * Módulo de TIR para la calculadora TIR.
 * Replica la lógica de @Calculadora para resolver la tasa y flujos descontados.
 */

let ultimaTIRCalculada = null;

function obtenerFechaCompraISO() {
    const fechaCompraInput = document.getElementById('fechaCompra');
    const fechaCompra = fechaCompraInput?.value?.trim();
    if (!fechaCompra) {
        return null;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaCompra)) {
        return convertirFechaDDMMAAAAaYYYYMMDD(fechaCompra);
    }
    return fechaCompra;
}

function recolectarFlujosYFechas() {
    const datos = window.cuponesModule?.getCuponesData?.() || [];
    const items = [];

    datos.forEach((cupon, index) => {
        if (!cupon.fechaLiquid) {
            return;
        }

        // PRIORIDAD: Usar el valor del input (lo que el usuario ve y puede haber modificado)
        // Si el input está vacío o es inválido, usar flujosNumero como respaldo
        const flujoRaw = cupon.flujos;
        let flujo = null;
        
        // Primero intentar leer del input (lo que el usuario ve)
        const flujoDesdeInput = normalizarNumeroDesdeInput(flujoRaw);
        
        if (flujoDesdeInput !== null && isFinite(flujoDesdeInput)) {
            // Usar el valor del input (puede haber sido modificado manualmente)
            flujo = flujoDesdeInput;
            // Actualizar flujosNumero para mantener consistencia
            cupon.flujosNumero = flujo;
        } else if (cupon.flujosNumero !== undefined && cupon.flujosNumero !== null) {
            // Si el input no es válido, usar flujosNumero como respaldo
            flujo = cupon.flujosNumero;
        } else {
            return;
        }

        let fechaLiquid = cupon.fechaLiquid;
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaLiquid)) {
            fechaLiquid = convertirFechaDDMMAAAAaYYYYMMDD(fechaLiquid);
        }

        const flujoNumber = Number(flujo);

        items.push({
            flujo: flujoNumber, // Usar Number() para máxima precisión
            fecha: fechaLiquid
        });
    });

    // Ordenar por fecha (importante para el cálculo de TIR)
    items.sort((a, b) => {
        const fechaA = crearFechaDesdeString(a.fecha);
        const fechaB = crearFechaDesdeString(b.fecha);
        if (!fechaA || !fechaB) return 0;
        return fechaA.getTime() - fechaB.getTime();
    });

    // Separar flujos y fechas ordenados
    const flujos = items.map(item => item.flujo);
    const fechas = items.map(item => item.fecha);

    return { flujos, fechas };
}

function calcularTIRLocal(flujos, fechas, fechaCompraISO) {
    // Obtener tipoInteresDias (base) para calcular fracciones de año
    const tipoInteresDias = parseInt(document.getElementById('tipoInteresDias')?.value || '0', 10);
    
    // Calcular fracciones de año para todos los flujos
    const fraccionesAnio = fechas.map(fecha => calcularFraccionAnio(fechaCompraISO, fecha, tipoInteresDias));

    // Función para calcular la sumatoria de flujos descontados para una tasa dada
    // IMPORTANTE: Usar valores completos sin truncar para máxima precisión
    function calcularSumatoria(tasa) {
        let sumatoria = 0;
        const detalles = [];
        
        for (let i = 0; i < flujos.length; i++) {
            // Usar valores completos sin truncar
            const flujoCompleto = Number(flujos[i]);
            const fraccionAnio = calcularFraccionAnio(fechaCompraISO, fechas[i], tipoInteresDias);
            let flujoDescontado;
            
            if (fraccionAnio > 0) {
                // Calcular con máxima precisión usando Math.pow
                const factorDescuento = Math.pow(1 + tasa, fraccionAnio);
                flujoDescontado = flujoCompleto / factorDescuento;
            } else {
                flujoDescontado = flujoCompleto;
            }
            
            // Guardar detalles para logging
            detalles.push({
                index: i,
                fecha: fechas[i],
                flujoCompleto: flujoCompleto,
                fraccionAnio: fraccionAnio,
                tasa: tasa,
                factorDescuento: fraccionAnio > 0 ? Math.pow(1 + tasa, fraccionAnio) : 1,
                flujoDescontado: flujoDescontado
            });
            
            // Acumular sin truncar hasta el final
            sumatoria += flujoDescontado;
        }
        
        return sumatoria;
    }

    const maxIteraciones = 1000;
    // Tolerancia más estricta para mayor precisión en la TIR
    // Usar tolerancia relativa basada en el valor absoluto de los flujos
    const sumaAbsolutaFlujos = flujos.reduce((sum, f) => sum + Math.abs(f), 0);
    const tolerancia = Math.max(0.000000000001, sumaAbsolutaFlujos * 1e-15); // Tolerancia relativa muy pequeña
    const pasoInicial = 0.01; // Paso inicial de 1%
    const factorReduccion = 0.5; // Reducir paso a la mitad cuando cambia de signo
    
    let tasa = 0.0; // Empezar desde 0%
    let paso = pasoInicial;
    let sumatoria = calcularSumatoria(tasa);
    
    // Si la sumatoria ya es 0 (o muy cercana), retornar 0%
    if (Math.abs(sumatoria) < tolerancia) {
        return tasa;
    }
    
    // Determinar dirección inicial: si sumatoria es positiva, aumentar TIR; si es negativa, disminuir
    let direccion = sumatoria > 0 ? 1 : -1; // 1 = aumentar, -1 = disminuir
    let ultimaSumatoria = sumatoria;
    let ultimaTasa = tasa;
    let cambioSigno = false;
    
    // Iterar ajustando la TIR
    for (let i = 0; i < maxIteraciones; i++) {
        // Ajustar tasa según dirección
        tasa += direccion * paso;
        
        // Limitar tasa a un rango razonable
        if (tasa < -0.99) {
            tasa = -0.99;
        }
        if (tasa > 10) {
            tasa = 10;
        }
        
        sumatoria = calcularSumatoria(tasa);
        
        // Si encontramos la solución (sumatoria ≈ 0 con 12 decimales de precisión)
        if (Math.abs(sumatoria) < tolerancia) {
            return tasa;
        }
        
        // Detectar cambio de signo
        if (i > 0 && (ultimaSumatoria * sumatoria < 0)) {
            // Cambió el signo, estamos cerca de la solución
            cambioSigno = true;
            paso *= factorReduccion; // Reducir paso
            direccion *= -1; // Cambiar dirección
            
            // Si el paso es muy pequeño, usar bisección
            if (paso < 0.0001) {
                // Usar bisección entre ultimaTasa y tasa actual
                let tasaMin = Math.min(ultimaTasa, tasa);
                let tasaMax = Math.max(ultimaTasa, tasa);
                
                // Tolerancia más estricta para bisección (mayor precisión)
                const toleranciaBiseccion = Math.max(0.0000000000001, sumaAbsolutaFlujos * 1e-16);
                const toleranciaTasa = 1e-18; // Tolerancia más estricta para la diferencia entre tasas (18 decimales)
                
                for (let j = 0; j < 300; j++) { // Aumentar iteraciones para mayor precisión (300 iteraciones)
                    const tasaBiseccion = (tasaMin + tasaMax) / 2;
                    const sumatoriaBiseccion = calcularSumatoria(tasaBiseccion);
                    
                    if (Math.abs(sumatoriaBiseccion) < toleranciaBiseccion) {
                        return tasaBiseccion;
                    }
                    
                    if (sumatoriaBiseccion > 0) {
                        tasaMin = tasaBiseccion;
                    } else {
                        tasaMax = tasaBiseccion;
                    }
                    
                    // Verificar convergencia tanto por sumatoria como por diferencia de tasas
                    if (Math.abs(tasaMax - tasaMin) < toleranciaTasa) {
                        break;
                    }
                }
                
                tasa = (tasaMin + tasaMax) / 2;
                return tasa;
            }
        } else {
            // No cambió el signo, continuar en la misma dirección
            if (cambioSigno) {
                // Si ya habíamos detectado cambio de signo pero ahora no, volver a reducir paso
                paso *= factorReduccion;
            }
        }
        
        ultimaSumatoria = sumatoria;
        ultimaTasa = tasa;
    }
    
    return tasa;
}

function limpiarFlujosDescontados() {
    const cupones = window.cuponesModule?.getCuponesData?.() || [];
    cupones.forEach(cupon => {
        if (cupon.flujosDesc) {
            cupon.flujosDesc = '';
        }
        actualizarCampoCupon(cupon, 'flujosDesc', '');
    });
    const sumatoriaSpan = document.getElementById('sumatoriaFlujosDesc');
    if (sumatoriaSpan) {
        sumatoriaSpan.textContent = '0.00000000';
    }
}

function resetearResultadoTIR() {
    ultimaTIRCalculada = null;
    const resultado = document.getElementById('resultadoTIR');
    if (resultado) {
        resultado.textContent = '-';
    }
    limpiarFlujosDescontados();
    
    // Ocultar panel de resultados
    const panelResultados = document.getElementById('panelResultados');
    if (panelResultados) {
        panelResultados.style.display = 'none';
    }
    
    // Limpiar valores de precios
    const preciosIds = ['precioCT', 'precioCTHoyAjustado', 'pagosEfectActualizados', 'precioCTAjustPagos', 'precioTecnicoVencimiento'];
    preciosIds.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.textContent = '-';
    });
}

function actualizarFlujosDescontadosYSumatoria() {
    const cupones = window.cuponesModule?.getCuponesData?.() || [];
    if (!cupones.length) {
        limpiarFlujosDescontados();
        return;
    }

    const fechaCompraISO = obtenerFechaCompraISO();
    if (!fechaCompraISO || ultimaTIRCalculada === null) {
        limpiarFlujosDescontados();
        return;
    }

    const tipoInteresDias = parseInt(document.getElementById('tipoInteresDias')?.value || '0', 10);
    const decimalesAjustes = obtenerDecimalesAjustes();
    const decimalesFlujos = decimalesAjustes === 12 ? 12 : 8;

    let sumatoria = 0;

    cupones.forEach((cupon, index) => {
        const flujoRaw = cupon.flujos;
        const flujo = normalizarNumeroDesdeInput(flujoRaw);
        if (flujo === null || !cupon.fechaLiquid) {
            actualizarCampoCupon(cupon, 'flujosDesc', '');
            return;
        }

        let fechaLiquidISO = cupon.fechaLiquid;
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(fechaLiquidISO)) {
            fechaLiquidISO = convertirFechaDDMMAAAAaYYYYMMDD(fechaLiquidISO);
        }

        // Usar Number() para máxima precisión
        const flujoCompleto = Number(flujo);
        const fraccionAnio = calcularFraccionAnio(fechaCompraISO, fechaLiquidISO, tipoInteresDias);
        
        let flujoDesc;
        if (fraccionAnio > 0) {
            // Calcular con máxima precisión usando Math.pow
            flujoDesc = flujoCompleto / Math.pow(1 + ultimaTIRCalculada, fraccionAnio);
        } else {
            flujoDesc = flujoCompleto;
        }

        sumatoria += flujoDesc;
        
        // Si los decimales de ajustes están en 12, usar 12 decimales para los flujos descontados (mayor precisión para TIR)
        actualizarCampoCupon(cupon, 'flujosDesc', formatearNumero(flujoDesc, decimalesFlujos));
    });

    const sumatoriaSpan = document.getElementById('sumatoriaFlujosDesc');
    if (sumatoriaSpan) {
        sumatoriaSpan.textContent = formatearNumero(sumatoria, 8);
    }
}

async function calcularTIR() {
    const btn = document.getElementById('btnCalcularTIR');
    if (btn) {
        btn.disabled = true;
    }

    try {
        const fechaCompraISO = obtenerFechaCompraISO();
        if (!fechaCompraISO) {
            if (typeof showError === 'function') {
                showError('Debe ingresar la fecha de compra.');
            }
            return;
        }

        // Recalcular flujos antes de calcular la TIR para asegurar que estén actualizados
        if (window.cuponesCalculos && typeof window.cuponesCalculos.recalcularFlujosCupones === 'function') {
            const cupones = window.cuponesModule?.getCuponesData?.() || [];
            window.cuponesCalculos.recalcularFlujosCupones(cupones);
        }

        const datos = window.cuponesModule?.getCuponesData?.() || [];
        if (!datos.length) {
            if (typeof showError === 'function') {
                showError('Debe cargar la inversión y al menos un cupón.');
            }
            return;
        }

        const inversion = datos.find(c => c.id === 'inversion');
        if (!inversion || normalizarNumeroDesdeInput(inversion.flujos) === null) {
            if (typeof showError === 'function') {
                showError('Complete el flujo de la inversión antes de calcular la TIR.');
            }
            return;
        }

        const cupones = datos.filter(c => c.id !== 'inversion');
        if (!cupones.length) {
            if (typeof showError === 'function') {
                showError('Debe agregar al menos un cupón.');
            }
            return;
        }

        const cuponesSinFlujo = cupones.filter(c => normalizarNumeroDesdeInput(c.flujos) === null);
        if (cuponesSinFlujo.length > 0) {
            if (typeof showError === 'function') {
                showError('Faltan flujos en algunos cupones. Verifique amortizaciones y rentas.');
            }
            return;
        }

        const { flujos, fechas } = recolectarFlujosYFechas();
        if (flujos.length < 2) {
            if (typeof showError === 'function') {
                showError('No hay flujos suficientes para calcular la TIR.');
            }
            return;
        }

        const tir = calcularTIRLocal(flujos, fechas, fechaCompraISO);
        ultimaTIRCalculada = tir;

        const resultado = document.getElementById('resultadoTIR');
        if (resultado) {
            resultado.textContent = (tir * 100).toFixed(8) + '%';
        }

        actualizarFlujosDescontadosYSumatoria();
        
        // Recalcular factores de actualización y pagos actualizados después de calcular la TIR
        if (window.cuponesCalculos && window.cuponesCalculos.recalcularValoresDerivados) {
            const cupones = window.cuponesModule?.getCuponesData?.() || [];
            window.cuponesCalculos.recalcularValoresDerivados(cupones);
        }
        
        // Renderizar la tabla para mostrar los valores actualizados (después de todos los recálculos)
        setTimeout(() => {
            if (window.cuponesModule && typeof window.cuponesModule.renderizarCupones === 'function') {
                window.cuponesModule.renderizarCupones();
            }
            
            // Calcular y mostrar precios después de renderizar
            if (window.preciosModule && typeof window.preciosModule.recalcularTodosPrecios === 'function') {
                window.preciosModule.recalcularTodosPrecios();
            }
            
            // Mostrar panel de resultados
            const panelResultados = document.getElementById('panelResultados');
            if (panelResultados) {
                panelResultados.style.display = 'block';
                
                // Mostrar/ocultar "Precio C+T Ajustado" según ajusteCER
                const ajusteCER = document.getElementById('ajusteCER')?.checked || false;
                const precioCTAjustadoContainer = document.getElementById('precioCTAjustadoContainer');
                if (precioCTAjustadoContainer) {
                    precioCTAjustadoContainer.style.display = ajusteCER ? 'flex' : 'none';
                }
            }
        }, 50);

        if (typeof showSuccess === 'function') {
            showSuccess('TIR calculada: ' + (tir * 100).toFixed(8) + '%');
        }
    } catch (error) {
        console.error('Error al calcular TIR:', error);
        if (typeof showError === 'function') {
            showError('Error al calcular la TIR: ' + error.message);
        }
    } finally {
        if (btn) {
            btn.disabled = false;
        }
    }
}

window.tirModule = {
    calcularTIR,
    actualizarFlujosDescontadosYSumatoria,
    resetTIR: resetearResultadoTIR,
    getUltimaTIR: () => ultimaTIRCalculada
};

window.calcularTIR = calcularTIR;

