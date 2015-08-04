/*jshint node:true*/

var express = require('express'),
    logger = require('morgan');
    // session = require('express-session'),
    // cookieParser = require('cookie-parser'),
    // bodyParser = require('body-parser'),
    // passport = require('passport'),
    // methodOverride = require('method-override');

var app = express();

app.use(express.static(__dirname + '/app'));
app.use(logger());
// app.use(cookieParser());
// app.use(bodyParser());
// app.use(methodOverride());
// app.use(session({ secret: 'uEhdLyHXQ8KLcEdR7WhKzFLHKDP3pM3V' }));
// app.use(passport.initialize());
// app.use(passport.session());
// app.use(express.Router());

var server = app.listen(8000, function() {
  console.log('Server listening at http://%s:%s',
    server.address().address, server.address().port);
});