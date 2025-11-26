/**
 * Controlador para operaciones relacionadas con Calculadoras guardadas
 */

const pool = require('../config/database');

const calculadorasController = {
    /**
     * Guardar calculadora en BD
     */
    guardarCalculadora: async (req, res) => {
        try {
            if (!pool) {
                return res.status(503).json({
                    success: false,
                    error: 'Base de datos no configurada'
                });
            }

            const {
                nombre,
                fechaCompra,
                precioCompra,
                cantidadPartida,
                ticker,
                tasa,
                formula,
                rentaTNA,
                spread,
                tipoInteresDias,
                fechaEmision,
                fechaPrimeraRenta,
                diasRestarFechaFinDev,
                fechaAmortizacion,
                porcentajeAmortizacion,
                periodicidad,
                intervaloInicio,
                intervaloFin,
                ajusteCER
            } = req.body;

            // Validar campos requeridos
            if (!nombre || nombre.trim() === '') {
                return res.status(400).json({
                    success: false,
                    error: 'El nombre de la calculadora es requerido'
                });
            }

            // Convertir fechaCompra de DD/MM/AAAA a YYYY-MM-DD si es necesario
            let fechaCompraFormato = null;
            if (fechaCompra) {
                if (/^\d{2}[-\/]\d{2}[-\/]\d{4}$/.test(fechaCompra)) {
                    const partes = fechaCompra.split(/[-\/]/);
                    fechaCompraFormato = `${partes[2]}-${partes[1]}-${partes[0]}`;
                } else {
                    fechaCompraFormato = fechaCompra;
                }
            }

            // Convertir fechaEmision de DD/MM/AAAA a YYYY-MM-DD si es necesario
            let fechaEmisionFormato = null;
            if (fechaEmision) {
                if (/^\d{2}[-\/]\d{2}[-\/]\d{4}$/.test(fechaEmision)) {
                    const partes = fechaEmision.split(/[-\/]/);
                    fechaEmisionFormato = `${partes[2]}-${partes[1]}-${partes[0]}`;
                } else {
                    fechaEmisionFormato = fechaEmision;
                }
            }

            // Convertir fechaAmortizacion de DD/MM/AAAA a YYYY-MM-DD si es necesario
            let fechaAmortizacionFormato = null;
            if (fechaAmortizacion) {
                if (/^\d{2}[-\/]\d{2}[-\/]\d{4}$/.test(fechaAmortizacion)) {
                    const partes = fechaAmortizacion.split(/[-\/]/);
                    fechaAmortizacionFormato = `${partes[2]}-${partes[1]}-${partes[0]}`;
                } else {
                    fechaAmortizacionFormato = fechaAmortizacion;
                }
            }

            const query = `
                INSERT INTO calculadoras (
                    nombre, fecha_compra, precio_compra, cantidad_partida,
                    ticker, tasa, formula, renta_tna, spread, tipo_interes_dias,
                    fecha_emision, fecha_primera_renta, dias_restar_fecha_fin_dev,
                    fecha_amortizacion, porcentaje_amortizacion, periodicidad,
                    intervalo_inicio, intervalo_fin, ajuste_cer
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
                RETURNING id, nombre, fecha_creacion
            `;

            const result = await pool.query(query, [
                nombre.trim(),
                fechaCompraFormato,
                precioCompra || null,
                cantidadPartida || null,
                ticker || null,
                tasa || null,
                formula || null,
                rentaTNA || null,
                spread || null,
                tipoInteresDias !== undefined ? tipoInteresDias : null,
                fechaEmisionFormato,
                fechaPrimeraRenta || null,
                diasRestarFechaFinDev !== undefined ? diasRestarFechaFinDev : -1,
                fechaAmortizacionFormato,
                porcentajeAmortizacion || null,
                periodicidad || null,
                intervaloInicio || null,
                intervaloFin || null,
                ajusteCER === true || ajusteCER === 'true'
            ]);

            res.json({
                success: true,
                calculadora: result.rows[0],
                message: 'Calculadora guardada exitosamente'
            });

        } catch (error) {
            console.error('Error al guardar calculadora:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Error al guardar calculadora'
            });
        }
    },

    /**
     * Obtener lista de calculadoras guardadas
     */
    obtenerCalculadoras: async (req, res) => {
        try {
            if (!pool) {
                return res.status(503).json({
                    success: false,
                    error: 'Base de datos no configurada'
                });
            }

            const result = await pool.query(
                'SELECT id, nombre, fecha_creacion, fecha_actualizacion FROM calculadoras ORDER BY fecha_creacion DESC'
            );

            res.json({
                success: true,
                calculadoras: result.rows
            });

        } catch (error) {
            console.error('Error al obtener calculadoras:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Error al obtener calculadoras'
            });
        }
    },

    /**
     * Cargar una calculadora específica por ID
     */
    cargarCalculadora: async (req, res) => {
        try {
            if (!pool) {
                return res.status(503).json({
                    success: false,
                    error: 'Base de datos no configurada'
                });
            }

            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de calculadora requerido'
                });
            }

            const result = await pool.query(
                'SELECT * FROM calculadoras WHERE id = $1',
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Calculadora no encontrada'
                });
            }

            const calculadora = result.rows[0];

            // Convertir fechas de YYYY-MM-DD a DD/MM/AAAA
            const convertirFecha = (fecha) => {
                if (!fecha) return null;
                const partes = fecha.toISOString().split('T')[0].split('-');
                return `${partes[2]}/${partes[1]}/${partes[0]}`;
            };

            res.json({
                success: true,
                calculadora: {
                    id: calculadora.id,
                    nombre: calculadora.nombre,
                    // Datos Partida
                    fechaCompra: convertirFecha(calculadora.fecha_compra),
                    precioCompra: calculadora.precio_compra,
                    cantidadPartida: calculadora.cantidad_partida,
                    // Datos Especie
                    ticker: calculadora.ticker,
                    tasa: calculadora.tasa,
                    formula: calculadora.formula,
                    rentaTNA: calculadora.renta_tna,
                    spread: calculadora.spread,
                    tipoInteresDias: calculadora.tipo_interes_dias,
                    fechaEmision: convertirFecha(calculadora.fecha_emision),
                    fechaPrimeraRenta: calculadora.fecha_primera_renta,
                    diasRestarFechaFinDev: calculadora.dias_restar_fecha_fin_dev,
                    fechaAmortizacion: convertirFecha(calculadora.fecha_amortizacion),
                    porcentajeAmortizacion: calculadora.porcentaje_amortizacion,
                    periodicidad: calculadora.periodicidad,
                    intervaloInicio: calculadora.intervalo_inicio,
                    intervaloFin: calculadora.intervalo_fin,
                    ajusteCER: calculadora.ajuste_cer
                }
            });

        } catch (error) {
            console.error('Error al cargar calculadora:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Error al cargar calculadora'
            });
        }
    }
};

module.exports = calculadorasController;

