/**
 * Funciones para guardar y cargar calculadoras desde la base de datos
 */

/**
 * Recopilar todos los datos de la calculadora del formulario
 */
function recopilarDatosCalculadora() {
    return {
        // Datos Partida
        fechaCompra: document.getElementById('fechaCompra')?.value || '',
        precioCompra: document.getElementById('precioCompra')?.value || '',
        cantidadPartida: document.getElementById('cantidadPartida')?.value || '',
        
        // Datos Especie
        ticker: document.getElementById('ticker')?.value || '',
        tasa: document.getElementById('tasa')?.value || '',
        formula: document.getElementById('formula')?.value || '',
        rentaTNA: document.getElementById('rentaTNA')?.value || '',
        spread: document.getElementById('spread')?.value || '',
        tipoInteresDias: document.getElementById('tipoInteresDias')?.value || '0',
        fechaEmision: document.getElementById('fechaEmision')?.value || '',
        fechaPrimeraRenta: document.getElementById('fechaPrimeraRenta')?.value || '',
        diasRestarFechaFinDev: document.getElementById('diasRestarFechaFinDev')?.value || '-1',
        fechaAmortizacion: document.getElementById('fechaAmortizacion')?.value || '',
        porcentajeAmortizacion: document.getElementById('porcentajeAmortizacion')?.value || '',
        periodicidad: document.getElementById('periodicidad')?.value || '',
        intervaloInicio: document.getElementById('intervaloInicio')?.value || '',
        intervaloFin: document.getElementById('intervaloFin')?.value || '',
        ajusteCER: document.getElementById('ajusteCER')?.checked || false
    };
}

/**
 * Guardar calculadora en la base de datos
 */
async function guardarCalculadora() {
    try {
        const datos = recopilarDatosCalculadora();
        
        // Mostrar modal para ingresar nombre
        mostrarModalGuardarCalculadora(datos);

    } catch (error) {
        console.error('Error al guardar calculadora:', error);
        showError('Error al guardar calculadora: ' + error.message);
    }
}

/**
 * Mostrar modal para ingresar nombre al guardar
 */
function mostrarModalGuardarCalculadora(datos) {
    // Crear modal
    const modal = document.createElement('div');
    modal.id = 'modalGuardarCalculadora';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    const modalContent = document.createElement('div');
    modalContent.className = 'card';
    modalContent.style.cssText = `
        max-width: 500px;
        width: 90%;
    `;

    modalContent.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border-color);">
            <h2 style="font-size: 20px; font-weight: 500; margin: 0;">Guardar Calculadora</h2>
            <button onclick="cerrarModalGuardarCalculadora()" style="background: none; border: none; cursor: pointer; padding: 8px; border-radius: 50%; transition: background 0.2s;" onmouseover="this.style.background='#f1f3f4'" onmouseout="this.style.background='transparent'">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            </button>
        </div>
        <div style="margin-bottom: 24px;">
            <label class="form-label" style="display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500;">Nombre de la calculadora</label>
            <input type="text" id="nombreCalculadoraInput" class="input" placeholder="Ej: Calculadora TX26 - Enero 2024" style="width: 100%;" autofocus />
        </div>
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button class="btn" onclick="cerrarModalGuardarCalculadora()">Cancelar</button>
            <button class="btn btn-primary" onclick="confirmarGuardarCalculadora()">Guardar</button>
        </div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Guardar datos en el modal para usarlos después
    modal.dataset.datos = JSON.stringify(datos);

    // Cerrar al hacer clic fuera del modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            cerrarModalGuardarCalculadora();
        }
    });

    // Guardar al presionar Enter
    const input = modalContent.querySelector('#nombreCalculadoraInput');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                confirmarGuardarCalculadora();
            }
        });
        input.focus();
    }
}

/**
 * Cerrar modal de guardar calculadora
 */
