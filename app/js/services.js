'use strict';

angular.module('readerAppServices', ['ngResource', 'appConfig'])

.factory('Database', function($resource, settings) {
  //PouchDB.plugin(require('pouchdb-upsert'));

  //var db = new PouchDB('http://localhost:5984/feeder');
  var db = new PouchDB('feeder');

  return {
    addFeed: function(feed_link) {
      var feeder_api = $resource('http://localhost:3000/feeds/add', {});
      return feeder_api.save({link: feed_link})
        .$promise.then(function(res) {
          console.log(res);
          db.replicate
            .from('http://localhost:5984/feeder')
            .then(function (result) {
              console.log(result);
            });
          return res;
        });
    },

    getArticles: function(feed_id) {
      return db.allDocs({
        include_docs: true,
        startkey: 'article_',
        endkey: 'article_\uffff'
      }).then(function(docs) {
        return docs.rows.filter(function(res) {
          return res.doc.feed_id === feed_id;
        }).map(function(rows){
          return rows.doc;
        });
      }).catch(function(err) {
        console.log(err);
      });
    },

    getTagsAndFeeds: function(callback) {
      db.allDocs({
        include_docs: true,
        startkey: 'tag_',
        endkey: 'tag_\uffff'
      }).then(function(docs) {
        var tags = docs.rows.map(function(tag) {
          return {
            name: tag.id.substr(4),
            id: tag.id,
            feeds: tag.doc.feeds
          }
        });
        callback(tags);
      }).catch(function(err) {
        console.log(err);
      });
    },

    getTags: function(callback) {
      db.allDocs({
        include_docs: true,
        startkey: 'tag_',
        endkey: 'tag_\uffff'
      }).then(function(docs) {
        var tags = docs.rows.map(function(tag) {
          return { "name": tag.id.substr(4) };
        });
        callback(tags);
      }).catch(function(err) {
        console.log(err);
      });
    },

    saveTag: function(tag) {
      db.putIfNotExists({
        "_id": "tag_" + tag.name,
        "type": "tag",
        "created_at": new Date().toISOString()
      }).then(function (doc) {
        console.log(doc);
      }).catch(function (err) {
        console.log(err);
      });
    },

    sync: function() {
      return db.sync('feeder', 'http://localhost:5984/feeder');
    }

  };
})

.factory('Feed', ['Database', '$resource', 'settings', '$rootScope',
function(db, $resource, settings, $rootScope) {
  var _tags;
  var current_feed_id;

  function getFeed(id) {
    for (var i=0; i<_tags.length; i++) {
      for (var j=0; j<_tags[i].feeds.length; j++) {
        var ref_match = _tags[i].feeds[j]._id.match(/feed_(.*)_http/);
        if (ref_match[1] == encodeURIComponent(id)) {
          return _tags[i].feeds[j];
        }
      }
    }
  }

  function getRandString() {
    return (Math.random()+1).toString(36).slice(2,10);
  }

  return {
    addFeed: function(link) {
      db.addFeed(link)
        .then(function(feed) {
          _tags.untagged.feeds.append({
            id: encodeURLComponent(feed.title),
            title: feed.title,
            unread_count: feed.unread
          });
        }).catch(function (err) {
          console.log(err);
        });
    },

    areFeedsLoaded: function() {
      return _tags !== undefined;
    },

    getTagsAndFeeds: function(callback) {
      db.sync().then(function(res) {
        console.log(res);
      }).catch(function(err) {
        console.log(error);
      });
      db.getTagsAndFeeds(function(tags) {
        _tags = tags;//.feeds;
        callback(_tags);
      });
    },

    getCurrentFeed: function() {
      return getFeed(current_feed_id);
    },

    setCurrentFeed: function(feed_id) {
      current_feed_id = feed_id;
    },

    getArticles: function(feed_id) {
      var feed = getFeed(feed_id);
      return db.getArticles(feed._id);
    }
  };
}])

.factory('Entry', function($resource, settings) {
  var read_resource = $resource(settings.apiBaseURL + 'entries/read/:entry_id',
    { entry_id: '@entry_id' }
  );

  var tag_resource = $resource(settings.apiBaseURL + 'entries/:entry_id/tag/:name',
    { entry_id: '@entry_id', name: '@name' }
  );

  return {
    addTag: function(_entry_id, tag_name) {
      tag_resource.save({entry_id: _entry_id, name: tag_name});
    },

    markRead: function(_entry_id, read_at) {
      read_resource.save({entry_id: _entry_id, 'read_at': read_at});
    },

    markUnread: function(_entry_id) {
      read_resource.save({entry_id: _entry_id, 'read_at': null});
    },

    removeTag: function(_entry_id, tag_name) {
      tag_resource.remove({entry_id: _entry_id, name: tag_name});
    }
  };
})

.factory('Hotkeys', function($document) {
  var keyHanders = {
    'n': handleNextArticle,
    'p': handlePrevArticle,
    'm': handleToggleArticleRead
  };

  function assignHotkeyEvents(elm) {
    elm.on('focus', function() {
      $document.off('keypress');
    });
    elm.on('blur', function() {
      $document.off('keypress'); // unregister so there's only one instance of the event if this
                                 // function is called more than once
      $document.on('keypress', keypressHandler);
    });
  }

  function handleNextArticle() {
    var articles_scope = angular.element($('#articles_view')).scope();
    articles_scope.selectNext();
  }

  function handlePrevArticle() {
    var articles_scope = angular.element($('#articles_view')).scope();
    articles_scope.selectPrev();
  }

  function handleToggleArticleRead() {
    var articles_scope = angular.element($('#articles_view')).scope();
    articles_scope.toggleRead();
  }

  function processKeypress(key) {
    if (typeof keyHanders[key] === 'function') {
      return keyHanders[key](key);
    }
  }

  function getChar(event) {
    if (event.which === null) {
      return String.fromCharCode(event.keyCode) // IE
    } else if (event.which !== 0 && event.charCode !== 0) {
      return String.fromCharCode(event.which)   // the rest
    } else {
      return null
    }
  }

  function keypressHandler(keyEvent) {
    processKeypress(getChar(keyEvent));
  }

  return {
    init: function() {
      $document.on('keypress', keypressHandler);
    },

    assignHotkeyEvents: function(elm) {
      return assignHotkeyEvents(elm);
    }
  }
})

.factory('Tag', ['Database', '$resource', 'settings',
function(db, $resource, settings) {
  //return $resource(settings.apiBaseURL + 'tags/:id');
  return {
    save: function(tag) {
      db.saveTag(tag);
    },

    query: function(callback) {
      db.getTags(callback);
    }
  }
}]);
