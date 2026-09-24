const express = require('express');
const { z } = require('zod');
const defaultPointsRepository = require('../repositories/pointsRepository');
const defaultOrdersRepository = require('../repositories/ordersRepository');
const { buildPollResponse } = require('../services/ordersService');
const {
  csrfProtection,
  createPollLimiter,
  issueCsrfToken,
  sameOrigin,
} = require('../middleware/security');

const idSchema = z.coerce.number().int().positive().max(2_147_483_647);
const orderIdSchema = z.union([
  z.string().regex(/^\d{1,20}$/),
  z.number().int().nonnegative(),
]);
const pollSchema = z.object({
  point_id: idSchema,
  orders: z.array(orderIdSchema).max(200).default([]),
  displayed_orders: z.array(orderIdSchema).max(500).default([]),
  order_timestamps: z
    .record(z.string().regex(/^\d{1,20}$/), z.coerce.number().int().positive())
    .refine((value) => Object.keys(value).length <= 200, 'Too many timestamps')
    .default({}),
}).strict();

function createRouter({
  pointsRepository = defaultPointsRepository,
  ordersRepository = defaultOrdersRepository,
} = {}) {
  const router = express.Router();
  const pollLimiter = createPollLimiter();

  router.get('/', (_req, res) => res.redirect('/border'));

  router.get('/health', (_req, res) => {
    res.set('Cache-Control', 'no-store').json({ status: 'ok' });
  });

  router.get('/border', async (req, res) => {
    const points = await pointsRepository.getPoints();
    res.set('Cache-Control', 'no-store');
    res.render('border', {
      title: 'Отображение заказов',
      points,
      csrfToken: issueCsrfToken(req, res),
    });
  });

  router.get('/tv/:id', async (req, res) => {
    const result = idSchema.safeParse(req.params.id);
    if (!result.success) {
      return res.status(404).render('error', { message: 'Точка не найдена' });
    }

    const point = await pointsRepository.getPoint(result.data);
    if (!point) {
      return res.status(404).render('error', { message: 'Точка не найдена' });
    }

    res.set('Cache-Control', 'no-store');
    return res.render('tv', {
      title: 'Отображение заказов',
      pointId: result.data,
      csrfToken: issueCsrfToken(req, res),
    });
  });

  router.post(
    '/border_get_orders',
    pollLimiter,
    sameOrigin,
    csrfProtection,
    async (req, res) => {
      const parsed = pollSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(422).json({
          st: false,
          error: 'Некорректные параметры запроса',
        });
      }

      const point = await pointsRepository.getPoint(parsed.data.point_id);
      if (!point) {
        return res.status(404).json({ st: false, error: 'Точка не найдена' });
      }

      if (!(await pointsRepository.hasTvSettings(parsed.data.point_id))) {
        return res.json({ st: false, error: 'Ошибка записи в points_tv_settings' });
      }

      const rows = await ordersRepository.getScreenOrders(point.base);
      return res.json(buildPollResponse({
        rows,
        previousOrders: parsed.data.orders,
        displayedOrders: parsed.data.displayed_orders,
        orderTimestamps: parsed.data.order_timestamps,
      }));
    },
  );

  return router;
}

module.exports = {
  createRouter,
  pollSchema,
};
