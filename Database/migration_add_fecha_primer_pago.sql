-- ============================================
-- Migración: Agregar campo fecha_primer_pago
-- ============================================
-- Este script agrega el campo fecha_primer_pago a la tabla calculadoras
-- para permitir especificar la fecha del primer pago cuando difiere
-- de la fecha calculada automáticamente desde la fecha de emisión.
-- ============================================

-- Agregar columna fecha_primer_pago
ALTER TABLE calculadoras 
ADD COLUMN IF NOT EXISTS fecha_primer_pago DATE;

-- Comentario en la columna
COMMENT ON COLUMN calculadoras.fecha_primer_pago IS 'Fecha del primer pago del cupón. Si está especificada, se usa esta fecha para construir el primer cupón en lugar de calcularla desde fecha_emision y dia_pago.';

