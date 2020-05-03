import formatDate from './formatDate'

const formatShifts = (shifts) => {
	var    data = []
	const { asDate, fromDate, fmtTime } = formatDate

	shifts.forEach((s) => {
		//const date = asDate(s.shift_date)
		//const fmt = fromDate(date)
		const fmt = asDate(s.shift_date)
		const key = s.shift_id + '-' + fmt

		// add data (id + date) => shift
		//s.date = date
		s.fmtDate = fmt
		s.fmtStart = fmtTime(s.shift_start || s.start_time)
		s.fmtEnd = fmtTime(s.shift_end || s.end_time)
		data[key] = s
	})

	return {
		data: data,
	}
}
export default formatShifts
