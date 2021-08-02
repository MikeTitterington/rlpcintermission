<script>
    import { fade } from 'svelte/transition'
	import { slide } from 'svelte/transition';
    import { textfit } from 'svelte-textfit';
    export let name;
    export let goals;
    export let assists;
    export let saves;
    export let mmr;
    export let games;
    export let left;
    export let top;
    export let back;
    if (goals == ''){
        goals = 0.00
    }
    if (assists == ''){
        assists = 0.00
    }
    if (saves == ''){
        saves = 0.00
    }
</script>

<div class='player' transition:fade="{{ duration:3000, ease:'circ' }}" style='left: {left}px; top: {top}; background-color: {back}'>
    <div class='name' use:textfit={
        {
          mode:"single", max:25,
          forceSingleModeWidth:false
        }
      }>{name}</div>
    <div class='mmr'>{mmr}</div>
    <div class='delayReveal' transition:slide="{{ delay:3000, duration:1000, ease:'circ' }}" style='background-color: {back}'>
        <div class='goals'>Goals: {goals}</div>
        <div class='assists'>Assists: {assists}</div>
        <div class='saves'>Saves: {saves}</div>
        <div class='games'>Games: {games}</div>
    </div>
</div>

<style>

    @font-face {
        font-family: 'Evogria';
        src:
            local('Evogria'), url('Evogria.otf') format("opentype");
    }

    .player {
        position: absolute;
        color: #ffc15e;
        font-family: Evogria;
        height: 50px;
        width: 300px;
    }
    .name {
        position: absolute;
        top: 0;
        left: 10px;
        line-height: 50px;
        height: 50px;
        width: 200px;
    }
    .mmr {
        position: absolute;
        top: 0;
        right: 10px;
        font-size: 25px;
        line-height: 50px;
    }
    .delayReveal {
        position: absolute;
        top: 50px;
        height: 100px;
        width: 100%;
    }
    .goals {
        position: absolute;
        top: 0%;
        height: 25%;
        width: 100%;
        left: 10px;
    }
    .assists {
        position: absolute;
        top: 25%;
        height: 25%;
        width: 100%;
        left: 10px;
    }
    .saves {
        position: absolute;
        top: 50%;
        height: 25%;
        width: 100%;
        left: 10px;
    }
    .games {
        position: absolute;
        top: 75%;
        height: 25%;
        width: 100%;
        left: 10px;
    }
</style>