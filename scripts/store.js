import { writable } from 'svelte/store';
import jQuery from 'jquery';
export const pbpVideo = writable('');
export const colorVideo = writable('');
export const pbpName = writable('');
export const colorName = writable('');
export const pbpImage = writable('');
export const colorImage = writable('');
export const tickerInfo = writable('');
export const currentScene = writable('caster');
let stop = false;
import WsSubscribers from '../scripts/ws_subscriber.js';

WsSubscribers.subscribe("ws", "open", function() {
    WsSubscribers.send("cb", "first_connect", {
        'name': 'Scorebug'
    });
    setInterval(function () {
        WsSubscribers.send("cb", "heartbeat", "heartbeat");
    }, 1000);
});

WsSubscribers.init(49322, false, [
    "game:update_state",
    "cb:heartbeat"
]);

WsSubscribers.subscribe("sos", "casters_update", (d) => {
    console.log(d['casters']);
    pbpVideo.set(d['casters']['left']['obs']);
    colorVideo.set(d['casters']['right']['obs']);
    stop = true;
  });

function updateCasters() {
    if (!stop) {
        var url = "https://spreadsheets.google.com/feeds/cells/1mDV2D9MRoYX-7f4eBDlllvBq-kewCFQ6kRbCf3ML6uk/od6/public/basic?alt=json";
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                var obj = JSON.parse(this.response);
                var i;
                var tickerInfoLocal = '';
                var entry = obj['feed']['entry']
                for (i = 0; i < entry.length; i++) {
                    let test = obj['feed']['entry'][i]['title']['$t'].slice(-2);
                    if (obj['feed']['entry'][i]['title']['$t'] == "H12") {
                        pbpVideo.set(obj['feed']['entry'][i]['content']['$t']);
                    } else if (obj['feed']['entry'][i]['title']['$t'] == "H13") {
                        colorVideo.set(obj['feed']['entry'][i]['content']['$t']);
                    } else if (obj['feed']['entry'][i]['title']['$t'] == "I23") {
                        pbpName.set(obj['feed']['entry'][i]['content']['$t']);
                    } else if (obj['feed']['entry'][i]['title']['$t'] == "J23") {
                        pbpImage.set(obj['feed']['entry'][i]['content']['$t']);
                    } else if (obj['feed']['entry'][i]['title']['$t'] == "I24") {
                        colorName.set(obj['feed']['entry'][i]['content']['$t']);
                    } else if (obj['feed']['entry'][i]['title']['$t'] == "J24") {
                        colorImage.set(obj['feed']['entry'][i]['content']['$t']);
                    } else if (obj['feed']['entry'][i]['title']['$t'] == "B5") {
                        var tempAr = obj['feed']['entry'][i]['content']['$t'].split(",");
                        tickerInfoLocal = tickerInfoLocal + "<p style='padding-left: 25px;'>" + tempAr[0] + " " + tempAr[1] + "-" + tempAr[2] + " " + tempAr[3] + "</p><p style='padding-left: 25px;'>|</p>";
                    } else if (obj['feed']['entry'][i]['title']['$t'] == "B5") {
                        var tempAr = obj['feed']['entry'][i]['content']['$t'].split(",");
                        tickerInfoLocal = tickerInfoLocal + "<p style='padding-left: 25px;'>" + tempAr[0] + " " + tempAr[1] + "-" + tempAr[2] + " " + tempAr[3] + "</p><p style='padding-left: 25px;'>|</p>";
                    } else if (obj['feed']['entry'][i]['title']['$t'] == "B6") {
                        var tempAr = obj['feed']['entry'][i]['content']['$t'].split(",");
                        tickerInfoLocal = tickerInfoLocal + "<p style='padding-left: 25px;'>" + tempAr[0] + " " + tempAr[1] + "-" + tempAr[2] + " " + tempAr[3] + "</p><p style='padding-left: 25px;'>|</p>";
                    } else if (obj['feed']['entry'][i]['title']['$t'] == "B7") {
                        var tempAr = obj['feed']['entry'][i]['content']['$t'].split(",");
                        tickerInfoLocal = tickerInfoLocal + "<p style='padding-left: 25px;'>" + tempAr[0] + " " + tempAr[1] + "-" + tempAr[2] + " " + tempAr[3] + "</p><p style='padding-left: 25px;'>|</p>";
                    } else if (obj['feed']['entry'][i]['title']['$t'] == "B8") {
                        var tempAr = obj['feed']['entry'][i]['content']['$t'].split(",");
                        tickerInfoLocal = tickerInfoLocal + "<p style='padding-left: 25px;'>" + tempAr[0] + " " + tempAr[1] + "-" + tempAr[2] + " " + tempAr[3] + "</p><p style='padding-left: 25px;'>|</p>";
                    } else if (obj['feed']['entry'][i]['title']['$t'] == "B9") {
                        var tempAr = obj['feed']['entry'][i]['content']['$t'].split(",");
                        tickerInfoLocal = tickerInfoLocal + "<p style='padding-left: 25px;'>" + tempAr[0] + " " + tempAr[1] + "-" + tempAr[2] + " " + tempAr[3] + "</p><p style='padding-left: 25px;'>|</p>";
                    } else if (obj['feed']['entry'][i]['title']['$t'] == "B10") {
                        var tempAr = obj['feed']['entry'][i]['content']['$t'].split(",");
                        tickerInfoLocal = tickerInfoLocal + "<p style='padding-left: 25px;'>" + tempAr[0] + " " + tempAr[1] + "-" + tempAr[2] + " " + tempAr[3] + "</p><p style='padding-left: 25px;'>|</p>";
                    }
                }
                tickerInfo.set(tickerInfoLocal);
            }
        };
        xhttp.open("GET", url, true);
        xhttp.send();
    }
    
}
var myVar = setInterval(updateCasters, 5000);
updateCasters();

export default {
	pbpVideo: pbpVideo.subscribe,
	colorVideo: colorVideo.subscribe,
	pbpName: pbpName.subscribe,
	colorName: colorName.subscribe,
	pbpImage: pbpImage.subscribe,
	colorImage: colorImage.subscribe,
	currentScene: currentScene.subscribe,
	tickerInfo: tickerInfo.subscribe
    
}