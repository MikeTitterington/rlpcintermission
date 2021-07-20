<script>
	import { fade } from 'svelte/transition';
	import Ticker from './Ticker.svelte';
	import store from '../scripts/store.js';
	import { onMount } from 'svelte';

    export let tickerInfo = '';
    
    onMount(() => {
		store.tickerInfo(currentMessage => {
			tickerInfo = currentMessage;
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
        background: #1c1c1c;
        position: absolute;
        bottom: 0%;
        left: 0%;
        width: 100%;
        overflow: hidden;
        color: #C1EDCC;
        font-size: 30px;
        font-family: 'Chosence';
    }

</style>
