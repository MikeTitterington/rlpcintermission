<script>
    import { fly, fade } from 'svelte/transition';
    export let name = '';
    export let logo = '';
    export let rec = '';
    export let color = '';
    export let dir = 'left';

    
    function preload(src) {
        return new Promise(function(resolve) {
            let img = new Image()
            img.onload = resolve
            img.src = src
        })
    }

</script>
{#await preload(logo) then _}
    {#if dir == 'left'}
        <div class='container' in:fly="{{ duration:2000, x: -1000, delay: 1500}}" style='background-color: {color};'>
            <div class='name'>{name}</div>
            <div class='record'>{rec}</div>
            <img class='logo' src='{logo}' alt='logo' style="filter: drop-shadow(-10px 10px 10px #1c1c1c);"/>
        </div>
    {:else if dir == 'right'}
        <div class='container2' in:fly="{{ duration:2000, x: 1000, delay: 1500}}" style='background-color: {color};'>
            <div class='name2'>{name}</div>
            <div class='record2'>{rec}</div>
            <img class='logo2' src='{logo}' alt='logo' style="filter: drop-shadow(10px 10px 10px #1c1c1c);"/>
        </div>
    {/if}
{/await}

<style>

    @font-face {
        font-family: 'Evogria';
        src:
            local('Evogria'), url('Evogria.otf') format("opentype");
    }

    .container {
        position: absolute;
        height: 300px;
        width: 50%;
        top: 50%;
        border: 30px #E4b363;
        border-style: outset hidden outset hidden ;
    }

    .name {
        position: absolute;
        left: 50%;
        line-height: 300px;
        font-size: 80px;
        color: #F4faff;
        font-family: 'Evogria';
        text-align: center;
        width: 50%;
    }

    .record {
        position: absolute;
        left: 50%;
        line-height: 100px;
        font-size: 40px;
        color: #F4faff;
        font-family: 'Evogria';
        bottom:0;
        text-align: center;
        width: 50%;
    }

    .logo {
        width: 50%;
        left: 0%;
        position: absolute;
        height: 170%;
        top: -50%;
        object-fit: contain;
        -webkit-transform: perspective(1000px) rotateY(20deg);
        transform: perspective(1000px) rotateY(20deg);
        margin: 50px 10px;
        background-origin: border-box;
    }

    .container2 {
        position: absolute;
        height: 300px;
        width: 50%;
        top: 50%;
        right: 0;
        border: 30px #E4b363;
        border-style: outset hidden outset hidden ;
    }

    .name2 {
        position: absolute;
        right: 50%;
        line-height: 300px;
        font-size: 80px;
        color: #F4faff;
        font-family: 'Evogria';
        text-align: center;
        width: 50%;
    }

    .record2 {
        position: absolute;
        right: 50%;
        line-height: 100px;
        font-size: 40px;
        color: #F4faff;
        font-family: 'Evogria';
        bottom:0;
        text-align: center;
        width: 50%;
    }

    .logo2 {
        width: 50%;
        right: 0%;
        position: absolute;
        height: 170%;
        top: -50%;
        object-fit: contain;
        -webkit-transform: perspective(1000px) rotateY(-20deg);
        transform: perspective(1000px) rotateY(-20deg);
        margin: 50px 10px;
        background-origin: border-box;
    }

</style>