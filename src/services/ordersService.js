const MIN_DISPLAY_SECONDS = 180;

function formatOrderId(order) {
  const orderId = String(order.id);
  const visibleLength = Number(order.type_order) === 2 ? 4 : 3;
  return orderId.length > visibleLength ? orderId.slice(-visibleLength) : orderId;
}

function unique(values) {
  return [...new Set(values)];
}

function buildPollResponse({
  rows,
  previousOrders = [],
  displayedOrders = [],
  orderTimestamps = {},
  nowSeconds = Math.floor(Date.now() / 1000),
}) {
  const previous = previousOrders.map(String);
  const displayed = new Set(displayedOrders.map(String));
  const timestamps = { ...orderTimestamps };

  const ordersToKeep = previous.filter((orderId) => {
    const firstShown = Number(timestamps[orderId]);
    return Number.isFinite(firstShown)
      && firstShown > 0
      && nowSeconds - firstShown < MIN_DISPLAY_SECONDS;
  });

  const ordersToShow = [];

  for (const order of rows) {
    // Самовывоз (type_order=2) в статусе 6 на ТВ не показываем — правка jaco от 24.06.24.
    if (Number(order.type_order) === 2 && Number(order.status_order) === 6) {
      continue;
    }

    const displayId = formatOrderId(order);
    const wasDisplayed = previous.includes(displayId);

    if (wasDisplayed && ordersToKeep.includes(displayId)) {
      ordersToShow.push(displayId);
      continue;
    }

    if (Number(order.status_order) === 6) {
      if (!displayed.has(String(order.id))) {
        ordersToShow.push(displayId);
      }
    } else {
      ordersToShow.push(displayId);
    }
  }

  const finalOrders = unique([...ordersToShow, ...ordersToKeep]);
  const newOrders = finalOrders.filter((orderId) => !previous.includes(orderId));

  for (const orderId of newOrders) {
    if (!Object.hasOwn(timestamps, orderId)) {
      timestamps[orderId] = nowSeconds;
    }
  }

  for (const orderId of previous) {
    if (!finalOrders.includes(orderId)) {
      delete timestamps[orderId];
    }
  }

  return {
    st: true,
    ready: finalOrders.map((id) => ({ id })),
    hot: newOrders.map((id) => ({ id })),
    displayed_status_4: rows
      .filter((order) => Number(order.status_order) === 4)
      .map((order) => order.id),
    order_timestamps: timestamps,
  };
}

module.exports = {
  MIN_DISPLAY_SECONDS,
  buildPollResponse,
  formatOrderId,
};
