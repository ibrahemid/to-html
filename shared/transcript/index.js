'use strict';

const adapters = {
  'claude-code': require('./claude-code')
};

class UnknownAdapterError extends Error {
  constructor(name) {
    super(`unknown transcript adapter: ${name}`);
    this.name = 'UnknownAdapterError';
  }
}

function getAdapter(name) {
  const a = adapters[name];
  if (!a) throw new UnknownAdapterError(name);
  return a;
}

module.exports = { getAdapter, UnknownAdapterError };
