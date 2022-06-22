
// uses: state

const empty_terminal_line    = '                                  ';
const selected_terminal_line = '##################################';
const doted_terminal_line    = '..................................';

const terminal_width = empty_terminal_line.length
const terminal_height = 13

MenuScreen.prototype.isContinuePossible = function()
{
	if ( (this.curlevel === undefined) && (this.curlevelTarget === undefined) )
		return false
	// test is savepoint is valid (TODO: use unique ids for levels instead)
	const l = state.levels[this.curlevel.level]
	if (l === undefined)
		return false // some levels before save point have been deleted and now we're after the game
	const b = l.boxes[this.curlevel.box]
	return (b !== undefined) && (this.curlevel.msg < b.length) // box index is invalid or some messages have been deleted
}


function skipTextBox()
{
	const next_level = new LevelState(curlevel.level+((curlevel.box === 3) ? 1 : 0), 2, -1)
	if (next_level.level >= state.levels.length)
	{
		next_level.level--
		next_level.box = 3
		next_level.msg = state.levels[state.levels.length-1].boxes[3].length-1
	}
	loadLevelFromState(state, next_level)
}

function titleMenuNewGame()
{
	loadLevelFromState(state, (new LevelState()).next())
}

MenuScreen.prototype.titleMenuContinue = function()
{
	loadLevelFromState(state, this.curlevel, undefined, true, this.curlevelTarget)
}


function pauseMenuRestart()
{
	loadLevelFromState(state, curlevel)
}

MenuScreen.prototype.doSelectedFunction = function()
{
	this.done = false
	const func = this.menu_entries[this.item][1]
	this.updateMenuItems() // in case we need to come back to the menu after the selected function
	func()
}

MenuScreen.prototype.makeTerminalScreen = function()
{
	this.text = Array.from(
		{
			3: ' Pattern:Script Terminal ',
			4: ' v 1.7 ',
			8: ' insert cartridge ',
			length:terminal_height
		},
		l => [(l === undefined) ? doted_terminal_line : centerText(l, doted_terminal_line), '#ffffff']
	)
}

MenuScreen.prototype.makeMenuItems = function(nb_lines, menu_entries)
{
	this.done = false
	this.menu_entries = menu_entries
	const l = menu_entries.length - 1
	this.interline_size = Math.ceil( nb_lines / (l+1) )
	const menu_height = this.interline_size*l + 1
	this.first_menu_line = this.text.length + Math.floor( ( nb_lines - menu_height ) / 2)
	this.text.push( ...Array(nb_lines).fill(['', game_def.text_color]) )
	this.item = 0
	this.updateMenuItems()
}

MenuScreen.prototype.updateMenuItems = function()
{
	for (const [i, [item_text, item_function]] of this.menu_entries.entries())
	{
		this.text[this.first_menu_line + i*this.interline_size] = [centerText( item_text, empty_terminal_line), game_def.text_color]
	}
	this.text[this.first_menu_line + this.item*this.interline_size] = [centerText( '# '+this.menu_entries[this.item][0]+' #', this.done ? selected_terminal_line : empty_terminal_line), game_def.text_color]
}

MenuScreen.prototype.openMenu = function(previous_screen = screen_layout.content)
{
	this.escaped_screen = previous_screen
	screen_layout.content = this
	tryPlaySimpleSound(this.open_soundname)
	canvasResize()
}

MenuScreen.prototype.closeMenu = function()
{
	if (this.escaped_screen === null)
		return
	screen_layout.content = this.escaped_screen
	// TODO: closing the title screen back to the pause menu does not play pausescreen sound.
	canvasResize()
}

