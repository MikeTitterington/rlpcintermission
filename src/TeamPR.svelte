<script>
    import { fade } from 'svelte/transition'
    export let team = '';
    export let logo = '';
    export let standing = '';
    export let top = 0;
    export let left = 0;
    let color = '';

    if ((top/100) % 2 == 0){
        color = '#1c1c1c';
    } else {
        color = '#a3141b';
    }
    function preload(src) {
        return new Promise(function(resolve) {
            let img = new Image()
            img.onload = resolve
            img.src = src
        })
    }
</script>
{#await preload(logo) then _}
    <div class='team' style="top:{top}px; background-color: {color}; left: {left+30}px" transition:fade={{duration: 3000}}>
        <p class='name'>{team}</p>
        <img src={logo} alt='team'>
        <p class='place'>{standing}</p>
    </div>
{/await}
<style>

    @font-face {
        font-family: 'Evogria';
        src:
            url('../Evogria.otf') format("opentype");
    }

    img {
        position: absolute;
        right: 1px;
        height: 100px;
        width: 100px;
        object-fit: contain;
    }

    .name {
        position: absolute;
        left: 60px;
        top:0;
    }

    .team {
        position: absolute;
        height: 100px;
        width: 400px;
        line-height: 30px;
        font-size: 35px;
        font-family: Evogria;
        color: #ffc15e;
        border: #f4faff 1px solid;
    }

    .place {
        position: absolute;
        left: 0px;
        top:0;
        width: 50px;
        text-align: center;
    }
</style>