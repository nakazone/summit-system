/**
 * Field-quote area + waste math (shared business rules).
 */
import { WASTE_DEFAULTS } from './wizardCatalog.js';

export function roomSqft(room) {
  if (!room) return 0;
  const direct = Number(room.sqft);
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct * 100) / 100;
  const length = Number(room.length_ft);
  const width = Number(room.width_ft);
  if (Number.isFinite(length) && Number.isFinite(width) && length > 0 && width > 0) {
    return Math.round(length * width * 100) / 100;
  }
  return 0;
}

export function defaultWasteFactor({ serviceType, materialId, pattern } = {}) {
  const svc = String(serviceType || '').toLowerCase();
  if (svc === 'demolition') return WASTE_DEFAULTS.demolition;
  if (svc === 'sanding') return WASTE_DEFAULTS.sanding;

  const mat = String(materialId || '').toLowerCase();
  if (mat === 'carpet') return WASTE_DEFAULTS.carpet;
  if (mat === 'tile') return WASTE_DEFAULTS.tile;

  const pat = String(pattern || 'straight').toLowerCase();
  if (pat === 'diagonal') return WASTE_DEFAULTS.install_diagonal;
  if (pat === 'herringbone') return WASTE_DEFAULTS.install_herringbone;
  if (pat === 'chevron') return WASTE_DEFAULTS.install_chevron;
  if (pat === 'straight') return WASTE_DEFAULTS.install_straight;
  return WASTE_DEFAULTS.default;
}

export function sqftWithWaste(sqft, wastePct) {
  const area = Math.max(0, Number(sqft) || 0);
  const waste = Math.max(0, Number(wastePct) || 0);
  return Math.round(area * (1 + waste / 100) * 100) / 100;
}

/**
 * @param {Array<{ id?: string, name?: string, sqft?: number, length_ft?: number, width_ft?: number, services?: Array }>} rooms
 * services: { type, materialId, pattern, waste_factor? }
 */
export function summarizeRooms(rooms) {
  const list = Array.isArray(rooms) ? rooms : [];
  const byService = {
    demolition: { sqft: 0, sqft_with_waste: 0, rooms: 0 },
    installation: { sqft: 0, sqft_with_waste: 0, rooms: 0 },
    sanding: { sqft: 0, sqft_with_waste: 0, rooms: 0 },
  };
  let houseSqft = 0;
  const roomRows = [];

  for (const room of list) {
    const sqft = roomSqft(room);
    houseSqft += sqft;
    const services = Array.isArray(room.services) ? room.services : [];
    const serviceRows = [];

    for (const svc of services) {
      const type = String(svc.type || svc.service_type || '').toLowerCase();
      if (!byService[type]) continue;
      const waste =
        svc.waste_factor != null && svc.waste_factor !== ''
          ? Number(svc.waste_factor)
          : defaultWasteFactor({
              serviceType: type,
              materialId: svc.material_id || svc.materialId,
              pattern: svc.pattern,
            });
      const withWaste = sqftWithWaste(sqft, waste);
      byService[type].sqft += sqft;
      byService[type].sqft_with_waste += withWaste;
      byService[type].rooms += 1;
      serviceRows.push({
        type,
        material_id: svc.material_id || svc.materialId || null,
        material_label: svc.material_label || svc.materialLabel || null,
        pattern: svc.pattern || null,
        waste_factor: waste,
        sqft,
        sqft_with_waste: withWaste,
        unit_price: svc.unit_price != null ? Number(svc.unit_price) : null,
        catalog_id: svc.catalog_id || svc.service_catalog_id || null,
      });
    }

    roomRows.push({
      id: room.id || null,
      name: room.name || 'Room',
      sqft,
      photo_url: room.photo_url || null,
      services: serviceRows,
    });
  }

  for (const k of Object.keys(byService)) {
    byService[k].sqft = Math.round(byService[k].sqft * 100) / 100;
    byService[k].sqft_with_waste = Math.round(byService[k].sqft_with_waste * 100) / 100;
  }

  return {
    house_sqft: Math.round(houseSqft * 100) / 100,
    by_service: byService,
    rooms: roomRows,
  };
}

/** Build quote line items from room summary + optional rates. */
export function buildLineItemsFromSummary(summary, rateMap = {}) {
  const items = [];
  const labels = {
    demolition: 'Demolition',
    installation: 'Installation',
    sanding: 'Sand & Refinish',
  };
  for (const type of ['demolition', 'installation', 'sanding']) {
    const row = summary.by_service[type];
    if (!row || row.sqft_with_waste <= 0) continue;
    const rate = Number(rateMap[type]) || 0;
    items.push({
      name: labels[type],
      service_type: labels[type],
      quantity: row.sqft_with_waste,
      rate,
      unit_type: 'sq_ft',
      type: 'service',
      description: `${row.sqft} sqft + waste → ${row.sqft_with_waste} sqft`,
    });
  }
  return items;
}

/** Auto-layout rooms as proportional rectangles on a grid. */
export function autoLayoutFloorPlan(rooms, { canvasW = 800, canvasH = 600, pad = 24 } = {}) {
  const list = (Array.isArray(rooms) ? rooms : []).map((r, i) => ({
    ...r,
    id: r.id || `room_${i + 1}`,
    sqft: roomSqft(r),
  }));
  if (!list.length) return [];

  const cols = Math.ceil(Math.sqrt(list.length));
  const rows = Math.ceil(list.length / cols);
  const cellW = (canvasW - pad * (cols + 1)) / cols;
  const cellH = (canvasH - pad * (rows + 1)) / rows;
  const maxSq = Math.max(...list.map((r) => r.sqft || 1), 1);

  return list.map((r, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const scale = Math.sqrt((r.sqft || 1) / maxSq);
    const w = Math.max(80, cellW * (0.55 + 0.45 * scale));
    const h = Math.max(60, cellH * (0.55 + 0.45 * scale));
    const x = pad + col * (cellW + pad) + (cellW - w) / 2;
    const y = pad + row * (cellH + pad) + (cellH - h) / 2;
    return {
      id: r.id,
      name: r.name || `Room ${i + 1}`,
      sqft: r.sqft,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(w),
      height: Math.round(h),
      services: r.services || [],
      photo_url: r.photo_url || null,
    };
  });
}
