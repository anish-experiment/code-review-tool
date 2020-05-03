export function getName(firstName = '', lastName = '') {
	const trimmedFirstName = firstName.trim()
	const trimmedLastName = lastName.trim()

	return [trimmedFirstName, trimmedLastName].filter(e => e).join(' ')
}