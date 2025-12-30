# Quick Start Guide

Get the Dota 2 AI Coaching Bot running in 5 minutes.

## Prerequisites Check

- [ ] Node.js v14+ installed (`node --version`)
- [ ] Dota 2 installed via Steam
- [ ] Steam account for bot (optional - can run in log-only mode)

## 1. Install (1 minute)

```bash
npm install
```

## 2. Configure (2 minutes)

### Create `.env` file:
```bash
cp .env.example .env
```

### Edit `.env` - Minimum required:
```env
GSI_PORT=3000
GSI_TOKEN=your_random_token_here
```

Generate a token:
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### Optional (for Steam bot):
```env
STEAM_USERNAME=your_bot_username
STEAM_PASSWORD=your_bot_password
```

## 3. Set Up Dota 2 GSI (2 minutes)

### Add Launch Options:
1. Steam → Library → Right-click Dota 2 → Properties
2. Launch Options: `-gamestateintegration -console`

### Create GSI Config File:

**Windows:**
```
C:\Program Files (x86)\Steam\steamapps\common\dota 2 beta\game\dota\cfg\gamestate_integration\gamestate_integration_coach.cfg
```

**Linux:**
```
~/.steam/steam/steamapps/common/dota 2 beta/game/dota/cfg/gamestate_integration/gamestate_integration_coach.cfg
```

**Mac:**
```
~/Library/Application Support/Steam/steamapps/common/dota 2 beta/game/dota/cfg/gamestate_integration/gamestate_integration_coach.cfg
```

Copy `gamestate_integration_coach.cfg` from this repo to that location.

**IMPORTANT**: Edit the file and change `"token"` to match your `GSI_TOKEN` from `.env`.

## 4. Run (30 seconds)

```bash
npm run build
npm start
```

## 5. Test

1. Launch Dota 2
2. Start a bot match
3. Check the console - you should see coaching messages!

## Troubleshooting

**No GSI data?**
- Check launch options are set
- Verify GSI config file location and token
- Check firewall (port 3000)

**No messages?**
- Make sure game is in progress (not in menu)
- Check logs for errors
- Messages are rate-limited (this is normal)

**Steam bot issues?**
- Run without Steam credentials for log-only mode
- Check Steam Guard requirements
- Verify bot account owns Dota 2

## Next Steps

- Read `SETUP.md` for detailed configuration
- Read `README.md` for full documentation
- Check `DOCUMENTATION_INDEX.md` for complete documentation guide
- Customize coaching in `src/config/constants.ts`

## Documentation

For more information:
- **Features & Improvements**: See `IMPROVEMENTS.md` and `REFINEMENTS.md`
- **Architecture**: See `ARCHITECTURE.md`
- **Professional Analysis**: See `PROFESSIONAL_LEVEL.md`

## Log-Only Mode

If you don't set up Steam bot credentials, the coach runs in log-only mode:
- All coaching advice prints to console
- Perfect for testing and development
- No Steam account needed

