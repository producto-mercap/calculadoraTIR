/**
 * Gestión de la tabla de cupones
 * 
 * NOTA: Este archivo mantiene compatibilidad con el código existente.
 * La lógica compleja está en calculadora/cupones/ para facilitar mantenimiento.
 */

/**
 * Función principal para cargar cupones (llamada desde el botón)
 */
async function cargarCupones() {
    if (typeof window.autocompletarCupones === 'function') {
        await window.autocompletarCupones();
    } else {
        console.error('La función autocompletarCupones no está disponible');
        if (typeof showError === 'function') {
            showError('Error: No se pudo cargar la función de autocompletado');
        }
    }
}

