/* jshint unused: false */
/* global showdown*/
var aero = new Aerophane();

// aero.createMenu(document.querySelector("#select-admin"));
// document.querySelector("#style-default"), function () {
//     getStyle("main");
// });

aero.initNav();

var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

var daysOfTheWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function dateTitleFormat(d) {
    var date = new Date(d + "T00:00:01");
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function gigTimes(date, startTime, durationH, durationM) {
    var gigDate = new Date(date);
    var gigStart = new Date(date + "T" + startTime + ":00");
    var hourStart = gigStart.getHours();
    var minuteStart = gigStart.getMinutes();
    var durationHms = parseInt(durationH, 10) * 60 * 60 * 1000;
    var durationMms = parseInt(durationM, 10) * 60 * 1000;

    var gigEnd = new Date(+gigStart + durationHms + durationMms);
    var hourEnd = gigEnd.getHours();
    var minuteEnd = gigEnd.getMinutes();

    var amPmStart = "AM";
    if (hourStart >= 12) {
        amPmStart = "PM";
    }
    if (hourStart > 12) {
        hourStart = hourStart - 12;
    }

    if (minuteStart) {
        if (minuteStart < 10) {
            minuteStart = ":0" + minuteStart;
        } else {
            minuteStart = ":" + minuteStart;
        }
    } else {
        minuteStart = "";
    }

    var amPmEnd = "AM";
    if (hourEnd >= 12) {
        amPmEnd = "PM";
    }
    if (hourEnd > 12) {
        hourEnd = hourEnd - 12;
    }
    if (minuteStart) {
        if (minuteEnd < 10) {
            minuteEnd = ":0" + minuteEnd;
        } else {
            minuteEnd = ":" + minuteEnd;
        }
    } else {
        minuteEnd = "";
    }
    if (amPmStart === amPmEnd) {
        return `${hourStart}${minuteStart} - ${hourEnd}${minuteEnd} ${amPmEnd}`;
    }
    return `${hourStart}${minuteStart} ${amPmStart} - ${hourEnd}${minuteEnd} ${amPmEnd}`;
}

function ord(num) {
    var sup = document.createElement("sup");
    var ordText = "th";
    num = num.toString(10);
    if (num.slice(-1) === "1") {
        ordText = "st";
    }
    if (num.slice(-1) === "2") {
        ordText = "nd";
    }
    if (num.slice(-1) === "3") {
        ordText = "rd";
    }
    sup.textContent = ordText;
    return sup;
}

function gigInfoDiv(gig) {
    var converter = new showdown.Converter();
    var div = document.createElement("div");
    var h3;
    var p;
    var date = new Date(gig.date + "T00:00:01");

    if (gig.title) {
        h3 = document.createElement("h3");
        h3.textContent = gig.title;
        div.appendChild(h3);
    }

    h3 = document.createElement("h3");
    h3.textContent = `${months[date.getMonth()]} ${date.getDate()}`;
    h3.appendChild(ord(date.getDate()));
    h3.appendChild(document.createTextNode(`, ${date.getFullYear()}`));
    div.appendChild(h3);

    h3 = document.createElement("h3");
    h3.textContent = gig.venueData.name;
    div.appendChild(h3);

    p = document.createElement("p");
    p.textContent = daysOfTheWeek[date.getDay()] + ", " + gigTimes(gig.date, gig.startTime, gig.durationH, gig.durationM);
    div.appendChild(p);

    p = document.createElement("p");
    p.textContent = `${gig.venueData.city}, ${gig.venueData.state}`;
    div.appendChild(p);

    var markdown;
    if (gig.desc) {
        markdown = document.createElement("div");
        markdown.innerHTML = converter.makeHtml(gig.desc);
        div.appendChild(markdown);
    }
    return div;
}

function gigMapDiv(gig) {
    var div = document.createElement("div");
    var iframe = document.createElement("iframe");

    iframe.loading = "lazy";
    iframe.src = `https://www.google.com/maps/embed/v1/place?q=${encodeURIComponent(gig.venueData.name)}%2C+${encodeURIComponent(gig.venueData.city)}+${encodeURIComponent(gig.venueData.state)}&key=${gig.venueData.MAP_KEY}`;
    div.appendChild(iframe);
    return div;
}

function extractSpotifyTrackId(shareLink) {
    var reQs, val;
    if (!shareLink) {
        return "";
    }
    reQs = new RegExp("[.*]spotify.com/track/([^?#]*)", "i");
    val = reQs.exec(shareLink);
    if (val) {
        return val[1];
    }
    return shareLink;
}

function getJsonData(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.addEventListener("load", function () {
        var jsonData = JSON.parse(this.responseText);
        callback(jsonData);
    });
    xhr.send();
}

function embedSpotifyPlayer(id, type) {
    var iframe = document.createElement("iframe");
    iframe.className = "spotify-player-sm";
    iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
    iframe.src = `https://open.spotify.com/embed/${type}/${id}`;
    return iframe;
}

function moreButton(link, text) {
    var more;
    more = document.createElement("a");
    more.className = "more";
    more.href = link;
    more.textContent = text;
    return more;
}

function setTitle() {
    getJsonData("/api/home/", function (info) {
        document.title = `${document.title} - ${info.name}`;
    });
}
