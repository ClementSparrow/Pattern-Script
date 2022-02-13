
var all_screen_types = []

// Base class, implements an empty screen
function EmptyScreen(screen_type = 'empty')
{
	this.screen_type = screen_type
	this.noAutoTick = true
	this.noSwipe = false
	this.alwaysAllowUndo = false
	this.dontDoWin = false
	all_screen_types.push(this)
}
EmptyScreen.prototype.get_nb_tiles = () => [0, 0]
EmptyScreen.prototype.get_tile_size = () => [0, 0]
EmptyScreen.prototype.get_virtual_screen_size = function()
{
	const [w,h] = this.get_nb_tiles()
	const [tw,th] = this.get_tile_size()
	return [w*tw, h*th]
}
EmptyScreen.prototype.redraw_virtual_screen = (ctx) => null
var empty_screen = new EmptyScreen()


// Text screen
function TextModeScreen(screen_type = 'text')
{
	EmptyScreen.call(this, screen_type)
	this.text = []
	this.done = false // not yet pressed the key that would leave the screen
}
TextModeScreen.prototype = Object.create(EmptyScreen.prototype)
TextModeScreen.prototype.get_nb_tiles = () => [ terminal_width, terminal_height ]
TextModeScreen.prototype.get_tile_size = () => [font_width+1, font_height+1]
var msg_screen = new TextModeScreen()

// Menu screen, based on TextModeScreen
function MenuScreen(open_soundname, select_soundname)
{
	TextModeScreen.call(this, 'menu')
	this.menu_items = []
	this.item = 0 //which item is currently highlighted/selected
	this.open_soundname = open_soundname
	this.select_soundname = select_soundname
}
MenuScreen.prototype = Object.create(TextModeScreen.prototype)
var pause_menu_screen = new MenuScreen('pausescreen')
var title_screen = new MenuScreen('gamescreen', 'startgame')

// Level screen, also base class for flickscreen and zoomscreen
function LevelScreen(screen_type = 'level')
{
	EmptyScreen.call(this, screen_type)
	this.noAutoTick = false
}
LevelScreen.prototype = Object.create(EmptyScreen.prototype)
LevelScreen.prototype.get_nb_tiles = function() { return [this.level.width, this.level.height] }
LevelScreen.prototype.get_tile_size = () => [sprite_width, sprite_height]
LevelScreen.prototype.get_viewport = function() { return [0, 0, this.level.width, this.level.height] }
var level_screen = new LevelScreen()

// Flick screen, also base class for zoomscreen (could be the reverse, it's just to reuse the methods)
function TiledWorldScreen(screen_type = 'flickscreen') { LevelScreen.call(this, screen_type) }
TiledWorldScreen.prototype = Object.create(LevelScreen.prototype)
TiledWorldScreen.prototype.get_nb_tiles = () => state.metadata.flickscreen
TiledWorldScreen.prototype.get_viewport = function()
{
	// TODO: oldflickscreendat is a global variable because it needs to be recorded for undos
	const [w, h] = this.get_nb_tiles()
	const playerPositions = this.level.getPlayerPositions()
	if ( (playerPositions.length === 0) && (oldflickscreendat !== undefined) )
		return oldflickscreendat

	const playerPosition = playerPositions[0] || 0
	const [px, py] = this.level.cellCoord(playerPosition)

	const [mini, minj] = this.get_viewport_for_focus_point(px, py, w, h)
	const maxi = Math.min(mini + w, this.level.width)
	const maxj = Math.min(minj + h, this.level.height)
	oldflickscreendat = [mini, minj, maxi, maxj]
	return oldflickscreendat
}
TiledWorldScreen.prototype.get_viewport_for_focus_point = (px, py, w, h) => [ Math.floor(px/w) * w, Math.floor(py/h) * h ]
var tiled_world_screen = new TiledWorldScreen()


// Zoom screen
function CameraOnPlayerScreen() { TiledWorldScreen.call(this, 'zoomscreen') }
CameraOnPlayerScreen.prototype = Object.create(TiledWorldScreen.prototype)
CameraOnPlayerScreen.prototype.get_nb_tiles = function()
{
	const [w, h] = state.metadata.zoomscreen
	return [ Math.min(w, this.level.width), Math.min(h, this.level.height) ]
}
CameraOnPlayerScreen.prototype.get_viewport_for_focus_point = (px, py, w, h) => [
	clamp(0, px - Math.floor(w/2), this.level.width  - w),
	clamp(0, py - Math.floor(h/2), this.level.height - h)
]
var camera_on_player_screen = new CameraOnPlayerScreen()


// Main screen: has a virtual screen for content, magnifies and centers it
function ScreenLayout(canvas)
{
	// content of the virtual screen
	this.content = title_screen
	// layout parameters
	this.magnification = 0
	this.margins = [0, 0]
	// drawing
	this.canvas = canvas
	this.ctx = this.canvas.getContext('2d')
	this.virtual_screen_canvas = document.createElement('canvas')
	this.vc_ctx = this.virtual_screen_canvas.getContext('2d')
	window.addEventListener('resize',  () => this.resize_canvas(), false)
}

ScreenLayout.prototype.noAutoTick = function() { return this.content.noAutoTick; }
ScreenLayout.prototype.noSwipe = function() { return this.content.noSwipe; }
ScreenLayout.prototype.alwaysAllowUndo = function() { return this.content.alwaysAllowUndo; }
ScreenLayout.prototype.dontDoWin = function() { return this.content.dontDoWin; }

