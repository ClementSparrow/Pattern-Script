var keyRepeatTimer=0;
var keyRepeatIndex=0;
var input_throttle_timer=0.0;
var lastinput=-100;

var dragging=false;
var rightdragging=false;




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
        if (event.target===canvas || event.target.className==="tapFocusIndicator")
        {
        	if (screen_layout.leftMouseClick(event))
        		return;
        }
        dragging=false;
        rightdragging=false; 
    }
    else if (rmb)
    {
    	if (event.target===canvas || event.target.className==="tapFocusIndicator")
    	{
		    dragging=false;
		    rightdragging=true;
		    if (screen_layout.rightMouseClick(event))
		    	return;
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

	screen_layout.mouseMove(event)

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

function checkKey(e, justPressed)
{
	ULBS();
	
    if (winning) {
    	return;
	}
	if (e&&(e.ctrlKey || e.metaKey|| e.altKey)){
		return;
	}
	
    var inputdir=-1;
    switch(e.keyCode)
    {
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
        case 27://escape
        {
        	if (screen_layout.content !== menu_screen)
        	{
        		menu_screen.selected = false
				goToTitleScreen()
		    	tryPlaySimpleSound('titlescreen')
				canvasResize()
				return prevent(e)
        	}
        	else
        	{
        		// TODO: should select option 'continue', which should not restart the level
        	}
        	break;
        }
        case 69: {//e
        	if (typeof level_editor_screen !== 'undefined') // can open editor
        	{
        		if (justPressed)
        		{
        			if (screen_layout.content === menu_screen)
        			{
        				if (state.title === 'EMPTY GAME')
        				{
        					compile(["loadFirstNonMessageLevel"])
        				}
        				else
        				{
        					nextLevel()
        				}
        			}
        			else if (screen_layout.content instanceof LevelEditorScreen)
        			{
        				printLevel()
        			}
					level_editor_screen.toggle()
        			restartTarget = backupLevel()
        			canvasResize()
        		}
        		return prevent(e);
        	}
            break;
		}
    }
	// prevent repetition of direction keys before the throttle_movement time
    if ( throttle_movement && (inputdir >= 0) && (inputdir <= 3) )
    {
    	if ( (lastinput == inputdir) && (input_throttle_timer < repeatinterval) )
    		return;
		lastinput = inputdir;
		input_throttle_timer = 0;
    }
	if (justPressed && screen_layout.checkKey(e, inputdir))
		return prevent(e);
	if (screen_layout.checkRepeatableKey(e, inputdir))
		return prevent(e);
}

TextModeScreen.prototype.checkKey = function(e, inputdir)
{
	if ( (state.levels.length === 0)|| (inputdir != 4) )
		return false;

	if (unitTesting)
	{
		nextLevel()
		return;
	}

	if (messageselected === false)
	{
		messageselected = true
		timer = 0
		quittingMessageScreen = true
		tryPlaySimpleSound('closemessage')
		this.doMessage()
	}
	return false;
}

MenuScreen.prototype.checkKey = function(e, inputdir)
{
	if ( (state.levels.length === 0)|| (inputdir != 4) | (this.selected === true) )
		return false;

	tryPlaySimpleSound('startgame')
	messageselected = false
	timer = 0
	quittingTitleScreen = true
	this.selected = true
	this.makeTitle()
	if (this.nb_items === 1)
	{
		canvasResize();
	}
	else
	{
		redraw();
	}
	return false;
}


MenuScreen.prototype.checkRepeatableKey = function(e, inputdir)
{
	if (state.levels.length === 0)
		return false;

	if ( ( (inputdir === 0) || (inputdir === 2) ) )
	{
		this.item = Math.max(0, Math.min( this.item + (inputdir === 0) ? -1 : 1, this.nb_items - 1))
		this.makeTitle()
		redraw()
	}
	return false;
}



LevelScreen.prototype.checkKey = function(e, inputdir)
{
	if (e.keyCode === 82) // R
	{
		pushInput('restart')
		DoRestart()
		canvasResize() // calls redraw
		return true;
	}
	return false;
}

LevelScreen.prototype.checkRepeatableKey = function(e, inputdir)
{
	if ( (e.keyCode == 85) || (e.keyCode == 90) ) // U or Z
	{
		//undo
		pushInput('undo')
		DoUndo(false, true)
		canvasResize() // calls redraw
		return true;
	}

	if ( againing || (inputdir < 0) )
		return false;

	if ( (inputdir === 4) && ('noaction' in state.metadata) )
		return true;

	pushInput(inputdir)
	if (processInput(inputdir))
	{
		redraw();
	}
	return true;
}


function update()
{
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
				if (state.metadata.flickscreen !== undefined)
				{
					screen_layout.content = tiled_world_screen
				}
				else if (state.metadata.zoomscreen  !== undefined)
				{
					screen_layout.content = camera_on_player_screen
				}
				else
				{
					screen_layout.content = level_screen
				}
				menu_screen.nb_items = ( (curlevel > 0) || (curlevelTarget !== null) ) ? 2 : 1
				menu_screen.selected = false
				menu_screen.item = 0
    			canvasResize()
    			checkWin()
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

    if ( ! ( (autotickinterval <= 0) || screen_layout.noAutoTick() || againing || winning ) )
    {
        autotick += deltatime;
        if (autotick > autotickinterval)
        {
            autotick = 0;
            pushInput("tick");
            if (processInput(-1))
            {
                redraw();
            }
        }
    }
}

// Lights, camera…function!
setInterval(function() {
    update();
}, deltatime);
