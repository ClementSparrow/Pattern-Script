
var sprites = [ ]

var RandomGen = new RNG();

const introstate = {
	title: "EMPTY GAME",
	attribution: "increpare",
	objectCount: 2,
	metadata:[],
	levels:[],
	bgcolor:"#000000",
	fgcolor:"#FFFFFF"
}

var state = introstate;

menu_screen.makeTitle()
if (menu_screen.nb_items > 1)
{
	menu_screen.item = 1 // defaults to 'continue'
}

canvasResize()


function tryPlaySimpleSound(soundname)
{
	if (state.sfx_Events[soundname] !== undefined)
	{
		playSound(state.sfx_Events[soundname])
	}
}




// LOADING LEVELS
// ==============

var loadedLevelSeed = 0

function loadLevelFromLevelDat(state, leveldat, randomseed)
{
	if (randomseed==null) {
		randomseed = (Math.random() + Date.now()).toString();
	}
	loadedLevelSeed = randomseed;
	RandomGen = new RNG(loadedLevelSeed);
	forceRegenImages()
	againing=false;
	if (leveldat.message===undefined) {
		menu_screen.nb_items = 1 // TODO: this should not be here
		screen_layout.content = level_screen
		level = leveldat.clone();
		level.rebuildArrays();


		if (state!==undefined) {
			if (state.metadata.flickscreen!==undefined){
				oldflickscreendat=[
					0,
					0,
					Math.min(state.metadata.flickscreen[0],level.width),
					Math.min(state.metadata.flickscreen[1],level.height)
				];
				screen_layout.content = tiled_world_screen
			} else if (state.metadata.zoomscreen!==undefined){
				oldflickscreendat=[
					0,
					0,
					Math.min(state.metadata.zoomscreen[0],level.width),
					Math.min(state.metadata.zoomscreen[1],level.height)
				];
				screen_layout.content = camera_on_player_screen
			}
		}
		screen_layout.content.level = level

		execution_context.resetUndoStack()
		execution_context.restartTarget = level.backUp()
		keybuffer = []

		if ('run_rules_on_level_start' in state.metadata)
		{
			runrulesonlevelstart_phase = true
			processInput(-1, true)
			runrulesonlevelstart_phase = false
		}
	} else {
		showTempMessage()
	}

	clearInputHistory();
}

function loadLevelFromState(state, levelindex, randomseed)
{
	const leveldat = (curlevelTarget === null) ? state.levels[levelindex] : curlevelTarget
	curlevel = levelindex
	if ( (leveldat !== undefined) && (leveldat.message === undefined) )
	{
		tryPlaySimpleSound('startlevel')
	}
	loadLevelFromLevelDat(state, state.levels[levelindex], randomseed)
	if (curlevelTarget !== null)
	{
		level.restore(curlevelTarget)
		execution_context.resetCommands()
		execution_context.restartTarget = curlevelTarget
	}
}

function goToLevel(i, state, levelindex, randomseed)
{
	curlevel = i
	winning = false
	timer = 0
	menu_screen.done = false
	msg_screen.done = false
	curlevelTarget = null
	loadLevelFromState(state, levelindex, randomseed)
}




// Backup levels
// =============

function executionContext()
{
	// Undo/restart/checkpoints data
	this.backups = [] // only used in doUndo
	this.restartTarget = null // last checkpoint reached. Only used in DoRestart
	this.hasUsedCheckpoint = false // was a checkpoint used in this level?


	// Output queue
	this.commandQueue = new CommandsSet()
	this.commandQueue.sourceRules = [] // only used with verbose_logging
}
var execution_context = new executionContext()

executionContext.prototype.resetUndoStack = function()
{
	this.backups = []
}
executionContext.prototype.resetCommands = function()
{
	this.commandQueue.reset()
	this.commandQueue.sourceRules = []
}

Level.prototype.backUp = function()
{
	return {
		dat: new Int32Array(this.objects),
		width:  this.width,
		height: this.height,
		oldflickscreendat: oldflickscreendat.concat([])
	}
}

