<script>
	export let currentScene;
	import Caster from "./Caster.svelte"
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