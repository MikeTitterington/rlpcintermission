<script>
    import { fade } from 'svelte/transition'
	import { onMount } from 'svelte';
	import store from '../scripts/store.js';
	import SinglePlayer from "./SinglePlayer.svelte";

    export let teamPlayers = [];

    onMount(() => {
		store.teamPlayers1(currentMessage => {
			teamPlayers = currentMessage;
		})
    });

</script>
<div class='back'  transition:fade="{{ duration:1000, ease:'circ' }}">
    <div class='contain' id='image'>
        {#each teamPlayers as player (player.id)}
            <SinglePlayer name={player.name} goals={player.goals} assists={player.assists} saves={player.saves} mmr={player.mmr} games={player.games}/>
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