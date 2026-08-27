/**
 * Configurable field-quote catalog (materials, conditional questions, waste defaults).
 * Add options here without changing wizard UI structure.
 */

export const PROJECT_TYPES = [
  { id: 'demolition', label: 'Demolition', color: '#dc2626', short: 'Demo' },
  { id: 'installation', label: 'Installation', color: '#2563eb', short: 'Install' },
  { id: 'sanding', label: 'Sand & Refinish', color: '#ca8a04', short: 'Sand' },
];

export const ROOM_NAME_OPTIONS = [
  'Living Room',
  'Kitchen',
  'Bedroom 1',
  'Bedroom 2',
  'Bedroom 3',
  'Hallway',
  'Stairs',
  'Closet',
  'Bathroom',
  'Dining Room',
  'Basement',
  'Other',
];

export const MATERIALS = [
  { id: 'carpet', label: 'Carpet' },
  { id: 'solid_hardwood', label: 'Solid Hardwood' },
  { id: 'engineered_wood', label: 'Engineered Wood' },
  { id: 'lvp', label: 'LVP (Luxury Vinyl Plank)' },
  { id: 'laminate', label: 'Laminate' },
  { id: 'tile', label: 'Tile / Porcelain' },
  { id: 'cork', label: 'Cork' },
  { id: 'other', label: 'Other' },
];

/** Default waste % by pattern / material family. Seller can override per room service. */
export const WASTE_DEFAULTS = {
  install_straight: 10,
  install_diagonal: 15,
  install_herringbone: 20,
  install_chevron: 20,
  tile: 12,
  carpet: 8,
  demolition: 0,
  sanding: 0,
  default: 10,
};

export const SANDING_SERVICE_TYPES = [
  { id: 'screen_coat', label: 'Screen & Coat (buff and recoat)' },
  { id: 'sand_finish', label: 'Sand & Finish (full)' },
  { id: 'stain', label: 'Stain / color change' },
  { id: 'spot_repair', label: 'Spot repair' },
];

/**
 * Conditional question defs.
 * `when.materialIds` / `when.sandingTypes` gate visibility.
 * `scope`: 'material' | 'general'
 */
