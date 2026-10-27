-- ============================================================
-- Migración 020: Telemetría y Correlación de Webhooks (Resend / Proveedor)
-- Fecha: 2026-10-25
-- Descripción: Agrega proveedor_message_id a cola_envios para
-- vincular eventos de webhook (bounced, delivered, opened, clicked)
-- ============================================================

ALTER TABLE cola_envios 
  ADD COLUMN IF NOT EXISTS proveedor_message_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_cola_envios_proveedor_msg_id 
  ON cola_envios(proveedor_message_id);
