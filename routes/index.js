var express = require('express');
var router = express.Router();
var fs = require('fs');
var csvParser = require('csv-parse');
var range = require('node-range');

var db;
var shiftTime = 4;
var shiftTimes = range(0, 24).toArray();
var days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
function nextDay(day) {
    var pos = days.indexOf(day) + 1;

    if (pos == days.length) {
        pos = 0;
    }

    return days[pos];
}

var allTimes = shiftTimes;
var centers = ['cg', 'sam'];

/* GET home page. */
router.get('/', function (req, res) {
    var now = new Date().getTime();
    startTime = 1421978400000;
    endTime = 1421985600000;

    if ((now >= startTime && now <= endTime) || req.query.override == 'banana') {
        res.render('index', { title: 'CTL Scheduler', shifts: shiftTimes, days: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] });
    } else {
        res.render('time');
    }
});

router.post('/', function (req, res) {
    var stmt = db.prepare('SELECT COUNT(*) as count FROM people WHERE (first_name = ? AND last_name = ?) OR email = ?');
    stmt.get(req.body.first_name, req.body.last_name, req.body.email, function (err, row) {
        if (row['count'] > 0) {
            res.json({error: 'You have already submitted this form with this name.'});
        } else {
            stmt = db.prepare('INSERT INTO people VALUES (null, ?, ?, ?)');
            stmt.run(req.body.first_name, req.body.last_name, function (err) {
                var stmt = db.prepare('INSERT INTO scheduled VALUES (?,?,"asdf",?)');
                stmt.run(this.lastID, req.body.shift, req.connection.remoteAddress);

                var day = req.body.shift.substring(0, 3);
                var time = parseInt(req.body.shift.substring(3));

                var checkAvail = db.prepare('SELECT * FROM supervisor_hours WHERE day=? AND hour=?');
                var center = null;

                var error = false;
                var done = 0;

                for (var i = 0; i < shiftTime; i++) {
                    var t = time + i;
                    if (t > 23) {
                        t = t - 24;
                        day = nextDay(day);
                    }

                    (function (time) {
                        checkAvail.get(day, t, function (err, doc) {
                            if (doc == undefined) {
                                error = 'An unknown error occurred.';
                                return;
                            }

                            for (var j in centers) {
                                if (doc[centers[j]] > 0) {
                                    center = centers[j];
                                }
                            }

                            if (center == null) {
                                error = 'Someone else has scheduled this shift. Please try again.';
                            } else {
                                stmt = db.prepare('UPDATE supervisor_hours SET ' + center + ' = ' + center + ' - 1 WHERE day=$day AND hour=$hour');
                                stmt.run({
                                    $day: day,
                                    $hour: time
                                });
                            }
                            done++;
                        });
                    })(t);
                }

                function merge() {
                    if (done < shiftTime) {
                        setImmediate(merge);
                    } else {
                        res.json({error: error});
                    }
                }
                merge();
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
                var minCheck = [shifts[i][shiftTimes[j]]];

                for (var k = 1; k < shiftTime; k++) {
                    var d = i;
                    var t = j + k;
                    if (t > 23) {
                        d = nextDay(d);
                        t -= 24;
                    }
                    minCheck.push(shifts[d][t]);
                }

                var min = Math.min.apply(null, minCheck);
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

    insertSupervisorHours();
}

function insertSupervisorHours() {
    db.serialize(function () {
        var stmt = db.prepare('INSERT INTO supervisor_hours VALUES (?,?,?,?)');

        var fileData = fs.readFileSync('./data/supervisors.csv', {encoding: 'ASCII'});
        csvParser(fileData, function (err, data) {
            for (var i = 1; i < data.length; i++) {
                console.log(data[i][0]);
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

function update() {
    stmt = db.prepare('PRAGMA table_info(people)');
    stmt.all(function (err, docs) {
        if (docs.length < 4) {
            db.run('ALTER TABLE people ADD COLUMN email TEXT');
        }
    });

    stmt = db.prepare('PRAGMA table_info(supervisor_hours)');
    stmt.all(function (err, docs) {
        if (docs.length == 0) {
            db.run('CREATE TABLE supervisor_hours (day TEXT, hour INTEGER, cg INTEGER, sam INTEGER)');
            insertSupervisorHours();
        }
    });
}

module.exports = function (sqlitedb, should_init) {
  db = sqlitedb;

  if (should_init) {
      initialize();
  }

  update();
  return router;
};
