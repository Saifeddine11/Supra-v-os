-- Premium commercial proposal fields for quotes (devis) and line items.
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- quotes
-- ---------------------------------------------------------------------------
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS proposal_title text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS package_name text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS project_object text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS strategic_positioning text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS commercial_recommendation text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS execution_assumptions text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS strategic_value_blocks jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS promotional_label text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS promotional_terms text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount_mode text NOT NULL DEFAULT 'fixed';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS first_month_total numeric(12,2);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS recurring_monthly_total numeric(12,2);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS commitment_months integer;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS ads_budget_note text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS maintenance_note text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS revision_policy_note text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS payment_terms text;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS include_signature_block boolean NOT NULL DEFAULT true;

ALTER TABLE quotes ALTER COLUMN template SET DEFAULT 'supra_premium_black_orange';

UPDATE quotes SET template = 'supra_premium_black_orange' WHERE template = 'classic_premium';

COMMENT ON COLUMN quotes.notes IS 'Internal notes — not shown on client PDF or portal.';
COMMENT ON COLUMN quotes.strategic_value_blocks IS 'JSON array of { title, body } for strategic value section.';
COMMENT ON COLUMN quotes.discount_mode IS 'fixed | percent — percent applied to (subtotal + tax_amount) when saving.';

-- ---------------------------------------------------------------------------
-- quote_items
-- ---------------------------------------------------------------------------
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS service_name text NOT NULL DEFAULT '';
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS detail_text text;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS strategic_explanation text;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS is_optional boolean NOT NULL DEFAULT false;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS is_recommended boolean NOT NULL DEFAULT false;

UPDATE quote_items SET service_name = COALESCE(NULLIF(trim(service_name), ''), description)
WHERE service_name IS NULL OR trim(service_name) = '';
