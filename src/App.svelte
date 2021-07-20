<script>
	import { onMount } from 'svelte';
	import store from '../scripts/store.js';
	export let currentScene;
	import Caster from "./Caster.svelte";
	import Desk from "./Desk.svelte";
	import PowerRankings from "./PowerRankings.svelte";
	import DefaultScene from "./DefaultScene.svelte";

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
	{:else if currentScene == 'default'}
		<DefaultScene />
	{:else}
		<p>IDK</p>
	{/if}
</main>

<style>
	main {
		position: absolute;
		height: 1080px;
		width: 1920px;
		overflow: hidden;
		top: 0;
		left: 0%;
	}
</style>