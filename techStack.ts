import Query from '../domains/Query';
import * as techStack from '../models/techStack';
import * as pagination from '../utils/pagination';

/**
 * Service to fetch all technology Stack.
 *
 * @param {Query} query
 * @returns {Promise}
 */
export async function fetch(query: Query) {
  const { page, size } = query;
  const limit = pagination.limit(size);
  const offset = pagination.offset(page, limit);
  const data = await techStack.fetch(offset, limit);

  return data;
}

/**
 * Service to fetch technology stack by Id.
 *
 * @param {number} id
 * @returns {Promise}
 */
export async function fetchById(id: number) {
  const data = await techStack.fetchById(id);

  return data;
}

/**
 * Service to fetch total count.
 *
 * @returns {number}
 */
export async function count() {
  const count = await techStack.count();

  return count;
}