Level.prototype.forSerialization = function()
{
	return {
		dat : Array.from(this.objects),
		width :  this.width,
		height : this.height,
		oldflickscreendat: oldflickscreendat.concat([])
	}
}


// Youtube
// =======

function tryDeactivateYoutube()
{
	var youtubeFrame = document.getElementById("youtubeFrame");
	if (youtubeFrame){
		document.body.removeChild(youtubeFrame);
	}
}

var ifrm;
function tryActivateYoutube(){
	var youtubeFrame = document.getElementById("youtubeFrame");
	if (youtubeFrame){
		return;
	}
	if (canYoutube) {
		if ('youtube' in state.metadata) {
			var youtubeid=state.metadata['youtube'];
			var url = "https://www.youtube.com/embed/"+youtubeid+"?autoplay=1&loop=1&playlist="+youtubeid;
			ifrm = document.createElement("IFRAME");
			ifrm.setAttribute("src",url);
			ifrm.setAttribute("id","youtubeFrame");
			ifrm.style.visibility="hidden";
			ifrm.style.width="500px";
			ifrm.style.height="500px";
			ifrm.style.position="absolute";
			ifrm.style.top="-1000px";
			ifrm.style.left="-1000px";
			document.body.appendChild(ifrm);
		}
	}
}


// GAME STATE
// ==========

// Only called at the end of compile()
function setGameState(_state, command = ['restart'], randomseed = null)
{
	oldflickscreendat=[];
	timer=0;
	autotick=0;
	winning=false;
	againing=false;
	msg_screen.done = false
	STRIDE_MOV=_state.STRIDE_MOV;
	STRIDE_OBJ=_state.STRIDE_OBJ;
	
	sfxCreateMask=new BitVec(STRIDE_OBJ);
	sfxDestroyMask=new BitVec(STRIDE_OBJ);

	if ( ((state.levels.length === 0) || (_state.levels.length === 0) ) && (command.length > 0) && (command[0] === 'rebuild') ) 
	{
		command = ["restart"]
	}
	RandomGen = new RNG(randomseed)

	state = _state

	if (command[0] !== 'rebuild')
	{
		execution_context.resetUndoStack() // TODO: shouldn't we also reset restartTarget?
	}

	//set sprites
	sprites = []
	for (var object of state.identifiers.objects)
	{
		sprites[object.id] = {
			colors: object.colors,
			dat: object.spritematrix
		}
	}

	autotick = 0
	autotickinterval = (state.metadata.realtime_interval !== undefined) ? state.metadata.realtime_interval*1000 : 0
	repeatinterval = (state.metadata.key_repeat_interval !== undefined) ? state.metadata.key_repeat_interval*1000 : 150
	againinterval = (state.metadata.again_interval !== undefined) ? state.metadata.again_interval*1000 : 150

	if ( throttle_movement && (autotickinterval === 0) )
	{
		logWarning("throttle_movement is designed for use in conjunction with realtime_interval. Using it in other situations makes games gross and unresponsive, broadly speaking.  Please don't.");
	}
	norepeat_action = (state.metadata.norepeat_action !== undefined)
	
	switch(command[0])
	{
		case 'restart':
		{
			if (restarting == true)
			{
				logWarning('A "restart" command is being triggered in the "run_rules_on_level_start" section of level creation, which would cause an infinite loop if it was actually triggered, but it\'s being ignored, so it\'s not.');
				break;
			}
			winning=false;
			timer=0;
			tryPlaySimpleSound('titlescreen')
			msg_screen.done = false
			screen_layout.content = menu_screen
			menu_screen.item = isContinuePossible() ? 1 : 0
			menu_screen.done = false
			menu_screen.makeTitle();
			break;
		}
		case 'rebuild':
		{
			//do nothing
			break;
		}
		case 'loadFirstNonMessageLevel':
		{
			for (var i=0; i<state.levels.length; i++)
			{
				if (state.levels[i].hasOwnProperty("message")){
					continue;
				}
				goToLevel(i, state, i, randomseed)
				break;
			}
			break;	
		}
		case 'loadLevel':
		{
			goToLevel(i, state, command[1], randomseed)
			break;
		}
		case 'levelline': // called when clicking on a level line in the editor
		{
			const targetLine = command[1]
			for (var i=state.levels.length-1; i>=0; i--)
			{
				if(state.levels[i].lineNumber <= targetLine+1)
				{
					goToLevel(i, state, i)
					break
				}
			}
			break
		}
	}
	
	if(command[0] !== 'rebuild')
	{
		clearInputHistory();
	}

	canvasResize()

	if ( (state.sounds.length === 0) && (state.metadata.youtube === null) )
	{
		killAudioButton()
	}
	else
	{
		showAudioButton()
	}
	
}


