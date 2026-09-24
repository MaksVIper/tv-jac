const env = require('./env');

function getZonedParts(date, timeZone = env.APP_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  return Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  );
}

function formatZonedDateTime(date, timeZone = env.APP_TIMEZONE) {
  const parts = getZonedParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function formatZonedDate(date, timeZone = env.APP_TIMEZONE) {
  return formatZonedDateTime(date, timeZone).slice(0, 10);
}

function mysqlOffset(timeZone = env.APP_TIMEZONE, date = new Date()) {
  const tzName = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
    hour: 'numeric',
  }).formatToParts(date).find((part) => part.type === 'timeZoneName')?.value || 'GMT+04:00';

  const match = tzName.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) {
    return '+04:00';
  }

  return `${match[1]}${match[2].padStart(2, '0')}:${match[3] || '00'}`;
}

function businessNowParts(now = new Date()) {
  const day = formatZonedDate(now);
  return {
    day,
    startOfDay: `${day} 00:00:00`,
    endOfDay: `${day} 23:59:59`,
    readyThreshold: formatZonedDateTime(new Date(now.getTime() - env.TIME_READY_SHOW_MINUTES * 60_000)),
    finishThreshold: formatZonedDateTime(new Date(now.getTime() - env.TIME_FINISH_SHOW_MINUTES * 60_000)),
  };
}

module.exports = {
  businessNowParts,
  formatZonedDate,
  formatZonedDateTime,
  mysqlOffset,
};
