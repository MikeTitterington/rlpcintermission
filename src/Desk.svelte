<script>
	import { fade, fly } from 'svelte/transition';
	import Ticker from './Ticker.svelte';
	import GameDesk from './GameDesk.svelte';
	import store from '../scripts/store.js';
	import { tickerInfo } from '../scripts/store.js';
	import { onMount } from 'svelte';
	import DefaultScene from "./DefaultScene.svelte";
	import DeskTicker from "./DeskTicker.svelte";
    export let tonightGames = [];
    let deskVideo = '';
    let anal1Video = '';
    let anal2Video = '';
    let numb = '';
    let currentScene = '';
    let cameraOption = 'off';
    let vidOption = 'off';
    let pbpVideo = '';
    let colorVideo = '';
    
    onMount(() => {
		store.tonightGames(currentMessage => {
			tonightGames = currentMessage;
		})
		store.deskVideo(currentMessage => {
			deskVideo = currentMessage;
		})
		store.anal1Video(currentMessage => {
			anal1Video = currentMessage;
		})
		store.anal2Video(currentMessage => {
			anal2Video = currentMessage;
		})
		store.pbpVideo(currentMessage => {
			pbpVideo = currentMessage;
		})
		store.colorVideo(currentMessage => {
			colorVideo = currentMessage;
		})
		store.numb(currentMessage => {
			numb = currentMessage;
		})
		store.currentScene(currentMessage => {
			currentScene = currentMessage;
		})
		store.cameraOption(currentMessage => {
			cameraOption = currentMessage;
		})
		store.vidOption(currentMessage => {
			vidOption = currentMessage;
		})
    });
</script>
<div class='container' in:fade="{{ duration:1000, ease:'circ' }}" out:fade="{{ delay: 1000, duration:1000, ease:'circ' }}">
    <img src='assets\Background.png' alt='left bar'/>
    <div in:fly="{{ duration:2000, delay: 1500, ease:'circ', x:-1000}}" out:fly="{{ duration:2000, ease:'circ', x:-1000}}" style='position: absolute; z-index: 2'>
        <img src='assets/RLPC_Desk_Bar.png' alt='RLPC bar'/>
        <img src='assets/Left_Red_Bar.png' alt='left bar'/>
        <div class='topLeft'>
            <p class='rlpcDesk'>RLPC DESK</p>
            <p class='tonightDesk'>TODAY'S MATCHES</p>
        </div>
        <img src='assets/Todays_Matches_Bar.png' alt='left bar'/>
    </div>
    <div in:fly="{{ duration:2000, delay: 1500, ease:'circ', x:-1000}}" out:fly="{{ duration:2000, ease:'circ', x:-1000}}" style='position: absolute; z-index: 2'>
        {#each tonightGames as game (game.time)}
                <GameDesk time={game.time} league={game.league} team1={game.team1} team2={game.team2} top={game.top}/>
        {/each}
    </div>
    <div in:fly="{{ duration:2000, delay: 500, ease:'circ', y:1000}}" out:fly="{{ duration:2000, ease:'circ', y:1000}}">
        <img src='assets/Bottom_Ticker_Tape.png' alt='ticker'/>
        <DeskTicker />
    </div>
    
    {#if cameraOption == 'on'}
        {#if numb == '3'}
            <img src='assets\3_Boxes.png' alt='left bar' transition:fade="{{ duration:1000, delay:2000, ease:'circ' }}"/>
            {#if deskVideo != 'null'}
                <div class='desk'>
                    <iframe allowtransparency="true" src="{deskVideo}" title="description" allow="autoplay; encrypted-media" frameborder="0" transition:fade="{{ duration:1000, delay:2000, ease:'circ' }}"></iframe>
                </div>
            {/if}
            
            {#if anal1Video != 'null'}
                <div class='anal1'>
                    <iframe allowtransparency="true" src="{anal1Video}" title="description" allow="autoplay; encrypted-media" frameborder="0" transition:fade="{{ duration:1000, delay:2000, ease:'circ' }}"></iframe>
                </div>
            {/if}

            {#if anal2Video != 'null'}
                <div class='anal2'>
                    <iframe allowtransparency="true" src="{anal2Video}" title="description" allow="autoplay; encrypted-media" frameborder="0" transition:fade="{{ duration:1000, delay:2000, ease:'circ' }}"></iframe>
                </div>
            {/if}
        {:else}
            <img src='assets\2_Boxes.png' alt='left bar' transition:fade="{{ duration:1000, delay:2000, ease:'circ' }}"/>
            {#if pbpVideo != 'null'}
                <div class='desk2'>
                    <iframe allowtransparency="true" src="{pbpVideo}" title="description" allow="autoplay; encrypted-media" frameborder="0" transition:fade="{{ duration:1000, delay:2000, ease:'circ' }}"></iframe>
                </div>
            {/if}
            
            {#if colorVideo != 'null'}
                <div class='anal12'>
                    <iframe allowtransparency="true" src="{colorVideo}" title="description" allow="autoplay; encrypted-media" frameborder="0" transition:fade="{{ duration:1000, delay:2000, ease:'circ' }}"></iframe>
                </div>
            {/if}
        {/if}
    {:else}
        {#if vidOption == 'on'}
            <div class='vid' transition:fade="{{ duration:1000, delay:2000, ease:'circ' }}">
                <iframe height='1015px' width='1598px' src="https://www.youtube.com/embed/rTQOqJhWoL0?controls=0&autoplay=1&vq=hd720&showinfo=0&loop=1&rel=0" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" muted autoplay></iframe>
            </div>
        {/if}
    {/if}

    
    
    
    
    
</div>

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

    .vid {
        position: absolute;
        height: 1016px;
        width: 1598px;
        left: 323px;
        z-index: 1;
    }

    
    .desk {
        position: absolute;
        top: 159px;
        left: 446px;
        width: 642px;
        height: 356px;
        z-index: 2;
    }

    iframe {
        height: 100%;
        width: 100%;
    }

    .anal1 {
        position: absolute;
        top: 159px;
        left: 1159px;
        width: 642px;
        height: 356px;
        z-index: 2;
    }

    .desk2 {
        position: absolute;
        top: 315px;
        left: 390px;
        width: 688px;
        height: 384px;
        z-index: 2;
    }

    .anal12 {
        position: absolute;
        top: 315px;
        left: 1155px;
        width: 688px;
        height: 384px;
        z-index: 2;
    }

    .anal2 {
        position: absolute;
        top: 578px;
        left: 802px;
        width: 642px;
        height: 356px;
        z-index: 2;
    }
    

    .topLeft {
        color: white;
        font-style: italic;
        letter-spacing: 3px;
    }

    .rlpcDesk {
        top: -59.4px;
        width: 434px;
        text-align: center;
        position: absolute;
        z-index: 1;
        height: 95px;
        line-height: 95px;
        font-size: 60px;
    }

    .tonightDesk {
        top: 54px;
        width: 360px;
        left: -1%;
        text-align: center;
        position: absolute;
        z-index: 1;
        height: 95px;
        line-height: 95px;
        font-size: 35px;
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

    img {
        position: absolute;
    }

</style>
