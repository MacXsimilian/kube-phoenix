import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from '../routes/exceptions.mjs'
import { db } from '../data.mjs'

const handlers = new Map()
register({ add: (method, path, handler) => handlers.set(`${method} ${path}`, handler) })

function invoke(path, body, method = 'POST', params = {}) {
  let response
  handlers.get(`${method} ${path}`)({ body, params }, { json: (status, data) => { response = { status, data } } })
  return response
}

function envelope(policyName) {
  return {
    schemaVersion: 1, kind: 'exception',
    exception: {
      policyName, exceptionType: 'stay_awake',
      startsAt: new Date(Date.now() + 3_600_000).toISOString(),
      endsAt: new Date(Date.now() + 7_200_000).toISOString(),
    },
  }
}

test('exception import preview and apply reject unsupported parents without creating records', () => {
  const count = db.exceptions.length
  for (const policyName of [undefined, null, '', ' \t\n']) {
    for (const endpoint of ['preview', 'apply']) {
      const result = invoke(`/api/exceptions/import/${endpoint}`, envelope(policyName))
      assert.equal(result.status, 400)
      assert.match(result.data.error, /policyName is required/)
      assert.equal(db.exceptions.length, count)
    }
  }
})

test('exception imports resolve named parents and preserve unresolved-name errors', () => {
  const preview = invoke('/api/exceptions/import/preview', envelope(db.policies[0].name))
  assert.equal(preview.status, 200)
  assert.equal(preview.data.parentPolicyId, db.policies[0].id)
  const missing = invoke('/api/exceptions/import/apply', envelope('missing-policy'))
  assert.equal(missing.status, 422)
})

test('manual creation requires a parent and updates cannot change it', () => {
  const count = db.exceptions.length
  assert.equal(invoke('/api/exceptions', {}).status, 400)
  assert.equal(db.exceptions.length, count)
  const original = db.exceptions[0]
  const saved = { ...original }
  try {
    const result = invoke('/api/exceptions/:id', { policyId: null, reason: 'updated' }, 'PUT', { id: original.id })
    assert.equal(result.status, 200)
    assert.equal(original.policyId, saved.policyId)
    assert.equal(original.reason, 'updated')
  } finally {
    Object.assign(original, saved)
  }
})
