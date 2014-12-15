var express = require('express');
var router = express.Router();
var fs = require('fs');
var csvParser = require('csv-parse');


var db;
var shiftTime = 4;
var shiftTimes = [7,8,9,10,11,12,1];
var allTimes = [7,8,9,10,11,12,1,2,3,4,5];

/* GET home page. */
router.get('/', function(req, res) {
    res.render('index', { title: 'CTL Scheduler', shifts: shiftTimes, days: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] });
});

router.post('/', function (req, res) {
    var stmt = db.prepare('SELECT COUNT(*) as count FROM people WHERE first_name = ? AND last_name = ?');
    stmt.get(req.body.first_name, req.body.last_name, function (err, row) {
        if (row['count'] > 0) {
            res.json({error: 'You have already submitted this form with this name.'});
        } else {
            stmt = db.prepare('INSERT INTO people VALUES (null, ?, ?)');
            stmt.run(req.body.first_name, req.body.last_name, function (err) {
                var stmt = db.prepare('INSERT INTO scheduled VALUES (?,?,"asdf",?)');
                stmt.run(this.lastID, req.body.shift, req.connection.remoteAddress);

                var day = req.body.shift.substring(0, 3);
                var time = req.body.shift.substring(3);

                stmt = db.prepare('UPDATE supervisor_hours SET cg = cg - 1 WHERE day=? AND hour=?');
                for (var i = 0; i < 4; i++) {
                    var t = (time + i > 12) ? 12 - time + i : time + i;
                    stmt.run(day, t);
                }

                res.json({error: null});
            });
        }
    });
});


router.get('/shifts', function (req, res) {
    var shifts = {};
    db.each('SELECT * FROM supervisor_hours', function (err, row) {
        if (shifts[row['day']] == undefined) shifts[row['day']] = {};
        shifts[row['day']][row['hour']] = row['cg'] + row['sam'];
    }, function () {
        var returnShifts = {};
        for (var i in shifts) {
            returnShifts[i] = {};
            for (var j = 0; j < shiftTimes.length; j++) {
                var min = Math.min(
                    shifts[i][shiftTimes[j]],
                    shifts[i][allTimes[j+1]],
                    shifts[i][allTimes[j+2]],
                    shifts[i][allTimes[j+3]]
                );
                returnShifts[i][shiftTimes[j]] = min;
            }
        }
        res.json(returnShifts);
    });
});


function initialize() {
    db.run('CREATE TABLE supervisor_hours (day TEXT, hour INTEGER, cg INTEGER, sam INTEGER)');
    db.run('CREATE TABLE scheduled (id INTEGER, hour INTEGER, center TEXT, ip TEXT)');
    db.run('CREATE TABLE people (id INTEGER PRIMARY KEY ASC, first_name TEXT, last_name TEXT)');

    db.serialize(function () {
        var stmt = db.prepare('INSERT INTO supervisor_hours VALUES (?,?,?,?)');

        var fileData = fs.readFileSync('./data/supervisors.csv', {encoding: 'ASCII'});
        csvParser(fileData, function (err, data) {
            for (var i = 1; i < data.length; i++) {
                if (data[i][1] == '') data[i][1] = 0;
                if (data[i][2] == '') data[i][2] = 0;

                stmt.run(
                    data[i][0].substring(0, 3),
                    data[i][0].substring(4),
                    data[i][1],
                    data[i][2]
                );
            }
        });
    });
}

module.exports = function (sqlitedb, should_init) {
  db = sqlitedb;

  if (should_init) {
      initialize();
  }

  return router;
};
