var keyRepeatTimer=0;
var keyRepeatIndex=0;
var input_throttle_timer=0.0;
var lastinput=-100;

var dragging=false;
var rightdragging=false;


// FUNCTIONS FOR THE LEVEL EDITOR (AND CONSOLE)
// ============================================

// TODO: all these functions should be moved into a new file so that they are not included in exported games

var columnAdded=false;

function selectText(containerid,e) {
	e = e || window.event;
	var myspan = document.getElementById(containerid);
	if (e&&(e.ctrlKey || e.metaKey)) {
		var levelarr = ["console"].concat(myspan.innerHTML.split("<br>"));
		var leveldat = levelFromString(state,levelarr);
		loadLevelFromLevelDat(state,leveldat,null);
		canvasResize();
	} else {
	    if (document.selection) {
	        var range = document.body.createTextRange();
	        range.moveToElementText(myspan);
	        range.select();
	    } else if (window.getSelection) {
	        var range = document.createRange();
	        range.selectNode(myspan);
	        window.getSelection().addRange(range);
	    }
	}
}

// function recalcLevelBounds() { }

// function arrCopy(from, fromoffset, to, tooffset, len) {
// 	while (len--)
// 		to[tooffset++] = from[fromoffset]++;
// }

function adjustLevel(level, widthdelta, heightdelta) {
	backups.push(backupLevel());
	var oldlevel = level.clone();
	level.width += widthdelta;
	level.height += heightdelta;
	level.n_tiles = level.width * level.height;
	level.objects = new Int32Array(level.n_tiles * STRIDE_OBJ);
	var bgMask = new BitVec(STRIDE_OBJ);
	bgMask.ibitset(state.backgroundid);
	for (var i=0; i<level.n_tiles; ++i) 
		level.setCell(i, bgMask);
	level.movements = new Int32Array(level.objects.length);
	columnAdded=true;
	RebuildLevelArrays();
	return oldlevel;
}

function copyLevelRegion(oldlevel, level, dx, dy)
{
	const xmin = Math.max(0, dx) // x >= 0 and x-dx >= 0
	const xmax = Math.min(level.width, oldlevel.width+dx) // x < level.width and x-dx < oldlevel.width
	const ymin = Math.max(0, dy) // y >= 0 and y-dy >= 0
	const ymax = Math.min(level.height, oldlevel.height+dy) // y < level.height and y-dy < oldlevel.height
	for (var x=xmin; x<xmax; ++x)
	{
		for (var y=ymin; y<ymax; ++y)
		{
			const index = x*level.height + y;
			const old_index = (x-dx)*oldlevel.height + y-dy
			level.setCell(index, oldlevel.getCell(old_index))
		}
	}
}

function addLeftColumn()
{
	copyLevelRegion(adjustLevel(level, 1, 0), level, 1, 0)
}

function addRightColumn()
{
	copyLevelRegion(adjustLevel(level, 1, 0), level, 0, 0)
}

function addTopRow()
{
	copyLevelRegion(adjustLevel(level, 0, 1), level, 0, 1)
}

function addBottomRow()
{
	copyLevelRegion(adjustLevel(level, 0, 1), level, 0, 0)
}

function removeLeftColumn()
{
	if (level.width > 1)
		copyLevelRegion(adjustLevel(level, -1, 0), level, -1, 0)
}

function removeRightColumn()
{
	if (level.width > 1)
		copyLevelRegion(adjustLevel(level, -1, 0), level, 0, 0)
}

function removeTopRow()
{
	if (level.height > 1)
		copyLevelRegion(adjustLevel(level, 0, -1), level, 0, -1)
}
function removeBottomRow()
{
	if (level.height > 1)
		copyLevelRegion(adjustLevel(level, 0, -1), level, 0, 0)
}

