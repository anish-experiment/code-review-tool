import axios from 'axios';

/**
 * Build authorization header
 *
 * @param {string} accessToken
 * @returns {string}
 */
function getAuthorizationHeader(accessToken) {
  return `Bearer ${accessToken}`;
}

/**
 * Interceptor to add Access Token header for all requests.
 *
 * @param {object} request
 * @returns {object}
 */
export function authorizationInterceptor(request) {
  const accessToken = localStorage.getItem('token');

  if (accessToken) {
    request.headers['Authorization'] = getAuthorizationHeader(accessToken);
  }

  return request;
}

/**
 * Http Utility.
 */
const http = axios.create({
  baseURL: process.env.BASEURL,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Initialize interceptors for the application.
 */
export function initInterceptors() {
  http.interceptors.request.use(authorizationInterceptor);
}

export { http as default };
