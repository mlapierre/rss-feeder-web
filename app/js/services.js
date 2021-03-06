'use strict';

angular.module('readerAppServices', ['ngResource', 'appConfig'])

.factory('Event', ['$resource', 'settings', 'Database', function($resource, settings, db) {
  return {
    log: function(event) {
      event["_id"] = 'event_' + (new Date(Date.now())).toISOString() + '-' + (Math.random()+1).toString(36).slice(2,10);
      db.addEvent(event);
    }
  }
}])

.factory('Database', function($resource, settings) {
  PouchDB.plugin('pouchdb-upsert');

  var db = new PouchDB('feeder');
  var userdb = new PouchDB('feeder_user');

  function addOrAppendTag(doc, tag_name) {
    if (!doc.hasOwnProperty('tags')) {
      doc.tags = [tag_name];
      return doc
    }

    if (doc.tags.indexOf(tag_name) !== -1) {
      return false;
    }

    doc.tags.push(tag_name);
    return doc;
  }

  function sync() {
    syncUserDB();
    db.replicate.from(settings.couchdbBaseURL + 'feeder').then(function() {
      console.log("feeder sync complete");
    }).catch(function(err) {
      console.log(err);
    });
  }

  function syncUserDB() {
    userdb.sync(settings.couchdbBaseURL + 'feeder_user').then(function() {
      console.log("feeder_user sync complete");
    }).catch(function(err) {
      console.log(err);
    });
  }

  function upsertDBs(article, elm, changeFunc) {
    userdb.upsert('article_' + article.feed_ref + '_' + article.id, function(doc) {
      return changeFunc(doc, elm);
    }).then(function() {
      return db.upsert(article._id, function(doc) {
        return changeFunc(doc, elm);
      });
    }).catch(function(err) {
      console.log(err);
    });
  }

  return {
    addArticleTag: function(article, tag_name) {
      upsertDBs(article, tag_name, addOrAppendTag);
    },

    addEvent: function(event) {
      userdb.put(event).catch(function (err) {
        console.log(err);
      });
    },

    addFeed: function(feed_link) {
      var feeder_api = $resource(settings.apiBaseURL + 'feeds/add');
      return feeder_api.save({link: feed_link}).$promise;
    },

    getArticles: function(feed_id) {
      return db.query('feeder/article_by_feed', {
        key: feed_id,
        include_docs: true,
        limit: 10
      }).then(function (result) {
        return result.rows.map(function(rows){
          return rows.doc;
        });
      }).catch(function (err) {
        console.log(err);
      });
    },

    getArticleAfter: function(id, feed_id) {
      return db.query('feeder/article_by_feed_read_pub', {
        include_docs: true,
        startkey: [feed_id, null, id, null],
        endkey: [feed_id, null, "article_\uffff", {}],
        limit: 1,
        skip: 1
      }).then(function(docs) {
        if (docs.rows.length > 0) {
          return docs.rows[0].doc;
        }
      }).catch(function(err) {
        console.log(err);
      });
    },

    getTagsAndFeeds: function(callback) {
      userdb.allDocs({
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
      userdb.allDocs({
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

    init: function() {
      // Create views
      var ddoc = {
        _id: '_design/feeder',
        views: {
          article_by_feed_read_pub: {
            map: function (doc) {
              emit([doc.feed_id, doc.read_at, doc._id, doc.published_at]);
            }.toString()
          },
          article_by_feed: {
            map: function (doc) {
              if (!doc.read_at && doc.type === "article") {
                emit(doc.feed_id)
              }
            }.toString()
          }
        }
      };
      db.upsert(ddoc._id, function(doc) {
        if (!doc.views) {
          return ddoc;
        }

        for (var new_view in ddoc.views) {
          if (!doc.views.hasOwnProperty(new_view)) {
            return ddoc;
          }
        }
        return false;
      }).then(function (doc) {
        if (doc.updated) {
          console.log("Views created");
        }
      }).catch(function (err) {
        console.log(err);
      });
    },

    saveTag: function(tag) {
      userdb.putIfNotExists({
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
      sync();
    },

    markArticleRead: function(article, at) {
      upsertDBs(article, at, function(doc) {
        if (!doc.read_at) {
          doc.read_at = at;
          return doc;
        }
        if (doc.read_at == at) {
          return false;
        }
        doc.read_at = at;
        return doc;
      });

      userdb.allDocs({
        include_docs: true,
        startkey: 'tag_',
        endkey: 'tag_\uffff'
      }).then(function(docs) {
        var feed_id = article.feed_id;

        for (var i = 0; i<docs.rows.length; i++) {
          userdb.upsert(docs.rows[i].id, function(doc) {
            for (var j = 0; j<doc.feeds.length; j++) {
              if (doc.feeds[j]._id === feed_id) {
                doc.feeds[j].unread_count--;
                return doc;
              }
            }
            return false;
          });
        }

      }).catch(function(err) {
        console.log(err);
      });
    },

    markArticleUnread: function(article) {
      upsertDBs(article, [], function(doc) {
        if (doc.read_at === null) {
          return false;
        }
        doc.read_at = null;
        return doc;
      });

      userdb.allDocs({
        include_docs: true,
        startkey: 'tag_',
        endkey: 'tag_\uffff'
      }).then(function(docs) {
        var feed_id = article.feed_id;

        for (var i = 0; i<docs.rows.length; i++) {
          userdb.upsert(docs.rows[i].id, function(doc) {
            for (var j = 0; j<doc.feeds.length; j++) {
              if (doc.feeds[j]._id === feed_id) {
                doc.feeds[j].unread_count++;
                return doc;
              }
            }
            return false;
          });
        }

      }).catch(function(err) {
        console.log(err);
      });

    },

    removeArticleTag: function(article, tag_name) {
      upsertDBs(article, tag_name, function(doc, tag_name) {
        doc.tags.splice(doc.tags.indexOf(tag_name), 1);
        return doc;
      });
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

  function updateFeedPanel(feed) {
    var found;
    var untagged;

    _tags.forEach(function(tag) {
      if (tag.name === 'untagged') {
        untagged = tag;
      }
      tag.feeds.forEach(function(_feed) {
        if (_feed.title === feed.title) {
          _feed.unread_count = feed.unread_count;
          found = true;
        }
      });
    });

    if (!found) {
      untagged.feeds.push(feed);
    }
  }

  return {
    addFeed: function(link) {
      return db.addFeed(link)
        .then(function(res) {
          db.sync();
          updateFeedPanel(res.feed);
        });
    },

    areFeedsLoaded: function() {
      return _tags !== undefined;
    },

    currentFeedCount: function() {
      return this.getCurrentFeed().unread_count;
    },

    decrementCurrentFeedCount: function() {
      var feed = this.getCurrentFeed();
      feed.unread_count = Math.max(0, feed.unread_count - 1);
    },

    fetchAfter: function(id, feed_id) {
      var feed = this.getCurrentFeed();
      return db.getArticleAfter(id, feed._id)
        .then(function(res) {
          return res;
        })
    },

    getArticles: function(feed_id) {
      var feed = getFeed(feed_id);
      return db.getArticles(feed._id);
    },

    getTagsAndFeeds: function(callback) {
      db.getTagsAndFeeds(function(tags) {
        _tags = tags;
        callback(_tags);
      });
    },

    getCurrentFeed: function() {
      return getFeed(current_feed_id);
    },

    incrementCurrentFeedCount: function() {
      this.getCurrentFeed().unread_count += 1;
    },

    setCurrentFeed: function(feed_id) {
      current_feed_id = feed_id;
    }
  };
}])

.factory('Article', ['Database', function(db) {
  return {
    addTag: function(article, tag_name) {
      db.addArticleTag(article, tag_name);
    },

    markRead: function(article, at) {
      db.markArticleRead(article, at);
    },

    markUnread: function(article, at) {
      db.markArticleUnread(article, at);
    },

    removeTag: function(article, tag_name) {
      db.removeArticleTag(article, tag_name);
    }
  };
}])

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