function matchGlyph(inputmask,glyphAndMask) {
	// find mask with closest match
	var highestbitcount=-1;
	var highestmask;
	for (var i=0; i<glyphAndMask.length; ++i) {
		var glyphname = glyphAndMask[i][0];
		var glyphmask = glyphAndMask[i][1];
 		var glyphbits = glyphAndMask[i][2];
		//require all bits of glyph to be in input
		if (glyphmask.bitsSetInArray(inputmask.data)) {
			var bitcount = 0;
			for (var bit=0;bit<32*STRIDE_OBJ;++bit) {
				if (glyphbits.get(bit) && inputmask.get(bit))
 					bitcount++;
				if (glyphmask.get(bit) && inputmask.get(bit))
					bitcount++;
			}
			if (bitcount>highestbitcount) {
				highestbitcount=bitcount;
				highestmask=glyphname;
			}
		}
	}
	if (highestbitcount>0) {
		return highestmask;
	}
	
	logErrorNoLine("Wasn't able to approximate a glyph value for some tiles, using '.' as a placeholder.",true);
	return '.';
}

var htmlEntityMap = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': '&quot;',
	"'": '&#39;',
	"/": '&#x2F;'
};

var selectableint  = 0;

function printLevel()
{
	var glyphMasks = [];
	for (const [identifier_index, glyph] of state.glyphDict.entries())
	{
		const glyphName = state.identifiers.names[identifier_index];
		if ( (glyphName.length === 1) && [identifier_type_object, identifier_type_aggregate].includes(state.identifiers.comptype[identifier_index]) )
		{
			// var glyph = state.glyphDict[glyphName];
			var glyphmask = makeMaskFromGlyph(glyph);
			var glyphbits = glyphmask.clone();
			//register the same - backgroundmask with the same name
			var bgMask = state.layerMasks[state.backgroundlayer];
			glyphmask.iclear(bgMask);
			glyphMasks.push([glyphName, glyphmask, glyphbits]);
		}
	}
	selectableint++;
	var tag = 'selectable'+selectableint;
	var output="Printing level contents:<br><br><span id=\""+tag+"\" onclick=\"selectText('"+tag+"',event)\">";
	for (var j=0;j<level.height;j++) {
		for (var i=0;i<level.width;i++) {
			var cellIndex = j+i*level.height;
			var cellMask = level.getCell(cellIndex);
			var glyph = matchGlyph(cellMask,glyphMasks);
			if (glyph in htmlEntityMap) {
				glyph = htmlEntityMap[glyph]; 
			}
			output = output+glyph;
		}
		if (j<level.height-1){
			output=output+"<br>";
		}
	}
	output+="</span><br><br>"
	consolePrint(output,true);
}

function relMouseCoords(event, canvas)
{
	const origin = (event.touches == null) ? event : event.touches[0]
	var result = { x: origin.pageX, y: origin.pageY }

    var currentElement = canvas

    do {
        result.x -= currentElement.offsetLeft - currentElement.scrollLeft
        result.y -= currentElement.offsetTop  - currentElement.scrollTop
    }
    while(currentElement = currentElement.offsetParent)

    return result;
}

function setMouseCoord(e)
{
    const coords = relMouseCoords(e, canvas);
    const virtualscreenCoordX = Math.floor( (coords.x - screen_layout.margins[0]) / screen_layout.magnification )
	const virtualscreenCoordY = Math.floor( (coords.y - screen_layout.margins[1]) / screen_layout.magnification )
	const gridCoordX = Math.floor(virtualscreenCoordX/sprite_width  );
	const gridCoordY = Math.floor(virtualscreenCoordY/sprite_height );
	const editor_layout = screen_layout.content
	editor_layout.hovered_glyph_index  = null
	editor_layout.hovered_level_cell   = null
	editor_layout.hovered_level_resize = null
	if (gridCoordY < editor_layout.editorRowCount)
	{
		const [w, h] = editor_layout.get_nb_tiles()
		if ( (gridCoordX == 0) && (gridCoordY == 0) )
		{
			editor_layout.hovered_glyph_index = -1
		}
		if ( (gridCoordX > 0) && (gridCoordY >= 0) && (gridCoordX < w-1))
		{
			const index = gridCoordY * (w-1) + (gridCoordX-1)
			if (index < state.abbrevNames.length)
			{
				editor_layout.hovered_glyph_index = index
			}
		}
		return;
	}

	const [w, h] = editor_layout.content.get_nb_tiles()
	const [x, y] = [ gridCoordX-1, gridCoordY - editor_layout.editorRowCount - 1 ]
	if ( (x < -1) || (x > w) || (y > h) )
		return;
	if ( (x == -1) || (y == -1) || (x == w) || (y == h) )
	{
		editor_layout.hovered_level_resize = [ gridCoordX, gridCoordY, x, y ]
	}
	else if ( (x >= 0) && (y >= 0) && (x < w) && (y < h) )
	{
		editor_layout.hovered_level_cell = [ gridCoordX, gridCoordY, x, y ]
	}
}


