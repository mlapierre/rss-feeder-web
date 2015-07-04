'use strict';

angular.module('readerApp.articles', ['ngRoute', 'ngSanitize'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/feed/:feedId', {
    templateUrl: 'articles/articles.html',
    controller: 'ArticlesCtrl'
  });
}])

.directive('onFinishRender', function ($timeout) {
  return {
      restrict: 'A',
      link: function (scope, element, attr) {
          if (scope.$last === true) {
              $timeout(function () {
                  scope.$emit(attr.onFinishRender);
              });
          }
      }
  }
})

.controller('ArticlesCtrl', ['$document', '$timeout', '$scope', '$routeParams', 'Articles', 'Entry', 'Hotkeys', 'Feed',
  function($document, $timeout, $scope, $routeParams, Articles, Entry, Hotkeys, Feed) {
    if ($routeParams.feedId) {
      $scope.feedId = $routeParams.feedId;
      $scope.articles = Articles.getFromFeed($routeParams.feedId);
    }
    $scope.new_article_tag;
    $scope.selectedId = -1;
    $scope.fetching = false;

    $scope.$on('bindHotkeys', function() {
      var input_elm = angular.element($('#add_article_tag_' + $scope.selectedId));
      Hotkeys.assignHotkeyEvents(input_elm);
    });

    $scope.activateArticle = function(id) {
      if ($scope.selectedId !== id) {
        logEvent('blur_article');
        $scope.selectedId = id;
        logEvent('focus_article');

        var input_elm = angular.element($('#add_article_tag_' + id));
        Hotkeys.assignHotkeyEvents(input_elm);

        // If the selected article is near the end, fetch more
        fetchArticles($scope.selectedId);
      }
    }

    $scope.addArticleTag = function() {
      var input_scope = angular.element($('#add_article_tag_' + $scope.selectedId)).scope();
      if (input_scope.add_article_tag_form.$valid) {
        if (!input_scope.article.article_tags) {
          input_scope.article.article_tags = [];
        }
        if (input_scope.article.article_tags.indexOf(input_scope.new_article_tag) >= 0) {
          return;
        }
        input_scope.article.article_tags.push(input_scope.new_article_tag);
        Entry.addTag($scope.selectedId, input_scope.new_article_tag);
        $('#add_article_tag_' + $scope.selectedId).val('');
      }
    }

    $scope.getContent = function(article) {
      if (!article.content) {
        return article.summary;
      } else if (!article.summary) {
        return article.content;
      } else if (article.content.length > article.summary.length ) {
        return article.content;
      }
      return article.summary;
    }

    $scope.isRead = function(index) {
      if ($scope.articles[index].read_at === null || $scope.articles[index].read_at === undefined) {
        return false;
      }
      return true;
    }

    $scope.isSelected = function(id) {
      return id === $scope.selectedId;
    }

    $scope.openArticleSource = function(id) {
      if ($scope.selectedId !== id) {
        logEvent('blur_article');
        $scope.selectedId = id;
        logEvent('focus_article');
      }
      logEvent('open_article_source');
    }

    $scope.selectNext = function() {
      if (!$scope.isRead(getIndexFromId($scope.selectedId))) {
        Feed.decrementCurrentFeedCount();
        markSelectedArticleRead();
        hideSelectedArticle();
      }

      if (getIndexFromId($scope.selectedId) !== $scope.$$childTail.$index) {
        if ($scope.isRead(getIndexFromId($scope.selectedId))) {
          logEvent('blur_article');
        }

        $scope.selectedId = getNextId($scope.selectedId);
        $scope.$apply();
        logEvent('focus_article');
      }
      scrollToEntry($scope.selectedId);
      var input_elm = angular.element($('#add_article_tag_' + $scope.selectedId));
      Hotkeys.assignHotkeyEvents(input_elm);

      fetchArticles($scope.selectedId);
    }

    $scope.selectPrev = function() {
      if (getIndexFromId($scope.selectedId) > 0) {
        logEvent('blur_article');
        $scope.selectedId = getPrevId($scope.selectedId);
        logEvent('focus_article');
      }
      $scope.$apply();

      if ($scope.isRead(getIndexFromId($scope.selectedId))) {
        Feed.incrementCurrentFeedCount();
        markSelectedArticleUnread();
        showSelectedArticle();
      }

      var input_elm = angular.element($('#add_article_tag_' + $scope.selectedId));
      Hotkeys.assignHotkeyEvents(input_elm);
    }

    $scope.toggleRead = function() {
      if ($scope.isRead(getIndexFromId($scope.selectedId))) {
        Feed.incrementCurrentFeedCount();
        markSelectedArticleUnread();
      } else {
        Feed.decrementCurrentFeedCount();
        markSelectedArticleRead();
      }
    }

    $scope.removeArticleTag = function(event) {
      var tag = event.target.parentElement.innerText.trim();
      var input_scope = angular.element($('#add_article_tag_' + $scope.selectedId)).scope();
      var tag_idx = input_scope.article.article_tags.indexOf(tag);
      input_scope.article.article_tags.splice(tag_idx, 1);
      Entry.removeTag(selectedId, tag);
    }

    function fetchArticles(selected_article_id) {
      if ($scope.fetching) {
        return;
      }

      var unread_count = Feed.currentFeedCount();
      var selectedIndex = getIndexFromId($scope.selectedId);
      if (unread_count > 0
          && (unread_count - ($scope.$$childTail.$index - selectedIndex + 1) > 0)
          && selectedIndex > ($scope.articles.length - 6)) {
        $scope.fetching = true;
        Articles.fetch($scope, Math.min(5, unread_count));
      }
    }

    function getArticleFromId(id) {
      for (var i = 0; i < $scope.articles.length; i++) {
        if ($scope.articles[i].id === id) {
          return $scope.articles[i];
        }
      }
    }

    function getTitleFromId(id) {
      for (var i = 0; i < $scope.articles.length; i++) {
        if ($scope.articles[i].id === id) {
          return $scope.articles[i].title;
        }
      }
    }

    function getIndexFromId(id) {
      for (var i = 0; i < $scope.articles.length; i++) {
        if ($scope.articles[i].id === id) {
          return i;
        }
      }
    }

    function getNextId(id) {
      for (var i = 0; i < $scope.articles.length-1; i++) {
        if ($scope.articles[i].id === id) {
          return $scope.articles[i+1].id;
        }
      }
      return id;
    }

    function getPrevId(id) {
      for (var i = 1; i < $scope.articles.length; i++) {
        if ($scope.articles[i].id === id) {
          return $scope.articles[i-1].id;
        }
      }
      return id;
    }

    function logEvent(event) {
      //console.log(event + ' ' + $scope.articles[$scope.selectedIndex].id);
      Articles.logEvent({
                          "event": event,
                          "article_index": getIndexFromId($scope.selectedId),
                          "article_id": $scope.selectedId
                        });
    }

    function hideSelectedArticle() {
      var article_id = '#article_' + $scope.selectedId;
      $(article_id).hide();
      logEvent('blur_article');
    }

    function markSelectedArticleRead() {
      var entry = getArticleFromId($scope.selectedId);
      var read_at = (new Date(Date.now())).toISOString();
      entry.read_at = read_at;
      Entry.markRead(entry.id, read_at);
      logEvent('article_read');
    }

    function markSelectedArticleUnread() {
      var entry = getArticleFromId($scope.selectedId);
      entry.read_at = null;
      Entry.markUnread(entry.id);
      logEvent('article_unread');
    }

    function scrollToEntry(entry_id) {
      var article_id = '#article_' + $scope.selectedId;
      var article_elm = angular.element($(article_id));
      angular.element($('#articles_panel')).scrollToElement(article_elm, 7, 0);
    }

    function showSelectedArticle() {
      var article_id = '#article_' + $scope.selectedId;
      $(article_id).show();
    }
  }
]);
