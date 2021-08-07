
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
	if (leveldat===undefined) {
		consolePrint("Trying to access a level that doesn't exist.", true)
		goToTitleScreen();
		return;
	}
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

		backups=[]
		restartTarget=backupLevel();
		keybuffer=[];

		if ('run_rules_on_level_start' in state.metadata)
		{
			runrulesonlevelstart_phase=true;
			processInput(-1,true);
			runrulesonlevelstart_phase=false;
		}
	} else {
		showTempMessage()
	}

	clearInputHistory();
}

function loadLevelFromState(state, levelindex, target, randomseed)
{
	if (target === undefined) { target = null }
	const leveldat = (target === null) ? state.levels[levelindex] : target
	curlevel = levelindex
	curlevelTarget = target
	if ( (leveldat !== undefined) && (leveldat.message === undefined) )
	{
		tryPlaySimpleSound('startlevel')
	}
	loadLevelFromLevelDat(state, state.levels[levelindex], randomseed)
	if (target !== null)
	{
		level.restore(target)
		restartTarget = target
	}
}

function goToLevel(i, state, levelindex, target, randomseed)
{
	curlevel = i
	winning = false
	timer = 0
	menu_screen.done = false
	msg_screen.done = false
	loadLevelFromState(state, levelindex, target, randomseed)
}




// Backup levels
// =============

var backups=[];
var restartTarget;

function backupLevel() {
	return {
		dat : new Int32Array(level.objects),
		width : level.width,
		height : level.height,
		oldflickscreendat: oldflickscreendat.concat([])
	};
}

function level4Serialization() {
	return {
		dat : Array.from(level.objects),
		width : level.width,
		height : level.height,
		oldflickscreendat: oldflickscreendat.concat([])
	};
}


// Youtube
// =======

function tryDeactivateYoutube(){
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
function setGameState(_state, command, randomseed)
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

	if (command===undefined) {
		command=["restart"];
	}
	if ((state.levels.length===0 || _state.levels.length===0) && command.length>0 && command[0]==="rebuild")  {
		command=["restart"];
	}
	if (randomseed===undefined) {
		randomseed=null;
	}
	RandomGen = new RNG(randomseed);

	state = _state;

	if (command[0]!=="rebuild"){
		backups=[];
	}

	//set sprites
	sprites = [];
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
			menu_screen.item = ( (curlevel > 0) || (curlevelTarget !== null) ) ? 1 : 0
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
				goToLevel(i, state, i, null, randomseed)
				break;
			}
			break;	
		}
		case 'loadLevel':
		{
			goToLevel(i, state, command[1], null, randomseed)
			break;
		}
		case 'levelline':
		{
			var targetLine = command[1];
			for (var i=state.levels.length-1;i>=0;i--) {
				var level= state.levels[i];
				if(level.lineNumber<=targetLine+1) {
					goToLevel(i, state, i)
					break;
				}
			}
			break;
		}
	}
	
	if(command[0] !== 'rebuild')
	{
		clearInputHistory();
	}

	canvasResize()

	if ( (state.sounds.length == 0) && (state.metadata.youtube == null) )
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

function DoRestart(force) {
	if (restarting===true){
		return;
	}
	if (force!==true && ('norestart' in state.metadata)) {
		return;
	}
	restarting = true;
	if (force !== true)
	{
		backups.push(backupLevel());
	}

	if (verbose_logging) {
		consolePrint("--- restarting ---",true);
	}

	level.restore(restartTarget);
	tryPlaySimpleSound('restart')

	if ('run_rules_on_level_start' in state.metadata) {
		processInput(-1,true);
	}
	
	level.commandQueue=[];
	level.commandQueueSourceRules=[];
	restarting=false;
}

function backupDiffers(){
	if (backups.length==0){
		return true;
	}
	var bak = backups[backups.length-1];
	for (var i=0;i<level.objects.length;i++) {
		if (level.objects[i]!==bak.dat[i]) {
			return true;
		}
	}
	return false;
}