var anyEditsSinceMouseDown = false;

function levelEditorClick(event, click) // click is false if we're in a drag gesture
{
	const editor_layout = screen_layout.content

	if ( click && (editor_layout.hovered_glyph_index !== null) )
	{
		if (editor_layout.hovered_glyph_index == -1)
		{
			printLevel()
		}
		else
		{
			glyphSelectedIndex = editor_layout.hovered_glyph_index
			redraw()
		}
		return;
	}

	if (editor_layout.hovered_level_cell !== null)
	{
		var glyphmask = makeMaskFromGlyph( state.glyphDict[ glyphImagesCorrespondance[glyphSelectedIndex] ] );

		var backgroundMask = state.layerMasks[state.backgroundlayer];
		if (glyphmask.bitsClearInArray(backgroundMask.data))
		{
			// If we don't already have a background layer, mix in  the default one.
			glyphmask.ibitset(state.backgroundid);
		}

		const coordIndex = editor_layout.hovered_level_cell[3] + editor_layout.hovered_level_cell[2]*level.height;
		const getcell = level.getCell(coordIndex);
		if (getcell.equals(glyphmask))
			return;
		if (anyEditsSinceMouseDown === false)
		{
			anyEditsSinceMouseDown = true;				
    		backups.push(backupLevel());
		}
		level.setCell(coordIndex, glyphmask);
		redraw();
		return;
	}

	if ( ( ! click ) || (editor_layout.hovered_level_resize === null) )
		return;

	const [w, h] = editor_layout.content.get_nb_tiles()

	if (editor_layout.hovered_level_resize[2] == -1)
	{
		addLeftColumn();			
	}
	else if (editor_layout.hovered_level_resize[2] == w)
	{
		addRightColumn();
	}

	if (editor_layout.hovered_level_resize[3] == -1)
	{
		addTopRow();
	}
	else if (editor_layout.hovered_level_resize[3] == h)
	{
		addBottomRow();
	}

	canvasResize()
	setMouseCoord(event)
	redraw()
}

function levelEditorRightClick(event, click)
{
	const editor_layout = screen_layout.content
	
	// TODO: [ClementSparrow] This doesn't make sense to me... shouldn't it be the same code than in levelEditorClick?
	if ( click && (editor_layout.hovered_glyph_index !== null) )
	{
		glyphSelectedIndex = mouseCoordX;
		redraw();
		return;
	}

	if (editor_layout.hovered_level_cell !== null)
	{
		const coordIndex = editor_layout.hovered_level_cell[3] + editor_layout.hovered_level_cell[2]*level.height;
		var glyphmask = new BitVec(STRIDE_OBJ);
		glyphmask.ibitset(state.backgroundid); // TODO: shouldn't it be the same code than in levelEditorClick?
		level.setCell(coordIndex, glyphmask);
		redraw();
		return;
	}

	if ( ( ! click ) || (editor_layout.hovered_level_resize === null) )
		return;

	const [w, h] = editor_layout.content.get_nb_tiles()

	if (editor_layout.hovered_level_resize[2] == -1)
	{
		//add a left row to the map
		removeLeftColumn();			
	}
	else if (editor_layout.hovered_level_resize[2] == w)
	{
		removeRightColumn();
	} 

	if (editor_layout.hovered_level_resize[3] == -1)
	{
		removeTopRow();
	}
	else if (editor_layout.hovered_level_resize[3] == h)
	{
		removeBottomRow();
	}

	canvasResize()
	setMouseCoord(event)
	redraw()
}



