<script>
	import { fade, fly } from 'svelte/transition';
    export let time = '';
    export let league = '';
    export let team1 = '';
    export let team2 = '';
    export let top = '';
    import { textfit } from 'svelte-textfit';
</script>
{#if time != ''}
<div class='container' style='top:{top}px'>
    <p class='time'>{time} ET</p>
    <p class='league'>{league}</p>
    <p class='vs'>VS</p>
    <p class='team1' use:textfit={
        {
          mode:"single", max:45,
          forceSingleModeWidth:false
        }
      }>{team1}</p>
    <p class='team2' use:textfit={
        {
          mode:"single", max:45,
          forceSingleModeWidth:false
        }
      }>{team2}</p>
</div>
{/if}


<style>

    @font-face {
        font-family: 'Evogria';
        src:
            local('Evogria'), url('Evogria.otf') format("opentype");
    }

    @font-face {
        font-family: 'Chosence';
        src:
            local('Chosence Regular'), url('Chosence Regular.otf') format("opentype");
    }

    .container {
        color: white;
        height: 200px;
        width: 320px;
        left: 0%;
        position: absolute;
        font-family: 'Evogria';
        font-style: italic;
        letter-spacing: 5px;
    }

    .time {
        position: absolute;
        top: -15%;
        left: 0%;
        font-size: 30px;
        text-align: center;
        width: 160px;
        letter-spacing: 3px;
    }

    .league {
        position: absolute;
        top: -15%;
        right: 0%;
        font-size: 30px;
        text-align: center;
        width: 100px;
    }

    .team1 {
        position: absolute;
        top: 1%;
        width: 100%;
        text-align: center;
        height: 50px;
        line-height: 50px;
    }

    .vs {
        position: absolute;
        top: 32%;
        width: 100%;
        text-align: center;
        font-size: 35px;
    }

    .team2 {
        position: absolute;
        bottom: -19%;
        width: 100%;
        text-align: center;
        height: 50px;
        line-height: 50px;
        
    }

</style>