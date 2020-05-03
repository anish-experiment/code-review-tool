import Query from '../domains/Query';
import * as wfh from '../models/wfh';
import * as pagination from '../utils/pagination';

/**
 * Service to fetch Work From Homes.
 *
 * @param {Query} query
 * @returns {Promise}
 */
export async function fetch(query: Query) {
  const { q, page, size, date, startDate, endDate } = query;
  const limit = pagination.limit(size);
  const offset = pagination.offset(page, limit);
  const dates = { q, date, startDate, endDate };
  const data = await wfh.fetch(dates, offset, limit);

  return data;
}

/**
 * Service to fetch total count.
 *
 * @param {Query} query
 * @returns {number}
 */
export async function count(query: Query) {
  const { q, date, startDate, endDate } = query;
  const dates = { q, date, startDate, endDate };
  const count = await wfh.count(dates);

  return count;
}
