'use strict';

angular.module('readerApp.version', [
  'readerApp.version.interpolate-filter',
  'readerApp.version.version-directive'
])

.value('version', '0.1.0');