function DoUndo(force, ignoreDuplicates)
{
	if ( ( ! screen_layout.alwaysAllowUndo() ) && ('noundo' in state.metadata) && (force !== true) )
		return;
	if (verbose_logging) {
		consolePrint("--- undoing ---",true);
	}

	if (ignoreDuplicates){
		while (backupDiffers()==false){
			backups.pop();
		}
	}

	if (backups.length > 0)
	{
		level.restore(backups[backups.length-1]);
		backups = backups.splice(0,backups.length-1);
		if (! force) {
			tryPlaySimpleSound('undo')
		}
	}
}

function getPlayerPositions()
{
	var result=[];
	var playerMask = state.playerMask;
	for (i=0; i<level.n_tiles; i++) // TODO: this scans the whole level, can't we optimize that by using level.mapCellContents, level.rowCellContents, or level.colCellContents?
	{
		level.getCellInto(i,_o11);
		if (playerMask.anyBitsInCommon(_o11))
		{
			result.push(i);
		}
	}
	return result;
}

function startMovement(dir)
{
	const playerPositions = getPlayerPositions()
	for (const playerPosIndex of playerPositions)
	{
		var cellMask = level.getCell(playerPosIndex)
		var movementMask = level.getMovements(playerPosIndex);

		cellMask.iand(state.playerMask)

		for (var i=0; i<state.objectCount; i++)
		{
			if (cellMask.get(i)) {
				movementMask.ishiftor(dir, 5 * state.identifiers.objects[ state.idDict[i] ].layer);
			}
		}

		level.setMovements(playerPosIndex, movementMask);
	}
	return playerPositions;
}

var dirMasksDelta = {
	 1:[0,-1],//up
	 2:[0,1],//'down'  : 
	 4:[-1,0],//'left'  : 
	 8:[1,0],//'right' : 
	 15:[0,0],//'?' : 
	 16:[0,0],//'action' : 
	 3:[0,0]//'no'
};

var dirMaskName = {
	 1:'up',
	 2:'down',
	 4:'left',
	 8:'right',
	 15:'?',
	 16:'action',
	 3:'no'
};

var seedsToPlay_CanMove = []
var seedsToPlay_CantMove = []

function repositionEntitiesOnLayer(positionIndex, layer, dirMask) 
{
	const [dx, dy] = dirMasksDelta[dirMask]
	const [sx, sy] = level.cellCoord(positionIndex)
	const [tx, ty] = [sx+dx, sy+dy]

	if ( (clamp(0, tx, level.width-1) != tx) || (clamp(0, ty, level.height-1) != ty) )
		return false

	const targetIndex = ty + tx*level.height

	const layerMask = state.layerMasks[layer]
	var targetMask = level.getCellInto(targetIndex, _o7)
	var sourceMask = level.getCellInto(positionIndex, _o8)

	if (layerMask.anyBitsInCommon(targetMask) && (dirMask != 16))
		return false

	for (const o of state.sfx_MovementMasks)
	{
		if ( o.objectMask.anyBitsInCommon(sourceMask) && level.getMovements(positionIndex).anyBitsInCommon(o.directionMask) && (seedsToPlay_CanMove.indexOf(o.seed) === -1) )
		{
			seedsToPlay_CanMove.push(o.seed)
		}
	}

	var movingEntities = sourceMask.clone();
	sourceMask.iclear(layerMask);
	movingEntities.iand(layerMask);
	targetMask.ior(movingEntities);

	level.setCell(positionIndex, sourceMask);
	level.setCell(targetIndex, targetMask);

	const [colIndex, rowIndex] = level.cellCoord(targetIndex)
	level.colCellContents[colIndex].ior(movingEntities);
	level.rowCellContents[rowIndex].ior(movingEntities);
	level.mapCellContents.ior(movingEntities);
	return true
}

function repositionEntitiesAtCell(positionIndex)
{
	var movementMask = level.getMovements(positionIndex)
	if (movementMask.iszero())
		return false

	var moved = false
	for (var layer=0; layer<level.layerCount; layer++)
	{
		const layerMovement = movementMask.getshiftor(0x1f, 5*layer)
		if (layerMovement !== 0)
		{
			if ( repositionEntitiesOnLayer(positionIndex, layer, layerMovement) )
			{
				movementMask.ishiftclear(layerMovement, 5*layer)
				moved = true
			}
		}
	}

	level.setMovements(positionIndex, movementMask)
	return moved
}

