var keyRepeatTimer=0;
var keyRepeatIndex=0;
var input_throttle_timer=0.0;
var lastinput=-100;


// GENERIC EVENT HANDLER
// =====================

window.addEventListener('focus', onMyFocusOrBlur, false)
window.addEventListener('blur', onMyFocusOrBlur, false)

function prevent(e)
{
	if (e.preventDefault) e.preventDefault();
	if (e.stopImmediatePropagation) e.stopImmediatePropagation();
	if (e.stopPropagation) e.stopPropagation();
	e.returnValue=false;
	return false;
}

function onMyFocusOrBlur(event)
{
	keybuffer = []
	keyRepeatIndex = 0
	keyRepeatTimer = 0
}


// MOUSE
// -----

EmptyScreen.prototype.leftMouseClick = () => -1 // event ignored
EmptyScreen.prototype.rightMouseClick = () => -1
EmptyScreen.prototype.mouseMove = (drag_state) => -1
EmptyScreen.prototype.hover = (coords) => null

ScreenLayout.prototype.handleEvent = function(event)
{
	if (event.handled)
		return

	const coords = (event.touches == null) ? event : event.touches[0]
	this.hover(coords)

	var result = -1
	var stop_event = (this.drag_state > 0)
	switch(event.type)
	{
		case 'touchstart':
		case 'mousedown':
			result = this.onMouseDown(event)
			stop_event = (result >= 0)
			this.event_listeners = [
				document.addEventListener('touchmove', this, false),
				document.addEventListener('mousemove', this, false),
			]
			break
		case 'touchmove':
		case 'mousemove':
			result = this.onMouseMove(event)
			break
		case 'touchend':
		case 'mouseup':
			result = this.onMouseUp(event)
			document.removeEventListener('touchmove', this.event_listeners[0])
			document.removeEventListener('mousemove', this.event_listeners[1])
	}

	switch (result)
	{
		case 2:
			this.resize_canvas()
			this.hover(coords)
		case 1:
			this.redraw()
		case 0:
		default:
	}
	if (stop_event)
		event.handled = true
}

ScreenLayout.prototype.register_listeners = function()
{
	this.drag_state = 0 // 0 = no dragging, 1 = left mouse dragging, 2 = right mouse dragging
	;(['touchstart', 'touchend', /*'touchmove',*/ 'mousedown', /*'mousemove'*/, 'mouseup']).forEach(
		n => this.canvas.addEventListener(n, this, false)
	)
}
screen_layout.register_listeners()

ScreenLayout.prototype.onMouseDown = function(event)
{
	ULBS();
	
	const lmb = (event.button === 0) || (event.type == 'touchstart')
	const rmb = (event.button === 2) || (lmb && (event.ctrlKey||event.metaKey))
	
	if (lmb && !rmb)
	{
        keybuffer=[];
        if (event.target===this.canvas || event.target.className==="tapFocusIndicator")
        {
        	const result = this.content.leftMouseClick()
        	if (result >= 0) // click event not ignored
        	{
				this.drag_state = 1
        		return result
        	}
        }
		this.drag_state = 0
    }
    else if (rmb)
    {
    	if (event.target===this.canvas || event.target.className==="tapFocusIndicator")
    	{
		    this.drag_state = 2
		    return this.content.rightMouseClick()
        }
	}
	
	return -1
}

function rightClickCanvas(event) // prevent opening contextual menu on right click in canvas
{
    return prevent(event)
}

ScreenLayout.prototype.onMouseMove = function(event)
{	
	return this.content.mouseMove(this.drag_state)
}

ScreenLayout.prototype.onMouseUp = function(event)
{
	this.drag_state = 0
	return -1
}



// KEYS
// ----

EmptyScreen.prototype.checkKey = (e, inputdir) => false
EmptyScreen.prototype.checkRepeatableKey = (e, inputdir) => false

document.addEventListener('keydown', onKeyDown, false)
document.addEventListener('keyup', onKeyUp, false)