// GENERIC EVENT HANDLER
// =====================

var lastDownTarget;

function onMouseDown(event)
{
	if (event.handled)
		return;

	ULBS();
	
	var lmb = event.button===0;
	var rmb = event.button===2 ;
	if (event.type=="touchstart")
	{
		lmb=true;
	}
	if (lmb && (event.ctrlKey||event.metaKey))
	{
		lmb=false;
		rmb=true;
	}
	
	if (lmb)
	{
        lastDownTarget = event.target;
        keybuffer=[];
        if (event.target===canvas || event.target.className==="tapFocusIndicator") {
        	if (screen_layout.content === levelEditor_Screen)
        	{
				setMouseCoord(event);
				dragging=true;
	        	rightdragging=false;
        		anyEditsSinceMouseDown=false;
        		return levelEditorClick(event,true);
        	}
        }
        dragging=false;
        rightdragging=false; 
    }
    else if (rmb)
    {
    	if (event.target===canvas || event.target.className==="tapFocusIndicator") {
		    dragging=false;
		    rightdragging=true;
        	if (screen_layout.content === levelEditor_Screen)
        	{
				setMouseCoord(event);
        		return levelEditorRightClick(event,true);
        	}
        }
	}
	
	event.handled=true;
}

function rightClickCanvas(event) {
    return prevent(event);
}

function onMouseUp(event) {
	if (event.handled){
		return;
	}

	dragging=false;
	rightdragging=false;
	
	event.handled=true;
}

function onKeyDown(event) {

	ULBS();
	
    event = event || window.event;

	// Prevent arrows/space from scrolling page
	if ((!IDE) && ([32, 37, 38, 39, 40].indexOf(event.keyCode) > -1)) {
		if (event&&(event.ctrlKey || event.metaKey)){
		} else {
			prevent(event);
		}
	}

	if ((!IDE) && event.keyCode===77){//m
		toggleMute();		
	}

	
    if (keybuffer.indexOf(event.keyCode)>=0) {
    	return;
    }

    if(lastDownTarget === canvas || (window.Mobile && (lastDownTarget === window.Mobile.focusIndicator) ) ){
    	if (keybuffer.indexOf(event.keyCode)===-1) {
    		if (event&&(event.ctrlKey || event.metaKey)){
		    } else {
    		    keybuffer.splice(keyRepeatIndex,0,event.keyCode);
	    	    keyRepeatTimer=0;
	    	    checkKey(event,true);
		    }
		}
	}


    if (canDump===true) {
        if (event.keyCode===74 && (event.ctrlKey||event.metaKey)) {//ctrl+j
            dumpTestCase();
            prevent(event);
        } else if (event.keyCode===75 && (event.ctrlKey||event.metaKey)) {//ctrl+k
            makeGIF();
            prevent(event);
        }  else if (event.keyCode===83 && (event.ctrlKey||event.metaKey)) {//ctrl+s
            saveClick();
            prevent(event);
        } else if (event.keyCode===13 && (event.ctrlKey||event.metaKey)){//ctrl+enter
			canvas.focus();
			editor.display.input.blur();
            rebuildClick();
            prevent(event);
		}
	}
}

function onKeyUp(event) {
	event = event || window.event;
	var index=keybuffer.indexOf(event.keyCode);
	if (index>=0){
    	keybuffer.splice(index,1);
    	if (keyRepeatIndex>=index){
    		keyRepeatIndex--;
    	}
    }
}

function onMyFocus(event) {	
	keybuffer=[];
	keyRepeatIndex = 0;
	keyRepeatTimer = 0;
}

function onMyBlur(event) {
	keybuffer=[];
	keyRepeatIndex = 0;
	keyRepeatTimer = 0;
}

function mouseMove(event) {
	
	if (event.handled)
		return;

    if (screen_layout.content === levelEditor_Screen)
    {
    	setMouseCoord(event);  
    	if (dragging) { 	
    		levelEditorClick(event,false);
    	} else if (rightdragging){
    		levelEditorRightClick(event,false);    		
    	}
	    redraw();
    }

	event.handled=true;
    //window.console.log("showcoord ("+ canvas.width+","+canvas.height+") ("+x+","+y+")");
}

