/* Conditions */
const EVENTS = {
  OPENED: 'opened',
  CLOSED: 'closed',
  REOPENED: 'reopened',
  EDITED: 'edited',
  SYNCHRONIZED: 'synchronized',
}

const EVENTS_LIST = Object.values(EVENTS)

module.exports = { EVENTS, EVENTS_LIST }