// MORE LEVEL STUFF
// ================


var messagetext=""; // the text of a message command appearing in a rule only (not messages in LEVEL section !)

function DoRestart(bak)
{
	if (restarting === true)
		return
	if ( (bak === undefined) && ('norestart' in state.metadata) )
		return
	restarting = true
	execution_context.backups.push( bak || level.backUp() )

	if (verbose_logging) { consolePrint("--- restarting ---", true) }

	level.restore(execution_context.restartTarget)
	execution_context.resetCommands()

	tryPlaySimpleSound('restart')

	if ('run_rules_on_level_start' in state.metadata)
	{
		processInput(-1, true)
	}
	
	execution_context.resetCommands()
	restarting = false
}

executionContext.prototype.backupDiffers = function()
{
	if (this.backups.length === 0)
		return true

	const bak = this.backups[this.backups.length-1]
	return level.objects.some( (o, i) => o !== bak.dat[i] )
}

executionContext.prototype.doUndo = function()
{
	if ( ( ! screen_layout.alwaysAllowUndo() ) && ('noundo' in state.metadata) )
		return

	// See Pattern:Script issue #23
	while (this.backupDiffers() === false)
	{
		this.backups.pop()
	}
	if (this.backups.length === 0)
	{
		if (verbose_logging) { consolePrint("--- nothing to undo ---", true) }
		return
	}

	forceUndo(this.backups[this.backups.length-1])
	this.backups = this.backups.splice(0, this.backups.length-1)
	tryPlaySimpleSound('undo')
}

function forceUndo(backup) // force=true, ignoreDuplicates=false
{
	if (verbose_logging) { consolePrint("--- undoing ---", true) }
	level.restore(backup)
	execution_context.resetCommands()
}


// Match rules and collect commands
// ================================

function applyRandomRuleGroup(ruleGroup, level)
{
	var propagated = false

	var matches = []
	for (const [ruleIndex, rule] of ruleGroup.entries())
	{
		const ruleMatches = rule.findMatches(level)
		if (ruleMatches.length > 0)
		{
			for (const tuple of cartesian_product(...ruleMatches))
			{
				matches.push([rule, tuple])
			}
		}		
	}

	if (matches.length === 0)
		return false

	const [rule, tuple] = matches[Math.floor(RandomGen.uniform()*matches.length)];
	const modified = rule.applyAt(level, tuple, false)
	rule.queueCommands()
	return modified
}

const max_loop_count = 200

function applyRuleGroup(ruleGroup, level)
{
	if (ruleGroup[0].isRandom)
		return applyRandomRuleGroup(ruleGroup, level)

	var skip_from = ruleGroup.length - 1
	var loopcount = 1
	var result = false
	while(loopcount <= max_loop_count)
	{
		var last_applied = null
		for (const [i, rule] of ruleGroup.entries())
		{
			if (rule.tryApply(level))
				last_applied = i
			if ( (i === skip_from) && (last_applied === null))
				return result
		}
		skip_from = last_applied
		result = true
		loopcount++
	}
	logErrorCacheable('Got caught looping lots in a rule group :O', ruleGroup[0].lineNumber, true)
	return result
}

