<script>
    import { fade } from 'svelte/transition'
	import { onMount } from 'svelte';
	import store from '../scripts/store.js';
	import SinglePlayer from "./SinglePlayer.svelte";

    export let teamPlayers1 = [];
    export let teamPlayers2 = [];
    export let team1Color = '';
    export let team2Color = '';

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
    });

</script>
<div class='back'  transition:fade="{{ duration:1000, ease:'circ' }}">
    <div class='contain' id='image'>
        {#each teamPlayers1 as player (player.name)}
            <SinglePlayer name={player.name} goals={player.goals} assists={player.assists} saves={player.saves} mmr={player.mmr} games={player.games} left={player.left} top='20%' back={team1Color}/>
        {/each}
        {#each teamPlayers2 as player (player.name)}
            <SinglePlayer name={player.name} goals={player.goals} assists={player.assists} saves={player.saves} mmr={player.mmr} games={player.games} left={player.left} top='60%' back={team2Color}/>
        {/each}
    </div>
</div>
<style>

    @font-face {
        font-family: 'Evogria';
        src:
            local('Evogria'), url('Evogria.otf') format("opentype");
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