var rigidBackups = []

function commitPreservationState(ruleGroupIndex)
{
	var propagationState = {
		ruleGroupIndex:ruleGroupIndex,
		objects:new Int32Array(level.objects),
		movements:new Int32Array(level.movements),
		rigidGroupIndexMask:level.rigidGroupIndexMask.concat([]),
		rigidMovementAppliedMask:level.rigidMovementAppliedMask.concat([]),
		bannedGroup:level.bannedGroup.concat([]),
		commandQueue:level.commandQueue.concat([]),
		commandQueueSourceRules:level.commandQueueSourceRules.concat([])
	};
	rigidBackups[ruleGroupIndex]=propagationState;
	return propagationState;
}

function restorePreservationState(preservationState) {;
//don't need to concat or anythign here, once something is restored it won't be used again.
	level.objects = new Int32Array(preservationState.objects);
	level.movements = new Int32Array(preservationState.movements);
	level.rigidGroupIndexMask = preservationState.rigidGroupIndexMask.concat([]);
	level.rigidMovementAppliedMask = preservationState.rigidMovementAppliedMask.concat([]);
	level.commandQueue = preservationState.commandQueue.concat([]);
	level.commandQueueSourceRules = preservationState.commandQueueSourceRules.concat([]);
	sfxCreateMask.setZero();
	sfxDestroyMask.setZero();
	consolePrint("Rigid movement application failed, rolling back");

//	rigidBackups = preservationState.rigidBackups;
}



function showTempMessage()
{
	tryPlaySimpleSound('showmessage')
	msg_screen.doMessage()
	canvasResize()
}

function processOutputCommands(commands)
{
	for (var command of commands)
	{
		if (command.charAt(1)==='f') //identifies sfxN
		{
			tryPlaySimpleSound(command);
		}  	
		if (unitTesting === false)
		{
			if (command === 'message')
			{
				keybuffer = []
				msg_screen.done = false
				showTempMessage()
			}
		}
	}
}

function applyRandomRuleGroup(ruleGroup) {
	var propagated=false;

	var matches=[];
	for (var ruleIndex=0;ruleIndex<ruleGroup.length;ruleIndex++) {
		var rule=ruleGroup[ruleIndex];
		var ruleMatches = rule.findMatches();
		if (ruleMatches.length>0) {
			var tuples  = generateTuples(ruleMatches);
			for (var j=0;j<tuples.length;j++) {
				var tuple=tuples[j];
				matches.push([ruleIndex,tuple]);
			}
		}		
	}

	if (matches.length===0)
	{
		return false;
	} 

	var match = matches[Math.floor(RandomGen.uniform()*matches.length)];
	var ruleIndex=match[0];
	var rule=ruleGroup[ruleIndex];
	var tuple=match[1];
	var check=false;
	var modified = rule.applyAt(tuple, check)

	rule.queueCommands();

	return modified;
}

function applyRuleGroup(ruleGroup) {
	if (ruleGroup[0].isRandom) {
		return applyRandomRuleGroup(ruleGroup);
	}

	var loopPropagated=false;
	var propagated=true;
	var loopcount=0;
	while(propagated) {
		loopcount++;
		if (loopcount>200) 
		{
			logErrorCacheable("Got caught looping lots in a rule group :O",ruleGroup[0].lineNumber,true);
			break;
		}
		propagated=false;
		for (var ruleIndex=0;ruleIndex<ruleGroup.length;ruleIndex++) {
			var rule = ruleGroup[ruleIndex];            
			propagated = rule.tryApply() || propagated;
		}
		if (propagated) {
			loopPropagated=true;
		}
	}

	return loopPropagated;
}