//for each rule, try to match it
function applyRules(rules, level, loopPoint, bannedGroup)
{
	//when we're going back in, let's loop, to be sure to be sure
	var loopCount = 0
	var ruleGroupIndex = 0
	var last_applied = null
	var skip_from = null
	var skip_to = null

	while (ruleGroupIndex < rules.length)
	{
		if ( ! (bannedGroup && bannedGroup[ruleGroupIndex]) && applyRuleGroup(rules[ruleGroupIndex], level) )
		{
			last_applied = ruleGroupIndex
		}
		// loopPoint[ruleGroupIndex] is set on the last ruleGroupIndex before an endloop and contains the first ruleGroupIndex after the matching startloop
		if ( (last_applied !== null) && (loopPoint[ruleGroupIndex] !== undefined) )
		{
			skip_from = last_applied
			skip_to = ruleGroupIndex
			ruleGroupIndex = loopPoint[ruleGroupIndex]
			last_applied = null
			loopCount++
			if (loopCount <= max_loop_count)
				continue
			logErrorCacheable('got caught in an endless startloop...endloop vortex, escaping!', rules[ruleGroupIndex][0].lineNumber, true)
			return
		}
		if ( (skip_from === ruleGroupIndex) && (last_applied === null) )
		{
			ruleGroupIndex = skip_to
		}
		ruleGroupIndex++
	}
}



// Apply global effects of rules
// =============================


const dirMasksDelta = {
	 1:[ 0,-1],//up
	 2:[ 0, 1],//down
	 4:[-1, 0],//left
	 8:[ 1, 0],//right
	15:[ 0, 0],//moving?
	16:[ 0, 0],//action
	 3:[ 0, 0]//'no'
}

Level.prototype.repositionEntitiesAtCell = function(positionIndex, seedsToPlay_CanMove)
{
	var movementMask = this.getMovements(positionIndex)
	if (movementMask.iszero())
		return false

	var sourceMask = this.getCellInto(positionIndex, _o8)
	const [sx, sy] = this.cellCoord(positionIndex)

	var moved = false
	for (var layer=0; layer<this.layerCount; layer++)
	{
		const dirMask = movementMask.getshiftor(0x1f, 5*layer)
		if (dirMask === 0)
			continue

		const [dx, dy] = dirMasksDelta[dirMask]
		const [tx, ty] = [sx+dx, sy+dy]

		if ( (clamp(0, tx, this.width-1) != tx) || (clamp(0, ty, this.height-1) != ty) )
			continue

		const targetIndex = ty + tx*this.height

		const layerMask = state.layerMasks[layer]
		var targetMask = this.getCellInto(targetIndex, _o7)

		if ( (targetIndex !== positionIndex) && layerMask.anyBitsInCommon(targetMask) ) // if moving and collision.
			continue

		// TODO: this test is there because at that point we know that something will move in that layer, but it's not the place to do that
		for (const o of state.sfx_MovementMasks[layer])
		{
			if ( (dirMask & o.directionMask) && o.objectMask.anyBitsInCommon(sourceMask) && (seedsToPlay_CanMove.indexOf(o.seed) === -1) )
			{
				seedsToPlay_CanMove.push(o.seed) // TODO: we should use a set or bitvec instead of an array
			}
		}

		movementMask.ishiftclear(dirMask, 5*layer)
		moved = true

		if (targetIndex === positionIndex)
			continue

		var movingEntities = sourceMask.clone()
		movingEntities.iand(layerMask)
		targetMask.ior(movingEntities)

		sourceMask.iclear(layerMask)
		this.setCell(targetIndex, targetMask) // TODO: we write the whole cell content, when we just need to do getCell(position).clear(layerMask), which could be done faster with ishiftclear

		this.colCellContents[tx].ior(movingEntities)
		this.rowCellContents[ty].ior(movingEntities)
		// this.mapCellContents.ior(movingEntities) // would not change
	}
	if ( ! moved )
		return false

	this.setCell(positionIndex, sourceMask)
	this.setMovements(positionIndex, movementMask)
	return moved
}