// sets: this.text
MenuScreen.prototype.makeTitle = function()
{
	if (state.levels.length === 0)
	{
		this.makeTerminalScreen()
		return
	}

	const title = (game_def.title !== undefined) ? game_def.title : 'Pattern:Script Game'

	const title_bottomline = 3
	const author_bottomline = 5
	const empty_line = ['', game_def.text_color]
	this.text = [ empty_line ]

	// Add title
	const max_title_height = (game_def.author === undefined) ? author_bottomline : title_bottomline
	var titlelines = wordwrap(title)
	if (titlelines.length > max_title_height)
	{
		titlelines.splice(max_title_height)
		logWarning(['title_truncated', max_title_height], undefined, true)
	}
	this.text.push(...titlelines.map( l => [centerText(l), game_def.title_color] ), ...Array(Math.max(0, max_title_height - titlelines.length - 1)).fill(empty_line))

	// Add author(s)
	if (game_def.author !== undefined)
	{
		var attributionsplit = wordwrap('by ' + game_def.author)
		if (attributionsplit[0].length < terminal_width)
		{
			attributionsplit[0] = " " + attributionsplit[0];
		}
		if (attributionsplit.length > author_bottomline - title_bottomline)
		{
			attributionsplit.splice(author_bottomline - title_bottomline)
			logWarning('Author list too long to fit on screen, truncating to three lines.', undefined, true)
		}
		this.text.push(...attributionsplit.map( l => [alignTextRight(l, Math.max(l.length - terminal_width, 1)), game_def.author_color] ))
		// I prefer them centered:
		// this.text.push(...attributionsplit.map( l => centerText(l) ))
	}
	this.text.push( ...Array(author_bottomline - this.text.length).fill(empty_line) )

	// Add menu options
	this.makeMenuItems(3,  this.isContinuePossible() ? [['continue from '+state.levels[this.curlevel.level].name, () => this.titleMenuContinue()], ['new game', titleMenuNewGame]] : [['start', titleMenuNewGame]])
	this.text.push( empty_line )

	// Add key configuration info:
	this.text.push( [alignTextLeft('arrow keys to move'), game_def.keyhint_color] )
	this.text.push( [alignTextLeft( game_def.noaction ? 'X to select' : 'X to select / action'), game_def.keyhint_color] )
	var msgs = []
	if ( ! game_def.noundo )
		msgs.push('Z to undo')
	if ( ! game_def.norestart )
		msgs.push('R to restart')
	this.text.push( [alignTextLeft( msgs.join(', ') ), game_def.keyhint_color] )

	this.text.push(empty_line)
}

function centerText(txt, context=empty_terminal_line)
{
	return alignTextLeft(txt, Math.max(0, Math.floor((terminal_width - txt.length)/2)), context)
}

function alignTextLeft(txt, lmargin=7, context=empty_terminal_line)
{
	return context.slice(0, lmargin) + txt + context.slice(txt.length + lmargin)
}

function alignTextRight(txt, rmargin=1, context=empty_terminal_line)
{
	return context.slice(0, -rmargin - txt.length) + txt + context.slice(context.length - rmargin)
}

function wordwrap(str, width = terminal_width)
{
	if (!str) { return str; }
 
	const regex = '.{1,'+width+'}(\\s|$)|.{'+width+'}|.+$'
	// cont regex = '.{1,'+width+'}(\\s|$)|\\S+?(\\s|$)'
	return str.match( RegExp(regex, 'g') );
}

function wordwrapAndColor(str, color, width = terminal_width)
{
	return wordwrap(str, width).map(l => [centerText(l), color])
}


MenuScreen.prototype.makePauseMenu = function()
{
	const empty_line = [empty_terminal_line, game_def.text_color]
	const level = state.levels[curlevel.level]
	this.text = [ empty_line, [centerText('-< GAME PAUSED >-'), game_def.title_color], [centerText(level.name), game_def.title_color] ]
	if ( (game_def.show_level_title_in_menu) && (level.title.length > 0) )
	{
		let title = level.title
		if (title.length > empty_terminal_line.length)
			title = title.substring(0, empty_terminal_line.length - 1) + '…'
		this.text.push([centerText(title), game_def.title_color])
	}
	this.text.push( empty_line )
	this.makeMenuItems(
		terminal_height - 5,
		[
			['resume game', () => this.closeMenu()],
			(screen_layout.content.screen_type === 'text') ? ['skip text', skipTextBox] : ['replay level from the start', pauseMenuRestart],
			['exit to title screen', goToTitleScreen]
		]
	)
	this.text.push( empty_line )
}


// uses state
TextModeScreen.prototype.doMessage = function(message)
{
	message ||= this
	screen_layout.content = this
	const empty_line = [ empty_terminal_line, game_def.text_color ]

	this.text = Array(terminal_height).fill(empty_line)

	const offset = Math.max(0, Math.floor((terminal_height-2)/2) - Math.floor(message.text.length/2) )

	const count = Math.min(message.text.length, terminal_height - 1)
	this.text.splice(offset, count, ...message.text)

	if ( ! this.done )
	{
		this.text[clamp(10, count+1, 12)] = [centerText('X to continue'), game_def.keyhint_color]
	}
	
	canvasResize()
}