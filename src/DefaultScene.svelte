<script>
    import { fade } from 'svelte/transition'
</script>

<div class='contain'  transition:fade="{{ duration:1000, ease:'circ' }}">
    <img src='https://media.discordapp.net/attachments/829498943309086782/930167400807141386/RLPC_S16_BG.png?width=1920&height=1080'>
</div>

<style>
    .contain {
        position: absolute;
        top: 0%;
        left: 0%;
    }

    img {
        height: 100%;
        width: 100%;
        object-fit: contain;
    }
</style>