//if this returns!=null, need to go back and reprocess
function resolveMovements(level, bannedGroup, seedsToPlay_CanMove, seedsToPlay_CantMove)
{
	var moved = true
	while(moved)
	{
		moved = false
		for (var i=0; i<level.n_tiles; i++)
		{
			moved |= level.repositionEntitiesAtCell(i, seedsToPlay_CanMove)
		}
	}
	var doUndo = false

	for (var i=0; i<level.n_tiles; i++)
	{
		const cellMask = level.getCellInto(i, _o6)
		var movementMask = level.getMovements(i)
		if ( ! movementMask.iszero() )
		{
			const rigidMovementAppliedMask = level.rigidMovementAppliedMask[i]
			if (rigidMovementAppliedMask !== 0)
			{
				movementMask.iand(rigidMovementAppliedMask)
				if ( ! movementMask.iszero() )
				{
					//find what layer was restricted
					for (var j=0; j<level.layerCount; j++)
					{
						if (movementMask.getshiftor(0x1f, 5*j) !== 0)
						{
							//this is our layer!
							var rigidGroupIndex = level.rigidGroupIndexMask[i].getshiftor(0x1f, 5*j)
							rigidGroupIndex-- //group indices start at zero, but are incremented for storing in the bitfield
							bannedGroup[ state.rigidGroupIndex_to_GroupIndex[rigidGroupIndex] ] = true
							doUndo = true
							break
						}
					}
				}
			}
			for (const [layer, sfx_objects] of state.sfx_MovementFailureMasks.entries() )
			{
				const dirMask = movementMask.getshiftor(0x1f, 5*layer)
				for (const o of sfx_objects)
				{				
					if ( (dirMask & o.objectMask) && o.objectMask.anyBitsInCommon(cellMask) && (seedsToPlay_CantMove.indexOf(o.seed) === -1) )
					{
						seedsToPlay_CantMove.push(o.seed)
					}
				}
			}
		}

		for (var j=0; j<STRIDE_MOV; j++)
		{
			level.movements[i*STRIDE_MOV + j] = 0
		}
		level.rigidGroupIndexMask[i] = 0
		level.rigidMovementAppliedMask[i] = 0
	}
	return doUndo
}


function showTempMessage()
{
	tryPlaySimpleSound('showmessage')
	msg_screen.doMessage()
	canvasResize()
}

CommandsSet.prototype.processOutput = function()
{
	for (var k = CommandsSet.command_keys['sfx0']; k <= CommandsSet.command_keys['sfx10']; k++)
	{
		if (this.get(k))
		{
			tryPlaySimpleSound(CommandsSet.commandwords[k])
		}
	}
	if ( (unitTesting === false) && (this.message !== null) )
	{
		keybuffer = []
		msg_screen.done = false
		showTempMessage()
	}
}


// Process inputs
// ==============

var sfxCreateMask = null
var sfxDestroyMask = null

Level.prototype.getPlayerPositions = function()
{
	var result = []
	var playerMask = state.playerMask
	for (i=0; i<this.n_tiles; i++) // TODO: this scans the whole level, can't we optimize that by using level.mapCellContents, level.rowCellContents, or level.colCellContents?
	{
		this.getCellInto(i,_o11)
		if (playerMask.anyBitsInCommon(_o11))
		{
			result.push(i)
		}
	}
	return result
}

Level.prototype.startMovement = function(dir)
{
	const playerPositions = this.getPlayerPositions()
	for (const playerPosIndex of playerPositions)
	{
		var cellMask = this.getCell(playerPosIndex)
		var movementMask = this.getMovements(playerPosIndex)

		cellMask.iand(state.playerMask)

		for (var i=0; i<state.objectCount; i++)
		{
			if (cellMask.get(i)) {
				movementMask.ishiftor(dir, 5 * state.identifiers.objects[ state.idDict[i] ].layer)
			}
		}

		this.setMovements(playerPosIndex, movementMask)
	}
	return playerPositions
}


const max_rigid_loops = 50

