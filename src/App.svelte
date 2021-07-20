<script>
	import { onMount } from 'svelte';
	import store from '../scripts/store.js';
	export let currentScene;
	import Caster from "./Caster.svelte";
	import Desk from "./Desk.svelte";
	import PowerRankings from "./PowerRankings.svelte";

	onMount(() => {
		store.currentScene(currentMessage => {
			currentScene = currentMessage;
		})
    });
</script>

<svelte:head>
	<title>RLPC Media Team Site</title>
	<html lang="en" />
</svelte:head>

<main>
	{#if currentScene == 'caster'}
		<Caster />
	{:else if currentScene == 'desk'}
		<Desk />
	{:else if currentScene == 'power'}
		<PowerRankings />
	{:else}
		<p>IDK</p>
	{/if}
</main>

<style>
	
</style>