function mouseOut() {
//  window.console.log("clear");
}

document.addEventListener('touchstart', onMouseDown, false);
document.addEventListener('touchmove', mouseMove, false);
document.addEventListener('touchend', onMouseUp, false);

document.addEventListener('mousedown', onMouseDown, false);
document.addEventListener('mouseup', onMouseUp, false);

document.addEventListener('keydown', onKeyDown, false);
document.addEventListener('keyup', onKeyUp, false);

window.addEventListener('focus', onMyFocus, false);
window.addEventListener('blur', onMyBlur, false);


function prevent(e) {
    if (e.preventDefault) e.preventDefault();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    if (e.stopPropagation) e.stopPropagation();
    e.returnValue=false;
    return false;
}

function checkKey(e,justPressed) {
	ULBS();
	
    if (winning) {
    	return;
	}
	if (e&&(e.ctrlKey || e.metaKey|| e.altKey)){
		return;
	}
	
    var inputdir=-1;
    switch(e.keyCode) {
        case 65://a
        case 37: //left
        {
//            window.console.log("LEFT");
            inputdir=1;
        break;
        }
        case 38: //up
        case 87: //w
        {
//            window.console.log("UP");
            inputdir=0;
        break;
        }
        case 68://d
        case 39: //right
        {
//            window.console.log("RIGHT");
            inputdir=3;
        break;
        }
        case 83://s
        case 40: //down
        {
//            window.console.log("DOWN");
            inputdir=2;
        break;
        }
        case 80://p
        {
			printLevel();
        	break;
        }
        case 13://enter
        case 32://space
        case 67://c
        case 88://x
        {
//            window.console.log("ACTION");
			if (norepeat_action===false || justPressed) {
            	inputdir=4;
            } else {
            	return;
            }
        break;
        }
        case 85://u
        case 90://z
        {
            //undo
            if (textMode===false) {
                pushInput("undo");
                DoUndo(false,true);
                canvasResize(); // calls redraw
            	return prevent(e);
            }
            break;
        }
        case 82://r
        {
        	if (textMode===false) {
        		if (justPressed) {
	        		pushInput("restart");
	        		DoRestart();
	                canvasResize(); // calls redraw
            		return prevent(e);
            	}
            }
            break;
        }
        case 27://escape
        {
        	if (titleScreen===false) {
				goToTitleScreen();	
		    	tryPlayTitleSound();
				canvasResize();
				return prevent(e)
        	}
        	break;
        }
        case 69: {//e
        	if (canOpenEditor) {
        		if (justPressed) {
        			if (titleScreen){
        				if (state.title==="EMPTY GAME"){
        					compile(["loadFirstNonMessageLevel"]);
        				} else {
        					nextLevel();
        				}
        			}
        			levelEditorOpened = ! levelEditorOpened;
        			if (levelEditorOpened === false)
        			{
        				printLevel();
        			}
        			restartTarget = backupLevel();
        			canvasResize();
        		}
        		return prevent(e);
        	}
            break;
		}
		case 48://0
		case 49://1
		case 50://2
		case 51://3
		case 52://4
		case 53://5
		case 54://6
		case 55://7
		case 56://8
		case 57://9
		{
        	if ( (screen_layout.content === levelEditor_Screen) && justPressed )
        	{
        		var num=9;
        		if (e.keyCode>=49)  {
        			num = e.keyCode-49;
        		}

				if (num<glyphImages.length) {
					glyphSelectedIndex=num;
				} else {
					consolePrint("Trying to select tile outside of range in level editor.",true)
				}

        		canvasResize();
        		return prevent(e);
        	}	
        	break;	
        }
		case 189://-
		{
        	if ( (screen_layout.content === levelEditor_Screen) && justPressed)
        	{
				if (glyphSelectedIndex>0) {
					glyphSelectedIndex--;
					canvasResize();
					return prevent(e);
				} 
        	}	
        	break;	
		}
		case 187://+
		{
        	if ( (screen_layout.content === levelEditor_Screen) && justPressed)
        	{
				if (glyphSelectedIndex+1<glyphImages.length) {
					glyphSelectedIndex++;
					canvasResize();
					return prevent(e);
				} 
        	}	
        	break;	
		}
    }
    if (throttle_movement && inputdir>=0&&inputdir<=3) {
    	if (lastinput==inputdir && input_throttle_timer<repeatinterval) {
    		return;
    	} else {
    		lastinput=inputdir;
    		input_throttle_timer=0;
    	}
    }
    if (textMode) {
    	if (state.levels.length===0) {
    		//do nothing
    	} else if (titleScreen) {
    		if (titleMode===0) {
    			if (inputdir===4&&justPressed) {
    				if (titleSelected===false) {    				
						tryPlayStartGameSound();
	    				titleSelected=true;
	    				messageselected=false;
	    				timer=0;
	    				quittingTitleScreen=true;
	    				generateTitleScreen();
	    				canvasResize();
	    			}
    			}
    		} else {
    			if (inputdir==4&&justPressed) {
    				if (titleSelected===false) {    				
						tryPlayStartGameSound();
	    				titleSelected=true;
	    				messageselected=false;
	    				timer=0;
	    				quittingTitleScreen=true;
	    				generateTitleScreen();
	    				redraw();
	    			}
    			}
    			else if (inputdir===0||inputdir===2) {
    				if (inputdir===0){
    					titleSelection=0;    					
    				} else {
    					titleSelection=1;    					    					
    				}
    				generateTitleScreen();
    				redraw();
    			}
    		}
    	} else {
    		if (inputdir==4&&justPressed) {    				
				if (unitTesting) {
					nextLevel();
					return;
				} else if (messageselected===false) {
    				messageselected=true;
    				timer=0;
    				quittingMessageScreen=true;
    				tryPlayCloseMessageSound();
    				titleScreen=false;
    				drawMessageScreen();
    			}
    		}
    	}
    } else {
	    if (!againing && inputdir>=0) {
            if (inputdir===4 && ('noaction' in state.metadata)) {

            } else {
                pushInput(inputdir);
                if (processInput(inputdir)) {
                    redraw();
                }
	        }
	       	return prevent(e);
    	}
    }
}