function applyRules(rules, loopPoint, startRuleGroupindex, bannedGroup){
	//for each rule
	//try to match it

	//when we're going back in, let's loop, to be sure to be sure
	var loopPropagated = startRuleGroupindex>0;
	var loopCount = 0;
	for (var ruleGroupIndex = startRuleGroupindex; ruleGroupIndex < rules.length ;)
	{
		if (bannedGroup && bannedGroup[ruleGroupIndex]) {
			//do nothing
		} else {
			var ruleGroup=rules[ruleGroupIndex];
			loopPropagated = applyRuleGroup(ruleGroup) || loopPropagated;
		}
		if (loopPropagated && loopPoint[ruleGroupIndex]!==undefined) {
			ruleGroupIndex = loopPoint[ruleGroupIndex];
			loopPropagated=false;
			loopCount++;
			if (loopCount > 200) {
				var ruleGroup=rules[ruleGroupIndex];
				logErrorCacheable("got caught in an endless startloop...endloop vortex, escaping!", ruleGroup[0].lineNumber,true);
				break;
			}
		} else {
			ruleGroupIndex++;
			if (ruleGroupIndex===rules.length) {
				if (loopPropagated && loopPoint[ruleGroupIndex]!==undefined) {
					ruleGroupIndex = loopPoint[ruleGroupIndex];
					loopPropagated=false;
					loopCount++;
					if (loopCount > 200) {
						var ruleGroup=rules[ruleGroupIndex];
						logErrorCacheable("got caught in an endless startloop...endloop vortex, escaping!", ruleGroup[0].lineNumber,true);
						break;
					}
				} 
			}
		}
	}
}


//if this returns!=null, need to go back and reprocess
function resolveMovements(dir){
	var moved=true;
	while(moved){
		moved=false;
		for (var i=0;i<level.n_tiles;i++) {
			moved = repositionEntitiesAtCell(i) || moved;
		}
	}
	var doUndo=false;

	for (var i=0;i<level.n_tiles;i++) {
		var cellMask = level.getCellInto(i,_o6);
		var movementMask = level.getMovements(i);
		if (!movementMask.iszero()) {
			var rigidMovementAppliedMask = level.rigidMovementAppliedMask[i];
			if (rigidMovementAppliedMask !== 0) {
				movementMask.iand(rigidMovementAppliedMask);
				if (!movementMask.iszero()) {
					//find what layer was restricted
					for (var j=0;j<level.layerCount;j++) {
						var layerSection = movementMask.getshiftor(0x1f, 5*j);
						if (layerSection!==0) {
							//this is our layer!
							var rigidGroupIndexMask = level.rigidGroupIndexMask[i];
							var rigidGroupIndex = rigidGroupIndexMask.getshiftor(0x1f, 5*j);
							rigidGroupIndex--;//group indices start at zero, but are incremented for storing in the bitfield
							var groupIndex = state.rigidGroupIndex_to_GroupIndex[rigidGroupIndex];
							level.bannedGroup[groupIndex]=true;
							//backtrackTarget = rigidBackups[rigidGroupIndex];
							doUndo=true;
							break;
						}
					}
				}
			}
			for (var j=0;j<state.sfx_MovementFailureMasks.length;j++) {
				var o = state.sfx_MovementFailureMasks[j];
				var objectMask = o.objectMask;
				if (objectMask.anyBitsInCommon(cellMask)) {
					var directionMask = o.directionMask;
					if (movementMask.anyBitsInCommon(directionMask) && seedsToPlay_CantMove.indexOf(o.seed)===-1) {
						seedsToPlay_CantMove.push(o.seed);
					}
				}
			}
		}

		for (var j=0;j<STRIDE_MOV;j++) {
			level.movements[j+i*STRIDE_MOV]=0;
		}
		level.rigidGroupIndexMask[i]=0;
		level.rigidMovementAppliedMask[i]=0;
	}
	return doUndo;
}

var sfxCreateMask=null;
var sfxDestroyMask=null;

function calculateRowColMasks() {
	for(var i=0;i<level.mapCellContents.length;i++) {
		level.mapCellContents[i]=0;
	}

	for (var i=0;i<level.width;i++) {
		var ccc = level.colCellContents[i];
		ccc.setZero();
	}

	for (var i=0;i<level.height;i++) {
		var rcc = level.rowCellContents[i];
		rcc.setZero();
	}

	for (var i=0;i<level.width;i++) {
		for (var j=0;j<level.height;j++) {
			var index = j+i*level.height;
			var cellContents=level.getCellInto(index,_o9);
			level.mapCellContents.ior(cellContents);
			level.rowCellContents[j].ior(cellContents);
			level.colCellContents[i].ior(cellContents);
		}
	}
}

