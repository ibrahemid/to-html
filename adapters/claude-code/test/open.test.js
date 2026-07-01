'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileUrl, detectOpener } = require('../lib/open');

test('pathToFileUrl: posix path encodes spaces but keeps slashes', () => {
  assert.equal(pathToFileUrl('/Users/x/my file.html', 'darwin'), 'file:///Users/x/my%20file.html');
});
test('pathToFileUrl: windows drive path keeps the drive colon, uses forward slashes', () => {
  assert.equal(pathToFileUrl('C:\\Users\\foo\\file.html', 'win32'), 'file:///C:/Users/foo/file.html');
});
test('pathToFileUrl: windows path with spaces encodes them, colon preserved', () => {
  assert.equal(pathToFileUrl('C:\\My Files\\a.html', 'win32'), 'file:///C:/My%20Files/a.html');
});
test('pathToFileUrl: windows UNC path uses host form', () => {
  assert.equal(pathToFileUrl('\\\\server\\share\\a.html', 'win32'), 'file://server/share/a.html');
});

test('detectOpener: darwin with an app uses open -a <app>', () => {
  const orig = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { value: 'darwin' });
  try {
    assert.deepEqual(detectOpener('Dia'), { cmd: 'open', args: ['-a', 'Dia'] });
    assert.deepEqual(detectOpener(null), { cmd: 'open', args: [] });
  } finally {
    Object.defineProperty(process, 'platform', orig);
  }
});