function update() {
    timer+=deltatime;
    input_throttle_timer+=deltatime;
    if (quittingTitleScreen) {
        if (timer/1000>0.3) {
            quittingTitleScreen=false;
            nextLevel();
        }
    }
    if (againing) {
        if (timer>againinterval&&messagetext.length==0) {
            if (processInput(-1)) {
                redraw();
                keyRepeatTimer=0;
                autotick=0;
            }
        }
    }
    if (quittingMessageScreen) {
        if (timer/1000>0.15) {
            quittingMessageScreen=false;
            if (messagetext==="") {
            	nextLevel();
            } else {
            	messagetext="";
            	textMode=false;
				titleScreen=false;
				titleMode=(curlevel>0||curlevelTarget!==null)?1:0;
				titleSelected=false;
				titleSelection=0;
    			canvasResize();  
    			checkWin();          	
            }
        }
    }
    if (winning) {
        if (timer/1000>0.5) {
            winning=false;
            nextLevel();
        }
    }
    if (keybuffer.length>0) {
	    keyRepeatTimer+=deltatime;
	    var ticklength = throttle_movement ? repeatinterval : repeatinterval/(Math.sqrt(keybuffer.length));
	    if (keyRepeatTimer>ticklength) {
	    	keyRepeatTimer=0;	
	    	keyRepeatIndex = (keyRepeatIndex+1)%keybuffer.length;
	    	var key = keybuffer[keyRepeatIndex];
	        checkKey({keyCode:key},false);
	    }
	}

    if ( ! ( (autotickinterval <= 0) || textMode || (screen_layout.content === levelEditor_Screen) || againing || winning ) )
    {
        autotick+=deltatime;
        if (autotick>autotickinterval) {
            autotick=0;
            pushInput("tick");
            if (processInput(-1)) {
                redraw();
            }
        }
    }
}

// Lights, camera…function!
setInterval(function() {
    update();
}, deltatime);
