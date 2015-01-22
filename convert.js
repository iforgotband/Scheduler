var fs = require('fs');

var db;
var shiftTime = 4;
var shiftTimes = [6,7,8,9,10,11,12,1];
var allTimes = [6,7,8,9,10,11,12,1,2,3,4,5];
var centers = ['cg', 'sam'];

var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('shifts.db');

var supervisorsCSV = fs.readFileSync('supervisors.csv', {encoding: 'ASCII'});
supervisorsCSV = supervisorsCSV.split("\n");
var supervisors = {};

for (var i in supervisorsCSV) {
    if (i == 0) continue;
    var row = supervisorsCSV[i].trim().split(',');
    var shift = row[0];
    supervisors[shift] = [];

    for (var j=1; j < row.length; j++) {
        var s = parseInt(row[j]);
        if (isNaN(s)) s = 0;
        supervisors[shift].push(s);
    }
}

db.each('SELECT * FROM scheduled', function (err, doc) {
    var day = doc['hour'].substring(3, 0);
    var hour = parseInt(doc['hour'].substr(3));
    hour = 11;

    var hours = [hour];
    for (var i = 1; i < shiftTime; i++) {
        var h = (hour + i) % 12;
        h = h ? h : 12;
        hours.push(h);
    }


    for (var i in hours) {
        var shift = day + ' ' + hours[i];
        var j;

        for (j in supervisors[shift]) {
            if (supervisors[shift][j] > 0) {
                break;
            }
        }

        supervisors[shift][j]--;
    }
}, function () {
    var out = '';
    for (var i in supervisors) {
        out = out + i;

        for (var j = 0; j < supervisors[i].length; j++) {
            out = out + "," + supervisors[i][j];
        }

        out = out + "\n";
    }

    fs.writeFile("supervisors-new.csv", out);
});

