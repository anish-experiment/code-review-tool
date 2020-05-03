import _ from 'underscore'

import mixpanelConstants from '../constants/mixpanel'

export function trackApplyFilter (state, key, nurseRoles) {
  const searchFilters = {}
  for (const k of Object.keys(state)) {
    if (state[k]) {
      if (k.match(/Date/)) {
        searchFilters[k] = new Date(state[k]).toLocaleDateString()
      } else if (k.match(/roleID/)) {
        const roleObj = _.findWhere(nurseRoles, { id: parseInt(state[key]) })
        searchFilters[k] = roleObj ? roleObj.name : ''
      } else {
        searchFilters[k] = state[k]
      }
    }
  }
  mixpanel.track(mixpanelConstants.SUPERVISOR_APPLY_NURSE_FILTER, {
    ...searchFilters,
    searchKey: key
  })
}
