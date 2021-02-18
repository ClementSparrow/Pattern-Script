
var RandomGen = new RNG();


function unloadGame() {
	state=introstate;
	level = new Level(0, 5, 5, 2, null);
	level.objects = new Int32Array(0);
	generateTitleScreen();
	canvasResize();
	redraw();
}

var introstate = {
	title: "EMPTY GAME",
	attribution: "increpare",
	objectCount: 2,
	metadata:[],
	levels:[],
	bgcolor:"#000000",
	fgcolor:"#FFFFFF"
};

var state = introstate;

function deepClone(item) {
	if (!item) { return item; } // null, undefined values check

	var types = [ Number, String, Boolean ], 
		result;

	// normalizing primitives if someone did new String('aaa'), or new Number('444');
	types.forEach(function(type) {
		if (item instanceof type) {
			result = type( item );
		}
	});

	if (typeof result == "undefined") {
		if (Object.prototype.toString.call( item ) === "[object Array]") {
			result = [];
			item.forEach(function(child, index, array) { 
				result[index] = deepClone( child );
			});
		} else if (typeof item == "object") {
			// testing that this is DOM
			if (item.nodeType && typeof item.cloneNode == "function") {
				var result = item.cloneNode( true );    
			} else if (!item.prototype) { // check that this is a literal
				if (item instanceof Date) {
					result = new Date(item);
				} else {
					// it is an object literal
					result = {};
					for (var i in item) {
						result[i] = deepClone( item[i] );
					}
				}
			} else {
				// depending what you would like here,
				// just keep the reference, or create new object
/*                if (false && item.constructor) {
					// would not advice to do that, reason? Read below
					result = new item.constructor();
				} else */{
					result = item;
				}
			}
		} else {
			result = item;
		}
	}

	return result;
}


var loadedLevelSeed=0;

