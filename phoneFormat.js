const formatPhoneNumber = num => {
	if (!num) return num
	const str = num.toString()

	const matched = str.match(/\d+\.?\d*/g)

	// 10 digit
	if (matched.length === 3) {
		return '(' + matched[0] + ') ' + matched[1] + '-' + matched[2]
		// 7 digit
	} else if (matched.length === 2) {
		return matched[0] + '-' + matched[1]
	}
	// no formatting attempted only found integers (i.e. 1234567890)
	else if (matched.length === 1) {
		// 10 digit
		if (matched[0].length === 10) {
			return '(' + matched[0].substr(0, 3) + ') ' + matched[0].substr(3, 3) + '-' + matched[0].substr(6)
		}
		// 7 digit
		if (matched[0].length === 7) {
			return matched[0].substr(0, 3) + '-' + matched[0].substr(3)
		}
	}

	// Format failed, return number back
	return num
}

export default formatPhoneNumber
