<script>
    export let time = '';
    export let league = '';
    export let team1 = '';
    export let team2 = '';
    export let top = '';

</script>
{#if time != ''}
<div class='container' style='top:{top}px'>
    <p class='time'>{time}</p>
    <p class='league'>{league}</p>
    <p class='team1'>{team1}</p>
    <p class='vs'>VS</p>
    <p class='team2'>{team2}</p>
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
        background-color: red;
        color: white;
        height: 250px;
        width: 300px;
        left: 0%;
        position: absolute;
        font-family: 'Chosence';
        font-style: italic;
    }

    .time {
        position: absolute;
        top: -10%;
        left: 5%;
        font-size: 30px;
    }

    .league {
        position: absolute;
        top: -10%;
        right: 5%;
        font-size: 30px;
    }

    .team1 {
        position: absolute;
        top: 8%;
        width: 100%;
        text-align: center;
        font-size: 50px;
        letter-spacing: 3px;
    }

    .vs {
        position: absolute;
        top: 40%;
        width: 100%;
        text-align: center;
        font-size: 40px;
        letter-spacing: 3px;
    }

    .team2 {
        position: absolute;
        bottom: -20%;
        width: 100%;
        text-align: center;
        font-size: 50px;
        letter-spacing: 3px;
        
    }

</style>