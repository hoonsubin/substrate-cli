import express from 'express';

(function main() {
    const app = express();
    const port = 3000;

    app.get('/', (_req, res) => {
        res.send('<h1>Hello World!</h1>');
    });

    app.listen(port, () => {
        return console.log(`server is listening on ${port}`);
    }).on('error', (e) => {
        return console.error(e);
    });
})();
