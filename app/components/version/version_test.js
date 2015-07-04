'use strict';

describe('readerApp.version module', function() {
  beforeEach(module('readerApp.version'));

  describe('version service', function() {
    it('should return current version', inject(function(version) {
      expect(version).toEqual('0.1');
    }));
  });
});
