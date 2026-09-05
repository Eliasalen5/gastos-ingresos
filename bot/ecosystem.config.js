module.exports = {
    apps: [
        {
            name: 'gastos-bot',
            script: 'index.js',
            cwd: __dirname,
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '300M',
            restart_delay: 5000,
            env: {
                NODE_ENV: 'production'
            }
        }
    ]
};