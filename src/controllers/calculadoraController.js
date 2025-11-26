/**
 * Controlador principal de la calculadora
 * Solo maneja el renderizado de la página principal
 * Las demás operaciones están en controladores especializados:
 * - cerController.js
 * - tamarController.js
 * - badlarController.js
 * - feriadosController.js
 * - calculadorasController.js
 */

const calculadoraController = {
    /**
     * Renderiza la página principal de Calculadora
     */
    renderCalculadora: async (req, res) => {
        try {
            res.render('pages/calculadora', {
                title: 'Calculadora',
                activeMenu: 'calculadora',
                datos: []
            });
        } catch (error) {
            console.error('Error al renderizar Calculadora:', error);
            res.status(500).render('pages/404', {
                title: 'Error',
                activeMenu: ''
            });
        }
    }
};

module.exports = calculadoraController;
