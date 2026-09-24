const request = require('supertest');
const { createApp } = require('../src/app');

function dependencies() {
  return {
    pointsRepository: {
      getPoints: vi.fn().mockResolvedValue([{ id: 1, name: 'Москва', base: 'point_1' }]),
      getPoint: vi.fn().mockResolvedValue({ id: 1, base: 'point_1' }),
      hasTvSettings: vi.fn().mockResolvedValue(true),
    },
    ordersRepository: {
      getScreenOrders: vi.fn().mockResolvedValue([
        { id: 123456, type_order: 3, status_order: 4 },
      ]),
    },
  };
}

async function csrfAgent(app) {
  const agent = request.agent(app);
  const page = await agent.get('/tv/1').expect(200);
  const match = page.text.match(/name="csrf-token" content="([^"]+)"/);
  expect(match).not.toBeNull();
  return { agent, token: match[1] };
}

describe('routes', () => {
  it('renders the points page', async () => {
    const response = await request(createApp(dependencies())).get('/border').expect(200);
    expect(response.text).toContain('Москва');
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
  });

  it('rejects polling without CSRF', async () => {
    await request(createApp(dependencies()))
      .post('/border_get_orders')
      .send({ point_id: 1 })
      .expect(403);
  });

  it('validates polling payloads', async () => {
    const { agent, token } = await csrfAgent(createApp(dependencies()));
    const response = await agent
      .post('/border_get_orders')
      .set('X-CSRF-TOKEN', token)
      .send({ point_id: 'bad' })
      .expect(422);
    expect(response.body.st).toBe(false);
  });

  it('returns ready orders with a valid CSRF token', async () => {
    const appDependencies = dependencies();
    const { agent, token } = await csrfAgent(createApp(appDependencies));
    const response = await agent
      .post('/border_get_orders')
      .set('X-CSRF-TOKEN', token)
      .send({
        point_id: 1,
        orders: [],
        displayed_orders: [],
        order_timestamps: {},
      })
      .expect(200);

    expect(response.body.ready).toEqual([{ id: '456' }]);
    expect(appDependencies.ordersRepository.getScreenOrders).toHaveBeenCalledWith('point_1');
  });

  it('rejects cross-site polling', async () => {
    const { agent, token } = await csrfAgent(createApp(dependencies()));
    await agent
      .post('/border_get_orders')
      .set('X-CSRF-TOKEN', token)
      .set('Sec-Fetch-Site', 'cross-site')
      .send({ point_id: 1 })
      .expect(403);
  });

  it('rate limits polling separately', async () => {
    const { agent, token } = await csrfAgent(createApp(dependencies()));
    const send = () => agent
      .post('/border_get_orders')
      .set('X-CSRF-TOKEN', token)
      .send({ point_id: 1 });

    await send().expect(200);
    await send().expect(200);
    const limited = await send().expect(429);
    expect(limited.body.error).toBe('Слишком частый опрос');
  });
});
