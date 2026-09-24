const { buildPollResponse, formatOrderId } = require('../src/services/ordersService');

describe('ordersService', () => {
  it('formats pickup and delivery identifiers like Laravel', () => {
    expect(formatOrderId({ id: 123456, type_order: 2 })).toBe('3456');
    expect(formatOrderId({ id: 123456, type_order: 3 })).toBe('456');
    expect(formatOrderId({ id: 12, type_order: 4 })).toBe('12');
  });

  it('returns newly visible orders as ready and hot', () => {
    const response = buildPollResponse({
      rows: [
        { id: 123456, type_order: 3, status_order: 4 },
        { id: 987654, type_order: 2, status_order: 5 },
      ],
      nowSeconds: 1_000,
    });

    expect(response.ready).toEqual([{ id: '456' }, { id: '7654' }]);
    expect(response.hot).toEqual(response.ready);
    expect(response.order_timestamps).toEqual({ 456: 1_000, 7654: 1_000 });
    expect(response.displayed_status_4).toEqual([123456]);
  });

  it('keeps an order for at least 180 seconds after first display', () => {
    const response = buildPollResponse({
      rows: [],
      previousOrders: ['456'],
      orderTimestamps: { 456: 900 },
      nowSeconds: 1_000,
    });

    expect(response.ready).toEqual([{ id: '456' }]);
    expect(response.hot).toEqual([]);
  });

  it('removes expired orders and their timestamps', () => {
    const response = buildPollResponse({
      rows: [],
      previousOrders: ['456'],
      orderTimestamps: { 456: 800 },
      nowSeconds: 1_000,
    });

    expect(response.ready).toEqual([]);
    expect(response.order_timestamps).toEqual({});
  });

  it('does not re-add a finished order already recorded by full id', () => {
    const response = buildPollResponse({
      rows: [{ id: 123456, type_order: 3, status_order: 6 }],
      displayedOrders: [123456],
      nowSeconds: 1_000,
    });

    expect(response.ready).toEqual([]);
  });

  it('hides completed pickup orders like the jaco tv() filter', () => {
    const response = buildPollResponse({
      rows: [{ id: 123456, type_order: 2, status_order: 6 }],
      nowSeconds: 1_000,
    });

    expect(response.ready).toEqual([]);
    expect(response.hot).toEqual([]);
  });
});
