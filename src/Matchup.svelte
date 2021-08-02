<script>
	import MatchupTeam from "./MatchupTeam.svelte";
	import { onMount } from 'svelte';
	import store from '../scripts/store.js';
    import { fade } from 'svelte/transition';

    let team1Name = '';
    let team2Name = '';
    let team1Logo = '';
    let team2Logo = '';
    let team1Record = '';
    let team2Record = '';
    let team1Color = '';
    let team2Color = '';

    onMount(() => {
        store.matchupTeam1(currentMessage => {
            team1Name = currentMessage;
        })
        store.matchupTeam2(currentMessage => {
            team2Name = currentMessage;
        })
        store.matchupTeam1logo(currentMessage => {
            team1Logo = currentMessage;
        })
        store.matchupTeam2logo(currentMessage => {
            team2Logo = currentMessage;
        })
        store.matchupTeam1Record(currentMessage => {
            team1Record = currentMessage;
        })
        store.matchupTeam2Record(currentMessage => {
            team2Record = currentMessage;
        })
        store.matchupTeam1Color(currentMessage => {
            team1Color = currentMessage;
        })
        store.matchupTeam2Color(currentMessage => {
            team2Color = currentMessage;
        })
    });

    function preload(src) {
        return new Promise(function(resolve) {
            let img = new Image()
            img.onload = resolve
            img.src = src
        })
    }




</script>

{#await preload('https://cdn.discordapp.com/attachments/402228472744902656/410550548748697610/RLPC_Logo.png') then _}
    <MatchupTeam name='{team1Name}' rec='{team1Record}' logo='{team1Logo}' color={team1Color}/>
    <img src='https://cdn.discordapp.com/attachments/402228472744902656/410550548748697610/RLPC_Logo.png' alt='logo' transition:fade={{duration:2000, ease: 'circ', delay: 1500}}/>
    <MatchupTeam name='{team2Name}' logo='{team2Logo}' rec='{team2Record}' dir='right' color={team2Color}/>
{/await}
<style>
    img {
        position: absolute;
        height: 30%;
        width: 30%;
        left: 35%;
        top: 37%;
        object-fit: contain;
        z-index: 1;
        filter: drop-shadow(0px 10px 10px #1c1c1c);
    }
</style>