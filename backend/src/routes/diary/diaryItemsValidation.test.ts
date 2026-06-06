import { describe, expect, it } from 'vitest';
import {
  addActivitySchema,
  addDelaySchema,
  addDeliverySchema,
  addEventSchema,
  addPersonnelSchema,
  addPlantSchema,
  addVisitorSchema,
} from './diaryItemsValidation.js';

describe('diary item validation schemas', () => {
  it('normalizes required and optional personnel text fields', () => {
    const parsed = addPersonnelSchema.parse({
      name: '  Riley ',
      company: '  Civil Co ',
      role: '  Leading Hand ',
      startTime: ' 07:00 ',
      finishTime: '15:30',
      hours: 8.5,
      lotId: ' lot-1 ',
    });

    expect(parsed).toEqual({
      name: 'Riley',
      company: 'Civil Co',
      role: 'Leading Hand',
      startTime: '07:00',
      finishTime: '15:30',
      hours: 8.5,
      lotId: 'lot-1',
    });
  });

  it('preserves existing time and daily-hour validation messages', () => {
    const timeResult = addPersonnelSchema.safeParse({ name: 'Riley', startTime: '7am' });
    expect(timeResult.success).toBe(false);
    if (!timeResult.success) {
      expect(timeResult.error.issues[0]?.message).toBe('startTime must be in HH:mm format');
    }

    const hoursResult = addPlantSchema.safeParse({ description: 'Excavator', hoursOperated: 25 });
    expect(hoursResult.success).toBe(false);
    if (!hoursResult.success) {
      expect(hoursResult.error.issues[0]?.message).toBe('hoursOperated cannot exceed 24');
    }
  });

  it('validates quantities across activity and delivery schemas', () => {
    expect(addActivitySchema.parse({ description: 'Excavate', quantity: 0 }).quantity).toBe(0);
    expect(addDeliverySchema.parse({ description: 'Pipe', quantity: 12, unit: 'm' })).toMatchObject(
      {
        description: 'Pipe',
        quantity: 12,
        unit: 'm',
      },
    );

    const negativeResult = addActivitySchema.safeParse({
      description: 'Excavate',
      quantity: -1,
    });
    expect(negativeResult.success).toBe(false);
    if (!negativeResult.success) {
      expect(negativeResult.error.issues[0]?.message).toBe('quantity cannot be negative');
    }
  });

  it('keeps long-text schemas and visitor partial updates available', () => {
    expect(addDelaySchema.parse({ delayType: 'weather', description: 'Rain' })).toMatchObject({
      delayType: 'weather',
      description: 'Rain',
    });
    expect(addVisitorSchema.partial().parse({ purpose: '  inspection ' })).toEqual({
      purpose: 'inspection',
    });
  });

  it('validates supported event types', () => {
    expect(
      addEventSchema.parse({ eventType: 'safety', description: 'Toolbox talk' }),
    ).toMatchObject({
      eventType: 'safety',
      description: 'Toolbox talk',
    });

    const result = addEventSchema.safeParse({ eventType: 'meeting', description: 'Coordination' });
    expect(result.success).toBe(false);
  });
});
