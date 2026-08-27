import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  roomSqft,
  defaultWasteFactor,
  sqftWithWaste,
  summarizeRooms,
  buildLineItemsFromSummary,
  autoLayoutFloorPlan,
} from './wizardCalculations.js';

describe('roomSqft', () => {
  it('uses direct sqft when set', () => {
    assert.equal(roomSqft({ sqft: 120.5 }), 120.5);
  });
  it('computes from length × width', () => {
    assert.equal(roomSqft({ length_ft: 10, width_ft: 12 }), 120);
  });
  it('prefers direct sqft over dimensions', () => {
    assert.equal(roomSqft({ sqft: 100, length_ft: 10, width_ft: 12 }), 100);
  });
});

describe('defaultWasteFactor', () => {
  it('returns 0 for demolition and sanding', () => {
    assert.equal(defaultWasteFactor({ serviceType: 'demolition' }), 0);
    assert.equal(defaultWasteFactor({ serviceType: 'sanding' }), 0);
  });
  it('uses pattern for hardwood install', () => {
    assert.equal(defaultWasteFactor({ serviceType: 'installation', pattern: 'straight' }), 10);
    assert.equal(defaultWasteFactor({ serviceType: 'installation', pattern: 'diagonal' }), 15);
    assert.equal(defaultWasteFactor({ serviceType: 'installation', pattern: 'herringbone' }), 20);
    assert.equal(defaultWasteFactor({ serviceType: 'installation', pattern: 'chevron' }), 20);
  });
  it('uses material defaults for carpet and tile', () => {
    assert.equal(defaultWasteFactor({ serviceType: 'installation', materialId: 'carpet' }), 8);
    assert.equal(defaultWasteFactor({ serviceType: 'installation', materialId: 'tile' }), 12);
  });
});

describe('sqftWithWaste', () => {
  it('applies waste percentage', () => {
    assert.equal(sqftWithWaste(100, 10), 110);
    assert.equal(sqftWithWaste(200, 15), 230);
  });
});

describe('summarizeRooms', () => {
  it('aggregates by service with editable waste', () => {
    const summary = summarizeRooms([
      {
        name: 'Living Room',
        sqft: 200,
        services: [
          { type: 'demolition', material_id: 'carpet' },
          { type: 'installation', material_id: 'lvp', pattern: 'straight' },
        ],
      },
      {
        name: 'Bedroom',
        length_ft: 10,
        width_ft: 12,
        services: [{ type: 'installation', material_id: 'lvp', waste_factor: 20 }],
      },
    ]);
    assert.equal(summary.house_sqft, 320);
    assert.equal(summary.by_service.demolition.sqft, 200);
    assert.equal(summary.by_service.demolition.sqft_with_waste, 200);
    assert.equal(summary.by_service.installation.sqft, 320);
    assert.equal(summary.by_service.installation.sqft_with_waste, 200 * 1.1 + 120 * 1.2);
  });
});

describe('buildLineItemsFromSummary', () => {
  it('creates priced lines from rates', () => {
    const summary = summarizeRooms([
      { name: 'A', sqft: 100, services: [{ type: 'installation', pattern: 'straight' }] },
    ]);
    const items = buildLineItemsFromSummary(summary, { installation: 4 });
    assert.equal(items.length, 1);
    assert.equal(items[0].quantity, 110);
    assert.equal(items[0].rate, 4);
  });
});

describe('autoLayoutFloorPlan', () => {
  it('places rooms with x/y/width/height', () => {
    const layout = autoLayoutFloorPlan([
      { name: 'A', sqft: 100 },
      { name: 'B', sqft: 200 },
    ]);
    assert.equal(layout.length, 2);
    assert.ok(layout[0].width > 0 && layout[0].height > 0);
    assert.ok(typeof layout[0].x === 'number');
  });
});
