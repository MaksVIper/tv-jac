const { businessNowParts, formatZonedDateTime, mysqlOffset } = require('../src/config/clock');

describe('Samara business clock', () => {
  it('formats naive datetimes in Europe/Samara, not the host timezone', () => {
    const utcNoon = new Date('2026-09-22T10:00:00.000Z');

    expect(formatZonedDateTime(utcNoon, 'Europe/Samara')).toBe('2026-09-22 14:00:00');
    expect(mysqlOffset('Europe/Samara', utcNoon)).toBe('+04:00');

    const parts = businessNowParts(utcNoon);
    expect(parts.day).toBe('2026-09-22');
    expect(parts.startOfDay).toBe('2026-09-22 00:00:00');
    expect(parts.endOfDay).toBe('2026-09-22 23:59:59');
    expect(parts.readyThreshold).toBe('2026-09-22 13:55:00');
    expect(parts.finishThreshold).toBe('2026-09-22 13:59:00');
  });
});
