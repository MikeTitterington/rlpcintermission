<script>
	import { onMount } from 'svelte';
	import store from '../scripts/store.js';
	export let currentScene;
	import Caster from "./Caster.svelte";
	import Desk from "./Desk.svelte";

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
		<Desk />
	{:else}
		<p>IDK</p>
	{/if}
</main>

<style>
	
</style>