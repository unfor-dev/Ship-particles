import restart from 'vite-plugin-restart'
import glsl from 'vite-plugin-glsl'

export default {
    root: 'src/',
    publicDir: '../static/',
    base: './',
    server:
    {
        host: true, // Open to local network and display URL
        open: !('SANDBOX_URL' in process.env || 'CODESANDBOX_HOST' in process.env) // Open if it's not a CodeSandbox
    },
    build:
    {
        outDir: '../dist',
        emptyOutDir: true,
        sourcemap: false,
        target: 'esnext'
    },
    plugins:
    [
        restart({ restart: [ '../static/**', ] }), // Restart server on static file change
        glsl() // Handle shader files
    ]
}