/* returns a bool indicating if anything changed */
function processInput(dir, dontDoWin, dontModify)
{
	againing = false;

	if (verbose_logging) { 
		if (dir===-1) {
			consolePrint('Turn starts with no input.')
		} else {
			consolePrint('=======================');
			consolePrint('Turn starts with input of ' + ['up','left','down','right','action'][dir]+'.');
		}
	}

	var bak = backupLevel();

	var playerPositions=[];
	if (dir<=4) {
		if (dir>=0) {
			dir = ([1, 4, 2, 8, 16])[dir] // TODO: use a global const generated from the one that defines these bits.
			playerPositions = startMovement(dir);
		}

		var i=0;
		level.bannedGroup = [];
		rigidBackups = [];
		level.commandQueue=[];
		level.commandQueueSourceRules=[];
		var startRuleGroupIndex=0;
		var rigidloop=false;
		var startState = commitPreservationState();
		sfxCreateMask.setZero();
		sfxDestroyMask.setZero();

		seedsToPlay_CanMove=[];
		seedsToPlay_CantMove=[];

		calculateRowColMasks();

		do {
		//not particularly elegant, but it'll do for now - should copy the world state and check
		//after each iteration
			rigidloop=false;
			i++;
			
			if (verbose_logging){consolePrint('applying rules');}

			applyRules(state.rules, state.loopPoint, startRuleGroupIndex, level.bannedGroup);
			var shouldUndo = resolveMovements();

			if (shouldUndo) {
				rigidloop=true;
				restorePreservationState(startState);
				startRuleGroupIndex=0;//rigidGroupUndoDat.ruleGroupIndex+1;
			} else {
				if (verbose_logging){consolePrint('applying late rules');}
				applyRules(state.lateRules, state.lateLoopPoint, 0);
				startRuleGroupIndex=0;
			}
		} while (i < 50 && rigidloop);

		if (i>=50) {
			consolePrint("looped through 50 times, gave up.  too many loops!");
		}


		if (playerPositions.length>0 && state.metadata.require_player_movement!==undefined) {
			var somemoved=false;
			for (var i=0;i<playerPositions.length;i++) {
				var pos = playerPositions[i];
				var val = level.getCell(pos);
				if (state.playerMask.bitsClearInArray(val.data)) {
					somemoved=true;
					break;
				}
			}
			if (somemoved===false) {
				if (verbose_logging){
					consolePrint('require_player_movement set, but no player movement detected, so cancelling turn.', true)
				}
				backups.push(bak);
				DoUndo(true,false);
				return false;
			}
			//play player cantmove sounds here
		}



		if (level.commandQueue.indexOf('cancel')>=0) {
			if (verbose_logging) {
				var r = level.commandQueueSourceRules[level.commandQueue.indexOf('cancel')];
				consolePrintFromRule('CANCEL command executed, cancelling turn.', r, true)
			}
			processOutputCommands(level.commandQueue);
			backups.push(bak);
			messagetext = "";
			DoUndo(true,false);
			tryPlaySimpleSound('cancel')
			return false;
		} 

		if (level.commandQueue.indexOf('restart')>=0) {
			if (verbose_logging) { 
				var r = level.commandQueueSourceRules[level.commandQueue.indexOf('restart')];
				consolePrintFromRule('RESTART command executed, reverting to restart state.', r, true)
			}
			processOutputCommands(level.commandQueue);
			backups.push(bak);
			messagetext = "";
			DoRestart(true);
			return true;
		} 

		var modified=false;
		for (var i=0;i<level.objects.length;i++) {
			if (level.objects[i]!==bak.dat[i]) {
				if (dontModify) {
					if (verbose_logging) {
						consoleCacheDump();
					}
					backups.push(bak);
					DoUndo(true,false);
					return true;
				} else {
					if (dir!==-1) {
						backups.push(bak);
					}
					modified=true;
				}
				break;
			}
		}

		if (dontModify && level.commandQueue.indexOf('win') >= 0)
			return true;

		if (dontModify) {		
			if (verbose_logging) {
				consoleCacheDump();
			}
			return false;
		}

		for (var i=0;i<seedsToPlay_CantMove.length;i++) {
				playSound(seedsToPlay_CantMove[i]);
		}

		for (var i=0;i<seedsToPlay_CanMove.length;i++) {
				playSound(seedsToPlay_CanMove[i]);
		}

		for (var i=0;i<state.sfx_CreationMasks.length;i++) {
			var entry = state.sfx_CreationMasks[i];
			if (sfxCreateMask.anyBitsInCommon(entry.objectMask)) {
				playSound(entry.seed);
			}
		}

		for (var i=0;i<state.sfx_DestructionMasks.length;i++) {
			var entry = state.sfx_DestructionMasks[i];
			if (sfxDestroyMask.anyBitsInCommon(entry.objectMask)) {
				playSound(entry.seed);
			}
		}

		processOutputCommands(level.commandQueue);

		if (screen_layout.content != msg_screen)
		{
			if (verbose_logging) { 
				consolePrint('Checking win condition.');
			}
			if (dontDoWin===undefined){
				dontDoWin = false;
			}
			checkWin( dontDoWin );
		}

		if (!winning) {
			if (level.commandQueue.indexOf('checkpoint')>=0) {
				if (verbose_logging) { 
					var r = level.commandQueueSourceRules[level.commandQueue.indexOf('checkpoint')];
					consolePrintFromRule('CHECKPOINT command executed, saving current state to the restart state.',r);
				}
				restartTarget=level4Serialization();
				hasUsedCheckpoint=true;
				var backupStr = JSON.stringify(restartTarget);
				if ( !!window.localStorage )
				{
					localStorage[document.URL+'_checkpoint']=backupStr;
					localStorage[document.URL]=curlevel;
				}
			}	 

			if (level.commandQueue.indexOf('again')>=0 && modified) {

				var r = level.commandQueueSourceRules[level.commandQueue.indexOf('again')];

				//first have to verify that something's changed
				var old_verbose_logging=verbose_logging;
				var oldmessagetext = messagetext;
				verbose_logging=false;
				if (processInput(-1,true,true)) {
					verbose_logging=old_verbose_logging;

					if (verbose_logging) { 
						consolePrintFromRule('AGAIN command executed, with changes detected - will execute another turn.',r);
					}

					againing=true;
					timer=0;
				} else {		    	
					verbose_logging=old_verbose_logging;
					if (verbose_logging) { 
						consolePrintFromRule('AGAIN command not executed, it wouldn\'t make any changes.',r);
					}
				}
				verbose_logging=old_verbose_logging;
				messagetext = oldmessagetext;
			}   
		}
			

		level.commandQueue=[];
		level.commandQueueSourceRules=[];

	}

	if (verbose_logging) {
		consoleCacheDump();
	}

	if (winning) {
		againing=false;
	}

	return modified;
}

