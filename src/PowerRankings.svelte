<script>
	import { onMount } from 'svelte';
	import store from '../scripts/store.js';
	import TeamPR from "./TeamPR.svelte";
    import html2canvas from 'html2canvas';

    export let powerRankings = [];
    export let league = '';

    onMount(() => {
		store.powerRankings(currentMessage => {
			powerRankings = currentMessage;
		})
		store.league(currentMessage => {
			league = currentMessage;
		})
    });

    function downloadURI(uri, name) {
        var link = document.createElement("a");

        link.download = name;
        link.href = uri;
        document.body.appendChild(link);
        link.click();
        clearDynamicLink(link); 
    }

    function DownloadAsImage() {
        var element = document.getElementById("image");
        html2canvas(element).then(function (canvas) {
            var myImage = canvas.toDataURL();
            downloadURI(myImage, league + ".png");
        });
    }

</script>
<div class='back'>
    <div class='contain' id='image'>
        <h1>{league} Power Rankings</h1>
        {#each powerRankings as team (team.id)}
            <TeamPR team={team.team} logo={team.logo} standing={team.id} top={team.top} left={team.left}/>
        {/each}
    </div>
    <button on:click={DownloadAsImage}>
        Download Image
    </button>
</div>
<style>

    @font-face {
        font-family: 'Evogria';
        src:
            url('../Evogria.otf');
    }

    h1 {
        color: #ffc15e;
        position: absolute;
        width: 900px;
        height: 886px;
        left: 30px;
        text-align: center;
        background-color: #1c1c1c;
        font-size: 50px;
        line-height: 80px;
        top:-20px;
        font-family: Evogria;
        border: #f4faff 1px solid;
    }

    button {
        position: absolute;
        z-index: 2;
        left: 980px;
        display: none;
    }

    .contain {
        position: absolute;
        top: 80px;
        left: 480px;
        height: 900px;
        width: 960px;
        background-color: #1c1c1c;
    }

    .back {
        position: absolute;
        top: 0%;
        left: 0%;
        height: 1080px;
        width: 1920px;
        background-color: #1c1c1c;
        overflow: hidden;
    }

</style>