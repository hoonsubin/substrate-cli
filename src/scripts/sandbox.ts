import PlasmConnect from '../helper/plasmApi';

const plasmApi = new PlasmConnect('Main');

// script entry point
(async () => {
    console.log('Hello World, this is a node sandbox to test things');
})()
    .catch((err) => {
        console.error(err);
    })
    .finally(async () => {
        const api = await plasmApi.api;
        api.disconnect();
    });