function checkWin(dontDoWin)
{
	dontDoWin = screen_layout.dontDoWin()

	if (level.commandQueue.indexOf('win')>=0)
	{
		if (runrulesonlevelstart_phase)
		{
			consolePrint("Win Condition Satisfied (However this is in the run_rules_on_level_start rule pass, so I'm going to ignore it for you.  Why would you want to complete a level before it's already started?!)");
		} else {
			consolePrint("Win Condition Satisfied");
		}
		if( !dontDoWin )
		{
			DoWin();
		}
		return;
	}

	var won= false;
	if (state.winconditions.length>0)  {
		var passed=true;
		for (var wcIndex=0;wcIndex<state.winconditions.length;wcIndex++) {
			var wincondition = state.winconditions[wcIndex];
			var filter1 = wincondition[1];
			var filter2 = wincondition[2];
			var rulePassed=true;
			switch(wincondition[0]) {
				case -1://NO
				{
					for (var i=0;i<level.n_tiles;i++) {
						var cell = level.getCellInto(i,_o10);
						if ( (!filter1.bitsClearInArray(cell.data)) &&  
							 (!filter2.bitsClearInArray(cell.data)) ) {
							rulePassed=false;
							break;
						}
					}

					break;
				}
				case 0://SOME
				{
					var passedTest=false;
					for (var i=0;i<level.n_tiles;i++) {
						var cell = level.getCellInto(i,_o10);
						if ( (!filter1.bitsClearInArray(cell.data)) &&  
							 (!filter2.bitsClearInArray(cell.data)) ) {
							passedTest=true;
							break;
						}
					}
					if (passedTest===false) {
						rulePassed=false;
					}
					break;
				}
				case 1://ALL
				{
					for (var i=0;i<level.n_tiles;i++) {
						var cell = level.getCellInto(i,_o10);
						if ( (!filter1.bitsClearInArray(cell.data)) &&  
							 (filter2.bitsClearInArray(cell.data)) ) {
							rulePassed=false;
							break;
						}
					}
					break;
				}
			}
			if (rulePassed===false) {
				passed=false;
			}
		}
		won=passed;
	}

	if (won)
	{
		if (runrulesonlevelstart_phase)
		{
			consolePrint("Win Condition Satisfied (However this is in the run_rules_on_level_start rule pass, so I'm going to ignore it for you.  Why would you want to complete a level before it's already started?!)");		
		} else {
			consolePrint("Win Condition Satisfied");
		}
		if ( !dontDoWin )
		{
			DoWin();
		}
	}
}

