angular.module('readerAppControllers', ['duScroll'])

.controller('feedsPanelController', function($scope, $location, $timeout, Feed, Tag) {
  Tag.query(function(tags) {
    $timeout(function() {
      $scope.tags = tags;
    }, 0);
  });
  Feed.getTagsAndFeeds(function(feeds) {
    $timeout(function() {
      $scope.feeds = feeds;
      console.log(feeds);
    }, 0);
  });

  $scope.feed_url = '';
  $scope.feed_tag = '';
  $scope.treeCallback = {
    accept: function(sourceNode, destNodes, destIndex) {
      var sourcetype = sourceNode.$parent.$element.attr('data-type');
      var destType = destNodes.$element.attr('data-type');
      return (sourcetype === destType);
    },
    dropped: function(event) {
      $scope.saveTags();
    }
  };

  // $scope.saveTags = function() {
  //   var tags = $scope.feeds;
  //   for (var i = 0; i < tags.length; i++) {
  //     tags[i].order = i;
  //     for (var j = 0; j < tags[i].feeds.length; j++) {
  //       tags[i].feeds[j].order = j;
  //     }
  //   }
  //   Feed.updateTags(tags);
  // };

  $scope.addSubscription = function() {
    var input_scope = angular.element($('#add_subscription')).scope();
    if (input_scope.add_feed_form.$valid) {
      console.log("Valid feed");
      Feed.addFeed(input_scope.feed_url);
      Feed.getTagsAndFeeds(function(feeds) {
        $scope.feeds = feeds;
        console.log(feeds);
      });
    }
  };

  $scope.addFeedTag = function() {
    var input_scope = angular.element($('#add_feed_tag')).scope();
    if (input_scope.add_feed_form.$valid) {
      console.log("Valid tag: " + $scope.feed_tag);
      Tag.save({name: input_scope.feed_tag});
    }
  };

  $scope.syncFeeds = function() {
    Feed.syncFeeds();
  }
})

.controller('mainCtrl', ['Hotkeys',
  function(Hotkeys) {
    function getLastVisibleEntry(scope) {
      var last = scope.$$childHead.$index;
      scope.articles.forEach(function(v, i) {
        if ($('#article_' + v.id).is(':visible')) {
          last = i;
        }
      });
      return last;
    }

    var input_elm = angular.element($('#add_subscription'));
    Hotkeys.init();
    Hotkeys.assignHotkeyEvents(input_elm);
  }
]);

