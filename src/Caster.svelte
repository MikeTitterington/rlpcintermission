
<script>
	import { fade } from 'svelte/transition';
	import { onMount } from 'svelte';
    let pbpVideo;
    let colorVideo;
    let pbpName;
    let colorName;
    let pbpImage;
    let colorImage;
	import store from '../scripts/store.js';
    onMount(() => {
		store.pbpVideo(currentMessage => {
			pbpVideo = currentMessage;
            console.log(pbpVideo)
		})
		store.colorVideo(currentMessage => {
			colorVideo = currentMessage;
            console.log(colorVideo)
		})
		store.pbpName(currentMessage => {
			pbpName = currentMessage.toUpperCase();
		})
		store.colorName(currentMessage => {
			colorName = currentMessage.toUpperCase();
		})
		store.pbpImage(currentMessage => {
			pbpImage = currentMessage;
		})
		store.colorImage(currentMessage => {
			colorImage = currentMessage;
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
<div class='container' transition:fade="{{ duration:1000, ease:'circ' }}">
    <div class='background'>
        <img src='https://media.discordapp.net/attachments/804171789101432832/845380799498944532/playoff2split.png?width=1920&height=1080' alt='background'>
    </div>
    
    {#if pbpVideo != 'null'}
        <div class='pbp' transition:fade="{{ duration:3000 }}">
            <iframe allowtransparency="true" src="{pbpVideo}" title="description" allow="autoplay; encrypted-media" frameborder="0"></iframe>
        </div>
    {/if}
    
    {#if colorVideo != 'null'}
        <div class='color' transition:fade="{{ duration:3000 }}">
            <iframe allowtransparency="true" src="{colorVideo}" title="description" allow="autoplay; encrypted-media" frameborder="0"></iframe>
        </div>
    {/if}
    {#await preload(pbpImage) then _}
        <div class='pbp2' transition:fade="{{ duration:3000 }}">
            <img src='{pbpImage}' alt='pbp'>
            <div class='pName'>{pbpName}</div>
        </div>
    {/await}
    {#await preload(colorImage) then _}
        <div class='color2' transition:fade="{{ duration:3000 }}">
            <img src='{colorImage}' alt='color'>
            <div class='pName'>{colorName}</div>
        </div>
    {/await}
</div>
<style>

    @font-face {
        font-family: 'Evogria';
        src:
            local('Evogria'), url('Evogria.otf') format("opentype");
    }


    .container {
        position: absolute;
        height: 1080px;
        width: 1920px;
        overflow: hidden;
        top: 0%;
        left: 0%;
        font-family: 'Evogria';
    }
    .pbp {
        position: absolute;
        top: 25%;
        left: 0px;
        width: 50%;
        height: 60%;
        z-index: 2;
    }

    .pName {
        position: absolute;
        font-size: 40px;
        color: white;
        top: 385px;
        width: 380px;
        height: 68px;
        left: 152px;
        line-height: 68px;
        text-align: center;
    }

    .pbp iframe {
        object-fit: contain;
        height: 100%;
        width: 100%;
    }

    .color {
        position: absolute;
        top: 25%;
        left: 50%;
        width: 50%;
        height: 60%;
        z-index: 2;
    }

    .color iframe {
        object-fit: contain;
        height: 100%;
        width: 100%;
        background-color: transparent;
    }

    .pbp2 {
        position: absolute;
        top: 350px;
        left: 170px;
        background-color: black;
        width: 682px;
        height: 380px;
    }

    .pbp2 img {
        object-fit: contain;
        height: 100%;
        width: 100%;
    }

    .color2 {
        position: absolute;
        top: 350px;
        left: 1072px;
        background-color: black;
        width: 682px;
        height: 380px;
    }

    .color2 img {
        object-fit: contain;
        height: 100%;
        width: 100%;
    }

    .background {
        position: absolute;
        top: 0;
        left: 0;
    }

</style>