/* returns a bool indicating if anything changed */
function processInput(dir, dontDoWin, dontModify)
{
	againing = false

	if (verbose_logging)
	{
		if (dir === -1) 
		{
			consolePrint('Turn starts with no input.')
		}
		else
		{
			consolePrint('=======================');
			consolePrint('Turn starts with input of ' + ['up','left','down','right','action'][dir]+'.');
		}
	}

	var bak = level.backUp()

	var playerPositions = []
	if (dir >= 0)
	{
		dir = ([1, 4, 2, 8, 16])[dir] // TODO: use a global const generated from the one that defines these bits. And use a more consistent ordering of directions
		playerPositions = level.startMovement(dir)
	}

	bannedGroup = []
	execution_context.resetCommands()

	level.calculateRowColMasks()
	const startState = {
		objects: new Int32Array(level.objects),
		movements: new Int32Array(level.movements),
		rigidGroupIndexMask: level.rigidGroupIndexMask.concat([]),
		rigidMovementAppliedMask: level.rigidMovementAppliedMask.concat([]),
		// colCellContents: level.colCellContents.map(x => x.clone()),
		// rowCellContents: level.rowCellContents.map(x => x.clone()),
		// mapCellContents: level.mapCellContents.clone(),
	}

	sfxCreateMask.setZero()
	sfxDestroyMask.setZero()

	var seedsToPlay_CanMove = []
	var seedsToPlay_CantMove = []

	var i = max_rigid_loops
	while (true)
	{
		if (verbose_logging) { consolePrint('applying rules') }
		applyRules(state.rules, level, state.loopPoint, bannedGroup)

		// not particularly elegant, but it'll do for now - should copy the world state and check after each iteration
		if ( ! resolveMovements(level, bannedGroup, seedsToPlay_CanMove, seedsToPlay_CantMove) )
		{
			if (verbose_logging) { consolePrint('applying late rules') }
			applyRules(state.lateRules, level, state.lateLoopPoint)
			break
		}

		// trackback
		consolePrint("Rigid movement application failed, rolling back")
		//don't need to concat or anythign here, once something is restored it won't be used again.
		level.objects = new Int32Array(startState.objects)
		level.movements = new Int32Array(startState.movements)
		level.rigidGroupIndexMask = startState.rigidGroupIndexMask.concat([])
		level.rigidMovementAppliedMask = startState.rigidMovementAppliedMask.concat([])
		// TODO: shouldn't we also save/restore the level data computed by level.calculateRowColMasks()?
		// -> I tried and it does not help with speed, but is it correct not to do it?
		// level.colCellContents = startState.colCellContents.map(x => x.clone())
		// level.rowCellContents = startState.rowCellContents.map(x => x.clone())
		// level.mapCellContents = startState.mapCellContents.clone()
		execution_context.resetCommands()
		sfxCreateMask.setZero()
		sfxDestroyMask.setZero()
		// TODO: shouldn't we also reset seedsToPlay_CanMove and seedsToPlay_CantMove?

		i--
		if (i <= 0)
		{
			consolePrint('Cancelled '+max_rigid_loops+' rigid rules, gave up. Too many loops!')
			break
		}
	}

	// require_player_movement
	// TODO: shouldn't this be tested after CANCEL and RESTART commands? (and AGAIN ?)
	if ( (playerPositions.length > 0) && (state.metadata.require_player_movement !== undefined) )
	{
		// TODO: technically, this checks that at least one cell initially containing a player does not contain a player at the end. It fails to detect permutations of players.
		if ( playerPositions.every( pos => ! state.playerMask.bitsClearInArray(level.getCell(pos).data) ) )
		{
			if (verbose_logging) { consolePrint('require_player_movement set, but no player movement detected, so cancelling turn.', true) }
			forceUndo(bak)
			return false
		}
		//play player cantmove sounds here
	}


	// CANCEL command
	if (execution_context.commandQueue.get(CommandsSet.command_keys.cancel))
	{
		if (verbose_logging)
		{
			consolePrintFromRule('CANCEL command executed, cancelling turn.', execution_context.commandQueue.sourceRules[CommandsSet.command_keys.cancel], true)
		}
		execution_context.commandQueue.processOutput()
		tryPlaySimpleSound('cancel')
		forceUndo(bak)
		return false
	} 

	// RESTART command
	if (execution_context.commandQueue.get(CommandsSet.command_keys.restart))
	{
		if (verbose_logging)
		{
			consolePrintFromRule('RESTART command executed, reverting to restart state.', execution_context.commandQueue.sourceRules[CommandsSet.command_keys.restart], true)
		}
		execution_context.commandQueue.processOutput()
		DoRestart(bak)
		return true
	} 

	const modified = level.objects.some( (o, i) => o !== bak.dat[i] )

	if (dontModify) // this is a fake frame just to check that applying again would cause some change
	{
		if (modified)
		{
			// if (verbose_logging) { consoleCacheDump() } // verbose_logging is set to false when dontModify is set to true
			forceUndo(bak)
			return true
		}
		return (execution_context.commandQueue.get(CommandsSet.command_keys.win))
	}

	// Add the frame to undo stack if something changed in the frame and it has some actual player input (not ticks, not apply rules on level start)
	if (modified && (dir !== -1) )
	{
		execution_context.backups.push(bak)
	}

	for (const seed of seedsToPlay_CantMove)
	{
		playSound(seed)
	}

	for (const seed of seedsToPlay_CanMove)
	{
		playSound(seed)
	}

	for (const entry of state.sfx_CreationMasks)
	{
		if (sfxCreateMask.anyBitsInCommon(entry.objectMask))
		{
			playSound(entry.seed)
		}
	}

	for (const entry of state.sfx_DestructionMasks)
	{
		if (sfxDestroyMask.anyBitsInCommon(entry.objectMask))
		{
			playSound(entry.seed)
		}
	}

	execution_context.commandQueue.processOutput()

	if (screen_layout.content !== msg_screen)
	{
		if (verbose_logging) { consolePrint('Checking win condition.') }
		checkWin(dontDoWin)
	}

	if ( ! winning )
	{
		if (execution_context.commandQueue.get(CommandsSet.command_keys.checkpoint))
		{
			if (verbose_logging)
			{ 
				consolePrintFromRule('CHECKPOINT command executed, saving current state to the restart state.', execution_context.commandQueue.sourceRules[CommandsSet.command_keys.checkpoint])
			}
			execution_context.restartTarget = level.forSerialization()
			execution_context.hasUsedCheckpoint = true
			storage_set(document.URL+'_checkpoint', JSON.stringify(execution_context.restartTarget))
			storage_set(document.URL, curlevel)
		}	 

		if ( modified && execution_context.commandQueue.get(CommandsSet.command_keys.again) )
		{
			const r = execution_context.commandQueue.sourceRules[CommandsSet.command_keys.again]

			// first have to verify that something's changed
			// TODO: instead, we could precompute the next state and activate it when the again_interval times out. It would require to store the to-be-displayed console messages
			// with the precomputed level, but I think we can do that, and for emulation/debugging purposes it might be good to associate the error messages with the state
			var old_verbose_logging = verbose_logging
			var oldmessagetext = messagetext
			verbose_logging = false
			if (processInput(-1, true, true)) // This is the only place we call processInput with parameter dontModify set to true
			{
				if (old_verbose_logging) { consolePrintFromRule('AGAIN command executed, with changes detected - will execute another turn.', r) }
				againing = true // this is the only place where we set againing to true
				timer = 0
			}
			else
			{
				if (old_verbose_logging) { consolePrintFromRule('AGAIN command not executed, it wouldn\'t make any changes.', r) }
			}
			verbose_logging = old_verbose_logging
			messagetext = oldmessagetext
		}
	}

	execution_context.resetCommands()

	if (verbose_logging) { consoleCacheDump() }

	return modified
}


