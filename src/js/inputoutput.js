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
        if (event.target===screen_layout.canvas || event.target.className==="tapFocusIndicator")
        {
        	if (screen_layout.leftMouseClick(event))
        		return;
        }
        dragging=false;
        rightdragging=false; 
    }
    else if (rmb)
    {
    	if (event.target===screen_layout.canvas || event.target.className==="tapFocusIndicator")
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

function onKeyDown(event)
{
	ULBS()

    event = event || window.event

	// Prevent arrows/space from scrolling page
	if ( ( ! IDE ) && ([32, 37, 38, 39, 40]).includes(event.keyCode) )
	{
		if ( event && (event.ctrlKey || event.metaKey) )
		{
		}
		else
		{
			prevent(event)
		}
	}

	if ( ( ! IDE) && (event.keyCode === 77) ) // M
	{
		toggleMute()
	}

    if (keybuffer.includes(event.keyCode))
    	return

    if( (lastDownTarget === screen_layout.canvas) || (window.Mobile && (lastDownTarget === window.Mobile.focusIndicator) ) )
    {
    	if ( ! keybuffer.includes(event.keyCode) )
    	{
    		if ( event && (event.ctrlKey || event.metaKey || event.repeat) )
    		{
		    } else
		    {
    		    keybuffer.splice(keyRepeatIndex, 0, event.keyCode)
	    	    keyRepeatTimer = 0
	    	    checkKey(event, true)
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
			screen_layout.canvas.focus();
			editor.display.input.blur();
            if (event.shiftKey) {
				runClick()
			} else {
				rebuildClick()
			}
            prevent(event)
		}
	}
}

function onKeyUp(event)
{
	event = event || window.event
	var index = keybuffer.indexOf(event.keyCode)
	if (index >= 0)
	{
		keybuffer.splice(index, 1)
		if (keyRepeatIndex >= index)
		{
			keyRepeatIndex--
		}
    }
}

function onMyFocus(event)
{
	keybuffer = []
	keyRepeatIndex = 0
	keyRepeatTimer = 0
}

function onMyBlur(event)
{
	keybuffer = []
	keyRepeatIndex = 0
	keyRepeatTimer = 0
}

function mouseMove(event)
{	
	if (event.handled)
		return

	screen_layout.mouseMove(event)

	event.handled = true
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
	ULBS()
	
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
            inputdir=1;
	        break
        }
        case 38: //up
        case 87: //w
        {
            inputdir=0;
	        break
        }
        case 68://d
        case 39: //right
        {
            inputdir=3;
	        break
        }
        case 83://s
        case 40: //down
        {
            inputdir=2;
	        break
        }
        case 80://p
        {
			level.printToConsole()
        	break
        }
        case 13://enter
        case 32://space
        case 67://c
        case 88://x
        {
			if ( justPressed || (norepeat_action === false) )
			{
				inputdir = 4
				break
            }
			return
        }
		case 27://escape
		{
			if (screen_layout.content instanceof MenuScreen)
			{
				screen_layout.content.closeMenu()
			}
			else
			{
				pause_menu_screen.makePauseMenu()
				pause_menu_screen.openMenu()
			}
			return prevent(e)
			break
		}
        case 69: {//e
        	if (typeof level_editor_screen !== 'undefined') // can open editor
        	{
        		if (justPressed)
        		{
					level_editor_screen.toggle()
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
	if ( (inputdir != 4) || (state.levels.length === 0) )
		return false

	if (unitTesting)
	{
		nextLevel()
		return
	}

	if (this.done === false)
	{
		timer = 0
		this.done = true
		tryPlaySimpleSound('closemessage')
		this.doMessage()
		keybuffer = []
	}
	return false
}

MenuScreen.prototype.checkKey = function(e, inputdir)
{
	if ( (inputdir != 4) || this.done || (state.levels.length === 0) )
		return false

	if (this.select_soundname !== undefined)
	{
		tryPlaySimpleSound(this.select_soundname)
	}
	timer = 0
	this.done = true
	this.updateMenuItems()
	keybuffer = []
	if (this.menu_entries.length === 1)
	{
		canvasResize()
	}
	else
	{
		redraw()
	}
	return false
}


MenuScreen.prototype.checkRepeatableKey = function(e, inputdir)
{
	if ( this.done || (state.levels.length === 0) )
		return false

	if ( (inputdir === 0) || (inputdir === 2) )
	{
		this.item = clamp(0, this.item + ((inputdir === 0) ? -1 : 1), this.menu_entries.length - 1)
		this.updateMenuItems()
		redraw()
	}
	return false
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
		execution_context.doUndo()
		canvasResize() // calls redraw
		return true;
	}

	if ( againing || (inputdir < 0) )
		return false;

	if ( (inputdir === 4) && ('noaction' in state.metadata) )
		return true;

	pushInput(inputdir)
	if ( processInput(inputdir) )
	{
		redraw()
	}
	return true;
}

function update()
{
    timer += deltatime
    input_throttle_timer += deltatime
	if ( (screen_layout.content instanceof MenuScreen) && screen_layout.content.done && (timer/1000>0.3) )
	{
		screen_layout.content.doSelectedFunction()
	}
    if ( againing && (timer > againinterval) && (messagetext.length == 0) && processInput(processing_causes.again_frame) )
    {
		redraw()
		keyRepeatTimer = 0
		autotick = 0
    }
    if ( msg_screen.done && (timer/1000 > 0.15) )
    {
    	closeMessageScreen()
    }
    if (winning) {
        if (timer/1000>0.5) {
            winning=false;
            nextLevel();
        }
    }
    if (keybuffer.length > 0)
    {
	    keyRepeatTimer += deltatime
	    var ticklength = throttle_movement ? repeatinterval : repeatinterval/(Math.sqrt(keybuffer.length))
	    if (keyRepeatTimer > ticklength)
		{
			keyRepeatTimer = 0	
			keyRepeatIndex = (keyRepeatIndex+1) % keybuffer.length
			checkKey( { keyCode: keybuffer[keyRepeatIndex] }, false )
		}
	}

    if ( ! ( (autotickinterval <= 0) || screen_layout.noAutoTick() || againing || winning ) )
    {
        autotick += deltatime;
        if (autotick > autotickinterval)
        {
            autotick = 0;
            pushInput("tick");
            if (processInput(processing_causes.autotick))
            {
                redraw();
            }
        }
    }
}

function updateUpdate()
{
	update.interval = (document.visibilityState == 'visible') ? update.interval || setInterval(update, deltatime) : clearInterval(update.interval)
}
document.addEventListener('visibilitychange', updateUpdate)
updateUpdate()