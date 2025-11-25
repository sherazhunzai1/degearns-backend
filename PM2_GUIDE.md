# PM2 Deployment Guide

This guide shows you how to run the XRPL NFT Marketplace backend using PM2 Process Manager.

## Prerequisites

Ensure you have:
- Node.js installed
- MySQL database set up and running
- Environment variables configured in `.env` file
- Database migrations completed

## Installation

### 1. Install PM2 Globally

```bash
npm install -g pm2
```

Verify installation:
```bash
pm2 --version
```

## Starting the Application

### Option 1: Using Ecosystem File (Recommended)

Start the app with the PM2 ecosystem configuration:

```bash
pm2 start ecosystem.config.js
```

For production environment:
```bash
pm2 start ecosystem.config.js --env production
```

### Option 2: Direct Start

Start the app directly:

```bash
pm2 start src/server.js --name "xrpl-nft-marketplace"
```

With environment variables:
```bash
pm2 start src/server.js --name "xrpl-nft-marketplace" --env production
```

## PM2 Commands

### View Running Applications

```bash
# List all applications
pm2 list

# Show detailed information
pm2 show xrpl-nft-marketplace

# Monitor in real-time
pm2 monit
```

### Managing the Application

```bash
# Stop the application
pm2 stop xrpl-nft-marketplace

# Restart the application
pm2 restart xrpl-nft-marketplace

# Reload (zero-downtime restart)
pm2 reload xrpl-nft-marketplace

# Delete from PM2
pm2 delete xrpl-nft-marketplace
```

### Viewing Logs

```bash
# View logs in real-time
pm2 logs xrpl-nft-marketplace

# View last 100 lines
pm2 logs xrpl-nft-marketplace --lines 100

# View only error logs
pm2 logs xrpl-nft-marketplace --err

# View only output logs
pm2 logs xrpl-nft-marketplace --out

# Clear logs
pm2 flush
```

### Monitoring

```bash
# Real-time monitoring dashboard
pm2 monit

# Web-based monitoring (PM2 Plus)
pm2 plus
```

## Auto-Restart on System Reboot

### Save PM2 Configuration

After starting your application, save the PM2 process list:

```bash
pm2 save
```

### Setup Startup Script

Generate and configure startup script:

```bash
# This command will output a command to run
pm2 startup

# Run the output command (it will look something like):
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u yourusername --hp /home/yourusername
```

Now PM2 will automatically start your application on system reboot!

### Disable Startup

To remove PM2 from startup:

```bash
pm2 unstartup systemd
```

## Cluster Mode (Optional)

For better performance, run multiple instances:

Edit `ecosystem.config.js`:
```javascript
instances: 'max',  // Use all CPU cores
exec_mode: 'cluster'
```

Then restart:
```bash
pm2 reload ecosystem.config.js
```

## Updating the Application

When you update your code:

```bash
# Pull latest code
git pull

# Install dependencies if needed
npm install

# Run migrations if needed
npm run db:migrate

# Reload the application (zero-downtime)
pm2 reload xrpl-nft-marketplace

# Or restart
pm2 restart xrpl-nft-marketplace
```

## Environment Variables

PM2 will use the `.env` file in your project root. Ensure it's properly configured before starting.

Alternatively, you can set environment variables in `ecosystem.config.js`:

```javascript
env: {
  NODE_ENV: 'development',
  PORT: 5000,
  DB_HOST: '127.0.0.1',
  DB_NAME: 'xrpl_nft_marketplace',
  // ... other variables
}
```

## Troubleshooting

### Application Won't Start

1. Check logs:
   ```bash
   pm2 logs xrpl-nft-marketplace --lines 50
   ```

2. Verify database connection:
   ```bash
   mysql -u root -p -h 127.0.0.1
   ```

3. Check if port is already in use:
   ```bash
   lsof -i :5000
   ```

### High Memory Usage

Monitor memory:
```bash
pm2 monit
```

Set memory limit in `ecosystem.config.js`:
```javascript
max_memory_restart: '500M'
```

### Application Keeps Restarting

Check error logs:
```bash
pm2 logs xrpl-nft-marketplace --err
```

Increase restart delay in `ecosystem.config.js`:
```javascript
min_uptime: '10s',
max_restarts: 10
```

## Production Best Practices

1. **Use Cluster Mode**: Run multiple instances for better performance
2. **Set Memory Limits**: Prevent memory leaks from crashing the system
3. **Configure Log Rotation**: Keep log files from growing too large
4. **Enable Auto-Restart**: Use `pm2 startup` for automatic recovery
5. **Monitor Regularly**: Use `pm2 monit` or PM2 Plus for monitoring
6. **Use Environment Files**: Keep production configs separate

## Log Rotation

Install PM2 log rotate module:

```bash
pm2 install pm2-logrotate
```

Configure rotation:
```bash
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

## Useful Scripts

Add these to your `package.json`:

```json
{
  "scripts": {
    "pm2:start": "pm2 start ecosystem.config.js",
    "pm2:stop": "pm2 stop ecosystem.config.js",
    "pm2:restart": "pm2 restart ecosystem.config.js",
    "pm2:reload": "pm2 reload ecosystem.config.js",
    "pm2:delete": "pm2 delete ecosystem.config.js",
    "pm2:logs": "pm2 logs xrpl-nft-marketplace",
    "pm2:monit": "pm2 monit"
  }
}
```

Then use:
```bash
npm run pm2:start
npm run pm2:logs
```

## Quick Reference

```bash
# Start
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# Logs
pm2 logs

# Restart
pm2 restart xrpl-nft-marketplace

# Stop
pm2 stop xrpl-nft-marketplace

# Save state
pm2 save

# Setup auto-start
pm2 startup
```

## Support

For PM2 issues, visit: https://pm2.keymetrics.io/docs/usage/quick-start/

For application issues, check the main README.md and MIGRATION_GUIDE.md
