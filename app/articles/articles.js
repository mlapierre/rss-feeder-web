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

.controller('ArticlesCtrl', ['$document', '$timeout', '$rootScope', '$scope', '$routeParams', 'Article', 'Hotkeys', 'Feed', 'Event',
  function($document, $timeout, $rootScope, $scope, $routeParams, Article, Hotkeys, Feed, Event) {
    $scope.$on('$destroy', feedsLoadedUnbind);
    $scope.new_article_tag;
    $scope.selectedId = -1;
    $scope.fetching = false;

    $scope.$on('bindHotkeys', function() {
      var input_elm = angular.element($('#add_article_tag_' + $scope.selectedId));
      Hotkeys.assignHotkeyEvents(input_elm);
    });

    var feedsLoadedUnbind = $rootScope.$on('feedsLoaded', function() {
      if ($routeParams.feedId) {
        showArticles();
      }
    });

    if ($routeParams.feedId && Feed.areFeedsLoaded()) {
      showArticles();
    }

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
        if (!input_scope.article.tags) {
          input_scope.article.tags = [];
        }
        if (input_scope.article.tags.indexOf(input_scope.new_article_tag) >= 0) {
          return;
        }
        input_scope.article.tags.push(input_scope.new_article_tag);
        input_scope.article.feed_ref = $routeParams.feedId;
        Article.addTag(input_scope.article, input_scope.new_article_tag);
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
      }
      hideSelectedArticle();
      if (getIndexFromId($scope.selectedId) !== $scope.$$childTail.$index) {
        $scope.selectedId = getNextId($scope.selectedId);
      } else if (getIndexFromId($scope.selectedId) > 0) {
        $scope.selectedId = getPrevId($scope.selectedId);
      }
      $scope.$apply();
      logEvent('focus_article');
      scrollToArticle($scope.selectedId);
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
      if ($scope.isRead(getIndexFromId($scope.selectedId))) {
        Feed.incrementCurrentFeedCount();
        markSelectedArticleUnread();
        showSelectedArticle();
      }
      $scope.$apply();
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
      $scope.$apply();
    }

    $scope.removeArticleTag = function(event) {
      var tag = event.target.parentElement.innerText.trim();
      var article_id = event.target.parentElement.parentElement.parentElement.id;
      var scope = angular.element($('#' + article_id)).scope();

      scope.article.feed_ref = $routeParams.feedId;
      scope.article.tags.splice(scope.article.tags.indexOf(tag), 1);
      Article.removeTag(scope.article, tag);
    }

    function fetchArticles(selected_article_id) {
      if ($scope.fetching) {
        return;
      }

      var unread_count = Feed.currentFeedCount();
      var selectedIndex = getIndexFromId($scope.selectedId);

      if (unread_count > 0
          && selectedIndex > ($scope.articles.length - 3)) {

        $scope.fetching = true;
        Feed.fetchAfter($scope.articles[$scope.articles.length-1]._id)
          .then(function(res) {
            if(res) {
              $scope.articles.push(res);
              $scope.$apply();
            }
            $scope.fetching = false;
          }).catch(function(err) {
            console.log(err);
          });
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
      Event.log({
        "event": event,
        "feed_ref": $routeParams.feedId,
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
      var article = getArticleFromId($scope.selectedId);
      var read_at = (new Date(Date.now())).toISOString();
      var elm = angular.element($('#article_' + $scope.selectedId));

      elm.addClass('read');
      article.read_at = read_at;
      Article.markRead(article, read_at);
      logEvent('article_read');
    }

    function markSelectedArticleUnread() {
      var article = getArticleFromId($scope.selectedId);
      var elm = angular.element($('#article_' + $scope.selectedId));

      elm.removeClass('read');
      article.read_at = null;
      Article.markUnread(article);
      logEvent('article_unread');
    }

    function scrollToArticle(_article_id) {
      var article_id = '#article_' + _article_id;
      var article_elm = angular.element($(article_id));
      angular.element($('#articles_panel')).scrollToElement(article_elm, 7, 0);
    }

    function showArticles() {
      $scope.feedId = $routeParams.feedId;
      Feed.setCurrentFeed($routeParams.feedId);
      Feed.getArticles($routeParams.feedId).then(function(articles) {
        $scope.articles = articles;
        $scope.$apply();
      });
    }

    function showSelectedArticle() {
      var article_id = '#article_' + $scope.selectedId;
      $(article_id).show();
    }
  }
]);
