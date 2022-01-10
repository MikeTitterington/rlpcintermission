<script>
	import { fade } from 'svelte/transition';
	import { onMount } from 'svelte';
	import store from '../scripts/store.js';
	export let currentScene;
	import Caster from "./Caster.svelte";
	import Desk from "./Desk.svelte";
	import PowerRankings from "./PowerRankings.svelte";
	import DefaultScene from "./DefaultScene.svelte";
	import PlayerCard from "./PlayerCard.svelte";
	import Matchup from "./Matchup.svelte";
	import Interview from "./Interview.svelte";
	let casterDisplay = 0;
	let deskDisplay = 0;
	onMount(() => {
		store.currentScene(currentMessage => {
			currentScene = currentMessage;
		})
		store.casterDisplay(currentMessage => {
			casterDisplay = currentMessage;
		})
		store.deskDisplay(currentMessage => {
			deskDisplay = currentMessage;
		})
    });
</script>
<svelte:head>
	<title>RLPC Media Team Site</title>
	<html lang="en" />
</svelte:head>

<main>
	{#if currentScene != 'matchup'}
		<DefaultScene />
	{:else}
    	<img src='assets\Background.png' alt='left bar'/>
	{/if}
	{#if currentScene == 'desk'}
		<Desk />
	{:else if currentScene == 'caster'}
		<Caster />
	{:else if currentScene == 'power'}
		<PowerRankings />
	{:else if currentScene == 'player'}
		<PlayerCard />
	{:else if currentScene == 'matchup'}
		<Matchup />
	{:else if currentScene == 'interview'}
		<Interview />
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