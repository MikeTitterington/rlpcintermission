<script>
	import { onMount } from 'svelte';
	import store from '../scripts/store.js';
	export let currentScene;
	import Caster from "./Caster.svelte";

	onMount(() => {
		store.currentScene(currentMessage => {
			currentScene = currentMessage;
		})
    });
</script>

<main>
	{#if currentScene == 'caster'}
		<Caster />
	{:else if currentScene == 'desk'}
		<p>{currentScene}</p>
	{:else}
		<p>IDK</p>
	{/if}
</main>

<style>
	
</style>