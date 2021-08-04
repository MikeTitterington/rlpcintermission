<script>
    import { fade } from 'svelte/transition'
	import { onMount } from 'svelte';
	import store from '../scripts/store.js';
	import SinglePlayer from "./SinglePlayer.svelte";

    export let teamPlayers1 = [];
    export let teamPlayers2 = [];
    export let team1Color = '';
    export let team2Color = '';
    export let team1Logo = '';
    export let team2Logo = '';
    export let team1Name = '';
    export let team2Name = '';

    onMount(() => {
		store.teamPlayers1(currentMessage => {
			teamPlayers1 = currentMessage;
		})
		store.teamPlayers2(currentMessage => {
			teamPlayers2 = currentMessage;
		})
        store.matchupTeam1Color(currentMessage => {
            team1Color = currentMessage;
        })
        store.matchupTeam2Color(currentMessage => {
            team2Color = currentMessage;
        })
        store.matchupTeam1logo(currentMessage => {
            team1Logo = currentMessage;
        })
        store.matchupTeam2logo(currentMessage => {
            team2Logo = currentMessage;
        })
        store.matchupTeam1(currentMessage => {
            team1Name = currentMessage;
        })
        store.matchupTeam2(currentMessage => {
            team2Name = currentMessage;
        })
    });

</script>
<div class='back' transition:fade="{{ duration:1000, ease:'circ' }}">
    <img src='assets\Background.png' alt='left bar'/>
    <div class='contain' id='image' transition:fade="{{ delay: 2000, duration:1000, ease:'circ' }}">
        <div class='team1'>
            <img class='img1' src='{team1Logo}'>
            <img class='img2' src='{team1Logo}'>
            <h1 class='name1'>{team1Name}</h1>
            {#each teamPlayers1 as player (player.name)}
                <SinglePlayer name={player.name} goals={player.goals} assists={player.assists} saves={player.saves} mmr={player.mmr} games={player.games} left={player.left} top='40%' back={team1Color}/>
            {/each}
        </div>
        <div class='team2'>
            <img class='img1' src='{team2Logo}'>
            <img class='img2' src='{team2Logo}'>
            {#each teamPlayers2 as player (player.name)}
                <SinglePlayer name={player.name} goals={player.goals} assists={player.assists} saves={player.saves} mmr={player.mmr} games={player.games} left={player.left} top='40%' back={team2Color}/>
            {/each}
            <h1 class='name2'>{team2Name}</h1>
        </div>
    </div>
</div>
<style>

    @font-face {
        font-family: 'Evogria';
        src:
            local('Evogria'), url('Evogria.otf') format("opentype");
    }

    .team1 .img1 {
        width: 25%;
        height: 100%;
        object-fit: contain;
        position: absolute;
        right: 0%;
    }

    .team2 .img1 {
        width: 25%;
        height: 100%;
        object-fit: contain;
        position: absolute;
        right: 0%;
    }
    
    .team1 .img2 {
        width: 25%;
        height: 100%;
        object-fit: contain;
        position: absolute;
        left: 0%;
        -webkit-transform: scaleX(-1);
        transform: scaleX(-1);
    }

    .team2 .img2 {
        width: 25%;
        height: 100%;
        object-fit: contain;
        position: absolute;
        left: 0%;
        -webkit-transform: scaleX(-1);
        transform: scaleX(-1);
    }

    .name1 {
        font-size: 60px;
        color: #ffc15e;
        position: absolute;
        z-index: 2;
        top: 0%;
        width: 100%;
        text-align: center;
        text-shadow: 2px 2px #1c1c1c;
    }

    .team1 {
        position: absolute;
        background-color: #1c1c1c;
        height: 350px;
        width: 90%;
        left: 5%;
        top: 10%;
        box-shadow: rgba(0, 0, 0, 0.25) 0px 14px 28px, rgba(0, 0, 0, 0.22) 0px 10px 10px;
        overflow: hidden;
    }

    .team2 {
        position: absolute;
        background-color: #1c1c1c;
        height: 350px;
        width: 90%;
        left: 5%;
        top: 60%;
        box-shadow: rgba(0, 0, 0, 0.25) 0px 14px 28px, rgba(0, 0, 0, 0.22) 0px 10px 10px;
        overflow: hidden;
    }

    .name2 {
        font-size: 60px;
        color: #ffc15e;
        position: absolute;
        z-index: 2;
        top: 0%;
        width: 100%;
        text-align: center;
        text-shadow: 2px 2px #1c1c1c;
    }


    .back {
        position: absolute;
        top: 0%;
        left: 0%;
        height: 1080px;
        width: 1920px;
        background-color: #1c1c1c;
        overflow: hidden;
        font-family: "Evogria";
    }

</style>