// only called from update when closing a message, and from processInput
function checkWin(dontDoWin = false)
{
	dontDoWin |= screen_layout.dontDoWin()

	if (execution_context.commandQueue.get(CommandsSet.command_keys.win))
	{
		if (runrulesonlevelstart_phase)
		{
			consolePrint("Win Condition Satisfied (However this is in the run_rules_on_level_start rule pass, so I'm going to ignore it for you.  Why would you want to complete a level before it's already started?!)");
		} else {
			consolePrint("Win Condition Satisfied");
		}
		if( ! dontDoWin )
		{
			DoWin()
		}
		return
	}

	if (state.winconditions.length == 0)
		return

	for (const [quantifier, filter1, filter2] of state.winconditions)
	{
		// TODO: can we use level.mapCellContents to optimize this?
		// "no"   FAILS    if we find an x WITH    an y
		// "some" SUCCEEDS if we find an x WITH    an y
		// "all"  FAILS    if we find an x WITHOUT an y
		var rulePassed = (quantifier != 0)
		const search_WITH = (quantifier < 1)
		for (var i=0; i<level.n_tiles; i++)
		{
			const cell = level.getCellInto(i,_o10)
			if ( ( ! filter1.bitsClearInArray(cell.data) ) && (search_WITH ^ filter2.bitsClearInArray(cell.data)) )
			{
				rulePassed = ! rulePassed
				break
			}
		}
		if ( ! rulePassed )
			return
	}

	// won
	if (runrulesonlevelstart_phase)
	{
		consolePrint("Win Condition Satisfied (However this is in the run_rules_on_level_start rule pass, so I'm going to ignore it for you.  Why would you want to complete a level before it's already started?!)");		
	} else {
		consolePrint("Win Condition Satisfied");
	}
	if ( ! dontDoWin )
	{
		DoWin()
	}
}

