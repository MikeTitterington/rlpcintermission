import App from './App.svelte';

const app = new App({
	target: document.body,
	props: {
		currentScene: 'caster'
	}
});

app.use('/build', express.static('public/build'))

export default app;