import { expect, test } from 'vitest'
import { SPAN_DAYS } from './ephemeris'
import { fromQuery } from './scenarioLink'
import { SITES } from './sites'

test('hand-edited links are brought back into range instead of crashing pages', () => {
  expect(fromQuery('?s=1.5&d=-1&u=0&m=40')).toEqual({ site: 2, day: 0, dur: 1, mast: 10 })
  expect(fromQuery('?s=999&d=500').site).toBe(SITES.length - 1)
  expect(fromQuery('?d=500').day).toBe(SPAN_DAYS)
  expect(fromQuery('?s=-3').site).toBe(0)
  expect(fromQuery('?s=abc&d=&r=0')).toEqual({ requireEarth: false })
})