function onKeyDown(event) // global key handler
{
	ULBS()

    event = event || window.event
	const has_modificator_key = event && (event.ctrlKey || event.metaKey)

	if ( ( ! IDE) && (event.keyCode === 77) ) // M
	{
		toggleMute()
	}

    if (keybuffer.includes(event.keyCode))
    	return

	if ( has_modificator_key && (canDump === true) )
	{
		switch (event.keyCode)
		{
			case 74: // ctrl+j
				dumpTestCase()
				break
			case 75: // ctrl+k
				makeGIF()
				break
			case 83: // ctrl+s
				saveClick()
				break
			case 13: // ctrl+enter
				screen_layout.canvas.focus()
				tabs.removeFocus()
				if (event.shiftKey) {
					runClick()
				} else {
					rebuildClick()
				}
				break
			default:
				return
		}
		prevent(event)
	}
	return false
}

function onKeyDownInCanvas(event)
{
	ULBS()

	event = event || window.event

	if (keybuffer.includes(event.keyCode))
		return

	if ( event && (event.ctrlKey || event.metaKey || event.repeat) )
		return

	keybuffer.splice(keyRepeatIndex, 0, event.keyCode)
	keyRepeatTimer = 0
	checkKey(event, true)
}
screen_layout.canvas.addEventListener('keydown', onKeyDownInCanvas, false)

function onKeyUp(event)
{
	event = event || window.event
	const index = keybuffer.indexOf(event.keyCode)
	if (index >= 0)
	{
		keybuffer.splice(index, 1)
		if (keyRepeatIndex >= index)
		{
			keyRepeatIndex--
		}
    }
}


function checkKey(e, justPressed) // only for when the canvas has focus
{
	ULBS()
	
    if (winning)
    	return
	if (e&&(e.ctrlKey || e.metaKey|| e.altKey))
		return
	
	let inputdir = Math.max(
		([38,37,40,39]).indexOf(e.keyCode), // up, left, down, right
		([87,65,83,68]).indexOf(e.keyCode), // wasd
	)
	if (inputdir < 0) switch(e.keyCode)
    {
        case 80://p
        { // TODO: should only work in the IDE?
			level.printToConsole()
        	break
        }
        case 13://enter
        case 32://space
        case 67://c
        case 88://x
        {
			if ( justPressed || (game_def.norepeat_action === false) )
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
		}
        case 69: {//e
        	if (typeof level_editor_screen !== 'undefined') // can open editor
        	{
        		if (justPressed)
        		{
					level_editor_screen.toggle()
        		}
        		return prevent(e)
        	}
            break
		}
    }

	// prevent repetition of direction keys before the throttle_movement time
    if ( game_def.throttle_movement && (inputdir >= 0) && (inputdir <= 3) )
    {
    	if ( (lastinput == inputdir) && (input_throttle_timer < repeatinterval) )
    		return;
		lastinput = inputdir;
		input_throttle_timer = 0;
    }
	if (justPressed && screen_layout.content.checkKey(e, inputdir))
		return prevent(e);
	if (screen_layout.content.checkRepeatableKey(e, inputdir))
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
		this.doMessage(curlevel.getMessage())
		keybuffer = []
		return true
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
	return true
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
		return true
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

	if ( (inputdir === 4) && (game_def.noaction) )
		return true;

	pushInput(inputdir)
	if ( processInput(inputdir) )
	{
		redraw()
	}
	return true;
}


// UPDATE LOOP
// -----------

function update()
{
    timer += deltatime
    input_throttle_timer += deltatime
	if ( (screen_layout.content instanceof MenuScreen) && screen_layout.content.done && (timer/1000>0.3) )
	{
		screen_layout.content.doSelectedFunction()
	}
    if ( againing && (timer > againinterval) && (execution_context.commandQueue.message === null) && processInput(processing_causes.again_frame) )
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
	    const ticklength = game_def.throttle_movement ? repeatinterval : repeatinterval/(Math.sqrt(keybuffer.length))
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