function DoWin() {
	if (winning) {
		return;
	}
	againing=false;
	tryPlaySimpleSound('endlevel')
	if (unitTesting) {
		nextLevel();
		return;
	}

	winning=true;
	timer=0;
}

/*
//this function isn't valid after refactoring, but also isn't used.
function anyMovements() {	
	for (var i=0;i<level.movementMask.length;i++) {
		if (level.movementMask[i]!==0) {
			return true;
		}
	}
	return false;
}*/


function nextLevel() {
	againing=false;
	messagetext="";
	if (state && state.levels && (curlevel>state.levels.length) ){
		curlevel=state.levels.length-1;
	}
	
	if (screen_layout.content === menu_screen) // TODO: this should not be in this function
	{
		if (menu_screen.item === 0)
		{
			//new game
			curlevel = 0
			curlevelTarget = null
		} 			
		if (curlevelTarget !== null)
		{
			loadLevelFromState(state, curlevel, curlevelTarget)
		} else {
			loadLevelFromState(state, curlevel)
		}
	} else {	
		if (hasUsedCheckpoint){
			curlevelTarget=null;
			hasUsedCheckpoint=false;
		}
		if (curlevel<(state.levels.length-1))
		{			
			curlevel++;
			msg_screen.done = false

			if (curlevelTarget!==null){			
				loadLevelFromState(state, curlevel, curlevelTarget)
			} else {
				loadLevelFromState(state, curlevel)
			}
		} else {
			try{
				if (!!window.localStorage) {
	
					localStorage.removeItem(document.URL);
					localStorage.removeItem(document.URL+'_checkpoint');
				}
			} catch(ex){
					
			}
			
			curlevel=0;
			curlevelTarget=null;
			goToTitleScreen();
			tryPlaySimpleSound('endgame')
		}		
		//continue existing game
	}
	try {
		if (!!window.localStorage) {
			localStorage[document.URL]=curlevel;
			if (curlevelTarget!==null){
				restartTarget=level4Serialization();
				var backupStr = JSON.stringify(restartTarget);
				localStorage[document.URL+'_checkpoint']=backupStr;
			} else {
				localStorage.removeItem(document.URL+"_checkpoint");
			}		
		}
	} catch (ex) {

	}

	if (state!==undefined && state.metadata.flickscreen!==undefined){
		oldflickscreendat=[0,0,Math.min(state.metadata.flickscreen[0],level.width),Math.min(state.metadata.flickscreen[1],level.height)];
	}
	canvasResize();	
	clearInputHistory();
}

function goToTitleScreen(){
	againing=false;
	messagetext="";
	screen_layout.content = menu_screen
	doSetupTitleScreenLevelContinue()
	menu_screen.item = ( (curlevel > 0) || (curlevelTarget !== null) ) ? 1 : 0
	menu_screen.makeTitle()
}


