<script>
	import { fade } from 'svelte/transition';
	import Ticker from './Ticker.svelte';
	import GameDesk from './GameDesk.svelte';
	import store from '../scripts/store.js';
	import { onMount } from 'svelte';

    export let tickerInfo = '';
    export let tonightGames = [];
    
    onMount(() => {
		store.tickerInfo(currentMessage => {
			tickerInfo = currentMessage;
		})
		store.tonightGames(currentMessage => {
			tonightGames = currentMessage;
		})
    });
    
    
    let props = {
		direction: ['left', [ 'left', 'right', 'top', 'bottom' ]],
		duration: 30,
		delay: 0,
		loop: true,
		pausing: true,
		alternate: false,
		behavior: ['auto', [ 'auto', 'always' ]]
	};
</script>
<div class='container' transition:fade="{{ delay: 1500, duration:1000, ease:'circ'}}">
    <div class='ticker'>
        {#if tickerInfo != ''}
            <Ticker behavior='always' duration=120>
                {@html tickerInfo}
            </Ticker>
        {/if}
    </div>
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

    .container {
        position: absolute;
        height: 1080px;
        width: 1920px;
        overflow: hidden;
        top: 0%;
        left: 0%;
    }

    .ticker {
        position: absolute;
        left: 0%;
        width: 100%;
        overflow: hidden;
        color: #f7ebc4;
        font-size: 30px;
        font-family: 'Evogria';
        bottom: -20px;
        letter-spacing: 3px;
    }

</style>