function cerrarModalGuardarCalculadora() {
    const modal = document.getElementById('modalGuardarCalculadora');
    if (modal) {
        modal.remove();
    }
}

/**
 * Confirmar y guardar calculadora
 */
async function confirmarGuardarCalculadora() {
    try {
        const modal = document.getElementById('modalGuardarCalculadora');
        if (!modal) return;

        const nombreInput = document.getElementById('nombreCalculadoraInput');
        const nombre = nombreInput?.value?.trim();

        if (!nombre || nombre === '') {
            showError('Por favor ingrese un nombre para la calculadora');
            return;
        }

        // Obtener datos guardados en el modal
        const datos = JSON.parse(modal.dataset.datos || '{}');

        // Preparar datos para enviar
        const datosEnvio = {
            nombre: nombre,
            ...datos
        };

        const response = await fetch('/api/calculadoras/guardar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(datosEnvio)
        });

        const result = await response.json();

        if (result.success) {
            cerrarModalGuardarCalculadora();
            showSuccess('Calculadora guardada exitosamente');
        } else {
            showError(result.error || 'Error al guardar calculadora');
        }

    } catch (error) {
        console.error('Error al confirmar guardar calculadora:', error);
        showError('Error al guardar calculadora: ' + error.message);
    }
}

/**
 * Cargar lista de calculadoras guardadas
 */
async function cargarCalculadora() {
    try {
        // Obtener lista de calculadoras
        const response = await fetch('/api/calculadoras');

        if (!response.ok) {
            throw new Error('Error al obtener calculadoras');
        }

        const result = await response.json();

        if (!result.success) {
            showError(result.error || 'Error al obtener calculadoras');
            return;
        }

        if (!result.calculadoras || result.calculadoras.length === 0) {
            showError('No hay calculadoras guardadas');
            return;
        }

        // Mostrar modal con lista de calculadoras
        mostrarModalCalculadoras(result.calculadoras);

    } catch (error) {
        console.error('Error al cargar calculadoras:', error);
        showError('Error al cargar calculadoras: ' + error.message);
    }
}

/**
 * Mostrar modal con lista de calculadoras
 */
