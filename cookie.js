import { COOKIE_DOMAIN } from "../constants/cookie";

export const setTokenInCookies = token => {
	document.cookie=`token=${token};domain=${COOKIE_DOMAIN};path=/;`
}

export const removeTokenFromCookies = () => {
	document.cookie = `token=;domain=${COOKIE_DOMAIN};path=/;expires=0`
}