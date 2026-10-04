// src/services/materials-catalog.js
// Canonical materials catalog for Tremega Contractor OS Phase 1 (week 5).
//
// Single source of truth shared by:
//   - db/seeds/materials.sql      (generated from this list — do not hand-edit rows)
//   - scripts/seed-materials.js   (inserts these rows via lib/supabase)
//   - src/services/materials-service.js (offline/fallback catalog when the live
//     materials table is unreachable or empty)
//
// Prices are realistic 2026-ish US big-box / supply-house unit costs.
// IDs are deterministic so seeds and tests are idempotent
// (ON CONFLICT (id) DO NOTHING / upsert on id).

const MATERIALS = [
  // ---------- Electrical ----------
  { id: '50000000-0000-4000-8000-000000000001', name: '14 AWG THHN Wire', category: 'electrical', unit: 'spool', unit_cost: 45.00, specification: '500ft spool, solid copper, 600V' },
  { id: '50000000-0000-4000-8000-000000000002', name: '12 AWG THHN Wire', category: 'electrical', unit: 'spool', unit_cost: 65.00, specification: '500ft spool, solid copper, 600V' },
  { id: '50000000-0000-4000-8000-000000000003', name: 'Single-Gang Outlet Box', category: 'electrical', unit: 'ea', unit_cost: 0.45, specification: 'Nail-on plastic new-work box, 18 cu in' },
  { id: '50000000-0000-4000-8000-000000000004', name: 'Single-Gang Switch Box', category: 'electrical', unit: 'ea', unit_cost: 0.60, specification: 'Nail-on plastic new-work box, 20 cu in' },
  { id: '50000000-0000-4000-8000-000000000005', name: '20A Single-Pole Breaker', category: 'electrical', unit: 'ea', unit_cost: 8.50, specification: '120V plug-in circuit breaker' },
  { id: '50000000-0000-4000-8000-000000000006', name: '30A Single-Pole Breaker', category: 'electrical', unit: 'ea', unit_cost: 12.00, specification: '120V plug-in circuit breaker' },
  { id: '50000000-0000-4000-8000-000000000007', name: '15A Single-Pole Breaker', category: 'electrical', unit: 'ea', unit_cost: 7.50, specification: '120V plug-in circuit breaker' },
  { id: '50000000-0000-4000-8000-000000000008', name: '50A Double-Pole Breaker', category: 'electrical', unit: 'ea', unit_cost: 18.00, specification: '240V plug-in circuit breaker (range/EV)' },
  { id: '50000000-0000-4000-8000-000000000009', name: '200A Main Breaker Panel', category: 'electrical', unit: 'ea', unit_cost: 145.00, specification: '40-space 200A main breaker load center' },
  { id: '50000000-0000-4000-8000-000000000010', name: '1/2" PVC Conduit', category: 'electrical', unit: 'ea', unit_cost: 2.50, specification: '10ft schedule 40 PVC conduit stick' },
  { id: '50000000-0000-4000-8000-000000000011', name: '1" PVC Conduit', category: 'electrical', unit: 'ea', unit_cost: 4.50, specification: '10ft schedule 40 PVC conduit stick' },
  { id: '50000000-0000-4000-8000-000000000012', name: '1/2" Conduit Elbow', category: 'electrical', unit: 'ea', unit_cost: 0.80, specification: '90-degree schedule 40 PVC elbow' },
  { id: '50000000-0000-4000-8000-000000000013', name: 'GFCI Outlet', category: 'electrical', unit: 'ea', unit_cost: 18.00, specification: '20A 125V tamper-resistant GFCI receptacle' },
  { id: '50000000-0000-4000-8000-000000000014', name: 'Standard Duplex Outlet', category: 'electrical', unit: 'ea', unit_cost: 1.20, specification: '15A 125V tamper-resistant receptacle' },
  { id: '50000000-0000-4000-8000-000000000015', name: 'Decora Switch', category: 'electrical', unit: 'ea', unit_cost: 2.50, specification: '15A 120V single-pole rocker switch' },
  { id: '50000000-0000-4000-8000-000000000016', name: '3-Way Switch', category: 'electrical', unit: 'ea', unit_cost: 4.00, specification: '15A 120V 3-way rocker switch' },
  { id: '50000000-0000-4000-8000-000000000017', name: 'Dimmer Switch', category: 'electrical', unit: 'ea', unit_cost: 12.00, specification: 'LED-compatible slide dimmer, single-pole' },
  { id: '50000000-0000-4000-8000-000000000018', name: '12/2 NM-B Romex', category: 'electrical', unit: 'roll', unit_cost: 85.00, specification: '250ft coil, 20A branch circuits' },
  { id: '50000000-0000-4000-8000-000000000019', name: '10/3 NM-B Romex', category: 'electrical', unit: 'roll', unit_cost: 140.00, specification: '250ft coil, 30A dryer/range circuits' },
  { id: '50000000-0000-4000-8000-000000000020', name: 'Wire Nut Assortment', category: 'electrical', unit: 'box', unit_cost: 6.00, specification: '500pc assorted twist-on connectors' },
  { id: '50000000-0000-4000-8000-000000000021', name: 'Electrical Tape', category: 'electrical', unit: 'ea', unit_cost: 3.50, specification: '66ft vinyl, UL listed' },
  { id: '50000000-0000-4000-8000-000000000022', name: '4" LED Recessed Light', category: 'electrical', unit: 'ea', unit_cost: 14.00, specification: 'Dimmable retrofit downlight, 3000K' },
  { id: '50000000-0000-4000-8000-000000000023', name: 'Ceiling Light Fixture', category: 'electrical', unit: 'ea', unit_cost: 35.00, specification: 'Flush-mount LED ceiling fixture' },
  { id: '50000000-0000-4000-8000-000000000024', name: 'Bath Exhaust Fan', category: 'electrical', unit: 'ea', unit_cost: 55.00, specification: '80 CFM quiet ceiling-mount fan' },
  { id: '50000000-0000-4000-8000-000000000025', name: 'Hardwired Smoke Detector', category: 'electrical', unit: 'ea', unit_cost: 22.00, specification: '120V interconnect with battery backup' },
  { id: '50000000-0000-4000-8000-000000000026', name: '8ft Ground Rod', category: 'electrical', unit: 'ea', unit_cost: 14.00, specification: '5/8" copper-bonded grounding electrode' },

  // ---------- Plumbing ----------
  { id: '50000000-0000-4000-8000-000000000027', name: '1/2" PVC Pipe', category: 'plumbing', unit: 'ea', unit_cost: 3.50, specification: '10ft schedule 40 PVC stick' },
  { id: '50000000-0000-4000-8000-000000000028', name: '3/4" PVC Pipe', category: 'plumbing', unit: 'ea', unit_cost: 5.00, specification: '10ft schedule 40 PVC stick' },
  { id: '50000000-0000-4000-8000-000000000029', name: '2" PVC Pipe', category: 'plumbing', unit: 'ea', unit_cost: 8.00, specification: '10ft schedule 40 PVC stick (drain)' },
  { id: '50000000-0000-4000-8000-000000000030', name: 'PVC Tee', category: 'plumbing', unit: 'ea', unit_cost: 0.75, specification: '1/2" schedule 40 slip tee' },
  { id: '50000000-0000-4000-8000-000000000031', name: 'PVC Elbow', category: 'plumbing', unit: 'ea', unit_cost: 0.65, specification: '1/2" schedule 40 90-degree slip elbow' },
  { id: '50000000-0000-4000-8000-000000000032', name: '2" PVC Elbow', category: 'plumbing', unit: 'ea', unit_cost: 2.20, specification: '2" schedule 40 90-degree elbow (drain)' },
  { id: '50000000-0000-4000-8000-000000000033', name: 'Cleanout Cap', category: 'plumbing', unit: 'ea', unit_cost: 4.50, specification: '4" ABS cleanout plug with cap' },
  { id: '50000000-0000-4000-8000-000000000034', name: '1/2" Shutoff Valve', category: 'plumbing', unit: 'ea', unit_cost: 15.00, specification: 'Quarter-turn angle stop, compression' },
  { id: '50000000-0000-4000-8000-000000000035', name: '3/4" Ball Valve', category: 'plumbing', unit: 'ea', unit_cost: 18.00, specification: 'Full-port brass ball valve' },
  { id: '50000000-0000-4000-8000-000000000036', name: 'Kitchen Faucet', category: 'plumbing', unit: 'ea', unit_cost: 65.00, specification: 'Single-handle pull-down kitchen faucet' },
  { id: '50000000-0000-4000-8000-000000000037', name: 'Bathroom Faucet', category: 'plumbing', unit: 'ea', unit_cost: 48.00, specification: '4" centerset single-handle lav faucet' },
  { id: '50000000-0000-4000-8000-000000000038', name: 'Shower Valve', category: 'plumbing', unit: 'ea', unit_cost: 85.00, specification: 'Pressure-balance tub/shower mixing valve' },
  { id: '50000000-0000-4000-8000-000000000039', name: '1/2" PEX Tubing', category: 'plumbing', unit: 'roll', unit_cost: 28.00, specification: '100ft coil PEX-B' },
  { id: '50000000-0000-4000-8000-000000000040', name: '3/4" PEX Tubing', category: 'plumbing', unit: 'roll', unit_cost: 42.00, specification: '100ft coil PEX-B' },
  { id: '50000000-0000-4000-8000-000000000041', name: 'PEX Crimp Fitting', category: 'plumbing', unit: 'ea', unit_cost: 0.85, specification: '1/2" brass crimp coupling' },
  { id: '50000000-0000-4000-8000-000000000042', name: 'Toilet Fill Valve', category: 'plumbing', unit: 'ea', unit_cost: 12.00, specification: 'Universal anti-siphon fill valve' },
  { id: '50000000-0000-4000-8000-000000000043', name: 'Toilet Wax Ring', category: 'plumbing', unit: 'ea', unit_cost: 3.00, specification: 'Standard wax bowl gasket' },
  { id: '50000000-0000-4000-8000-000000000044', name: 'PVC Primer', category: 'plumbing', unit: 'ea', unit_cost: 7.00, specification: 'Quart purple primer' },
  { id: '50000000-0000-4000-8000-000000000045', name: 'PVC Cement', category: 'plumbing', unit: 'ea', unit_cost: 8.00, specification: 'Quart medium-body solvent cement' },
  { id: '50000000-0000-4000-8000-000000000046', name: 'Drain Trap Kit', category: 'plumbing', unit: 'ea', unit_cost: 9.00, specification: '1-1/2" P-trap with slip nuts' },
  { id: '50000000-0000-4000-8000-000000000047', name: '20" Supply Line', category: 'plumbing', unit: 'ea', unit_cost: 6.00, specification: 'Braided stainless faucet supply line' },
  { id: '50000000-0000-4000-8000-000000000048', name: '50gal Water Heater', category: 'plumbing', unit: 'ea', unit_cost: 550.00, specification: 'Electric, 4500W, 6-year tank' },
  { id: '50000000-0000-4000-8000-000000000049', name: 'Garbage Disposal', category: 'plumbing', unit: 'ea', unit_cost: 95.00, specification: '1/2 HP continuous-feed' },
  { id: '50000000-0000-4000-8000-000000000050', name: 'Hose Bib', category: 'plumbing', unit: 'ea', unit_cost: 14.00, specification: 'Frost-free 1/2" x 6" sillcock' },

  // ---------- General ----------
  { id: '50000000-0000-4000-8000-000000000051', name: '2x4x8 Stud', category: 'general', unit: 'ea', unit_cost: 6.50, specification: 'Kiln-dried SPF framing lumber' },
  { id: '50000000-0000-4000-8000-000000000052', name: '2x6x8 Lumber', category: 'general', unit: 'ea', unit_cost: 9.50, specification: 'Kiln-dried SPF framing lumber' },
  { id: '50000000-0000-4000-8000-000000000053', name: '3/4" Plywood Sheet', category: 'general', unit: 'ea', unit_cost: 48.00, specification: '4x8 CDX sheathing' },
  { id: '50000000-0000-4000-8000-000000000054', name: '4x8 Drywall Sheet', category: 'general', unit: 'ea', unit_cost: 14.00, specification: '1/2" gypsum wallboard' },
  { id: '50000000-0000-4000-8000-000000000055', name: 'Joint Compound', category: 'general', unit: 'ea', unit_cost: 22.00, specification: '5gal all-purpose pre-mixed mud' },
  { id: '50000000-0000-4000-8000-000000000056', name: 'Drywall Screws', category: 'general', unit: 'box', unit_cost: 28.00, specification: '25lb #6 x 1-1/4" coarse thread' },
  { id: '50000000-0000-4000-8000-000000000057', name: 'Exterior Paint', category: 'general', unit: 'gal', unit_cost: 35.00, specification: 'Acrylic latex, satin finish' },
  { id: '50000000-0000-4000-8000-000000000058', name: 'Interior Paint', category: 'general', unit: 'gal', unit_cost: 28.00, specification: 'Acrylic latex, eggshell finish' },
  { id: '50000000-0000-4000-8000-000000000059', name: 'R-13 Insulation Batt', category: 'general', unit: 'bag', unit_cost: 65.00, specification: 'Kraft-faced fiberglass, 15" x 93" (bag of 11)' },
  { id: '50000000-0000-4000-8000-000000000060', name: 'Deck Screws', category: 'general', unit: 'box', unit_cost: 32.00, specification: '5lb #8 x 2-1/2" coated exterior' },
  { id: '50000000-0000-4000-8000-000000000061', name: 'Framing Nails', category: 'general', unit: 'box', unit_cost: 38.00, specification: '21lb 16d bright common' },
  { id: '50000000-0000-4000-8000-000000000062', name: 'Roofing Shingles', category: 'general', unit: 'bundle', unit_cost: 38.00, specification: 'Architectural asphalt, 33.3 sqft/bundle' },
  { id: '50000000-0000-4000-8000-000000000063', name: 'Roofing Felt', category: 'general', unit: 'roll', unit_cost: 25.00, specification: '#30 asphalt saturated felt, 216 sqft' },
  { id: '50000000-0000-4000-8000-000000000064', name: 'Roofing Nails', category: 'general', unit: 'box', unit_cost: 18.00, specification: '5lb 1-1/4" galvanized coil nails' },
  { id: '50000000-0000-4000-8000-000000000065', name: 'Concrete Mix', category: 'general', unit: 'bag', unit_cost: 6.25, specification: '80lb high-strength 4000 PSI' },
  { id: '50000000-0000-4000-8000-000000000066', name: 'Rebar #4', category: 'general', unit: 'ea', unit_cost: 8.00, specification: '10ft grade 60 steel rebar' },
  { id: '50000000-0000-4000-8000-000000000067', name: 'Construction Adhesive', category: 'general', unit: 'ea', unit_cost: 5.00, specification: '28oz subfloor/panel adhesive' },
  { id: '50000000-0000-4000-8000-000000000068', name: "Painter's Tape", category: 'general', unit: 'ea', unit_cost: 7.00, specification: '1.88" x 60yd blue multi-surface' },
  { id: '50000000-0000-4000-8000-000000000069', name: 'Drop Cloth', category: 'general', unit: 'ea', unit_cost: 12.00, specification: '9x12 canvas, 8oz' },
  { id: '50000000-0000-4000-8000-000000000070', name: 'Interior Door Slab', category: 'general', unit: 'ea', unit_cost: 85.00, specification: '30" 6-panel hollow-core prehung-ready' },
  { id: '50000000-0000-4000-8000-000000000071', name: 'Baseboard Trim', category: 'general', unit: 'ea', unit_cost: 9.00, specification: '8ft primed MDF colonial' },
  { id: '50000000-0000-4000-8000-000000000072', name: 'Drywall Corner Bead', category: 'general', unit: 'ea', unit_cost: 4.00, specification: '8ft galvanized metal' },
  { id: '50000000-0000-4000-8000-000000000073', name: 'Drywall Mesh Tape', category: 'general', unit: 'ea', unit_cost: 6.00, specification: '2" x 300ft self-adhesive fiberglass' },
];

module.exports = { MATERIALS };