// only called from checkWin
function DoWin()
{
	if (winning)
		return
	againing = false
	tryPlaySimpleSound('endlevel')
	if (unitTesting)
	{
		nextLevel()
		return
	}

	winning = true
	timer = 0
}

function nextLevel()
{
	againing = false
	messagetext = ''
	if (state && state.levels && (curlevel > state.levels.length) )
	{
		curlevel = state.levels.length-1
	}
	
	if (screen_layout.content === menu_screen) // TODO: this should not be in this function
	{
		if (menu_screen.item === 0)
		{
			//new game
			curlevel = 0
			curlevelTarget = null
		} 			
		loadLevelFromState(state, curlevel)
	}
	else
	{
		if (execution_context.hasUsedCheckpoint)
		{
			curlevelTarget = null
			execution_context.hasUsedCheckpoint = false
		}
		if (curlevel < state.levels.length-1)
		{			
			curlevel++
			msg_screen.done = false
			loadLevelFromState(state, curlevel)
		}
		else // end game
		{
			try {
				storage_remove(document.URL)
				storage_remove(document.URL+'_checkpoint')
			} catch(ex) { }
			
			curlevel = 0
			curlevelTarget = null
			goToTitleScreen()
			tryPlaySimpleSound('endgame')
		}		
		//continue existing game
	}
	try {
		storage_set(document.URL, curlevel)
		if (curlevelTarget !== null)
		{
			execution_context.restartTarget = level.forSerialization()
			storage_set(document.URL+'_checkpoint', JSON.stringify(execution_context.restartTarget))
		} else {
			storage_remove(document.URL+'_checkpoint')
		}		
	} catch (ex) { }

	if ( (state !== undefined) && (state.metadata.flickscreen !== undefined) )
	{
		oldflickscreendat = [0, 0, Math.min(state.metadata.flickscreen[0], level.width), Math.min(state.metadata.flickscreen[1], level.height)]
	}
	canvasResize()
	clearInputHistory()
}

function goToTitleScreen()
{
	againing = false
	messagetext = ''
	screen_layout.content = menu_screen
	doSetupTitleScreenLevelContinue()
	menu_screen.item = isContinuePossible() ? 1 : 0
	menu_screen.makeTitle()
}


