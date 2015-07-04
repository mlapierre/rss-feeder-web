'use strict';

angular.module('readerAppControllers')

.controller('navController', function($scope, $rootScope, Feed) {
  var feedSelectedUnbind = $rootScope.$on('feedSelected', function() {
    $scope.feed = Feed.getCurrentFeed();  
  })

  $scope.$on('$destroy', feedSelectedUnbind);
});