function loadLevelFromLevelDat(state, leveldat, randomseed)
{
	if (randomseed==null) {
		randomseed = (Math.random() + Date.now()).toString();
	}
	loadedLevelSeed = randomseed;
	RandomGen = new RNG(loadedLevelSeed);
	forceRegenImages=true;
	titleScreen=false;
	titleMode=(curlevel>0||curlevelTarget!==null)?1:0;
	titleSelection=(curlevel>0||curlevelTarget!==null)?1:0;
	titleSelected=false;
	againing=false;
	if (leveldat===undefined) {
		consolePrint("Trying to access a level that doesn't exist.",true);
	goToTitleScreen();
		return;
	}
	if (leveldat.message===undefined) {
		titleMode=0;
		textMode=false;
		level = leveldat.clone();
		RebuildLevelArrays();


		if (state!==undefined) {
			if (state.metadata.flickscreen!==undefined){
				oldflickscreendat=[
					0,
					0,
					Math.min(state.metadata.flickscreen[0],level.width),
					Math.min(state.metadata.flickscreen[1],level.height)
				];
			} else if (state.metadata.zoomscreen!==undefined){
				oldflickscreendat=[
					0,
					0,
					Math.min(state.metadata.zoomscreen[0],level.width),
					Math.min(state.metadata.zoomscreen[1],level.height)
				];
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
		tryPlayShowMessageSound();
		drawMessageScreen();
		canvasResize();
	}

	clearInputHistory();
}

function loadLevelFromStateTarget(state,levelindex,target,randomseed) {	
	var leveldat = target;    
	curlevel=levelindex;
	curlevelTarget=target;
	if (leveldat.message===undefined) {
		if (levelindex=== 0){ 
			tryPlayStartLevelSound();
		} else {
			tryPlayStartLevelSound();			
		}
	}
	loadLevelFromLevelDat(state,state.levels[levelindex],randomseed);
	restoreLevel(target);
	restartTarget=target;
}

function loadLevelFromState(state,levelindex,randomseed) {	
	var leveldat = state.levels[levelindex];    
	curlevel=levelindex;
	curlevelTarget=null;
	if (leveldat!==undefined && leveldat.message===undefined) {
		if (levelindex=== 0){ 
			tryPlayStartLevelSound();
		} else {
			tryPlayStartLevelSound();			
		}
	}
	loadLevelFromLevelDat(state,leveldat,randomseed);
}

var sprites = [
{
	color: '#423563',
	dat: [
		[1, 1, 1, 1, 1],
		[1, 0, 0, 0, 1],
		[1, 0, 0, 0, 1],
		[1, 0, 0, 0, 1],
		[1, 1, 1, 1, 1]
	]
},
{
	color: '#252342',
	dat: [
		[0, 0, 1, 0, 0],
		[1, 1, 1, 1, 1],
		[0, 0, 1, 0, 0],
		[0, 1, 1, 1, 0],
		[0, 1, 0, 1, 0]
	]
}
];


generateTitleScreen();
if (titleMode>0){
	titleSelection=1;
}

canvasResize();

function tryPlaySimpleSound(soundname) {
	if (state.sfx_Events[soundname]!==undefined) {
		var seed = state.sfx_Events[soundname];
		playSound(seed);
	}
}
function tryPlayTitleSound() {
	tryPlaySimpleSound("titlescreen");
}

function tryPlayStartGameSound() {
	tryPlaySimpleSound("startgame");
}

function tryPlayEndGameSound() {
	tryPlaySimpleSound("endgame");
}

function tryPlayCancelSound() {
	tryPlaySimpleSound("cancel");
}

function tryPlayStartLevelSound() {
	tryPlaySimpleSound("startlevel");
}

function tryPlayEndLevelSound() {
	tryPlaySimpleSound("endlevel");
}

function tryPlayUndoSound(){
	tryPlaySimpleSound("undo");
}

function tryPlayRestartSound(){
	tryPlaySimpleSound("restart");
}

function tryPlayShowMessageSound(){
	tryPlaySimpleSound("showmessage");
}

function tryPlayCloseMessageSound(){
	tryPlaySimpleSound("closemessage");
}

var backups=[];
var restartTarget;

function backupLevel() {
	var ret = {
		dat : new Int32Array(level.objects),
		width : level.width,
		height : level.height,
		oldflickscreendat: oldflickscreendat.concat([])
	};
	return ret;
}

function level4Serialization() {
	var ret = {
		dat : Array.from(level.objects),
		width : level.width,
		height : level.height,
		oldflickscreendat: oldflickscreendat.concat([])
	};
	return ret;
}


function tryDeactivateYoutube(){
	var youtubeFrame = document.getElementById("youtubeFrame");
	if (youtubeFrame){
		document.body.removeChild(youtubeFrame);
	}
}

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

function setGameState(_state, command, randomseed) {
	oldflickscreendat=[];
	timer=0;
	autotick=0;
	winning=false;
	againing=false;
	messageselected=false;
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
	for (var object of state.objects)
	{
		var sprite = {
			colors: object.colors,
			dat: object.spritematrix
		};
		sprites[object.id] = sprite;
	}
	if (state.metadata.realtime_interval!==undefined) {
		autotick=0;
		autotickinterval=state.metadata.realtime_interval*1000;
	} else {
		autotick=0;
		autotickinterval=0;
	}

	if (state.metadata.key_repeat_interval!==undefined) {
		repeatinterval=state.metadata.key_repeat_interval*1000;
	} else {
		repeatinterval=150;
	}

	if (state.metadata.again_interval!==undefined) {
		againinterval=state.metadata.again_interval*1000;
	} else {
		againinterval=150;
	}
	if (throttle_movement && autotickinterval===0) {
		logWarning("throttle_movement is designed for use in conjunction with realtime_interval. Using it in other situations makes games gross and unresponsive, broadly speaking.  Please don't.");
	}
	norepeat_action = state.metadata.norepeat_action!==undefined;
	
	switch(command[0]){
		case "restart":
		{
			if (restarting==true){
				logWarning('A "restart" command is being triggered in the "run_rules_on_level_start" section of level creation, which would cause an infinite loop if it was actually triggered, but it\'s being ignored, so it\'s not.');
				break;
			}
			winning=false;
			timer=0;
			titleScreen=true;
			tryPlayTitleSound();
			textMode=true;
			titleSelection=(curlevel>0||curlevelTarget!==null)?1:0;
			titleSelected=false;
			quittingMessageScreen=false;
			quittingTitleScreen=false;
			messageselected=false;
			titleMode = 0;
			if ((curlevel>0||curlevelTarget!==null)) {
				titleMode=1;
			}
			generateTitleScreen();
			break;
		}
		case "rebuild":
		{
			//do nothing
			break;
		}
		case "loadFirstNonMessageLevel":{
			for (var i=0;i<state.levels.length;i++){
				if (state.levels[i].hasOwnProperty("message")){
					continue;
				}
				var targetLevel = i;
				curlevel=i;
				winning=false;
				timer=0;
				titleScreen=false;
				textMode=false;
				titleSelection=(curlevel>0||curlevelTarget!==null)?1:0;
				titleSelected=false;
				quittingMessageScreen=false;
				quittingTitleScreen=false;
				messageselected=false;
				titleMode = 0;
				loadLevelFromState(state,targetLevel,randomseed);
				break;
			}
			break;	
		}
		case "loadLevel":
		{
			var targetLevel = command[1];
			curlevel=i;
			winning=false;
			timer=0;
			titleScreen=false;
			textMode=false;
			titleSelection=(curlevel>0||curlevelTarget!==null)?1:0;
			titleSelected=false;
			quittingMessageScreen=false;
			quittingTitleScreen=false;
			messageselected=false;
			titleMode = 0;
			loadLevelFromState(state,targetLevel,randomseed);
			break;
		}
		case "levelline":
		{
			var targetLine = command[1];
			for (var i=state.levels.length-1;i>=0;i--) {
				var level= state.levels[i];
				if(level.lineNumber<=targetLine+1) {
					curlevel=i;
					winning=false;
					timer=0;
					titleScreen=false;
					textMode=false;
					titleSelection=(curlevel>0||curlevelTarget!==null)?1:0;
					titleSelected=false;
					quittingMessageScreen=false;
					quittingTitleScreen=false;
					messageselected=false;
					titleMode = 0;
					loadLevelFromState(state,i);
					break;
				}
			}
			break;
		}
	}
	
	if(command[0] !== "rebuild") {
		clearInputHistory();
	}
	canvasResize();


	if (state.sounds.length==0&&state.metadata.youtube==null){
		killAudioButton();
	} else {
		showAudioButton();
	}
	
}

function RebuildLevelArrays() {
	level.movements = new Int32Array(level.n_tiles * STRIDE_MOV);

	level.rigidMovementAppliedMask = [];
	level.rigidGroupIndexMask = [];
	level.rowCellContents = [];
	level.colCellContents = [];
	level.mapCellContents = new BitVec(STRIDE_OBJ);
	_movementVecs = [new BitVec(STRIDE_MOV),new BitVec(STRIDE_MOV),new BitVec(STRIDE_MOV)];

	_o1 = new BitVec(STRIDE_OBJ);
	_o2 = new BitVec(STRIDE_OBJ);
	_o2_5 = new BitVec(STRIDE_OBJ);
	_o3 = new BitVec(STRIDE_OBJ);
	_o4 = new BitVec(STRIDE_OBJ);
	_o5 = new BitVec(STRIDE_OBJ);
	_o6 = new BitVec(STRIDE_OBJ);
	_o7 = new BitVec(STRIDE_OBJ);
	_o8 = new BitVec(STRIDE_OBJ);
	_o9 = new BitVec(STRIDE_OBJ);
	_o10 = new BitVec(STRIDE_OBJ);
	_o11 = new BitVec(STRIDE_OBJ);
	_o12 = new BitVec(STRIDE_OBJ);
	_m1 = new BitVec(STRIDE_MOV);
	_m2 = new BitVec(STRIDE_MOV);
	_m3 = new BitVec(STRIDE_MOV);
	

	for (var i=0;i<level.height;i++) {
		level.rowCellContents[i]=new BitVec(STRIDE_OBJ);	    	
	}
	for (var i=0;i<level.width;i++) {
		level.colCellContents[i]=new BitVec(STRIDE_OBJ);	    	
	}

	for (var i=0;i<level.n_tiles;i++)
	{
		level.rigidMovementAppliedMask[i]=new BitVec(STRIDE_MOV);
		level.rigidGroupIndexMask[i]=new BitVec(STRIDE_MOV);
	}
}

var messagetext="";
function restoreLevel(lev) {
	oldflickscreendat=lev.oldflickscreendat.concat([]);

	level.objects = new Int32Array(lev.dat);

	if (level.width !== lev.width || level.height !== lev.height) {
		level.width = lev.width;
		level.height = lev.height;
		level.n_tiles = lev.width * lev.height;
		RebuildLevelArrays();
		//regenerate all other stride-related stuff
	}
	else 
	{
	// layercount doesn't change

		for (var i=0;i<level.n_tiles;i++) {
			level.movements[i]=0;
			level.rigidMovementAppliedMask[i]=0;
			level.rigidGroupIndexMask[i]=0;
		}	

		for (var i=0;i<level.height;i++) {
			var rcc = level.rowCellContents[i];
			rcc.setZero();
		}
		for (var i=0;i<level.width;i++) {
			var ccc = level.colCellContents[i];
			ccc.setZero();
		}
	}

	againing=false;
	level.commandQueue=[];
	level.commandQueueSourceRules=[];
}

var zoomscreen=false;
var flickscreen=false;
var screenwidth=0;
var screenheight=0;

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

	restoreLevel(restartTarget);
	tryPlayRestartSound();

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

function DoUndo(force,ignoreDuplicates) {
	if ((!levelEditorOpened)&&('noundo' in state.metadata && force!==true)) {
		return;
	}
	if (verbose_logging) {
		consolePrint("--- undoing ---",true);
	}

	if (ignoreDuplicates){
		while (backupDiffers()==false){
			backups.pop();
		}
	}

	if (backups.length>0) {
		var torestore = backups[backups.length-1];
		restoreLevel(torestore);
		backups = backups.splice(0,backups.length-1);
		if (! force) {
			tryPlayUndoSound();
		}
	}
}

function getPlayerPositions() {
	var result=[];
	var playerMask = state.playerMask;
	for (i=0;i<level.n_tiles;i++) {
		level.getCellInto(i,_o11);
		if (playerMask.anyBitsInCommon(_o11)) {
			result.push(i);
		}
	}
	return result;
}

function getLayersOfMask(cellMask) {
	var layers=[];
	for (var i=0;i<state.objectCount;i++) {
		if (cellMask.get(i)) {
			layers.push( state.objects[ state.idDict[i] ].layer )
		}
	}
	return layers;
}

function moveEntitiesAtIndex(positionIndex, entityMask, dirMask) {
	var cellMask = level.getCell(positionIndex);
	cellMask.iand(entityMask);
	var layers = getLayersOfMask(cellMask);

	var movementMask = level.getMovements(positionIndex);
	for (var i=0;i<layers.length;i++) {
		movementMask.ishiftor(dirMask, 5 * layers[i]);
	}
	level.setMovements(positionIndex, movementMask);
}


function startMovement(dir) {
	var movedany=false;
	var playerPositions = getPlayerPositions();
	for (var i=0;i<playerPositions.length;i++) {
		var playerPosIndex = playerPositions[i];
		moveEntitiesAtIndex(playerPosIndex,state.playerMask,dir);
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
	 2:'down'  ,
	 4:'left'  , 
	 8:'right',  
	 15:'?' ,
	 16:'action',
	 3:'no'
};

var seedsToPlay_CanMove=[];
var seedsToPlay_CantMove=[];

function repositionEntitiesOnLayer(positionIndex,layer,dirMask) 
{
	var delta = dirMasksDelta[dirMask];

	var dx = delta[0];
	var dy = delta[1];
	var tx = ((positionIndex/level.height)|0);
	var ty = ((positionIndex%level.height));
	var maxx = level.width-1;
	var maxy = level.height-1;

	if ( (tx===0&&dx<0) || (tx===maxx&&dx>0) || (ty===0&&dy<0) || (ty===maxy&&dy>0)) {
		return false;
	}

	var targetIndex = (positionIndex+delta[1]+delta[0]*level.height);

	var layerMask = state.layerMasks[layer];
	var targetMask = level.getCellInto(targetIndex,_o7);
	var sourceMask = level.getCellInto(positionIndex,_o8);

	if (layerMask.anyBitsInCommon(targetMask) && (dirMask!=16)) {
		return false;
	}

	for (var i=0;i<state.sfx_MovementMasks.length;i++) {
		var o = state.sfx_MovementMasks[i];
		var objectMask = o.objectMask;
		if (objectMask.anyBitsInCommon(sourceMask)) {
			var movementMask = level.getMovements(positionIndex);
			var directionMask = o.directionMask;
			if (movementMask.anyBitsInCommon(directionMask) && seedsToPlay_CanMove.indexOf(o.seed)===-1) {
				seedsToPlay_CanMove.push(o.seed);
			}
		}
	}

	var movingEntities = sourceMask.clone();
	sourceMask.iclear(layerMask);
	movingEntities.iand(layerMask);
	targetMask.ior(movingEntities);

	level.setCell(positionIndex, sourceMask);
	level.setCell(targetIndex, targetMask);

	var colIndex=(targetIndex/level.height)|0;
	var rowIndex=(targetIndex%level.height);
	level.colCellContents[colIndex].ior(movingEntities);
	level.rowCellContents[rowIndex].ior(movingEntities);
	level.mapCellContents.ior(movingEntities);
	return true;
}

function repositionEntitiesAtCell(positionIndex) {
	var movementMask = level.getMovements(positionIndex);
	if (movementMask.iszero())
		return false;

	var moved=false;
	for (var layer=0;layer<level.layerCount;layer++) {
		var layerMovement = movementMask.getshiftor(0x1f, 5*layer);
		if (layerMovement!==0) {
			var thismoved = repositionEntitiesOnLayer(positionIndex,layer,layerMovement);
			if (thismoved) {
				movementMask.ishiftclear(layerMovement, 5*layer);
				moved = true;
			}
		}
	}

	level.setMovements(positionIndex, movementMask);

	return moved;
}






//say cellRow has length 5, with a split in the middle
/*
function cellRowMatchesWildcardFunctionGenerate(direction,cellRow,i, maxk, mink) {

	var result = [];
	var matchfirsthalf = cellRow[0].matches(i)&&cellRow[1].matches((i+d)%level.n_tiles);
	if (matchfirsthalf) {
		for (var k=mink,kmaxk;k++) {
			if (cellRow[2].matches((i+d*(k+0))%level.n_tiles)&&cellRow[2].matches((i+d*(k+1))%level.n_tiles)) {
				result.push([i,k]);
			}
		}
	}
	return result;
}
*/

function DoesCellRowMatchWildCard(direction,cellRow,i,maxk,mink) {
	if (mink === undefined) {
		mink = 0;
	}

	var cellPattern = cellRow[0];

	//var result=[];

	if (cellPattern.matches(i)){
		var delta = dirMasksDelta[direction];
		var d0 = delta[0]*level.height;
		var d1 = delta[1];
		var targetIndex = i;

		for (var j=1;j<cellRow.length;j+=1) {
			targetIndex = (targetIndex+d1+d0);

			var cellPattern = cellRow[j]
			if (cellPattern === ellipsisPattern) {
				//BAM inner loop time
				for (var k=mink;k<maxk;k++) {
					var targetIndex2=targetIndex;
					targetIndex2 = (targetIndex2+(d1+d0)*(k)+level.n_tiles)%level.n_tiles;
					for (var j2=j+1;j2<cellRow.length;j2++) {
						cellPattern = cellRow[j2];
						if (!cellPattern.matches(targetIndex2)) {
							break;
						}
						targetIndex2 = (targetIndex2+d1+d0);
					}

					if (j2>=cellRow.length) {
						return true;
						//result.push([i,k]);
					}
				}
				break;
			} else if (!cellPattern.matches(targetIndex)) {
				break;
			}
		}               
	}  
	return false;
}

//say cellRow has length 3
/*
CellRow Matches can be specialized to look something like:
function cellRowMatchesFunctionGenerate(direction,cellRow,i) {
	var delta = dirMasksDelta[direction];
	var d = delta[1]+delta[0]*level.height;
	return cellRow[0].matches(i)&&cellRow[1].matches((i+d)%level.n_tiles)&&cellRow[2].matches((i+2*d)%level.n_tiles);
}
*/

function DoesCellRowMatch(direction,cellRow,i,k) {
	var cellPattern = cellRow[0];
	if (cellPattern.matches(i)) {

		var delta = dirMasksDelta[direction];
		var d0 = delta[0]*level.height;
		var d1 = delta[1];
		var cr_l = cellRow.length;

		var targetIndex = i;
		for (var j=1;j<cr_l;j++) {
			targetIndex = (targetIndex+d1+d0);
			cellPattern = cellRow[j];
			if (cellPattern === ellipsisPattern) {
					//only for once off verifications
				targetIndex = (targetIndex+(d1+d0)*k); 					
			}
			if (!cellPattern.matches(targetIndex)) {
				break;
			}
		}   
		
		if (j>=cellRow.length) {
			return true;
		}

	}  
	return false;
}

function matchCellRow(direction, cellRowMatch, cellRow, cellRowMask) {	
	var result=[];
	
	if ((!cellRowMask.bitsSetInArray(level.mapCellContents.data))) {
		return result;
	}

	var xmin=0;
	var xmax=level.width;
	var ymin=0;
	var ymax=level.height;

	var len=cellRow.length;

	switch(direction) {
		case 1://up
		{
			ymin+=(len-1);
			break;
		}
		case 2: //down 
		{
			ymax-=(len-1);
			break;
		}
		case 4: //left
		{
			xmin+=(len-1);
			break;
		}
		case 8: //right
		{
			xmax-=(len-1);	
			break;
		}
		default:
		{
			window.console.log("EEEP "+direction);
		}
	}

	var horizontal=direction>2;
	if (horizontal) {
		for (var y=ymin;y<ymax;y++) {
			if (!cellRowMask.bitsSetInArray(level.rowCellContents[y].data)) {
				continue;
			}

			for (var x=xmin;x<xmax;x++) {
				var i = x*level.height+y;
				if (cellRowMatch(cellRow,i))
				{
					result.push(i);
				}
			}
		}
	} else {
		for (var x=xmin;x<xmax;x++) {
			if (!cellRowMask.bitsSetInArray(level.colCellContents[x].data)) {
				continue;
			}

			for (var y=ymin;y<ymax;y++) {
				var i = x*level.height+y;
				if (cellRowMatch(	cellRow,i))
				{
					result.push(i);
				}
			}
		}		
	}

	return result;
}


function matchCellRowWildCard(direction, cellRowMatch, cellRow,cellRowMask) {
	var result=[];
	if ((!cellRowMask.bitsSetInArray(level.mapCellContents.data))) {
		return result;
	}
	var xmin=0;
	var xmax=level.width;
	var ymin=0;
	var ymax=level.height;

	var len=cellRow.length-1;//remove one to deal with wildcard
	switch(direction) {
		case 1://up
		{
			ymin+=(len-1);
			break;
		}
		case 2: //down 
		{
			ymax-=(len-1);
			break;
		}
		case 4: //left
		{
			xmin+=(len-1);
			break;
		}
		case 8: //right
		{
			xmax-=(len-1);	
			break;
		}
		default:
		{
			window.console.log("EEEP2 "+direction);
		}
	}



	var horizontal=direction>2;
	if (horizontal) {
		for (var y=ymin;y<ymax;y++) {
			if (!cellRowMask.bitsSetInArray(level.rowCellContents[y].data)) {
				continue;
			}

			for (var x=xmin;x<xmax;x++) {
				var i = x*level.height+y;
				var kmax;

				if (direction === 4) { //left
					kmax=x-len+2;
				} else if (direction === 8) { //right
					kmax=level.width-(x+len)+1;	
				} else {
					window.console.log("EEEP2 "+direction);					
				}

				result.push.apply(result, cellRowMatch(cellRow,i,kmax,0));
			}
		}
	} else {
		for (var x=xmin;x<xmax;x++) {
			if (!cellRowMask.bitsSetInArray(level.colCellContents[x].data)) {
				continue;
			}

			for (var y=ymin;y<ymax;y++) {
				var i = x*level.height+y;
				var kmax;

				if (direction === 2) { // down
					kmax=level.height-(y+len)+1;
				} else if (direction === 1) { // up
					kmax=y-len+2;					
				} else {
					window.console.log("EEEP2 "+direction);
				}
				result.push.apply(result, cellRowMatch(cellRow,i,kmax,0));
			}
		}		
	}

	return result;
}

function generateTuples(lists) {
	var tuples=[[]];

	for (var i=0;i<lists.length;i++)
	{
		var row = lists[i];
		var newtuples=[];
		for (var j=0;j<row.length;j++) {
			var valtoappend = row[j];
			for (var k=0;k<tuples.length;k++) {
				var tuple=tuples[k];
				var newtuple = tuple.concat([valtoappend]);
				newtuples.push(newtuple);
			}
		}
		tuples=newtuples;
	}
	return tuples;
}

var rigidBackups=[]

function commitPreservationState(ruleGroupIndex) {
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



function showTempMessage() {
	keybuffer=[];
	textMode=true;
	titleScreen=false;
	quittingMessageScreen=false;
	messageselected=false;
	tryPlayShowMessageSound();
	drawMessageScreen();
	canvasResize();
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
				showTempMessage();
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
	var delta = dirMasksDelta[rule.direction];
	var tuple=match[1];
	var check=false;
	var modified = rule.applyAt(delta,tuple,check);

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
			switch(dir){
				case 0://up
				{
					dir=parseInt('00001', 2);;
					break;
				}
				case 1://left
				{
					dir=parseInt('00100', 2);;
					break;
				}
				case 2://down
				{
					dir=parseInt('00010', 2);;
					break;
				}
				case 3://right
				{
					dir=parseInt('01000', 2);;
					break;
				}
				case 4://action
				{
					dir=parseInt('10000', 2);;
					break;
				}
			}
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
					consolePrint('require_player_movement set, but no player movement detected, so cancelling turn.');
					consoleCacheDump();
				}
				backups.push(bak);
				DoUndo(true,false);
				return false;
			}
			//play player cantmove sounds here
		}



		if (level.commandQueue.indexOf('cancel')>=0) {
			if (verbose_logging) { 
				consoleCacheDump();
				var r = level.commandQueueSourceRules[level.commandQueue.indexOf('cancel')];
				consolePrintFromRule('CANCEL command executed, cancelling turn.',r,true);
			}
			processOutputCommands(level.commandQueue);
			backups.push(bak);
			messagetext = "";
			DoUndo(true,false);
			tryPlayCancelSound();
			return false;
		} 

		if (level.commandQueue.indexOf('restart')>=0) {
			if (verbose_logging) { 
				var r = level.commandQueueSourceRules[level.commandQueue.indexOf('restart')];
				consolePrintFromRule('RESTART command executed, reverting to restart state.',r);
				consoleCacheDump();
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

		if (textMode===false) {
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
	if (levelEditorOpened) {
		dontDoWin=true;
	}

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
	tryPlayEndLevelSound();
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
	
	if (titleScreen) {
		if (titleSelection===0) {
			//new game
			curlevel=0;
			curlevelTarget=null;
		} 			
		if (curlevelTarget!==null){			
			loadLevelFromStateTarget(state,curlevel,curlevelTarget);
		} else {
			loadLevelFromState(state,curlevel);
		}
	} else {	
		if (hasUsedCheckpoint){
			curlevelTarget=null;
			hasUsedCheckpoint=false;
		}
		if (curlevel<(state.levels.length-1))
		{			
			curlevel++;
			textMode=false;
			titleScreen=false;
			quittingMessageScreen=false;
			messageselected=false;

			if (curlevelTarget!==null){			
				loadLevelFromStateTarget(state,curlevel,curlevelTarget);
			} else {
				loadLevelFromState(state,curlevel);
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
			tryPlayEndGameSound();
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
	titleScreen=true;
	textMode=true;
	doSetupTitleScreenLevelContinue();
	titleSelection=(curlevel>0||curlevelTarget!==null)?1:0;
	generateTitleScreen();
}