function mostrarModalCalculadoras(calculadoras) {
    // Crear modal
    const modal = document.createElement('div');
    modal.id = 'modalCalculadoras';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    const modalContent = document.createElement('div');
    modalContent.className = 'card';
    modalContent.style.cssText = `
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
    `;

    modalContent.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border-color);">
            <h2 style="font-size: 20px; font-weight: 500; margin: 0;">Cargar Calculadora</h2>
            <button onclick="cerrarModalCalculadoras()" style="background: none; border: none; cursor: pointer; padding: 8px; border-radius: 50%; transition: background 0.2s;" onmouseover="this.style.background='#f1f3f4'" onmouseout="this.style.background='transparent'">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
            </button>
        </div>
        <div id="listaCalculadoras" style="min-height: 200px;">
            ${calculadoras.map(calc => `
                <div style="padding: 16px; border-bottom: 1px solid var(--border-color); cursor: pointer; transition: background 0.2s;" 
                     onmouseover="this.style.background='#f1f3f4'" 
                     onmouseout="this.style.background='white'"
                     onclick="seleccionarCalculadora(${calc.id})">
                    <div style="font-weight: 500; margin-bottom: 4px;">${calc.nombre}</div>
                    <div style="font-size: 12px; color: var(--text-secondary);">
                        Creada: ${new Date(calc.fecha_creacion).toLocaleString('es-AR')}
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Cerrar al hacer clic fuera del modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            cerrarModalCalculadoras();
        }
    });
}

/**
 * Cerrar modal de calculadoras
 */
function cerrarModalCalculadoras() {
    const modal = document.getElementById('modalCalculadoras');
    if (modal) {
        modal.remove();
    }
}

/**
 * Seleccionar y cargar una calculadora
 */
async function seleccionarCalculadora(id) {
    try {
        const response = await fetch(`/api/calculadoras/${id}`);
        const result = await response.json();

        if (!result.success) {
            showError(result.error || 'Error al cargar calculadora');
            return;
        }

        const calculadora = result.calculadora;

        // Llenar formulario con los datos
        if (calculadora.fechaCompra) {
            document.getElementById('fechaCompra').value = calculadora.fechaCompra;
        }
        if (calculadora.precioCompra) {
            document.getElementById('precioCompra').value = calculadora.precioCompra;
        }
        if (calculadora.cantidadPartida) {
            document.getElementById('cantidadPartida').value = calculadora.cantidadPartida;
        }
        if (calculadora.ticker) {
            document.getElementById('ticker').value = calculadora.ticker;
        }
        if (calculadora.tasa) {
            document.getElementById('tasa').value = calculadora.tasa;
        }
        if (calculadora.formula) {
            document.getElementById('formula').value = calculadora.formula;
        }
        if (calculadora.rentaTNA) {
            document.getElementById('rentaTNA').value = calculadora.rentaTNA;
        }
        if (calculadora.spread) {
            document.getElementById('spread').value = calculadora.spread;
        }
        if (calculadora.tipoInteresDias !== null && calculadora.tipoInteresDias !== undefined) {
            document.getElementById('tipoInteresDias').value = calculadora.tipoInteresDias;
        }
        if (calculadora.fechaEmision) {
            document.getElementById('fechaEmision').value = calculadora.fechaEmision;
        }
        if (calculadora.fechaPrimeraRenta) {
            document.getElementById('fechaPrimeraRenta').value = calculadora.fechaPrimeraRenta;
        }
        if (calculadora.diasRestarFechaFinDev !== null && calculadora.diasRestarFechaFinDev !== undefined) {
            document.getElementById('diasRestarFechaFinDev').value = calculadora.diasRestarFechaFinDev;
        }
        if (calculadora.fechaAmortizacion) {
            document.getElementById('fechaAmortizacion').value = calculadora.fechaAmortizacion;
        }
        if (calculadora.porcentajeAmortizacion) {
            document.getElementById('porcentajeAmortizacion').value = calculadora.porcentajeAmortizacion;
        }
        if (calculadora.periodicidad) {
            document.getElementById('periodicidad').value = calculadora.periodicidad;
        }
        if (calculadora.intervaloInicio !== null && calculadora.intervaloInicio !== undefined) {
            document.getElementById('intervaloInicio').value = calculadora.intervaloInicio;
        }
        if (calculadora.intervaloFin !== null && calculadora.intervaloFin !== undefined) {
            document.getElementById('intervaloFin').value = calculadora.intervaloFin;
        }
        if (calculadora.ajusteCER !== null && calculadora.ajusteCER !== undefined) {
            document.getElementById('ajusteCER').checked = calculadora.ajusteCER;
        }

        cerrarModalCalculadoras();
        showSuccess('Calculadora cargada exitosamente');

    } catch (error) {
        console.error('Error al seleccionar calculadora:', error);
        showError('Error al cargar calculadora: ' + error.message);
    }
}

// Inicializar máscaras de fecha para la página de calculadora
document.addEventListener('DOMContentLoaded', () => {
    // Aplicar máscara a todos los inputs de fecha en la calculadora
    const fechaInputs = [
        'fechaCompra',
        'fechaEmision',
        'fechaPrimeraRenta',
        'fechaAmortizacion',
        'fechaValuacion'
    ];
    
    fechaInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            // Usar separador / para inputs de calculadora
            aplicarMascaraFecha(input, '/');
        }
    });
    
    // Aplicar máscara DD/MM para fechaPrimeraRenta
    const fechaPrimeraRentaInput = document.getElementById('fechaPrimeraRenta');
    if (fechaPrimeraRentaInput) {
        aplicarMascaraFechaDDMM(fechaPrimeraRentaInput);
    }
});

