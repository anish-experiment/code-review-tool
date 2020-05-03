import moment from 'moment-timezone'

const client = new ClientJS()

export const clientProperties = {
	os: {
		name: client.getOS(),
		version: client.getOSVersion()
	},
	browser: {
		isIE: client.isIE(),
		name: client.getBrowser(),
		isChrome: client.isChrome(),
		isSafari: client.isSafari(),
		isFirefox: client.isFirefox(),
		version: client.getBrowserVersion(),
		isMobileSafari: client.isMobileSafari(),
		majorVersion: client.getBrowserMajorVersion()
	},
	mobile: {
		isIpad: client.isIpad(),
		isIphone: client.isIphone(),
		isIOS: client.isMobileIOS(),
		isMobile: client.isMobile(),
		isAndroid: client.isMobileAndroid(),
	},
	device: {
		info: client.getDevice(),
		type: client.getDeviceType(),
		vendor: client.getDeviceVendor(),
	},
	userAgent: client.getUserAgent(),
	resolution: client.getCurrentResolution(),
}

export const getClientProperties = () => ({
	...clientProperties,
	timezone: moment.tz.guess(),
	timestamp: moment().format(),
	utcTimestamp: moment().utc().format(),
})

export default client