# Setup Guide

This guide will walk you through setting up the Dota 2 AI Coaching Bot step by step.

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Configure Environment

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and add your credentials:
```env
STEAM_USERNAME=your_bot_account_username
STEAM_PASSWORD=your_bot_account_password
GSI_PORT=3000
GSI_TOKEN=generate_a_random_token_here
```

**Important**: Generate a secure random token for `GSI_TOKEN`. You can use:
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

## Step 3: Set Up Dota 2 GSI

### 3.1 Add Launch Options

1. Open Steam
2. Go to Library
3. Right-click on Dota 2
4. Select "Properties"
5. In the "General" tab, find "Launch Options"
6. Add: `-gamestateintegration -console`
7. Click "Close"

### 3.2 Create GSI Configuration File

The location depends on your operating system:

#### Windows
```
C:\Program Files (x86)\Steam\steamapps\common\dota 2 beta\game\dota\cfg\gamestate_integration\gamestate_integration_coach.cfg
```

#### Linux
```
~/.steam/steam/steamapps/common/dota 2 beta/game/dota/cfg/gamestate_integration/gamestate_integration_coach.cfg
```

#### Mac
```
~/Library/Application Support/Steam/steamapps/common/dota 2 beta/game/dota/cfg/gamestate_integration/gamestate_integration_coach.cfg
```

**Note**: If the `gamestate_integration` folder doesn't exist, create it.

### 3.3 Copy GSI Config

1. Copy the file `gamestate_integration_coach.cfg` from this repository
2. Paste it into the location above
3. **CRITICAL**: Edit the file and update the `token` field to match your `GSI_TOKEN` from `.env`

Example:
```
"auth"
{
    "token"     "your_secure_token_here"  ← Change this to match .env
}
```

## Step 4: Set Up Steam Bot Account

### 4.1 Create Bot Account (Optional but Recommended)

1. Create a new Steam account (or use an existing one)
2. Make sure the account owns Dota 2 (it's free to play)
3. Add your main account as a friend
4. Use these credentials in `.env`

### 4.2 Steam Guard

If your bot account has Steam Guard enabled:
- You may need to enter a code on first login
- Consider using Steam Guard Mobile Authenticator for easier access
- The bot will prompt for Steam Guard codes if needed

## Step 5: Build and Run

### Build the project:
```bash
npm run build
```

### Run the coach:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

## Step 6: Test the Setup

### 6.1 Verify GSI Connection

1. Start the coaching bot (see Step 5)
2. Launch Dota 2
3. Start a bot match or join a game
4. Check the bot console - you should see GSI data being received

If you see errors:
- Verify GSI config file is in the correct location
- Check that the token matches in both `.env` and GSI config
- Ensure Dota 2 launch options are set correctly
- Check firewall settings (port 3000 should be accessible)

### 6.2 Test Coaching Messages

1. Invite the bot Steam account as a coach in your game lobby
2. Start a game
3. The bot should provide coaching advice

**Note**: If Steam bot isn't set up, the bot will run in "log-only" mode, printing messages to the console.

## Troubleshooting

### GSI Not Working

**Symptoms**: No game state data received

**Solutions**:
1. Verify launch options: `-gamestateintegration -console`
2. Check GSI config file location and contents
3. Verify token matches in `.env` and GSI config
4. Check Windows Firewall / Linux iptables / Mac Firewall
5. Try changing `GSI_PORT` in `.env` if port 3000 is in use
6. Check Dota 2 console for GSI errors (press ` key in-game)

### Steam Bot Not Connecting

**Symptoms**: Bot can't log in to Steam

**Solutions**:
1. Verify credentials in `.env`
2. Check for Steam Guard requirements
3. Ensure bot account owns Dota 2
4. Check network connectivity
5. Review logs for specific errors

### No Coaching Messages

**Symptoms**: Bot is running but no advice given

**Solutions**:
1. Ensure game is in progress (not in menu)
2. Check that GSI is receiving data (check logs)
3. Verify game state is being processed (check logs)
4. Messages may be rate-limited (this is normal)

### Port Already in Use

**Symptoms**: Error: "EADDRINUSE: address already in use"

**Solutions**:
1. Change `GSI_PORT` in `.env` to a different port (e.g., 3001)
2. Update GSI config file `uri` to match new port
3. Or stop the process using port 3000

## Next Steps

Once everything is working:

1. **Customize Coaching**: Adjust `COACH_AGGRESSIVENESS` in `.env`
2. **Monitor Logs**: Check `combined.log` and `error.log` files
3. **Test in Bot Matches**: Practice with the bot before using in ranked
4. **Fine-tune**: Adjust rate limits and priorities in `src/config/constants.ts`
5. **Review Documentation**: Check `DOCUMENTATION_INDEX.md` for complete guide
6. **Understand Features**: Read `IMPROVEMENTS.md` and `REFINEMENTS.md` for advanced features

## Advanced Configuration

### Custom Win Conditions

Edit `src/config/constants.ts` to add custom win conditions or modify existing ones.

### Adjust Rate Limits

Edit `RATE_LIMITS` in `src/config/constants.ts` to change message frequency.

### Add Hero-Specific Logic

Extend `src/services/phaseCoaching.ts` or create new service files for hero-specific coaching.

## Support

If you encounter issues not covered here:

1. Check the main README.md
2. Review the logs (`combined.log`, `error.log`)
3. Open an issue on the repository with:
   - Your OS and Node.js version
   - Error messages from logs
   - Steps to reproduce the issue

