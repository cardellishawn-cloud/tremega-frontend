-- db/seeds/materials.sql
-- Week 5: construction materials catalog seed (electrical / plumbing / general).
-- 73 rows with realistic 2026-ish unit costs.
--
-- GENERATED FILE — do not hand-edit rows. Source of truth:
--   src/services/materials-catalog.js  ->  scripts/generate-materials-seed.js
--
-- Idempotent: deterministic UUIDs + ON CONFLICT (id) DO NOTHING.
-- The account_id column is set by the guarded block at the bottom, only when
-- the live materials table actually has that column (unprobed at week 5).

INSERT INTO materials (id, name, category, unit, unit_cost, specification) VALUES
  ('50000000-0000-4000-8000-000000000001', '14 AWG THHN Wire', 'electrical', 'spool', 45.00, '500ft spool, solid copper, 600V')
,  ('50000000-0000-4000-8000-000000000002', '12 AWG THHN Wire', 'electrical', 'spool', 65.00, '500ft spool, solid copper, 600V')
,  ('50000000-0000-4000-8000-000000000003', 'Single-Gang Outlet Box', 'electrical', 'ea', 0.45, 'Nail-on plastic new-work box, 18 cu in')
,  ('50000000-0000-4000-8000-000000000004', 'Single-Gang Switch Box', 'electrical', 'ea', 0.60, 'Nail-on plastic new-work box, 20 cu in')
,  ('50000000-0000-4000-8000-000000000005', '20A Single-Pole Breaker', 'electrical', 'ea', 8.50, '120V plug-in circuit breaker')
,  ('50000000-0000-4000-8000-000000000006', '30A Single-Pole Breaker', 'electrical', 'ea', 12.00, '120V plug-in circuit breaker')
,  ('50000000-0000-4000-8000-000000000007', '15A Single-Pole Breaker', 'electrical', 'ea', 7.50, '120V plug-in circuit breaker')
,  ('50000000-0000-4000-8000-000000000008', '50A Double-Pole Breaker', 'electrical', 'ea', 18.00, '240V plug-in circuit breaker (range/EV)')
,  ('50000000-0000-4000-8000-000000000009', '200A Main Breaker Panel', 'electrical', 'ea', 145.00, '40-space 200A main breaker load center')
,  ('50000000-0000-4000-8000-000000000010', '1/2" PVC Conduit', 'electrical', 'ea', 2.50, '10ft schedule 40 PVC conduit stick')
,  ('50000000-0000-4000-8000-000000000011', '1" PVC Conduit', 'electrical', 'ea', 4.50, '10ft schedule 40 PVC conduit stick')
,  ('50000000-0000-4000-8000-000000000012', '1/2" Conduit Elbow', 'electrical', 'ea', 0.80, '90-degree schedule 40 PVC elbow')
,  ('50000000-0000-4000-8000-000000000013', 'GFCI Outlet', 'electrical', 'ea', 18.00, '20A 125V tamper-resistant GFCI receptacle')
,  ('50000000-0000-4000-8000-000000000014', 'Standard Duplex Outlet', 'electrical', 'ea', 1.20, '15A 125V tamper-resistant receptacle')
,  ('50000000-0000-4000-8000-000000000015', 'Decora Switch', 'electrical', 'ea', 2.50, '15A 120V single-pole rocker switch')
,  ('50000000-0000-4000-8000-000000000016', '3-Way Switch', 'electrical', 'ea', 4.00, '15A 120V 3-way rocker switch')
,  ('50000000-0000-4000-8000-000000000017', 'Dimmer Switch', 'electrical', 'ea', 12.00, 'LED-compatible slide dimmer, single-pole')
,  ('50000000-0000-4000-8000-000000000018', '12/2 NM-B Romex', 'electrical', 'roll', 85.00, '250ft coil, 20A branch circuits')
,  ('50000000-0000-4000-8000-000000000019', '10/3 NM-B Romex', 'electrical', 'roll', 140.00, '250ft coil, 30A dryer/range circuits')
,  ('50000000-0000-4000-8000-000000000020', 'Wire Nut Assortment', 'electrical', 'box', 6.00, '500pc assorted twist-on connectors')
,  ('50000000-0000-4000-8000-000000000021', 'Electrical Tape', 'electrical', 'ea', 3.50, '66ft vinyl, UL listed')
,  ('50000000-0000-4000-8000-000000000022', '4" LED Recessed Light', 'electrical', 'ea', 14.00, 'Dimmable retrofit downlight, 3000K')
,  ('50000000-0000-4000-8000-000000000023', 'Ceiling Light Fixture', 'electrical', 'ea', 35.00, 'Flush-mount LED ceiling fixture')
,  ('50000000-0000-4000-8000-000000000024', 'Bath Exhaust Fan', 'electrical', 'ea', 55.00, '80 CFM quiet ceiling-mount fan')
,  ('50000000-0000-4000-8000-000000000025', 'Hardwired Smoke Detector', 'electrical', 'ea', 22.00, '120V interconnect with battery backup')
,  ('50000000-0000-4000-8000-000000000026', '8ft Ground Rod', 'electrical', 'ea', 14.00, '5/8" copper-bonded grounding electrode')
,  ('50000000-0000-4000-8000-000000000027', '1/2" PVC Pipe', 'plumbing', 'ea', 3.50, '10ft schedule 40 PVC stick')
,  ('50000000-0000-4000-8000-000000000028', '3/4" PVC Pipe', 'plumbing', 'ea', 5.00, '10ft schedule 40 PVC stick')
,  ('50000000-0000-4000-8000-000000000029', '2" PVC Pipe', 'plumbing', 'ea', 8.00, '10ft schedule 40 PVC stick (drain)')
,  ('50000000-0000-4000-8000-000000000030', 'PVC Tee', 'plumbing', 'ea', 0.75, '1/2" schedule 40 slip tee')
,  ('50000000-0000-4000-8000-000000000031', 'PVC Elbow', 'plumbing', 'ea', 0.65, '1/2" schedule 40 90-degree slip elbow')
,  ('50000000-0000-4000-8000-000000000032', '2" PVC Elbow', 'plumbing', 'ea', 2.20, '2" schedule 40 90-degree elbow (drain)')
,  ('50000000-0000-4000-8000-000000000033', 'Cleanout Cap', 'plumbing', 'ea', 4.50, '4" ABS cleanout plug with cap')
,  ('50000000-0000-4000-8000-000000000034', '1/2" Shutoff Valve', 'plumbing', 'ea', 15.00, 'Quarter-turn angle stop, compression')
,  ('50000000-0000-4000-8000-000000000035', '3/4" Ball Valve', 'plumbing', 'ea', 18.00, 'Full-port brass ball valve')
,  ('50000000-0000-4000-8000-000000000036', 'Kitchen Faucet', 'plumbing', 'ea', 65.00, 'Single-handle pull-down kitchen faucet')
,  ('50000000-0000-4000-8000-000000000037', 'Bathroom Faucet', 'plumbing', 'ea', 48.00, '4" centerset single-handle lav faucet')
,  ('50000000-0000-4000-8000-000000000038', 'Shower Valve', 'plumbing', 'ea', 85.00, 'Pressure-balance tub/shower mixing valve')
,  ('50000000-0000-4000-8000-000000000039', '1/2" PEX Tubing', 'plumbing', 'roll', 28.00, '100ft coil PEX-B')
,  ('50000000-0000-4000-8000-000000000040', '3/4" PEX Tubing', 'plumbing', 'roll', 42.00, '100ft coil PEX-B')
,  ('50000000-0000-4000-8000-000000000041', 'PEX Crimp Fitting', 'plumbing', 'ea', 0.85, '1/2" brass crimp coupling')
,  ('50000000-0000-4000-8000-000000000042', 'Toilet Fill Valve', 'plumbing', 'ea', 12.00, 'Universal anti-siphon fill valve')
,  ('50000000-0000-4000-8000-000000000043', 'Toilet Wax Ring', 'plumbing', 'ea', 3.00, 'Standard wax bowl gasket')
,  ('50000000-0000-4000-8000-000000000044', 'PVC Primer', 'plumbing', 'ea', 7.00, 'Quart purple primer')
,  ('50000000-0000-4000-8000-000000000045', 'PVC Cement', 'plumbing', 'ea', 8.00, 'Quart medium-body solvent cement')
,  ('50000000-0000-4000-8000-000000000046', 'Drain Trap Kit', 'plumbing', 'ea', 9.00, '1-1/2" P-trap with slip nuts')
,  ('50000000-0000-4000-8000-000000000047', '20" Supply Line', 'plumbing', 'ea', 6.00, 'Braided stainless faucet supply line')
,  ('50000000-0000-4000-8000-000000000048', '50gal Water Heater', 'plumbing', 'ea', 550.00, 'Electric, 4500W, 6-year tank')
,  ('50000000-0000-4000-8000-000000000049', 'Garbage Disposal', 'plumbing', 'ea', 95.00, '1/2 HP continuous-feed')
,  ('50000000-0000-4000-8000-000000000050', 'Hose Bib', 'plumbing', 'ea', 14.00, 'Frost-free 1/2" x 6" sillcock')
,  ('50000000-0000-4000-8000-000000000051', '2x4x8 Stud', 'general', 'ea', 6.50, 'Kiln-dried SPF framing lumber')
,  ('50000000-0000-4000-8000-000000000052', '2x6x8 Lumber', 'general', 'ea', 9.50, 'Kiln-dried SPF framing lumber')
,  ('50000000-0000-4000-8000-000000000053', '3/4" Plywood Sheet', 'general', 'ea', 48.00, '4x8 CDX sheathing')
,  ('50000000-0000-4000-8000-000000000054', '4x8 Drywall Sheet', 'general', 'ea', 14.00, '1/2" gypsum wallboard')
,  ('50000000-0000-4000-8000-000000000055', 'Joint Compound', 'general', 'ea', 22.00, '5gal all-purpose pre-mixed mud')
,  ('50000000-0000-4000-8000-000000000056', 'Drywall Screws', 'general', 'box', 28.00, '25lb #6 x 1-1/4" coarse thread')
,  ('50000000-0000-4000-8000-000000000057', 'Exterior Paint', 'general', 'gal', 35.00, 'Acrylic latex, satin finish')
,  ('50000000-0000-4000-8000-000000000058', 'Interior Paint', 'general', 'gal', 28.00, 'Acrylic latex, eggshell finish')
,  ('50000000-0000-4000-8000-000000000059', 'R-13 Insulation Batt', 'general', 'bag', 65.00, 'Kraft-faced fiberglass, 15" x 93" (bag of 11)')
,  ('50000000-0000-4000-8000-000000000060', 'Deck Screws', 'general', 'box', 32.00, '5lb #8 x 2-1/2" coated exterior')
,  ('50000000-0000-4000-8000-000000000061', 'Framing Nails', 'general', 'box', 38.00, '21lb 16d bright common')
,  ('50000000-0000-4000-8000-000000000062', 'Roofing Shingles', 'general', 'bundle', 38.00, 'Architectural asphalt, 33.3 sqft/bundle')
,  ('50000000-0000-4000-8000-000000000063', 'Roofing Felt', 'general', 'roll', 25.00, '#30 asphalt saturated felt, 216 sqft')
,  ('50000000-0000-4000-8000-000000000064', 'Roofing Nails', 'general', 'box', 18.00, '5lb 1-1/4" galvanized coil nails')
,  ('50000000-0000-4000-8000-000000000065', 'Concrete Mix', 'general', 'bag', 6.25, '80lb high-strength 4000 PSI')
,  ('50000000-0000-4000-8000-000000000066', 'Rebar #4', 'general', 'ea', 8.00, '10ft grade 60 steel rebar')
,  ('50000000-0000-4000-8000-000000000067', 'Construction Adhesive', 'general', 'ea', 5.00, '28oz subfloor/panel adhesive')
,  ('50000000-0000-4000-8000-000000000068', 'Painter''s Tape', 'general', 'ea', 7.00, '1.88" x 60yd blue multi-surface')
,  ('50000000-0000-4000-8000-000000000069', 'Drop Cloth', 'general', 'ea', 12.00, '9x12 canvas, 8oz')
,  ('50000000-0000-4000-8000-000000000070', 'Interior Door Slab', 'general', 'ea', 85.00, '30" 6-panel hollow-core prehung-ready')
,  ('50000000-0000-4000-8000-000000000071', 'Baseboard Trim', 'general', 'ea', 9.00, '8ft primed MDF colonial')
,  ('50000000-0000-4000-8000-000000000072', 'Drywall Corner Bead', 'general', 'ea', 4.00, '8ft galvanized metal')
,  ('50000000-0000-4000-8000-000000000073', 'Drywall Mesh Tape', 'general', 'ea', 6.00, '2" x 300ft self-adhesive fiberglass')
ON CONFLICT (id) DO NOTHING;

-- Populate account_id when the column exists on the live table.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'account_id'
  ) THEN
    UPDATE materials
    SET account_id = '00000000-0000-0000-0000-000000000001'
    WHERE account_id IS NULL;
  END IF;
END $$;
