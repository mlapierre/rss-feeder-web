var fs = require('fs');
var config = fs.readFileSync('scripts/config.tmpl', 'utf8');

config = config.replace(/%API_PORT%/g, process.env.API_PORT);
config = config.replace(/%API_ADDR%/g, process.env.API_ADDR);
config = config.replace(/%FEEDERDB_ADDR%/g, process.env.FEEDERDB_ADDR);
config = config.replace(/%FEEDERDB_PORT%/g, process.env.FEEDERDB_PORT);

fs.writeFile("app/js/config.js", config, function(err) {
    if(err) {
        return console.log(err);
    }
    console.log("The config file was saved.");
});