
var all_screen_types = []

function forceRegenImages()
{
	all_screen_types.forEach( s => {s.last_magnification = null} )
}

// Base class, implements an empty screen
function EmptyScreen(screen_type = 'empty')
{
	this.last_magnification = null
	this.screen_type = screen_type
	this.noAutoTick = true
	this.noSwipe = false
	this.alwaysAllowUndo = false
	this.dontDoWin = false
	all_screen_types.push(this)
}
EmptyScreen.prototype.get_virtual_screen_size = () => [ 0, 0 ]
EmptyScreen.prototype.redraw = () => null
EmptyScreen.prototype.updateResources = function(magnification)
{
	if (this.last_magnification !== magnification)
	{
		this.regenResources.call(this, magnification)
	}
	this.last_magnification = magnification
}
EmptyScreen.prototype.regenResources = (m) => null
EmptyScreen.prototype.leftMouseClick = (e) => false
EmptyScreen.prototype.rightMouseClick = (e) => false
EmptyScreen.prototype.mouseMove = (e) => null
EmptyScreen.prototype.checkKey = (e, inputdir) => false
EmptyScreen.prototype.checkRepeatableKey = (e, inputdir) => false
var empty_screen = new EmptyScreen()


// Text screen
function TextModeScreen()
{
	EmptyScreen.call(this, 'text')
	this.text = []
}
TextModeScreen.prototype = Object.create(EmptyScreen.prototype)
TextModeScreen.prototype.get_nb_tiles = () => [ terminal_width, terminal_height ]
TextModeScreen.prototype.get_virtual_screen_size = () => [ terminal_width*(font_width+1), terminal_height*(font_height+1) ]
var textmode_screen = new TextModeScreen()

// Menu screen, based on TextModeScreen
function MenuScreen()
{
	TextModeScreen.call(this, 'menu')
	this.nb_items = 1
	this.item = 0 //which item is currently highlighted/selected
	this.done = false //only highlighted. Will be set to true when action key is pressed.
}
MenuScreen.prototype = Object.create(TextModeScreen.prototype)
var menu_screen = new MenuScreen()

// Level screen, also base class for flickscreen and zoomscreen
function LevelScreen(screen_type = 'level')
{
	EmptyScreen.call(this, screen_type)
	this.noAutoTick = false
	this.spriteimages = []
}
LevelScreen.prototype = Object.create(EmptyScreen.prototype)
LevelScreen.prototype.get_nb_tiles = () => [ level.width, level.height ]
LevelScreen.prototype.get_virtual_screen_size = function()
{
	const [w,h] = this.get_nb_tiles()
	return [ w*sprite_width, h*sprite_height ];
}
LevelScreen.prototype.get_viewport = () => [0, 0, level.width, level.height]
var level_screen = new LevelScreen()

// Flick screen, also base class for zoomscreen (could be the reverse, it's just to reuse the methods)
function TiledWorldScreen(screen_type = 'flickscreen') { LevelScreen.call(this, screen_type) }
TiledWorldScreen.prototype = Object.create(LevelScreen.prototype)
TiledWorldScreen.prototype.get_nb_tiles = () => state.metadata.flickscreen
TiledWorldScreen.prototype.get_viewport = function()
{
	// TODO: oldflickscreendat is a global variable because it needs to be recorded for undos
	const playerPositions = getPlayerPositions();
	if (playerPositions.length == 0)
		return oldflickscreendat;

	const playerPosition = playerPositions[0];
	const px = Math.floor(playerPosition/level.height);
	const py = (playerPosition%level.height);

	const [w, h] = this.get_nb_tiles()
	const [mini, minj] = this.get_viewport_for_focus_point(px, py, w, h)
	const maxi = Math.min(mini + w, level.width);
	const maxj = Math.min(minj + h, level.height);
	oldflickscreendat = [mini, minj, maxi, maxj];
	return oldflickscreendat;
}
TiledWorldScreen.prototype.get_viewport_for_focus_point = (px, py, w, h) => [ Math.floor(px/w) * w, Math.floor(py/h) * h ]
var tiled_world_screen = new TiledWorldScreen()


// Zoom screen
function CameraOnPlayerScreen() { TiledWorldScreen.call(this, 'zoomscreen') }
CameraOnPlayerScreen.prototype = Object.create(TiledWorldScreen.prototype)
CameraOnPlayerScreen.prototype.get_nb_tiles = () => state.metadata.zoomscreen
CameraOnPlayerScreen.prototype.get_viewport_for_focus_point = (px, py, w, h) => [
	Math.max( 0, Math.min(px - Math.floor(w/2), level.width  - w) ),
	Math.max( 0, Math.min(py - Math.floor(h/2), level.height - h) )
]
var camera_on_player_screen = new CameraOnPlayerScreen()


// Main screen: has a virtual screen for content, magnifies and centers it
function ScreenLayout()
{
	// content of the virtual screen
	this.content = menu_screen
	// layout parameters
	this.magnification = 0
	this.margins = [ 0, 0]
}

ScreenLayout.prototype.resize = function(canvas_size)
{
	// Update layout parameters
	[this.magnification, this.margins] = centerAndMagnify(this.content.get_virtual_screen_size(), canvas_size)

	// Should we update sprites?
	this.content.updateResources(this.magnification)
}

ScreenLayout.prototype.leftMouseClick = function(event) { return this.content.leftMouseClick(event); }
ScreenLayout.prototype.rightMouseClick = function(event) { return this.content.rightMouseClick(event); }
ScreenLayout.prototype.mouseMove = function(event) { return this.content.mouseMove(event); }
ScreenLayout.prototype.checkKey = function(event, inputdir) { return this.content.checkKey(event, inputdir); }
ScreenLayout.prototype.checkRepeatableKey = function(event, inputdir) { return this.content.checkRepeatableKey(event, inputdir); }
ScreenLayout.prototype.noAutoTick = function() { return this.content.noAutoTick; }
ScreenLayout.prototype.noSwipe = function() { return this.content.noSwipe; }
ScreenLayout.prototype.alwaysAllowUndo = function() { return this.content.alwaysAllowUndo; }
ScreenLayout.prototype.dontDoWin = function() { return this.content.dontDoWin; }

var screen_layout = new ScreenLayout()