export const QUESTIONS = {
  demolition: [
    {
      id: 'existing_materials',
      scope: 'general',
      type: 'multi',
      label: 'Existing material(s) to remove',
      options: MATERIALS.map((m) => ({ id: m.id, label: m.label })),
      allowCustom: true,
    },
    {
      id: 'carpet_pad',
      scope: 'material',
      when: { materialIds: ['carpet'] },
      type: 'boolean',
      label: 'Pad / underlayment to remove?',
    },
    {
      id: 'carpet_tack_strip',
      scope: 'material',
      when: { materialIds: ['carpet'] },
      type: 'boolean',
      label: 'Tack strip to remove?',
    },
    {
      id: 'carpet_staples',
      scope: 'material',
      when: { materialIds: ['carpet'] },
      type: 'boolean',
      label: 'Staples in concrete?',
    },
    {
      id: 'wood_fastening',
      scope: 'material',
      when: { materialIds: ['solid_hardwood', 'engineered_wood', 'laminate'] },
      type: 'select',
      label: 'Current fastening method',
      options: [
        { id: 'glued', label: 'Glued' },
        { id: 'nailed', label: 'Nailed' },
        { id: 'floating', label: 'Floating / click' },
      ],
    },
    {
      id: 'wood_layers',
      scope: 'material',
      when: { materialIds: ['solid_hardwood', 'engineered_wood', 'laminate'] },
      type: 'number',
      label: 'How many flooring layers stacked?',
      min: 1,
      max: 5,
    },
    {
      id: 'tile_thinset',
      scope: 'material',
      when: { materialIds: ['tile'] },
      type: 'boolean',
      label: 'Thinset to remove from subfloor?',
    },
    {
      id: 'tile_cement_subfloor',
      scope: 'material',
      when: { materialIds: ['tile'] },
      type: 'boolean',
      label: 'Subfloor is cement?',
    },
    {
      id: 'haul_away',
      scope: 'general',
      type: 'boolean',
      label: 'Haul away / disposal included?',
    },
    {
      id: 'haul_yards',
      scope: 'general',
      whenAnswers: { haul_away: true },
      type: 'text',
      label: 'Dumpster / yards estimate',
    },
    {
      id: 'remove_baseboard',
      scope: 'general',
      type: 'boolean',
      label: 'Baseboard removal?',
    },
    {
      id: 'subfloor_notes',
      scope: 'general',
      type: 'textarea',
      label: 'Subfloor condition after demo (notes)',
    },
  ],
  installation: [
    {
      id: 'install_material',
      scope: 'general',
      type: 'select',
      label: 'Material to install',
      options: MATERIALS.filter((m) => m.id !== 'cork').map((m) => ({ id: m.id, label: m.label })),
      allowCustom: true,
    },
    {
      id: 'carpet_pad_type',
      scope: 'material',
      when: { materialIds: ['carpet'] },
      type: 'text',
      label: 'Pad type / density',
    },
    {
      id: 'carpet_method',
      scope: 'material',
      when: { materialIds: ['carpet'] },
      type: 'select',
      label: 'Install method',
      options: [{ id: 'stretch_in', label: 'Stretch-in' }],
    },
    {
      id: 'carpet_stairs',
      scope: 'material',
      when: { materialIds: ['carpet'] },
      type: 'boolean',
      label: 'Includes stairs?',
    },
    {
      id: 'wood_method',
      scope: 'material',
      when: { materialIds: ['solid_hardwood', 'engineered_wood'] },
      type: 'select',
      label: 'Install method',
      options: [
        { id: 'nailed', label: 'Nailed' },
        { id: 'glued', label: 'Glued' },
        { id: 'floating', label: 'Floating' },
      ],
    },
    {
      id: 'wood_pattern',
      scope: 'material',
      when: { materialIds: ['solid_hardwood', 'engineered_wood'] },
      type: 'select',
      label: 'Pattern',
      options: [
        { id: 'straight', label: 'Straight' },
        { id: 'diagonal', label: 'Diagonal' },
        { id: 'herringbone', label: 'Herringbone' },
        { id: 'chevron', label: 'Chevron' },
      ],
    },
    {
      id: 'board_width',
      scope: 'material',
      when: { materialIds: ['solid_hardwood', 'engineered_wood'] },
      type: 'text',
      label: 'Board width',
    },
    {
      id: 'install_direction',
      scope: 'material',
      when: { materialIds: ['solid_hardwood', 'engineered_wood'] },
      type: 'text',
      label: 'Install direction vs rooms',
    },
    {
      id: 'moisture_barrier',
      scope: 'material',
      when: { materialIds: ['solid_hardwood', 'engineered_wood'] },
      type: 'boolean',
      label: 'Moisture barrier needed?',
    },
    {
      id: 'lvp_method',
      scope: 'material',
      when: { materialIds: ['lvp'] },
      type: 'select',
      label: 'LVP method',
      options: [
        { id: 'click', label: 'Click / floating' },
        { id: 'glue_down', label: 'Glue-down' },
      ],
    },
    {
      id: 'lvp_underlayment',
      scope: 'material',
      when: { materialIds: ['lvp'] },
      type: 'boolean',
      label: 'Underlayment included?',
    },
    {
      id: 'laminate_underlayment',
      scope: 'material',
      when: { materialIds: ['laminate'] },
      type: 'boolean',
      label: 'Underlayment + moisture barrier included?',
    },
    {
      id: 'tile_size',
      scope: 'material',
      when: { materialIds: ['tile'] },
      type: 'text',
      label: 'Tile size',
    },
    {
      id: 'tile_pattern',
      scope: 'material',
      when: { materialIds: ['tile'] },
      type: 'text',
      label: 'Layout pattern',
    },
    {
      id: 'grout_color',
      scope: 'material',
      when: { materialIds: ['tile'] },
      type: 'text',
      label: 'Grout color',
    },
    {
      id: 'waterproof_membrane',
      scope: 'material',
      when: { materialIds: ['tile'] },
      type: 'boolean',
      label: 'Waterproofing membrane (wet areas)?',
    },
    {
      id: 'subfloor_prep',
      scope: 'general',
      type: 'boolean',
      label: 'Subfloor prep (leveling / self-leveling)?',
    },
    {
      id: 'transitions',
      scope: 'general',
      type: 'text',
      label: 'Transition strips (qty / room boundaries)',
    },
    {
      id: 'baseboard_install',
      scope: 'general',
      type: 'boolean',
      label: 'Baseboard / quarter round included?',
    },
    {
      id: 'furniture_move',
      scope: 'general',
      type: 'boolean',
      label: 'Furniture removal & reset included?',
    },
    {
      id: 'stairs_qty',
      scope: 'general',
      type: 'number',
      label: 'Stairs (quantity)',
      min: 0,
    },
    {
      id: 'stairs_finish',
      scope: 'general',
      type: 'text',
      label: 'Stairs finish notes',
    },
  ],
  sanding: [
    {
      id: 'sanding_type',
      scope: 'general',
      type: 'select',
      label: 'Sanding service type',
      options: SANDING_SERVICE_TYPES.map((s) => ({ id: s.id, label: s.label })),
    },
    {
      id: 'coats',
      scope: 'material',
      when: { sandingTypes: ['sand_finish', 'screen_coat'] },
      type: 'number',
      label: 'Number of finish coats',
      min: 1,
      max: 5,
    },
    {
      id: 'finish_type',
      scope: 'material',
      when: { sandingTypes: ['sand_finish'] },
      type: 'select',
      label: 'Finish type',
      options: [
        { id: 'oil', label: 'Oil-based' },
        { id: 'water', label: 'Water-based' },
      ],
    },
    {
      id: 'sheen',
      scope: 'material',
      when: { sandingTypes: ['sand_finish'] },
      type: 'select',
      label: 'Sheen',
      options: [
        { id: 'matte', label: 'Matte' },
        { id: 'satin', label: 'Satin' },
        { id: 'semi_gloss', label: 'Semi-gloss' },
        { id: 'gloss', label: 'Gloss' },
      ],
    },
    {
      id: 'dustless',
      scope: 'material',
      when: { sandingTypes: ['sand_finish'] },
      type: 'boolean',
      label: 'Dustless system?',
    },
    {
      id: 'boards_repair',
      scope: 'material',
      when: { sandingTypes: ['sand_finish', 'spot_repair'] },
      type: 'number',
      label: 'Boards to repair / replace (est.)',
      min: 0,
    },
    {
      id: 'fill_gaps',
      scope: 'material',
      when: { sandingTypes: ['sand_finish'] },
      type: 'boolean',
      label: 'Fill gaps?',
    },
    {
      id: 'stain_color',
      scope: 'material',
      when: { sandingTypes: ['stain'] },
      type: 'text',
      label: 'Desired stain color / sample',
    },
    {
      id: 'stain_onsite_test',
      scope: 'material',
      when: { sandingTypes: ['stain'] },
      type: 'boolean',
      label: 'On-site color test before closing?',
    },
    {
      id: 'screen_condition',
      scope: 'material',
      when: { sandingTypes: ['screen_coat'] },
      type: 'textarea',
      label: 'Current floor condition notes',
    },
    {
      id: 'sanding_stairs',
      scope: 'general',
      type: 'boolean',
      label: 'Includes stairs?',
    },
    {
      id: 'baseboard_paint',
      scope: 'general',
      type: 'boolean',
      label: 'Baseboard paint / varnish included?',
    },
  ],
};

/** Map catalog service_type keywords → wizard project type for hybrid pricing. */
export const CATALOG_TYPE_HINTS = {
  demolition: ['demolition', 'demo', 'removal', 'tear'],
  installation: ['install', 'installation', 'hardwood', 'lvp'],
  sanding: ['sand', 'refinish', 'screen', 'recoat', 'finish'],
};

export function getPublicWizardCatalog() {
  return {
    projectTypes: PROJECT_TYPES,
    roomNames: ROOM_NAME_OPTIONS,
    materials: MATERIALS,
    wasteDefaults: WASTE_DEFAULTS,
    sandingServiceTypes: SANDING_SERVICE_TYPES,
    questions: QUESTIONS,
  };
}
