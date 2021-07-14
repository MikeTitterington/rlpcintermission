
<script src="/vendor/jQuery.js">
    import jQuery from 'jquery'
</script>
<script context='module'>
    function updateCasters() {
        var url = "https://spreadsheets.google.com/feeds/cells/1mDV2D9MRoYX-7f4eBDlllvBq-kewCFQ6kRbCf3ML6uk/od6/public/basic?alt=json";
        var xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function() {
            if (this.readyState == 4 && this.status == 200) {
                var obj = JSON.parse(this.response);
                var i;
                var entry = obj['feed']['entry']
                for (i = 0; i < entry.length; i++) {
                    let test = obj['feed']['entry'][i]['title']['$t'].slice(-2);
                    if (obj['feed']['entry'][i]['title']['$t'] == "H12") {
                        if(jQuery(".pbp iframe").attr('src') != obj['feed']['entry'][i]['content']['$t']){
                            jQuery(".pbp iframe").attr('src', (obj['feed']['entry'][i]['content']['$t']));
                        }
                    } else if (obj['feed']['entry'][i]['title']['$t'] == "H13") {
                        if(jQuery(".color iframe").attr('src') != obj['feed']['entry'][i]['content']['$t']){
                            jQuery(".color iframe").attr('src', (obj['feed']['entry'][i]['content']['$t']));
                        }
                    }
                }
            }
        };
        xhttp.open("GET", url, true);
        xhttp.send();
    }
    var myVar = setInterval(updateCasters, 5000);
    updateCasters();

</script>
<div class='background'>
    <img src='https://media.discordapp.net/attachments/804171789101432832/845380799498944532/playoff2split.png?width=1920&height=1080' alt='background'>
</div>
<div class='pbp'>
    <iframe allowtransparency="true" src="https://obs.ninja/?view=kfbdg3r&scene&room=rlpc&password=rlpc?autoplay=1" title="description" allow="autoplay; encrypted-media" frameborder="0"></iframe>
</div>
<div class='color'>
    <iframe allowtransparency="true" src="https://obs.ninja/?view=kfbdg3r&scene&room=rlpc&password=rlpc?autoplay=1" title="description" allow="autoplay; encrypted-media" frameborder="0"></iframe>
</div>
<style>

    .pbp {
        position: absolute;
        top: 25%;
        left: 0px;
        width: 50%;
        height: 60%;
    }

    .pbp iframe {
        object-fit: contain;
        height: 100%;
        width: 100%;
    }

    .color {
        position: absolute;
        top: 25%;
        left: 50%;
        width: 50%;
        height: 60%;
    }

    .color iframe {
        object-fit: contain;
        height: 100%;
        width: 100%;
        background-color: transparent;
    }

    .background {
        position: absolute;
        top: 0;
        left: 0;
    }

</style>
